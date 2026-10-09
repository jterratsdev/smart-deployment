import type { ResumePreparation, ResumeRetryStrategy } from '../deployment/resume-deployment-service.js';
import type { DeploymentPostconditionView } from './deployment-postcondition-projector.js';

export type ResumePresenterIO = {
  log: (message: string) => void;
};

export class ResumeCommandPresenter {
  public reportPostcondition(io: ResumePresenterIO, condition: DeploymentPostconditionView): void {
    io.log(`${condition.code}: ${condition.objectName}`);
    io.log(
      `Internal expected=${condition.expectedInternalSharingModel}, observed=${
        condition.observedInternalSharingModel ?? 'unavailable'
      }; external expected=${condition.expectedExternalSharingModel ?? 'unspecified'}, observed=${
        condition.observedExternalSharingModel ?? 'unavailable'
      }`
    );
    io.log(
      `Attempts=${condition.attempts}, waitedMs=${condition.waitedMs}, errorCategory=${
        condition.errorCategory ?? 'none'
      }, resumedPhase=${condition.resumedPhase ?? 'not-resumed'}`
    );
  }

  public reportResumePreparation(
    io: ResumePresenterIO,
    summary: ResumePreparation,
    retryStrategy: ResumeRetryStrategy
  ): void {
    io.log(`🔄 Resume prepared for deployment ${summary.deploymentId}`);
    io.log(`Retry strategy: ${retryStrategy}`);
    io.log(`Resuming from wave ${summary.currentWave}/${summary.totalWaves}`);
    io.log(`Remaining waves: ${summary.remainingWaves}`);
    if (summary.failureReason) {
      io.log(`Previous failure: ${summary.failureReason}`);
    }
  }
}
