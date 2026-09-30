import { CycleRemediationPlanner } from '../dependencies/cycle-remediation-planner.js';
import type { ManualCheckpoint, ReachedManualCheckpoint } from '../types/manual-checkpoint.js';
import { CycleRemediationRunner } from './cycle-remediation-runner.js';
import { DeploymentContext } from './deployment-context-service.js';
import { DeploymentRunner } from './deployment-runner.js';
import {
  DynamicQueryTargetValidator,
  type DynamicQueryTargetValidationResult,
} from './dynamic-query-target-validator.js';
import { DeploymentTracker } from './deployment-tracker.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { SfCliMetadataLookup } from './sf-cli-metadata-lookup.js';
import { StateManager } from './state-manager.js';
import { TestPlanService } from './test-plan-service.js';
import { OwdBarrierPlanner } from './owd-barrier-planner.js';
import { SfCliOrgQuery } from './sf-cli-org-query.js';
import type { OwdPostcondition } from './deployment-postcondition.js';
import { createDeploymentPlanFingerprint, createSourceFingerprint } from '../types/manual-checkpoint.js';

export type StartExecutionOptions = {
  dryRun: boolean;
  validateOnly: boolean;
  allowCycleRemediation: boolean;
  skipTests: boolean;
  destructive?: boolean;
  targetOrg?: string;
  sourcePath?: string;
  deploymentContext: DeploymentContext;
  log: (message: string) => void;
  checkpoints?: ManualCheckpoint[];
  approvedCheckpointIds?: ReadonlySet<string>;
  startExecutionIndex?: number;
  deploymentId?: string;
  planFingerprint?: string;
  contextOptions?: Omit<import('./deployment-context-service.js').DeploymentContextBuildOptions, 'sourcePath'>;
  postconditions?: OwdPostcondition[];
  satisfiedPostconditions?: Array<import('./deployment-postcondition.js').SatisfiedPostcondition>;
  pendingPostconditionId?: string;
  postconditionOptions?: { timeoutMs: number; initialDelayMs: number; maximumDelayMs: number };
};

export type StartExecutionResult =
  | { kind: 'skipped'; reason: 'dry-run' | 'validate-only' }
  | { kind: 'completed'; postconditions: Array<import('./deployment-postcondition.js').SatisfiedPostcondition> }
  | { kind: 'paused'; checkpoint: ReachedManualCheckpoint }
  | { kind: 'postcondition-paused'; postcondition: import('./deployment-postcondition.js').PausedPostcondition }
  | { kind: 'precondition-blocked'; postcondition: import('./deployment-postcondition.js').PausedPostcondition };

type StartExecutionServiceDependencies = {
  testPlanService?: TestPlanService;
  cycleRemediationRunner?: CycleRemediationRunner;
  deploymentRunner?: DeploymentRunner;
  dynamicQueryTargetValidator?: DynamicQueryTargetValidator;
  createSfCli?: () => SfCliIntegration;
  createStateManager?: (baseDir?: string) => StateManager;
  createTracker?: () => DeploymentTracker;
  createDeploymentId?: () => string;
  owdBarrierPlanner?: OwdBarrierPlanner;
};

export class StartExecutionService {
  private readonly testPlanService: TestPlanService;
  private readonly cycleRemediationRunner: CycleRemediationRunner;
  private readonly deploymentRunner: DeploymentRunner;
  private readonly dynamicQueryTargetValidator: DynamicQueryTargetValidator;
  private readonly createSfCli: NonNullable<StartExecutionServiceDependencies['createSfCli']>;
  private readonly createStateManager: NonNullable<StartExecutionServiceDependencies['createStateManager']>;
  private readonly createTracker: NonNullable<StartExecutionServiceDependencies['createTracker']>;
  private readonly createDeploymentId: NonNullable<StartExecutionServiceDependencies['createDeploymentId']>;
  private readonly owdBarrierPlanner: OwdBarrierPlanner;

