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

export class ResumeDeploymentService {
  public constructor(
    private readonly stateManager: StateManager = new StateManager(),
    private readonly sfCli: Pick<SfCliIntegration, 'resumeDeployment'> = new SfCliIntegration()
  ) {}

  public async prepareResume(
    retryStrategy: ResumeRetryStrategy,
    options: { targetOrg?: string } = {}
  ): Promise<ResumePreparation> {
    const state = await this.stateManager.loadState();

    if (!state?.failedWave) {
      throw new Error('No failed deployment state found to resume');
    }

    const summary = summarizeDeploymentState(state);
    const remoteResult = options.targetOrg
      ? await this.sfCli.resumeDeployment(state.deploymentId, options.targetOrg)
      : undefined;

    if (remoteResult?.success === false) {
      throw new Error(`Remote resume failed: ${remoteResult.output}`);
    }

    const resumedState = createResumedState(
      remoteResult
        ? {
            ...state,
            targetOrg: options.targetOrg ?? state.targetOrg,
            metadata: {
              ...(state.metadata ?? {}),
              lastKnownStatus: remoteResult.status,
              remoteResumeStatus: remoteResult.status,
              remoteResumeCheckedAt: new Date().toISOString(),
              remoteComponentSuccesses: remoteResult.componentSuccesses,
              remoteComponentFailures: remoteResult.componentFailures,
              remoteTestsRun: remoteResult.testsRun,
              remoteTestFailures: remoteResult.testFailures,
            },
          }
        : state,
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
