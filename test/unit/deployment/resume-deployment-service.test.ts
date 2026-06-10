import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResumeDeploymentService } from '../../../src/deployment/resume-deployment-service.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';

describe('ResumeDeploymentService', () => {
  it('prepares resumed state from a failed deployment', async () => {
    let savedState: DeploymentState | undefined;
    const service = new ResumeDeploymentService({
      loadState: async () => ({
        deploymentId: 'deploy-123',
        targetOrg: 'test-org',
        timestamp: '2026-04-20T00:00:00.000Z',
        totalWaves: 4,
        completedWaves: [1],
        currentWave: 2,
        failedWave: {
          waveNumber: 2,
          error: 'UNABLE_TO_LOCK_ROW',
          timestamp: '2026-04-20T00:01:00.000Z',
        },
      }),
      saveState: async (state: DeploymentState) => {
        savedState = state;
      },
    } as never);

    const summary = await service.prepareResume('quick');

    expect(summary).to.deep.include({
      deploymentId: 'deploy-123',
      currentWave: 2,
      totalWaves: 4,
      remainingWaves: 3,
      failureReason: 'UNABLE_TO_LOCK_ROW',
    });
    expect(savedState?.failedWave).to.equal(undefined);
    expect(savedState?.metadata).to.deep.include({
      retryStrategy: 'quick',
      resumedFromWave: 2,
      lastKnownStatus: 'Resumed',
    });
  });

  it('calls remote sf resume when a target org is provided', async () => {
    let savedState: DeploymentState | undefined;
    let remoteCall: { deploymentId: string; targetOrg: string } | undefined;
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: '0AfREMOTE000001',
          targetOrg: 'old-org',
          timestamp: '2026-04-20T00:00:00.000Z',
          totalWaves: 3,
          completedWaves: [1],
          currentWave: 2,
          failedWave: {
            waveNumber: 2,
            error: 'Polling timed out',
            timestamp: '2026-04-20T00:01:00.000Z',
          },
        }),
        saveState: async (state: DeploymentState) => {
          savedState = state;
        },
      } as never,
      {
        resumeDeployment: async (deploymentId, targetOrg) => {
          remoteCall = { deploymentId, targetOrg };
          return {
            success: true,
            deploymentId,
            status: 'Succeeded',
            componentSuccesses: 1,
            componentFailures: 0,
            testsRun: 0,
            testFailures: 0,
            output: '{}',
          };
        },
      }
    );

    const summary = await service.prepareResume('standard', { targetOrg: 'release-org' });

    expect(remoteCall).to.deep.equal({ deploymentId: '0AfREMOTE000001', targetOrg: 'release-org' });
    expect(summary.deploymentId).to.equal('0AfREMOTE000001');
    expect(savedState?.targetOrg).to.equal('release-org');
    expect(savedState?.failedWave).to.equal(undefined);
    expect(savedState?.metadata).to.deep.include({
      retryStrategy: 'standard',
      remoteResumeStatus: 'Succeeded',
      lastKnownStatus: 'Resumed',
      resumedFromWave: 2,
    });
  });

  it('does not mark state resumed when remote sf resume fails', async () => {
    let saveCalled = false;
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: '0AfREMOTE000002',
          targetOrg: 'old-org',
          timestamp: '2026-04-20T00:00:00.000Z',
          totalWaves: 3,
          completedWaves: [1],
          currentWave: 2,
          failedWave: {
            waveNumber: 2,
            error: 'Polling timed out',
            timestamp: '2026-04-20T00:01:00.000Z',
          },
        }),
        saveState: async () => {
          saveCalled = true;
        },
      } as never,
      {
        resumeDeployment: async (deploymentId) => ({
          success: false,
          deploymentId,
          status: 'Failed',
          componentSuccesses: 0,
          componentFailures: 1,
          testsRun: 0,
          testFailures: 0,
          output: 'INVALID_OPERATION: deployment cannot be resumed',
        }),
      }
    );

    try {
      await service.prepareResume('standard', { targetOrg: 'release-org' });
      expect.fail('Expected remote resume failure to throw');
    } catch (error) {
      expect((error as Error).message).to.equal(
        'Remote resume failed: INVALID_OPERATION: deployment cannot be resumed'
      );
    }
    expect(saveCalled).to.equal(false);
  });
});
