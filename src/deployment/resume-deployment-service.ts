import { createDeploymentPlanFingerprint, createSourceFingerprint } from '../types/manual-checkpoint.js';
import { loadRepoConfigStrict } from '../config/repo-config.js';
import type { DeploymentConfig } from '../config/repo-config.js';
import { createResumedState, summarizeDeploymentState } from './deployment-state-summary.js';
import { StateManager } from './state-manager.js';
import { SfCliIntegration } from './sf-cli-integration.js';
import { DeploymentContextService } from './deployment-context-service.js';
import { StartExecutionService, type StartExecutionResult } from './start-execution-service.js';

export type ResumeRetryStrategy = 'standard' | 'quick' | 'validate-only';

export type ResumePreparation = {
  deploymentId: string;
  currentWave: number;
  totalWaves: number;
  remainingWaves: number;
  failureReason?: string;
};

export type ResumeOptions = {
  targetOrg?: string;
  sourcePath?: string;
  approveCheckpoint?: string;
};

type ResumeDeploymentServiceDependencies = {
  deploymentContextService?: DeploymentContextService;
  startExecutionService?: StartExecutionService;
  loadConfig?: (sourcePath: string) => Promise<DeploymentConfig>;
};

export class ResumeDeploymentService {
  public constructor(
    private readonly stateManager: StateManager = new StateManager(),
    private readonly sfCli: SfCliIntegration = new SfCliIntegration(),
    dependencies: ResumeDeploymentServiceDependencies = {}
  ) {
    this.deploymentContextService = dependencies.deploymentContextService ?? new DeploymentContextService();
    this.startExecutionService = dependencies.startExecutionService ?? new StartExecutionService();
    this.loadConfig = dependencies.loadConfig ?? loadRepoConfigStrict;
  }

  private readonly deploymentContextService: DeploymentContextService;
  private readonly startExecutionService: StartExecutionService;
  private readonly loadConfig: NonNullable<ResumeDeploymentServiceDependencies['loadConfig']>;

  public async prepareResume(
    retryStrategy: ResumeRetryStrategy,
    options: ResumeOptions = {}
  ): Promise<ResumePreparation> {
    const state = await this.stateManager.loadState();

    if (!state?.failedWave) {
      throw new Error('No failed deployment state found to resume');
    }

    const summary = summarizeDeploymentState(state);
    const targetOrg = options.targetOrg ?? state.targetOrg;
    const remoteResume = options.targetOrg ? await this.sfCli.resumeDeployment(state.deploymentId) : undefined;
    if (remoteResume && !remoteResume.success) {
      throw new Error(remoteResume.output);
    }

    const resumedState = createResumedState(
      {
        ...state,
        deploymentId: remoteResume?.deploymentId ?? state.deploymentId,
        targetOrg,
        metadata: {
          ...(state.metadata ?? {}),
          remoteResumeStatus: remoteResume?.status,
          remoteComponentSuccesses: remoteResume?.componentSuccesses,
          remoteComponentFailures: remoteResume?.componentFailures,
          remoteTestsRun: remoteResume?.testsRun,
          remoteTestFailures: remoteResume?.testFailures,
          remoteResumeCheckedAt: remoteResume ? new Date().toISOString() : undefined,
        },
      },
      retryStrategy
    );

    await this.stateManager.saveState(resumedState);

    return {
      deploymentId: summary.deploymentId,
      currentWave: summary.currentWave,
      totalWaves: summary.totalWaves,
      remainingWaves: summary.remainingWaves,
      failureReason: summary.failureReason,
    };
  }

  public async resumeCheckpoint(options: ResumeOptions & { approveCheckpoint: string }): Promise<StartExecutionResult> {
    const state = await this.stateManager.loadState();
    if (!state?.pausedCheckpoint || !state.execution) {
      throw new Error('No paused deployment checkpoint found to resume');
    }
    if (options.approveCheckpoint !== state.pausedCheckpoint.id) {
      throw new Error(`Checkpoint approval does not match ${state.pausedCheckpoint.id}.`);
    }

    return this.continueLocalExecution({ ...state, execution: state.execution }, options, options.approveCheckpoint);
  }

