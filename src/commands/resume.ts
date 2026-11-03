/**
 * smart-deployment:resume command - US-049
 *
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 * @issue #49
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { ResumeDeploymentService, type ResumeRetryStrategy } from '../deployment/resume-deployment-service.js';
import { ResumeCommandPresenter } from '../presentation/resume-command-presenter.js';
import { getLogger } from '../utils/logger.js';
import { StateManager } from '../deployment/state-manager.js';
import type { ReleaseReportCommandOutput } from '../reports/release-report-command-adapter.js';
import { ResumeResultProjector, type ResumeCommandResult } from '../presentation/resume-result-projector.js';
import { ResumeReleaseReportCoordinator } from '../reports/resume-release-report-coordinator.js';

const logger = getLogger('ResumeCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'resume');
const presenter = new ResumeCommandPresenter();
const resultProjector = new ResumeResultProjector();
const releaseReportCoordinator = new ResumeReleaseReportCoordinator();

type ResumeResult = ResumeCommandResult & ReleaseReportCommandOutput;

export default class Resume extends SfCommand<ResumeResult> {
  public static readonly aliases = ['smart-deployment resume'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
    }),
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    'retry-strategy': Flags.string({
      summary: messages.getMessage('flags.retry-strategy.summary'),
      options: ['standard', 'quick', 'validate-only'],
      default: 'standard',
    }),
    'approve-checkpoint': Flags.string({
      summary: messages.getMessage('flags.approve-checkpoint.summary'),
    }),
  };

  public async run(): Promise<ResumeResult> {
    const parseResult = await this.parse(Resume);
    const { flags } = parseResult;
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);

    try {
      logger.info('Resuming deployment', { flags });

      const retryStrategy = flags['retry-strategy'] as ResumeRetryStrategy;
      const stateManager = new StateManager({ baseDir: sourcePath });
      const resumeService = new ResumeDeploymentService(stateManager);
      if (typeof flags['approve-checkpoint'] === 'string') {
        const state = await new StateManager({ baseDir: sourcePath }).loadState();
        const result = await resumeService.resumeCheckpoint({
          approveCheckpoint: flags['approve-checkpoint'],
          targetOrg,
          sourcePath,
        });
        return await this.finalizeReport(resultProjector.project(state, result), sourcePath, targetOrg);
      }
      const state = await stateManager.loadState();
      if (state?.pausedPostcondition && state.execution) {
        const result = await resumeService.resumePostcondition({ targetOrg, sourcePath });
        const response = resultProjector.project(state, result);
        if (!this.jsonEnabled() && response.postcondition) {
          presenter.reportPostcondition(this, response.postcondition);
        }
        return await this.finalizeReport(response, sourcePath, targetOrg);
      }
      if (state?.failedWave && state.execution) {
        const result = await resumeService.resumeFailedWaves({ targetOrg, sourcePath });
        return await this.finalizeReport(resultProjector.project(state, result), sourcePath, targetOrg);
      }
      const summary = await resumeService.prepareResume(retryStrategy, { targetOrg });
      if (!this.jsonEnabled()) presenter.reportResumePreparation(this, summary, retryStrategy);

      return await this.finalizeReport(
        {
          success: true,
          resumedFromWave: summary.currentWave,
          remainingWaves: summary.remainingWaves,
          deploymentId: summary.deploymentId,
          outcome: 'prepared',
        },
        sourcePath,
        targetOrg
      );
    } catch (error) {
      logger.error('Resume failed', { error });
      this.error(`Resume failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) {
      return value;
    }

    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername: () => string }).getUsername;
      return typeof getUsername === 'function' ? getUsername.call(value) : undefined;
    }

    return undefined;
  }

  private async finalizeReport(
    result: ResumeCommandResult,
    sourcePath: string | undefined,
    targetOrg: string | undefined
  ): Promise<ResumeResult> {
    return releaseReportCoordinator.finalize(this, result, { sourcePath, targetOrg });
  }
}
