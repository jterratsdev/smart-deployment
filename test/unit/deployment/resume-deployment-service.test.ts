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

  it('calls remote resume before saving resumed state when target org is provided', async () => {
    let savedState: DeploymentState | undefined;
    const remoteCalls: string[] = [];
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: '0AfRemoteResume',
          targetOrg: 'test-org',
          timestamp: '2026-04-20T00:00:00.000Z',
          totalWaves: 3,
          completedWaves: [1],
          currentWave: 2,
          failedWave: {
            waveNumber: 2,
            error: 'Timeout waiting for status',
            timestamp: '2026-04-20T00:01:00.000Z',
          },
        }),
        saveState: async (state: DeploymentState) => {
          savedState = state;
        },
      } as never,
      {
        resumeDeployment: async (deploymentId: string) => {
          remoteCalls.push(deploymentId);
          return {
            success: true,
            deploymentId: '0AfRemoteResume',
            status: 'Succeeded',
            componentSuccesses: 1,
            componentFailures: 0,
            output: '{}',
          };
        },
      } as never
    );

    const summary = await service.prepareResume('standard', { targetOrg: 'test-org' });

    expect(summary.deploymentId).to.equal('0AfRemoteResume');
    expect(remoteCalls).to.deep.equal(['0AfRemoteResume']);
    expect(savedState?.failedWave).to.equal(undefined);
    expect(savedState?.metadata).to.deep.include({
      remoteResumeStatus: 'Succeeded',
      retryStrategy: 'standard',
      resumedFromWave: 2,
    });
  });
});
