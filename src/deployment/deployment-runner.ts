import type { DependencyGraph, NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { DeploymentTracker } from './deployment-tracker.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { StateManager } from './state-manager.js';
import { TestPlanService } from './test-plan-service.js';
import { WaveManifestService } from './wave-manifest-service.js';
import { ForceIgnoreStagingService } from './forceignore-staging-service.js';
import type { TestExecutor } from './test-executor.js';
import type { DeploymentAIContext } from './deployment-context-service.js';
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
};

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

  public async execute(params: DeploymentRunnerParams): Promise<void> {
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

    await this.forEachSequentially(orderedWaves, async (wave) => {
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
        const persistedDeploymentId = result.deploymentId ?? deploymentId;

        if (!result.success) {
          const diagnostics = result.diagnostics ?? [];
          const formattedDiagnostics = formatDeploymentDiagnostics(diagnostics);
          const failureMessage = formattedDiagnostics ? `${result.output}\n\n${formattedDiagnostics}` : result.output;
          await stateManager.saveState({
            deploymentId: persistedDeploymentId,
            targetOrg,
            timestamp: new Date().toISOString(),
            totalWaves: orderedWaves.length,
            completedWaves: Array.from({ length: Math.max(0, wave.number - 1) }, (_, i) => i + 1),
            currentWave: wave.number,
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
          });
          throw new Error(`Wave ${wave.number} failed: ${failureMessage}`);
        }

        await stateManager.saveState({
          deploymentId: persistedDeploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: orderedWaves.length,
          completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
          currentWave: wave.number,
          metadata: {
            lastKnownStatus: result.status,
            testsRun: result.testsRun,
            testFailures: result.testFailures,
            testLevel: testPlan.testLevel,
            destructive,
            waveGraphContext: buildPersistedWaveGraphContext(orderedWaves, dependencyGraph),
            ...this.buildAIMetadata(aiContext),
          },
        });

        log(`✅ Wave ${wave.number} ${destructive ? 'deleted' : 'deployed'} successfully`);
      } finally {
        await workspace.cleanup();
      }
    });

    await stateManager.clearState();
    log(`\n✅ All waves ${params.destructive ? 'deleted' : 'deployed'} successfully!`);
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

  private async forEachSequentially<T>(
    items: readonly T[],
    callback: (item: T, index: number) => Promise<void>
  ): Promise<void> {
    let chain = Promise.resolve();
    items.forEach((item, index) => {
      chain = chain.then(async () => callback(item, index));
    });
    await chain;
  }
}