  public constructor(dependencies: StartExecutionServiceDependencies = {}) {
    this.testPlanService = dependencies.testPlanService ?? new TestPlanService();
    this.cycleRemediationRunner = dependencies.cycleRemediationRunner ?? new CycleRemediationRunner();
    this.deploymentRunner = dependencies.deploymentRunner ?? new DeploymentRunner();
    this.dynamicQueryTargetValidator =
      dependencies.dynamicQueryTargetValidator ?? new DynamicQueryTargetValidator(new SfCliMetadataLookup());
    this.createSfCli = dependencies.createSfCli ?? ((): SfCliIntegration => new SfCliIntegration());
    this.createStateManager =
      dependencies.createStateManager ??
      ((baseDir?: string): StateManager => new StateManager({ baseDir: baseDir ?? process.cwd() }));
    this.createTracker = dependencies.createTracker ?? ((): DeploymentTracker => new DeploymentTracker());
    this.createDeploymentId = dependencies.createDeploymentId ?? ((): string => `deployment-${Date.now()}`);
    const orgQuery = new SfCliOrgQuery();
    this.owdBarrierPlanner =
      dependencies.owdBarrierPlanner ??
      new OwdBarrierPlanner({
        query: (targetOrg, objectName): ReturnType<SfCliOrgQuery['getEntitySharingModels']> =>
          orgQuery.getEntitySharingModels(targetOrg, objectName),
      });
  }

