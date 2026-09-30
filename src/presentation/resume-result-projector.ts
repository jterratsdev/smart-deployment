import type { StartExecutionResult } from '../deployment/start-execution-service.js';
import type { DeploymentState } from '../deployment/state-manager.js';
import type { DeploymentPostconditionView } from './deployment-postcondition-projector.js';
import { projectDeploymentPostcondition } from './deployment-postcondition-projector.js';

export type ResumeCommandResult = {
  success: boolean;
  resumedFromWave: number;
  remainingWaves: number;
  deploymentId: string;
  outcome?: 'completed' | 'paused' | 'prepared';
  checkpoint?: { id: string; phase: 'before' | 'after'; waveNumber: number; message?: string };
  postcondition?: DeploymentPostconditionView;
  postconditions?: DeploymentPostconditionView[];
};

export class ResumeResultProjector {
  public project(state: DeploymentState | null, result: StartExecutionResult): ResumeCommandResult {
    const postconditions =
      result.kind === 'postcondition-paused' || result.kind === 'precondition-blocked'
        ? [result.postcondition]
        : result.kind === 'completed'
        ? result.postconditions
        : [];
    const projectedPostconditions = postconditions.map(projectDeploymentPostcondition);

    return {
      success: result.kind === 'completed',
      resumedFromWave: state?.pausedCheckpoint?.waveNumber ?? state?.currentWave ?? 0,
      remainingWaves: this.remainingWaves(state, result),
      deploymentId: state?.deploymentId ?? '',
      outcome: result.kind === 'skipped' ? 'prepared' : result.kind === 'completed' ? 'completed' : 'paused',
      checkpoint:
        result.kind === 'paused'
          ? {
              id: result.checkpoint.id,
              phase: result.checkpoint.phase,
              waveNumber: result.checkpoint.waveNumber,
              message: result.checkpoint.message,
            }
          : undefined,
      postcondition: projectedPostconditions[0],
      postconditions: projectedPostconditions.length > 0 ? projectedPostconditions : undefined,
    };
  }

  private remainingWaves(state: DeploymentState | null, result: StartExecutionResult): number {
    if (result.kind === 'paused') {
      return Math.max(0, result.checkpoint.totalExecutionWaves - result.checkpoint.executionIndex);
    }
    if (result.kind === 'postcondition-paused' || result.kind === 'precondition-blocked') {
      return Math.max(0, (state?.totalWaves ?? 0) - (state?.completedWaves.length ?? 0));
    }
    return 0;
  }
}
