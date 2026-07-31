import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import {
  SpecialDeploymentPlanExecutor,
  type SpecialDeploymentExecutionResult,
} from '../deployment/special-deployment-executor.js';
import { SpecialDeploymentPlanService, type SpecialDeploymentPlan } from '../deployment/special-deployment-plan.js';
import {
  ReleaseReportCommandAdapter,
  type ReleaseReportCommandOutput,
} from '../reports/release-report-command-adapter.js';
import { buildCiPublishReportFacts } from '../reports/release-report-facts-factory.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('CiPublishCommand');
const releaseReportAdapter = new ReleaseReportCommandAdapter();

type CiPublishResult = SpecialDeploymentPlan & ReleaseReportCommandOutput;

export default class CiPublish extends SfCommand<CiPublishResult> {
  public static readonly aliases = ['smart-deployment ci-publish'];
  public static readonly summary = 'Build a coordinated metadata, Agentforce, LWR, and OmniStudio publish plan for CI.';

  public static readonly examples = [
    '<%= config.bin %> <%= command.id %> --since origin/main --dry-run',
    '<%= config.bin %> <%= command.id %> --source-path force-app --target-org release --since HEAD~1 --json',
  ];

  public static readonly flags = {
    'source-path': Flags.string({
      summary: 'Path inside a Salesforce DX project to scan.',
    }),
    since: Flags.string({
      summary: 'Git revision used as the previous green deploy SHA for change detection.',
    }),
    'target-org': Flags.string({
      char: 'o',
      summary: 'Target org alias or username used for deploy commands and org preflight checks.',
    }),
    'dry-run': Flags.boolean({
      summary: 'Print the coordinated publish plan without executing external commands.',
      default: true,
      allowNo: true,
    }),
    'auto-activate': Flags.boolean({
      summary: 'Include Agentforce activation commands after authoring bundle publish.',
      default: false,
    }),
  };

  public async run(): Promise<CiPublishResult> {
    const { flags } = await this.parse(CiPublish);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const since = typeof flags.since === 'string' ? flags.since : undefined;
    const targetOrg = typeof flags['target-org'] === 'string' ? flags['target-org'] : undefined;
    const dryRun = flags['dry-run'] !== false;
    const autoActivate = flags['auto-activate'] === true;

    logger.info('Building CI publish plan', { sourcePath, since, targetOrg, dryRun, autoActivate });

    const plan = await new SpecialDeploymentPlanService().buildPlan({
      sourcePath,
      since,
      targetOrg,
      dryRun,
      autoActivate,
    });

    this.reportPlan(plan);
    let execution: SpecialDeploymentExecutionResult | undefined;
    let resultPlan = plan;
    let executionFailure: string | undefined;
    if (!dryRun) {
      execution = await new SpecialDeploymentPlanExecutor().execute(plan);
      if (!execution.success) {
        const message = execution.errors[0] ?? 'Coordinated publish failed.';
        executionFailure = message;
        resultPlan = {
          ...plan,
          success: false,
          errors: [...plan.errors, message],
        };
        this.reportExecutionFailure(execution.failedPhase, execution.exitCode, message);
      } else {
        this.log('');
        this.log('Coordinated publish execution completed successfully.');
      }
    }

    const result = await this.finalizeReleaseReport(resultPlan, execution);
    if (executionFailure) this.error(executionFailure);
    return result;
  }

  private async finalizeReleaseReport(
    plan: SpecialDeploymentPlan,
    execution: SpecialDeploymentExecutionResult | undefined
  ): Promise<CiPublishResult> {
    const releaseReport = await releaseReportAdapter.finalize(
      this,
      { kind: 'succeeded', value: plan },
      buildCiPublishReportFacts(plan, execution),
      { projectRoot: plan.projectRoot }
    );
    return { ...plan, ...releaseReport };
  }

  private reportPlan(plan: SpecialDeploymentPlan): void {
    this.log('Coordinated publish plan');
    this.log(`Project: ${plan.projectRoot}`);
    this.log(`Mode: ${plan.dryRun ? 'dry-run' : 'execute'}`);
    if (plan.since) {
      this.log(`Since: ${plan.since}`);
    }
    if (plan.targetOrg) {
      this.log(`Target Org: ${plan.targetOrg}`);
    }

    for (const phase of plan.phases) {
      this.log('');
      this.log(`${phase.label}${phase.skipped ? ' (skipped)' : ''}`);
      if (phase.skipReason) {
        this.log(`  ${phase.skipReason}`);
      }
      for (const command of phase.commands) {
        this.log(`  ${command.tool} ${command.args.join(' ')}`);
      }
    }

    if (plan.warnings.length > 0) {
      this.log('');
      for (const warning of plan.warnings) {
        this.warn(warning);
      }
    }
  }

  private reportExecutionFailure(failedPhase: string | undefined, exitCode: number | undefined, message: string): void {
    this.log('');
    this.warn(
      `Coordinated publish failed in phase ${failedPhase ?? 'unknown'} with exit code ${
        exitCode ?? 'unknown'
      }: ${message}`
    );
  }
}
