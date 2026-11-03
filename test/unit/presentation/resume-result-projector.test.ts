import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResumeResultProjector } from '../../../src/presentation/resume-result-projector.js';

describe('ResumeResultProjector', () => {
  it('keeps all satisfied postconditions in stable order in successful JSON output', () => {
    const result = new ResumeResultProjector().project(
      {
        deploymentId: 'deploy-1',
        targetOrg: 'test-org',
        timestamp: '2026-09-30T00:00:00.000Z',
        totalWaves: 2,
        completedWaves: [1],
        currentWave: 2,
        status: 'paused',
      },
      {
        kind: 'completed',
        postconditions: [
          {
            id: 'owd:Case:Private',
            kind: 'owd-internal-sharing-model',
            objectName: 'Case',
            afterWaveNumber: 1,
            expectedInternalSharingModel: 'Private',
            status: 'satisfied',
            observedInternalSharingModel: 'Private',
            attempts: 5,
            waitedMs: 1250,
            resumedPhase: 2,
          },
          {
            id: 'owd:Account:Read',
            kind: 'owd-internal-sharing-model',
            objectName: 'Account',
            afterWaveNumber: 2,
            expectedInternalSharingModel: 'Read',
            status: 'satisfied',
            observedInternalSharingModel: 'Read',
            attempts: 3,
            waitedMs: 750,
            resumedPhase: 3,
          },
        ],
      }
    );

    expect(result).to.deep.include({ success: true, outcome: 'completed', resumedFromWave: 2 });
    expect(result.postcondition).to.deep.include({
      code: 'OWD_PROPAGATION_SATISFIED',
      status: 'satisfied',
      attempts: 5,
      waitedMs: 1250,
      resumedPhase: 2,
    });
    expect(result.postconditions).to.have.length(2);
    expect(result.postconditions?.map((condition) => condition.objectName)).to.deep.equal(['Case', 'Account']);
    expect(result.postconditions?.[1]).to.deep.include({
      code: 'OWD_PROPAGATION_SATISFIED',
      status: 'satisfied',
      attempts: 3,
      waitedMs: 750,
      resumedPhase: 3,
    });
  });
});
