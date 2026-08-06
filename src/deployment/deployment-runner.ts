import type { DependencyGraph, NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import {
  createDeploymentPlanFingerprint,
  createSourceFingerprint,
  validateManualCheckpoints,
  type ManualCheckpoint,
  type ReachedManualCheckpoint,
} from '../types/manual-checkpoint.js';
import { DeploymentTracker } from './deployment-tracker.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { StateManager } from './state-manager.js';
import { TestPlanService } from './test-plan-service.js';
import { WaveManifestService } from './wave-manifest-service.js';
import { ForceIgnoreStagingService } from './forceignore-staging-service.js';
import type { TestExecutor } from './test-executor.js';
import type { DeploymentAIContext, DeploymentContextBuildOptions } from './deployment-context-service.js';
import { buildPersistedWaveGraphContext } from './wave-graph-state.js';
import { formatDeploymentDiagnostics } from './deployment-error-diagnostics.js';

export type DeploymentRunnerParams = {
  deploymentId: string;
  targetOrg: string;
  sourcePath?: string;
  orderedWaves: Wave[];
  dependencyGraph?: DependencyGraph;
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  apiVersion?: string;
  skipTests: boolean;
  destructive: boolean;
  testExecutor: TestExecutor;
  tracker: DeploymentTracker;
  stateManager: StateManager;
  sfCli: SfCliIntegration;
  aiContext?: DeploymentAIContext;
  log: (message: string) => void;
  checkpoints?: ManualCheckpoint[];
  approvedCheckpointIds?: ReadonlySet<string>;
  startExecutionIndex?: number;
  planFingerprint?: string;
  contextOptions?: Omit<DeploymentContextBuildOptions, 'sourcePath'>;
};

export type DeploymentRunnerResult = { kind: 'completed' } | { kind: 'paused'; checkpoint: ReachedManualCheckpoint };

type DeploymentRunnerDependencies = {
  testPlanService?: TestPlanService;
  waveManifestService?: WaveManifestService;
  forceIgnoreStagingService?: ForceIgnoreStagingService;
};

export class DeploymentRunner {
  private readonly testPlanService: TestPlanService;
  private readonly waveManifestService: WaveManifestService;
  private readonly forceIgnoreStagingService: ForceIgnoreStagingService;

  public constructor(dependencies: DeploymentRunnerDependencies = {}) {
    this.testPlanService = dependencies.testPlanService ?? new TestPlanService();
    this.waveManifestService = dependencies.waveManifestService ?? new WaveManifestService();
    this.forceIgnoreStagingService = dependencies.forceIgnoreStagingService ?? new ForceIgnoreStagingService();
  }

  public async execute(params: DeploymentRunnerParams): Promise<DeploymentRunnerResult> {
    const {
      deploymentId,
      targetOrg,
      sourcePath,
      orderedWaves,
      dependencyGraph,
      componentMap,
      apiVersion,
      skipTests,
      destructive,
      testExecutor,
      tracker,
      stateManager,
      sfCli,
      aiContext,
      log,
    } = params;
    const checkpoints = params.checkpoints ?? [];
    const approvedCheckpointIds = params.approvedCheckpointIds ?? new Set<string>();
    const startExecutionIndex = params.startExecutionIndex ?? 0;
    validateManualCheckpoints(checkpoints, orderedWaves);
    if (startExecutionIndex < 0 || startExecutionIndex > orderedWaves.length) {
      throw new Error(`Invalid deployment start execution index: ${startExecutionIndex}`);
    }
    const planFingerprint =
      params.planFingerprint ??
      createDeploymentPlanFingerprint({
        waves: orderedWaves,
        checkpoints,
        destructive,
        skipTests,
        apiVersion,
        sourceFingerprint: await createSourceFingerprint(componentMap),
      });
    const completedWaveNumbers = orderedWaves.slice(0, startExecutionIndex).map((wave) => wave.number);
    let persistedDeploymentId = deploymentId;

    for (let executionIndex = startExecutionIndex; executionIndex < orderedWaves.length; executionIndex += 1) {
      const wave = orderedWaves[executionIndex];
      const beforeCheckpoint = this.findCheckpoint(checkpoints, 'before', wave.number, approvedCheckpointIds);
      if (beforeCheckpoint) {
        return this.pauseAtCheckpoint({
          checkpoint: beforeCheckpoint,
          deploymentId: persistedDeploymentId,
          executionIndex,
          completedWaveNumbers,
          params,
          planFingerprint,
        });
      }

      log(
        `\n🌊 ${destructive ? 'Deleting' : 'Deploying'} Wave ${wave.number}/${orderedWaves.length} (${
          wave.components.length
        } components)...`
      );
      const workspace = await this.forceIgnoreStagingService.prepare({
        projectRoot: sourcePath ?? process.cwd(),
      });

      try {
        const destructiveManifest = destructive
          ? await this.waveManifestService.generateDestructiveManifest({
              baseDir: workspace.projectRoot,
              waveNumber: wave.number,
              components: wave.components,
              componentMap,
              apiVersion,
            })
          : undefined;
        const manifestPath =
          destructiveManifest?.packagePath ??
          (await this.waveManifestService.generateManifest({
            baseDir: workspace.projectRoot,
            waveNumber: wave.number,
            components: wave.components,
            componentMap,
            apiVersion,
          }));
        const destructiveChangesPath = destructiveManifest?.destructiveChangesPath;
        const testPlan = this.testPlanService.resolveTestPlan(wave, destructive || skipTests, testExecutor);

        tracker.startTracking(deploymentId, wave.number, orderedWaves.length);
        const result = await sfCli.deploy({
          manifestPath,
          targetOrg,
          workingDirectory: workspace.projectRoot,
          testLevel: testPlan.testLevel,
          tests: testPlan.testLevel === 'RunSpecifiedTests' ? testPlan.tests : undefined,
          destructiveChangesPath,
          destructiveChangesTiming: 'post',
        });
        tracker.updateProgress(deploymentId, result);
        persistedDeploymentId = result.deploymentId ?? persistedDeploymentId;

        if (!result.success) {
          const diagnostics = result.diagnostics ?? [];
          const formattedDiagnostics = formatDeploymentDiagnostics(diagnostics);
          const failureMessage = formattedDiagnostics ? `${result.output}\n\n${formattedDiagnostics}` : result.output;
          await stateManager.saveState({
            deploymentId: persistedDeploymentId,
            targetOrg,
            timestamp: new Date().toISOString(),
            totalWaves: orderedWaves.length,
            completedWaves: [...completedWaveNumbers],
            currentWave: wave.number,
            status: 'failed',
            failedWave: {
              waveNumber: wave.number,
              error: failureMessage,
              timestamp: new Date().toISOString(),
            },
            metadata: {
              lastKnownStatus: result.status,
              testsRun: result.testsRun,
              testFailures: result.testFailures,
              testLevel: testPlan.testLevel,
              destructive,
              diagnostics,
              waveGraphContext: buildPersistedWaveGraphContext(orderedWaves, dependencyGraph),
              ...this.buildAIMetadata(aiContext),
            },
            approvedCheckpointIds: [...approvedCheckpointIds],
            execution: this.buildExecutionState(params, planFingerprint, executionIndex),
          });
          throw new Error(`Wave ${wave.number} failed: ${failureMessage}`);
        }

        await stateManager.saveState({
          deploymentId: persistedDeploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: orderedWaves.length,
          completedWaves: [...completedWaveNumbers, wave.number],
          currentWave: wave.number,
          status: 'running',
          metadata: {
            lastKnownStatus: result.status,
            testsRun: result.testsRun,
            testFailures: result.testFailures,
            testLevel: testPlan.testLevel,
            destructive,
            waveGraphContext: buildPersistedWaveGraphContext(orderedWaves, dependencyGraph),
            ...this.buildAIMetadata(aiContext),
          },
          approvedCheckpointIds: [...approvedCheckpointIds],
          execution: this.buildExecutionState(params, planFingerprint, executionIndex + 1),
        });

        log(`✅ Wave ${wave.number} ${destructive ? 'deleted' : 'deployed'} successfully`);
      } finally {
        await workspace.cleanup();
      }
      completedWaveNumbers.push(wave.number);

      const afterCheckpoint = this.findCheckpoint(checkpoints, 'after', wave.number, approvedCheckpointIds);
      if (afterCheckpoint) {
        return this.pauseAtCheckpoint({
          checkpoint: afterCheckpoint,
          deploymentId: persistedDeploymentId,
          executionIndex: executionIndex + 1,
          completedWaveNumbers,
          params,
          planFingerprint,
        });
      }
    }

    await stateManager.clearState();
    log(`\n✅ All waves ${params.destructive ? 'deleted' : 'deployed'} successfully!`);
    return { kind: 'completed' };
  }

  private findCheckpoint(
    checkpoints: readonly ManualCheckpoint[],
    phase: ManualCheckpoint['phase'],
    waveNumber: number,
    approvedCheckpointIds: ReadonlySet<string>
  ): ManualCheckpoint | undefined {
    return checkpoints.find(
      (checkpoint) =>
        checkpoint.phase === phase && checkpoint.waveNumber === waveNumber && !approvedCheckpointIds.has(checkpoint.id)
    );
  }

  private async pauseAtCheckpoint(options: {
    checkpoint: ManualCheckpoint;
    deploymentId: string;
    executionIndex: number;
    completedWaveNumbers: number[];
    params: DeploymentRunnerParams;
    planFingerprint: string;
  }): Promise<DeploymentRunnerResult> {
    const reachedAt = new Date().toISOString();
    const reachedCheckpoint: ReachedManualCheckpoint = {
      ...options.checkpoint,
      deploymentId: options.deploymentId,
      executionIndex: options.executionIndex,
      totalExecutionWaves: options.params.orderedWaves.length,
      reachedAt,
      planFingerprint: options.planFingerprint,
    };
    const nextWave = options.params.orderedWaves[options.executionIndex];
    await options.params.stateManager.saveState({
      deploymentId: options.deploymentId,
      targetOrg: options.params.targetOrg,
      timestamp: reachedAt,
      totalWaves: options.params.orderedWaves.length,
      completedWaves: [...options.completedWaveNumbers],
      currentWave: nextWave?.number ?? options.checkpoint.waveNumber,
      status: 'paused',
      pausedCheckpoint: reachedCheckpoint,
      approvedCheckpointIds: [...(options.params.approvedCheckpointIds ?? new Set<string>())],
      execution: {
        sourcePath: options.params.sourcePath ?? process.cwd(),
        orderedWaveNumbers: options.params.orderedWaves.map((wave) => wave.number),
        nextExecutionIndex: options.executionIndex,
        destructive: options.params.destructive,
        skipTests: options.params.skipTests,
        apiVersion: options.params.apiVersion,
        planFingerprint: options.planFingerprint,
        checkpoints: options.params.checkpoints ?? [],
        contextOptions: options.params.contextOptions,
      },
      metadata: {
        lastKnownStatus: 'Paused',
        destructive: options.params.destructive,
        waveGraphContext: buildPersistedWaveGraphContext(options.params.orderedWaves, options.params.dependencyGraph),
        ...this.buildAIMetadata(options.params.aiContext),
      },
    });
    options.params.log(`⏸ Deployment paused at checkpoint ${options.checkpoint.id}.`);
    return { kind: 'paused', checkpoint: reachedCheckpoint };
  }

  private buildExecutionState(
    params: DeploymentRunnerParams,
    planFingerprint: string,
    nextExecutionIndex: number
  ): NonNullable<import('./state-manager.js').DeploymentState['execution']> {
    return {
      sourcePath: params.sourcePath ?? process.cwd(),
      orderedWaveNumbers: params.orderedWaves.map((wave) => wave.number),
      nextExecutionIndex,
      destructive: params.destructive,
      skipTests: params.skipTests,
      apiVersion: params.apiVersion,
      planFingerprint,
      checkpoints: params.checkpoints ?? [],
      contextOptions: params.contextOptions,
    };
  }

  private buildAIMetadata(aiContext?: DeploymentAIContext): Record<string, unknown> {
    if (aiContext === undefined) {
      return {};
    }

    return {
      aiProvider: aiContext.provider,
      aiModel: aiContext.model,
      aiFallback: aiContext.fallback,
      aiAdjustments: aiContext.aiAdjustments,
      aiUnknownTypes: aiContext.unknownTypes,
      aiInferenceFallback: aiContext.inferenceFallback,
      aiInferredDependencies: aiContext.inferredDependencies,
    };
  }
}
