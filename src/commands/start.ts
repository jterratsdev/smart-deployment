/**
 * smart-deployment:start command
 * Main deployment command that orchestrates the entire workflow
 *
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 * @ac US-046-AC-4: Supports --target-org flag
 * @ac US-046-AC-5: Supports --dry-run flag
 * @ac US-046-AC-6: Supports --validate-only flag
 * @ac US-046-AC-7: Supports --skip-tests flag
 * @ac US-046-AC-8: Shows progress bar
 * @ac US-046-AC-9: Generates deployment report
 * @ac US-046-AC-10: Handles failures gracefully
 *
 * @issue #46
 */

import { type Interfaces } from '@oclif/core';
import { Messages } from '@salesforce/core';
import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../utils/logger.js';
import { StartExecutionService } from '../deployment/start-execution-service.js';
import { DeploymentContextService } from '../deployment/deployment-context-service.js';
import { ProjectAnalysisPresenter } from '../presentation/project-analysis-presenter.js';
import { StartCommandPresenter } from '../presentation/start-command-presenter.js';
import { DeploymentPlanReportService } from '../reports/deployment-plan-report-service.js';
import { RollbackPlanningService, type RollbackExecutionPlan } from '../deployment/rollback-planning-service.js';
import type { CommitScopeOptions } from '../deployment/commit-scope-service.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('@jterrats/smart-deployment', 'start');
const logger = getLogger('StartCommand');
const deploymentContextService = new DeploymentContextService();
const startExecutionService = new StartExecutionService();
const projectAnalysisPresenter = new ProjectAnalysisPresenter();
const presenter = new StartCommandPresenter();
const deploymentPlanReportService = new DeploymentPlanReportService();
const rollbackPlanningService = new RollbackPlanningService();

/**
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 */
type StartResult = {
  success: boolean;
  waves: number;
  reports?: {
    jsonPath: string;
    htmlPath: string;
  };
  commitScope?: {
    enabled: boolean;
    commits: string[];
    changedComponents: string[];
    dependencyComponents: string[];
    includedComponents: string[];
    ignoredComponents: string[];
  };
  rollback?: {
    enabled: boolean;
    from: string;
    to: string;
    destructiveComponents: string[];
    restoreComponents: string[];
  };
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    aiAdjustments?: number;
    unknownTypes?: string[];
    fallback?: boolean;
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
};

