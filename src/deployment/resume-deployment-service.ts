import { createResumedState, summarizeDeploymentState } from './deployment-state-summary.js';
import { StateManager } from './state-manager.js';
import { SfCliIntegration } from './sf-cli-integration.js';

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
};

export class ResumeDeploymentService {
  public constructor(
    private readonly stateManager: StateManager = new StateManager(),
    private readonly sfCli: SfCliIntegration = new SfCliIntegration()
  ) {}

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
}
