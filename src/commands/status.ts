/**
 * smart-deployment:status command - US-050
 *
 * @ac US-050-AC-1: Shows current wave number
 * @ac US-050-AC-2: Shows completed waves
 * @ac US-050-AC-3: Shows remaining waves
 * @ac US-050-AC-4: Shows estimated time remaining
 * @ac US-050-AC-5: Shows test execution status
 * @ac US-050-AC-6: Refreshes automatically
 * @issue #50
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { DeploymentStatusService } from '../deployment/deployment-status-service.js';
import { StatusCommandPresenter } from '../presentation/status-command-presenter.js';
import { getLogger } from '../utils/logger.js';
import { StateManager } from '../deployment/state-manager.js';
import type { WaveGraph } from '../waves/wave-graph.js';

const logger = getLogger('StatusCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'status');
const presenter = new StatusCommandPresenter();

type StatusResult = {
  currentWave: number;
  totalWaves: number;
  completedWaves: number[];
  remainingWaves: number;
  status: string;
  canResume: boolean;
  waveGraph?: WaveGraph;
  ai?: {
    provider?: string;
    model?: string;
    fallback?: boolean;
    aiAdjustments?: number;
    unknownTypes?: string[];
    inferenceFallback?: boolean;
    inferredDependencies?: number;
  };
};

export default class Status extends SfCommand<StatusResult> {
  public static readonly aliases = ['smart-deployment status'];
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
  };

  public async run(): Promise<StatusResult> {
    const parseResult = await this.parse(Status);
    const { flags } = parseResult;
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);

    try {
      logger.info('Getting status', { flags });

      const statusService = new DeploymentStatusService(new StateManager({ baseDir: sourcePath }));
      const summary = await statusService.getStatus({ refreshRemote: targetOrg !== undefined, targetOrg });
      const formattedStatus = statusService.formatStatus(summary);

      if (!this.jsonEnabled()) presenter.reportStatus(this, summary, formattedStatus);

      if (!summary.hasState) {
        return {
          currentWave: 0,
          totalWaves: 0,
          completedWaves: [],
          remainingWaves: 0,
          status: 'Not Started',
          canResume: false,
        };
      }

      const result: StatusResult = {
        currentWave: summary.currentWave,
        totalWaves: summary.totalWaves,
        completedWaves: summary.completedWaves,
        remainingWaves: summary.remainingWaves.length,
        status:
          summary.status === 'in-progress'
            ? 'In Progress'
            : summary.status === 'failed'
            ? 'Failed'
            : summary.status === 'completed'
            ? 'Completed'
            : summary.status === 'paused'
            ? 'Paused'
            : 'Not Started',
        canResume: summary.resumable,
        waveGraph: summary.waveGraph,
      };

      if (summary.hasState && summary.status !== 'not-started') {
        const stateSummary = await new StateManager({ baseDir: sourcePath }).loadState();
        if (stateSummary?.metadata) {
          result.ai = {
            provider:
              typeof stateSummary.metadata.aiProvider === 'string' ? stateSummary.metadata.aiProvider : undefined,
            model: typeof stateSummary.metadata.aiModel === 'string' ? stateSummary.metadata.aiModel : undefined,
            fallback:
              typeof stateSummary.metadata.aiFallback === 'boolean' ? stateSummary.metadata.aiFallback : undefined,
            aiAdjustments:
              typeof stateSummary.metadata.aiAdjustments === 'number' ? stateSummary.metadata.aiAdjustments : undefined,
            unknownTypes: Array.isArray(stateSummary.metadata.aiUnknownTypes)
              ? stateSummary.metadata.aiUnknownTypes.filter((item): item is string => typeof item === 'string')
              : undefined,
            inferenceFallback:
              typeof stateSummary.metadata.aiInferenceFallback === 'boolean'
                ? stateSummary.metadata.aiInferenceFallback
                : undefined,
            inferredDependencies:
              typeof stateSummary.metadata.aiInferredDependencies === 'number'
                ? stateSummary.metadata.aiInferredDependencies
                : undefined,
          };
        }
      }

      return result;
    } catch (error) {
      logger.error('Status failed', { error });
      this.error(`Status failed: ${error instanceof Error ? error.message : String(error)}`);
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
}
