import type { DeploymentPostconditionResult } from '../deployment/deployment-postcondition.js';
import type { ReleasePostconditionV1 } from '../types/release-report.js';

export type DeploymentPostconditionView = ReleasePostconditionV1;

export function projectDeploymentPostcondition(
  postcondition: DeploymentPostconditionResult
): DeploymentPostconditionView {
  return {
    code: postcondition.status === 'satisfied' ? 'OWD_PROPAGATION_SATISFIED' : 'OWD_PROPAGATION_PENDING',
    status: postcondition.status,
    objectName: postcondition.objectName,
    expectedInternalSharingModel: postcondition.expectedInternalSharingModel,
    observedInternalSharingModel: postcondition.observedInternalSharingModel,
    expectedExternalSharingModel: postcondition.expectedExternalSharingModel,
    observedExternalSharingModel: postcondition.observedExternalSharingModel,
    attempts: postcondition.attempts,
    waitedMs: postcondition.waitedMs,
    errorCategory: 'observationError' in postcondition ? postcondition.observationError?.category : undefined,
    resumedPhase: postcondition.resumedPhase,
  };
}
