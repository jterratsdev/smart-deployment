import { expect } from 'chai';
import { describe, it } from 'mocha';
import { projectDeploymentPostcondition } from '../../../src/presentation/deployment-postcondition-projector.js';

describe('projectDeploymentPostcondition', () => {
  it('projects satisfied history without internal errors or paths', () => {
    expect(
      projectDeploymentPostcondition({
        id: 'owd:Case:Private',
        kind: 'owd-internal-sharing-model',
        objectName: 'Case',
        afterWaveNumber: 1,
        expectedInternalSharingModel: 'Private',
        expectedExternalSharingModel: 'Private',
        status: 'satisfied',
        observedInternalSharingModel: 'Private',
        observedExternalSharingModel: 'Private',
        attempts: 5,
        waitedMs: 1250,
        resumedPhase: 2,
      })
    ).to.deep.equal({
      code: 'OWD_PROPAGATION_SATISFIED',
      status: 'satisfied',
      objectName: 'Case',
      expectedInternalSharingModel: 'Private',
      observedInternalSharingModel: 'Private',
      expectedExternalSharingModel: 'Private',
      observedExternalSharingModel: 'Private',
      attempts: 5,
      waitedMs: 1250,
      errorCategory: undefined,
      resumedPhase: 2,
    });
  });
});