export default class Start extends SfCommand<StartResult> {
  public static readonly aliases = ['smart-deployment start'];
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  /**
   * @ac US-046-AC-4: Supports --target-org flag
   * @ac US-046-AC-5: Supports --dry-run flag
   * @ac US-046-AC-6: Supports --validate-only flag
   * @ac US-046-AC-7: Supports --skip-tests flag
   * @ac US-057-AC-1: Send component list to Agentforce
   */
  public static readonly flags: Interfaces.FlagInput = {
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      char: 'd',
      default: false,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      char: 'v',
      default: false,
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      char: 's',
      default: false,
    }),
    'source-path': Flags.string({
      summary: messages.getMessage('flags.source-path.summary'),
      description: messages.getMessage('flags.source-path.description'),
    }),
    'report-dir': Flags.string({
      summary: messages.getMessage('flags.report-dir.summary'),
      description: messages.getMessage('flags.report-dir.description'),
    }),
    'allow-cycle-remediation': Flags.boolean({
      summary: messages.getMessage('flags.allow-cycle-remediation.summary'),
      description: messages.getMessage('flags.allow-cycle-remediation.description'),
      default: false,
    }),
    'use-ai': Flags.boolean({
      summary: messages.getMessage('flags.use-ai.summary'),
      description: messages.getMessage('flags.use-ai.description'),
      default: false,
    }),
    'org-type': Flags.string({
      summary: messages.getMessage('flags.org-type.summary'),
      description: messages.getMessage('flags.org-type.description'),
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: messages.getMessage('flags.industry.summary'),
      description: messages.getMessage('flags.industry.description'),
    }),
    'scope-commits': Flags.string({
      summary: messages.getMessage('flags.scope-commits.summary'),
      description: messages.getMessage('flags.scope-commits.description'),
    }),
    'scope-manifest': Flags.string({
      summary: messages.getMessage('flags.scope-manifest.summary'),
      description: messages.getMessage('flags.scope-manifest.description'),
    }),
    destructive: Flags.boolean({
      summary: messages.getMessage('flags.destructive.summary'),
      description: messages.getMessage('flags.destructive.description'),
      default: false,
    }),
    'rollback-from': Flags.string({
      summary: messages.getMessage('flags.rollback-from.summary'),
      description: messages.getMessage('flags.rollback-from.description'),
    }),
    'rollback-to': Flags.string({
      summary: messages.getMessage('flags.rollback-to.summary'),
      description: messages.getMessage('flags.rollback-to.description'),
    }),
  };

  /**
   * @ac US-046-AC-8: Shows progress bar
   * @ac US-046-AC-9: Generates deployment report
   * @ac US-046-AC-10: Handles failures gracefully
   */
  public async run(): Promise<StartResult> {
    const { flags } = await this.parse(Start);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const commitScope = this.getCommitScopeOptions(flags);
    const rollbackOptions = this.getRollbackOptions(flags);
    let rollbackPlan: RollbackExecutionPlan | undefined;

    try {
      logger.info('Starting smart deployment', { flags: this.toLoggableFlags(flags) });

      this.log('📊 Analyzing metadata...');
      const deploymentContext = await deploymentContextService.buildContext({
        sourcePath,
        useAI: Boolean(flags['use-ai']),
        orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
        industry: typeof flags.industry === 'string' ? flags.industry : undefined,
        commitScope,
      });
      if (rollbackOptions) {
        rollbackPlan = await rollbackPlanningService.buildExecutionPlan({
          projectRoot: deploymentContext.scanResult.projectRoot,
          fromRef: rollbackOptions.from,
          toRef: rollbackOptions.to,
          currentContext: deploymentContext,
          buildContext: async (rollbackSourcePath) =>
            deploymentContextService.buildContext({
              sourcePath: rollbackSourcePath,
              useAI: Boolean(flags['use-ai']),
              orgType: typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
              industry: typeof flags.industry === 'string' ? flags.industry : undefined,
            }),
        });
      }
      projectAnalysisPresenter.reportDiagnostics(this, deploymentContext.scanResult, deploymentContext.messages);
      const metadataCount = deploymentContext.scanResult.components.length;
      const waves = deploymentContext.orderedWaves.length;
      presenter.reportAnalysisSummary(this, {
        metadataCount,
        waves,
        aiEnabled: Boolean(flags['use-ai']),
      });

      const executionTargets = rollbackPlan
        ? [
            { deploymentContext: rollbackPlan.destructiveContext, destructive: true },
            { deploymentContext: rollbackPlan.restoreContext, destructive: false },
          ].filter((target): target is { deploymentContext: typeof deploymentContext; destructive: boolean } =>
            Boolean(target.deploymentContext)
          )
        : [{ deploymentContext, destructive: flags.destructive === true }];

      await executionTargets.reduce<Promise<void>>(async (previous, target) => {
        await previous;
        const executionOptions = {
          dryRun: flags['dry-run'] === true,
          validateOnly: flags['validate-only'] === true,
          allowCycleRemediation: flags['allow-cycle-remediation'] === true,
          skipTests: flags['skip-tests'] === true,
          destructive: target.destructive,
          targetOrg: this.getTargetOrgIdentifier(flags['target-org']),
          sourcePath: target.deploymentContext.scanResult.projectRoot,
          deploymentContext: target.deploymentContext,
          log: this.log.bind(this),
        } as const;

        if (!executionOptions.dryRun && !executionOptions.validateOnly) {
          presenter.reportExecutionStart(this);
        }
        const executionResult = await startExecutionService.execute(executionOptions);
        if (executionResult.kind === 'skipped') {
          presenter.reportExecutionSkipped(this, executionResult.reason);
        }
      }, Promise.resolve());

      const reportOptions = {
        reportDir: typeof flags['report-dir'] === 'string' ? flags['report-dir'] : undefined,
        targetOrg: this.getTargetOrgIdentifier(flags['target-org']),
        sourcePath,
        dryRun: flags['dry-run'] === true,
        validateOnly: flags['validate-only'] === true,
        destructive: flags.destructive === true || rollbackPlan !== undefined,
        skipTests: flags['skip-tests'] === true,
      };

      presenter.reportReportGenerationStart(this);
      const reportResult =
        reportOptions.dryRun || reportOptions.validateOnly
          ? await deploymentPlanReportService.generate(deploymentContext, reportOptions)
          : undefined;
      presenter.reportDeploymentReport(this, waves);
      if (reportResult) {
        presenter.reportPlanReportsSaved(this, reportResult);
      }

      return {
        success: true,
        waves,
        reports: reportResult ? { jsonPath: reportResult.jsonPath, htmlPath: reportResult.htmlPath } : undefined,
        commitScope: deploymentContext.commitScope,
        rollback: rollbackPlan
          ? {
              enabled: true,
              from: rollbackPlan.summary.from,
              to: rollbackPlan.summary.to,
              destructiveComponents: rollbackPlan.summary.destructiveComponents,
              restoreComponents: rollbackPlan.summary.restoreComponents,
            }
          : undefined,
        ai: deploymentContext.aiContext,
      };
    } catch (error) {
      // AC-10: Handle failures gracefully
      logger.error('Deployment failed', { error });
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    } finally {
      await rollbackPlan?.cleanup();
    }
  }

  private getCommitScopeOptions(flags: Record<string, unknown>): CommitScopeOptions | undefined {
    const commits = typeof flags['scope-commits'] === 'string' ? [flags['scope-commits']] : undefined;
    const manifestPath = typeof flags['scope-manifest'] === 'string' ? flags['scope-manifest'] : undefined;

    return commits !== undefined || manifestPath !== undefined ? { commits, manifestPath } : undefined;
  }

  private getRollbackOptions(flags: Record<string, unknown>): { from: string; to: string } | undefined {
    const from = typeof flags['rollback-from'] === 'string' ? flags['rollback-from'] : undefined;
    const to = typeof flags['rollback-to'] === 'string' ? flags['rollback-to'] : undefined;

    if ((from === undefined) !== (to === undefined)) {
      throw new Error('Rollback requires both --rollback-from and --rollback-to.');
    }

    return from && to ? { from, to } : undefined;
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

  private toLoggableFlags(flags: Record<string, unknown>): Record<string, string | boolean | undefined> {
    return {
      'target-org': this.getTargetOrgIdentifier(flags['target-org']),
      'dry-run': flags['dry-run'] === true,
      'validate-only': flags['validate-only'] === true,
      'skip-tests': flags['skip-tests'] === true,
      'source-path': typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined,
      'report-dir': typeof flags['report-dir'] === 'string' ? flags['report-dir'] : undefined,
      'allow-cycle-remediation': flags['allow-cycle-remediation'] === true,
      'use-ai': flags['use-ai'] === true,
      'org-type': typeof flags['org-type'] === 'string' ? flags['org-type'] : undefined,
      industry: typeof flags.industry === 'string' ? flags.industry : undefined,
      'scope-commits': typeof flags['scope-commits'] === 'string' ? flags['scope-commits'] : undefined,
      'scope-manifest': typeof flags['scope-manifest'] === 'string' ? flags['scope-manifest'] : undefined,
      destructive: flags.destructive === true,
      'rollback-from': typeof flags['rollback-from'] === 'string' ? flags['rollback-from'] : undefined,
      'rollback-to': typeof flags['rollback-to'] === 'string' ? flags['rollback-to'] : undefined,
    };
  }
}
