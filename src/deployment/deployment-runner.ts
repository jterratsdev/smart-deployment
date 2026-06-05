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
import { formatDeploymentDiagnostics } from './deployment-error-diagnostics.js';
import { buildPersistedWaveGraphContext } from './wave-graph-state.js';

export type DeploymentRunnerParams = {
  deploymentId: string;
  targetOrg: string;
  sourcePath?: string;
  orderedWaves: Wave[];
  dependencyGraph?: DependencyGraph;
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  apiVersion?: string;
  skipTests: boolean;
  testExecutor: TestExecutor;
  tracker: DeploymentTracker;
  stateManager: StateManager;
  sfCli: SfCliIntegration;
  aiContext?: DeploymentAIContext;
  mode?: 'deploy' | 'destructive';
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
      testExecutor,
      tracker,
      stateManager,
      sfCli,
      aiContext,
      mode = 'deploy',
      log,
    } = params;

    await this.forEachSequentially(orderedWaves, async (wave) => {
      const destructive = mode === 'destructive';
      log(
        `\n🌊 ${destructive ? 'Deleting' : 'Deploying'} Wave ${wave.number}/${orderedWaves.length} (${
          wave.components.length
        } components)...`
      );
      const workspace = await this.forceIgnoreStagingService.prepare({
        projectRoot: sourcePath ?? process.cwd(),
      });

      try {
        const manifest = destructive
          ? await this.waveManifestService.generateDestructiveManifest({
              baseDir: workspace.projectRoot,
              waveNumber: wave.number,
              components: wave.components,
              componentMap,
              apiVersion,
            })
          : {
              packagePath: await this.waveManifestService.generateManifest({
                baseDir: workspace.projectRoot,
                waveNumber: wave.number,
                components: wave.components,
                componentMap,
                apiVersion,
              }),
              destructiveChangesPath: undefined,
            };
        const testPlan = destructive
          ? { testLevel: 'NoTestRun' as const, tests: [] }
          : this.testPlanService.resolveTestPlan(wave, skipTests, testExecutor);

        tracker.startTracking(deploymentId, wave.number, orderedWaves.length);
        const result = await sfCli.deploy({
          manifestPath: manifest.packagePath,
          postDestructiveChangesPath: manifest.destructiveChangesPath,
          targetOrg,
          workingDirectory: workspace.projectRoot,
          testLevel: testPlan.testLevel,
          tests: testPlan.testLevel === 'RunSpecifiedTests' ? testPlan.tests : undefined,
        });
        tracker.updateProgress(deploymentId, result);

        if (!result.success) {
          const diagnostics = result.diagnostics ?? [];
          const formattedDiagnostics = formatDeploymentDiagnostics(diagnostics);
          const failureMessage = formattedDiagnostics ? `${result.output}\n\n${formattedDiagnostics}` : result.output;

          await stateManager.saveState({
            deploymentId,
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
              diagnostics,
              waveGraphContext: buildPersistedWaveGraphContext(orderedWaves, dependencyGraph),
              ...this.buildAIMetadata(aiContext),
            },
          });
          throw new Error(`Wave ${wave.number} failed: ${failureMessage}`);
        }

        await stateManager.saveState({
          deploymentId,
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
    log(`\n✅ All waves ${mode === 'destructive' ? 'deleted' : 'deployed'} successfully!`);
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
