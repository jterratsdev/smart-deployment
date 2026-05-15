import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { SpecialDeploymentPlanExecutor } from '../deployment/special-deployment-executor.js';
import { SpecialDeploymentPlanService, type SpecialDeploymentPlan } from '../deployment/special-deployment-plan.js';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('CiPublishCommand');

export default class CiPublish extends SfCommand<SpecialDeploymentPlan> {
  public static readonly summary = 'Build a coordinated metadata, Agentforce, LWR, and OmniStudio publish plan for CI.';

  public static readonly examples = [
    '<%= config.bin %> <%= command.id %> --since origin/main --dry-run',
    '<%= config.bin %> <%= command.id %> --source-path force-app --since HEAD~1 --json',
  ];

  public static readonly flags = {
    'source-path': Flags.string({
      summary: 'Path inside a Salesforce DX project to scan.',
    }),
    since: Flags.string({
      summary: 'Git revision used as the previous green deploy SHA for change detection.',
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

  public async run(): Promise<SpecialDeploymentPlan> {
    const { flags } = await this.parse(CiPublish);
    const sourcePath = typeof flags['source-path'] === 'string' ? flags['source-path'] : undefined;
    const since = typeof flags.since === 'string' ? flags.since : undefined;
    const dryRun = flags['dry-run'] !== false;
    const autoActivate = flags['auto-activate'] === true;

    logger.info('Building CI publish plan', { sourcePath, since, dryRun, autoActivate });

    const plan = await new SpecialDeploymentPlanService().buildPlan({
      sourcePath,
      since,
      dryRun,
      autoActivate,
    });

    this.reportPlan(plan);
    if (!dryRun) {
      const execution = await new SpecialDeploymentPlanExecutor().execute(plan);
      if (!execution.success) {
        const message = execution.errors[0] ?? 'Coordinated publish failed.';
        const failedPlan = {
          ...plan,
          success: false,
          errors: [...plan.errors, message],
        };
        this.reportExecutionFailure(execution.failedPhase, execution.exitCode, message);
        return failedPlan;
      }
      this.log('');
      this.log('Coordinated publish execution completed successfully.');
    }

    return plan;
  }

  private reportPlan(plan: SpecialDeploymentPlan): void {
    this.log('Coordinated publish plan');
    this.log(`Project: ${plan.projectRoot}`);
    this.log(`Mode: ${plan.dryRun ? 'dry-run' : 'execute'}`);
    if (plan.since) {
      this.log(`Since: ${plan.since}`);
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
    this.error(
      `Coordinated publish failed in phase ${failedPhase ?? 'unknown'} with exit code ${
        exitCode ?? 'unknown'
      }: ${message}`
    );
  }
}