  public async resumeFailedWaves(options: ResumeOptions = {}): Promise<StartExecutionResult> {
    const state = await this.stateManager.loadState();
    if (!state?.failedWave || !state.execution) {
      throw new Error('No locally resumable failed deployment state found');
    }

    return this.continueLocalExecution({ ...state, execution: state.execution }, options);
  }

  private async continueLocalExecution(
    state: NonNullable<Awaited<ReturnType<StateManager['loadState']>>> & {
      execution: NonNullable<NonNullable<Awaited<ReturnType<StateManager['loadState']>>>['execution']>;
    },
    options: ResumeOptions,
    approvedCheckpoint?: string
  ): Promise<StartExecutionResult> {
    const targetOrg = options.targetOrg ?? state.targetOrg;
    if (targetOrg !== state.targetOrg) {
      throw new Error(`Checkpoint target org mismatch: expected ${state.targetOrg}, received ${targetOrg}.`);
    }
    const sourcePath = options.sourcePath ?? state.execution.sourcePath;
    const currentConfig = await this.loadConfig(sourcePath);
    if (JSON.stringify(currentConfig.checkpoints ?? []) !== JSON.stringify(state.execution.checkpoints)) {
      throw new Error('Manual checkpoint configuration changed after the deployment was paused.');
    }
    if (
      state.pausedCheckpoint !== undefined &&
      (state.pausedCheckpoint.planFingerprint !== state.execution.planFingerprint ||
        state.pausedCheckpoint.executionIndex !== state.execution.nextExecutionIndex)
    ) {
      throw new Error('Paused deployment state is internally inconsistent.');
    }
    const deploymentContext = await this.deploymentContextService.buildContext({
      sourcePath,
      ...state.execution.contextOptions,
    });
    const executionWaves = state.execution.destructive
      ? [...deploymentContext.orderedWaves].reverse()
      : deploymentContext.orderedWaves;
    const fingerprint = createDeploymentPlanFingerprint({
      waves: executionWaves,
      checkpoints: state.execution.checkpoints,
      destructive: state.execution.destructive,
      skipTests: state.execution.skipTests,
      apiVersion: deploymentContext.scanResult.apiVersion,
      sourceFingerprint: await createSourceFingerprint(deploymentContext.scanResult.dependencyResult.components),
    });
    if (fingerprint !== state.execution.planFingerprint) {
      throw new Error(
        `Deployment plan changed after the checkpoint was created (${state.execution.planFingerprint} != ${fingerprint}). Regenerate and restart the deployment.`
      );
    }
    if (executionWaves.map((wave) => wave.number).join(',') !== state.execution.orderedWaveNumbers.join(',')) {
      throw new Error('Deployment wave order changed after the checkpoint was created.');
    }
    const expectedCompleted = state.execution.orderedWaveNumbers.slice(0, state.execution.nextExecutionIndex);
    if (expectedCompleted.join(',') !== state.completedWaves.join(',')) {
      throw new Error('Completed waves do not match the persisted execution position.');
    }

    return this.startExecutionService.execute({
      dryRun: false,
      validateOnly: false,
      allowCycleRemediation: false,
      skipTests: state.execution.skipTests,
      destructive: state.execution.destructive,
      targetOrg,
      sourcePath,
      deploymentContext,
      log: () => undefined,
      checkpoints: state.execution.checkpoints,
      approvedCheckpointIds: new Set([
        ...(state.approvedCheckpointIds ?? []),
        ...(approvedCheckpoint === undefined ? [] : [approvedCheckpoint]),
      ]),
      startExecutionIndex: state.execution.nextExecutionIndex,
      deploymentId: state.deploymentId,
      planFingerprint: fingerprint,
      contextOptions: state.execution.contextOptions,
    });
  }
}