  public async execute(options: StartExecutionOptions): Promise<StartExecutionResult> {
    if (options.dryRun) {
      return { kind: 'skipped', reason: 'dry-run' };
    }

    if (options.validateOnly) {
      return { kind: 'skipped', reason: 'validate-only' };
    }

    const { scanResult, orderedWaves, aiContext } = options.deploymentContext;
    const destructive = options.destructive === true;
    let executionWaves = destructive ? [...orderedWaves].reverse() : orderedWaves;
    const testExecutor = this.testPlanService.createExecutor(scanResult.components);
    const remediationPlan = destructive
      ? undefined
      : new CycleRemediationPlanner(scanResult.dependencyResult.graph, {
          components: scanResult.dependencyResult.components,
        }).createPlan();

    if (remediationPlan && remediationPlan.cycles.length > 0) {
      options.log(`♻️ Detected ${remediationPlan.cycles.length} circular dependency cycle(s).`);

      if (!options.allowCycleRemediation) {
        throw new Error(
          'Circular dependencies detected. Re-run with --allow-cycle-remediation for supported ApexClass cycles or resolve them manually.'
        );
      }

      if (!remediationPlan.supported) {
        throw new Error(
          [
            'Cycle remediation was requested, but one or more cycles are not safely supported.',
            ...remediationPlan.warnings,
          ].join('\n')
        );
      }
    }

    const sfCli = this.createSfCli();
    const stateManager = this.createStateManager(options.sourcePath);
    const tracker = this.createTracker();
    const deploymentId = options.deploymentId ?? this.createDeploymentId();

    if (!options.targetOrg) {
      throw new Error('The --target-org flag is required for real deployments.');
    }

    let postconditions = options.postconditions ?? [];
    let checkpoints = options.checkpoints ?? [];
    if (!destructive) {
      const barrierPlan = options.postconditions
        ? this.owdBarrierPlanner.restorePlan(
            executionWaves,
            scanResult.dependencyResult.components,
            postconditions,
            checkpoints,
            scanResult.dependencyResult.graph
          )
        : await this.owdBarrierPlanner.createPlan(
            executionWaves,
            scanResult.dependencyResult.components,
            options.targetOrg,
            checkpoints,
            scanResult.dependencyResult.graph
          );
      executionWaves = barrierPlan.waves;
      postconditions = barrierPlan.postconditions;
      checkpoints = barrierPlan.checkpoints;
      for (const transition of barrierPlan.transitions) {
        if (
          transition.sharingModel?.changed ||
          transition.externalSharingModel?.changed ||
          transition.observationError
        ) {
          options.log(
            `OWD transition ${transition.objectName}: internal=${
              transition.sharingModel?.observed ?? 'unavailable'
            } -> ${transition.sharingModel?.source ?? 'unchanged'}, external=${
              transition.externalSharingModel?.observed ?? 'unavailable'
            } -> ${transition.externalSharingModel?.source ?? 'unchanged'}`
          );
        }
      }
      if (barrierPlan.blockedPostconditions.length > 0) {
        const postcondition = barrierPlan.blockedPostconditions[0];
        const planFingerprint = createDeploymentPlanFingerprint({
          waves: executionWaves,
          checkpoints,
          destructive,
          skipTests: options.skipTests,
          apiVersion: scanResult.apiVersion,
          sourceFingerprint: await createSourceFingerprint(scanResult.dependencyResult.components),
          postconditions: [postcondition],
        });
        await stateManager.saveState({
          deploymentId,
          targetOrg: options.targetOrg,
          timestamp: postcondition.pausedAt,
          totalWaves: executionWaves.length,
          completedWaves: [],
          currentWave: executionWaves[0]?.number ?? 0,
          status: 'paused',
          pausedPostcondition: postcondition,
          satisfiedPostconditions: options.satisfiedPostconditions ?? [],
          approvedCheckpointIds: [...(options.approvedCheckpointIds ?? [])],
          execution: {
            sourcePath: options.sourcePath ?? process.cwd(),
            orderedWaveNumbers: executionWaves.map((wave) => wave.number),
            nextExecutionIndex: 0,
            destructive,
            skipTests: options.skipTests,
            apiVersion: scanResult.apiVersion,
            planFingerprint,
            checkpoints,
            postconditions: [postcondition],
            postconditionOptions: options.postconditionOptions,
            contextOptions: options.contextOptions,
          },
          metadata: { lastKnownStatus: 'PreconditionBlocked', destructive },
        });
        options.log(
          `Deployment blocked before mutation: ${postcondition.objectName} sharing-model observation is unavailable (${
            postcondition.observationError?.category ?? 'query'
          }).`
        );
        return { kind: 'precondition-blocked', postcondition };
      }
    }

    if (!destructive) {
      await this.assertDynamicQueryFieldsAreSafe(scanResult.dependencyResult, options.targetOrg);
    }

    if (remediationPlan && remediationPlan.cycles.length > 0) {
      if ((options.checkpoints?.length ?? 0) > 0) {
        throw new Error('Manual wave checkpoints are not supported during cycle remediation deployments.');
      }
      await this.cycleRemediationRunner.execute({
        deploymentId,
        targetOrg: options.targetOrg,
        sourcePath: options.sourcePath,
        stateManager,
        tracker,
        plan: remediationPlan,
        sfCli,
        skipTests: options.skipTests,
        componentMap: scanResult.dependencyResult.components,
        apiVersion: scanResult.apiVersion,
        log: options.log,
      });

      return { kind: 'completed', postconditions: [] };
    }

    const result = await this.deploymentRunner.execute({
      deploymentId,
      targetOrg: options.targetOrg,
      sourcePath: options.sourcePath,
      orderedWaves: executionWaves,
      dependencyGraph: scanResult.dependencyResult.graph,
      componentMap: scanResult.dependencyResult.components,
      apiVersion: scanResult.apiVersion,
      skipTests: options.skipTests,
      destructive,
      testExecutor,
      tracker,
      stateManager,
      sfCli,
      aiContext,
      log: options.log,
      checkpoints,
      approvedCheckpointIds: options.approvedCheckpointIds,
      startExecutionIndex: options.startExecutionIndex,
      planFingerprint: options.planFingerprint,
      contextOptions: options.contextOptions,
      postconditions,
      satisfiedPostconditions: options.satisfiedPostconditions,
      pendingPostconditionId: options.pendingPostconditionId,
      postconditionOptions: options.postconditionOptions,
    });

    return result;
  }

  private async assertDynamicQueryFieldsAreSafe(
    dependencyResult: DeploymentContext['scanResult']['dependencyResult'],
    targetOrg: string
  ): Promise<void> {
    const validation = await this.dynamicQueryTargetValidator.validate(dependencyResult, targetOrg);
    if (validation.missingFields.length === 0) {
      return;
    }

    throw new Error(this.formatDynamicQueryFieldError(validation));
  }

  private formatDynamicQueryFieldError(validation: DynamicQueryTargetValidationResult): string {
    return [
      'Dynamic SOQL prerequisites are missing in the target org.',
      ...validation.missingFields.map(
        (field) =>
          `- ${field.consumerNodeId} requires ${field.fieldNodeId} (${field.reason ?? 'dynamic query reference'}).`
      ),
      'Install the missing CustomField metadata in an earlier wave or deploy it to the target org before this consumer.',
    ].join('\n');
  }
}
