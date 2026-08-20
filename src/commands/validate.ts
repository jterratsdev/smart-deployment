/**
 * smart-deployment:validate command - US-048
 *
 * @ac US-048-AC-1: Builds and validates a local wave plan
 * @ac US-048-AC-2: Validates generated wave ordering and risk signals
 * @ac US-048-AC-3: Reports validation errors
 * @ac US-048-AC-4: Supports --target-org flag
 * @ac US-048-AC-5: Shows estimated deployment time
 * @ac US-048-AC-6: Does not execute Salesforce deployment validation
 * @issue #48
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand, optionalOrgFlagWithDeprecations } from '@salesforce/sf-plugins-core';
import type { CommitScopeOptions } from '../deployment/commit-scope-service.js';
import { DeploymentValidationService } from '../deployment/deployment-validation-service.js';
import { ValidateCommandPresenter } from '../presentation/validate-command-presenter.js';
import { ReleaseReportCommandAdapter } from '../reports/release-report-command-adapter.js';
import { buildValidationReportFacts } from '../reports/release-report-facts-factory.js';
import type { MetadataDependencyKind } from '../types/metadata.js';
import type { ReleaseReportV1 } from '../types/release-report.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('ValidateCommand');
Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'validate');
const presenter = new ValidateCommandPresenter();
const releaseReportAdapter = new ReleaseReportCommandAdapter();

type ValidateResult = {
  success: boolean;
  components: number;
  dependencies: number;
  dependencyBreakdown: Record<MetadataDependencyKind, number>;
  waves: number;
  issueCount: number;
  commitScope?: {
    commits: string[];
    changedComponents: string[];
    dependencyComponents: string[];
    explicitComponents: string[];
    includedComponents: string[];
    ignoredComponents: string[];
    manifestPath?: string;
  };
  ai?: {
    analyzed: boolean;
    provider?: string;
    model?: string;
    fallback?: boolean;
    overallRisk?: 'low' | 'medium' | 'high' | 'critical';
  };
  releaseReport?: ReleaseReportV1;
  releaseReportPath?: string;
  releaseReportWarning?: string;
};

export default class Validate extends SfCommand<ValidateResult> {
  public static readonly aliases = ['smart-deployment validate'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly examples = messages.getMessages('examples');
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': optionalOrgFlagWithDeprecations,
    'source-path': Flags.directory({
      summary: messages.getMessage('flags.source-path.summary'),
      exists: true,
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      default: false,
    }),
    'scope-commits': Flags.string({
      summary: messages.getMessage('flags.scope-commits.summary'),
    }),
    'scope-manifest': Flags.string({
      summary: messages.getMessage('flags.scope-manifest.summary'),
    }),
    'scope-manifest-output': Flags.string({
      summary: messages.getMessage('flags.scope-manifest-output.summary'),
      description: messages.getMessage('flags.scope-manifest-output.description'),
    }),
  };

  public async run(): Promise<ValidateResult> {
    const { flags } = await this.parse(Validate);
    const validationService = new DeploymentValidationService();
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const useAI = flags['use-ai'] === true;
    const commitScope = this.getCommitScopeOptions(flags);

    logger.info('Validating wave plan', { flags });

    const summary = await validationService.validateProject(sourcePath, {
      useAI,
      commitScope,
    });
    if (!this.jsonEnabled()) presenter.reportValidationResult(this, summary);

    const result: ValidateResult = {
      success: summary.valid,
      components: summary.components,
      dependencies: summary.dependencies,
      dependencyBreakdown: summary.dependencyBreakdown,
      waves: summary.totalWaves,
      issueCount: summary.issues.length,
      commitScope: summary.commitScope,
      ai: useAI
        ? {
            analyzed: summary.aiAnalyzed ?? false,
            provider: summary.aiProvider,
            model: summary.aiModel,
            fallback: summary.aiFallback,
            overallRisk: summary.overallRisk,
          }
        : undefined,
    };
    const targetOrg = this.getTargetOrgIdentifier(flags['target-org']);
    const releaseReport = await releaseReportAdapter.finalize(
      this,
      { kind: 'succeeded', value: result },
      buildValidationReportFacts(summary, targetOrg, useAI),
      { projectRoot: summary.projectRoot }
    );
    return { ...result, ...releaseReport };
  }

  private getCommitScopeOptions(flags: Record<string, unknown>): CommitScopeOptions | undefined {
    const commits = typeof flags['scope-commits'] === 'string' ? [flags['scope-commits']] : undefined;
    const manifestPath = typeof flags['scope-manifest'] === 'string' ? flags['scope-manifest'] : undefined;
    const outputManifestPath =
      typeof flags['scope-manifest-output'] === 'string' ? flags['scope-manifest-output'] : undefined;

    return commits !== undefined || manifestPath !== undefined || outputManifestPath !== undefined
      ? { commits, manifestPath, outputManifestPath }
      : undefined;
  }

  private getTargetOrgIdentifier(value: unknown): string | undefined {
    if (typeof value === 'string' && value.length > 0) return value;
    if (typeof value === 'object' && value !== null && 'getUsername' in value) {
      const getUsername = (value as { getUsername: () => string }).getUsername;
      return typeof getUsername === 'function' ? getUsername.call(value) : undefined;
    }
    return undefined;
  }
}
