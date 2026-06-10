import { mkdtemp, rm } from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { DeploymentStatusService } from '../../../src/deployment/deployment-status-service.js';
import { StateManager } from '../../../src/deployment/state-manager.js';

describe('DeploymentStatusService', () => {
  let testDir: string;
  let stateManager: StateManager;
  let service: DeploymentStatusService;

  beforeEach(async () => {
    testDir = await mkdtemp(path.join(os.tmpdir(), 'deployment-status-service-'));
    stateManager = new StateManager({ baseDir: testDir });
    service = new DeploymentStatusService(stateManager);
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  it('returns not-started when no deployment state exists', async () => {
    const summary = await service.getStatus();

    expect(summary.hasState).to.equal(false);
    expect(summary.status).to.equal('not-started');
    expect(summary.currentWave).to.equal(0);
    expect(summary.totalWaves).to.equal(0);
    expect(summary.remainingWaves).to.deep.equal([]);
  });

  it('returns failed status and resumable details for failed deployments', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-123',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
      metadata: {
        testLevel: 'RunLocalTests',
      },
    });

    const summary = await service.getStatus();

    expect(summary.hasState).to.equal(true);
    expect(summary.status).to.equal('failed');
    expect(summary.currentWave).to.equal(3);
    expect(summary.remainingWaves).to.deep.equal([3, 4]);
    expect(summary.resumable).to.equal(true);
    expect(summary.testStatus).to.equal('pending');
  });

  it('rebuilds a wave graph from persisted wave context', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-wave-graph',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 3,
        error: 'FIELD_INTEGRITY_EXCEPTION',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
      metadata: {
        waveGraphContext: {
          waves: [
            { number: 1, components: ['CustomObject:Account'] },
            { number: 2, components: ['CustomField:Account.External_Id__c'] },
            { number: 3, components: ['ApexClass:AccountService'] },
          ],
          dependencies: [
            { from: 'CustomField:Account.External_Id__c', to: 'CustomObject:Account' },
            { from: 'ApexClass:AccountService', to: 'CustomField:Account.External_Id__c' },
          ],
        },
      },
    });

    const summary = await service.getStatus();

    expect(summary.waveGraph?.nodes.map((node) => node.status)).to.deep.equal(['completed', 'current', 'failed']);
    expect(summary.waveGraph?.edges).to.include.deep.members([
      { fromWave: 1, toWave: 2, kind: 'dependency', dependencyCount: 1 },
      { fromWave: 2, toWave: 3, kind: 'dependency', dependencyCount: 1 },
    ]);
  });

  it('omits the wave graph for legacy state without wave context', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-legacy',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
    });

    const summary = await service.getStatus();

    expect(summary.hasState).to.equal(true);
    expect(summary.waveGraph).to.equal(undefined);
  });

  it('refreshes persisted state from remote deployment report when a target org is provided', async () => {
    await stateManager.saveState({
      deploymentId: '0AfREMOTE000001',
      targetOrg: 'old-org',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [],
      currentWave: 1,
      failedWave: {
        waveNumber: 1,
        error: 'Polling timed out',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
    });
    const refreshedService = new DeploymentStatusService(stateManager, {
      checkDeploymentStatus: async (deploymentId, targetOrg) => {
        expect(deploymentId).to.equal('0AfREMOTE000001');
        expect(targetOrg).to.equal('release-org');
        return {
          success: true,
          deploymentId,
          status: 'Succeeded',
          componentSuccesses: 2,
          componentFailures: 0,
          testsRun: 3,
          testFailures: 0,
          output: '{}',
        };
      },
    });

    const summary = await refreshedService.getStatus({ targetOrg: 'release-org' });
    const savedState = await stateManager.loadState();

    expect(summary.status).to.equal('completed');
    expect(summary.resumable).to.equal(false);
    expect(summary.completedWaves).to.deep.equal([1, 2]);
    expect(savedState?.failedWave).to.equal(undefined);
    expect(savedState?.targetOrg).to.equal('release-org');
    expect(savedState?.metadata).to.deep.include({
      lastKnownStatus: 'Succeeded',
      remoteStatus: 'Succeeded',
      remoteComponentSuccesses: 2,
      remoteTestsRun: 3,
    });
  });

  it('keeps a remote in-progress deployment resumable false without treating success false as failure', async () => {
    await stateManager.saveState({
      deploymentId: '0AfREMOTE000002',
      targetOrg: 'old-org',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'Earlier polling timeout',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
    });
    const refreshedService = new DeploymentStatusService(stateManager, {
      checkDeploymentStatus: async (deploymentId, targetOrg) => {
        expect(deploymentId).to.equal('0AfREMOTE000002');
        expect(targetOrg).to.equal('release-org');
        return {
          success: false,
          deploymentId,
          status: 'InProgress',
          componentSuccesses: 1,
          componentFailures: 0,
          testsRun: 1,
          testFailures: 0,
          output: '{}',
        };
      },
    });

    const summary = await refreshedService.getStatus({ targetOrg: 'release-org' });
    const savedState = await stateManager.loadState();

    expect(summary.status).to.equal('in-progress');
    expect(summary.resumable).to.equal(false);
    expect(savedState?.failedWave).to.equal(undefined);
    expect(savedState?.metadata).to.deep.include({
      lastKnownStatus: 'InProgress',
      remoteStatus: 'InProgress',
    });
  });

  it('returns a resume summary for failed deployments', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-456',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
    });

    const resume = await service.getResumeSummary();

    expect(resume.success).to.equal(true);
    expect(resume.resumeWave).to.equal(2);
    expect(resume.completedWaves).to.deep.equal([1]);
    expect(resume.remainingWaves).to.deep.equal([2, 3]);
  });

  it('formats the status report with failure details', async () => {
    await stateManager.saveState({
      deploymentId: 'deploy-789',
      targetOrg: 'test@example.com',
      timestamp: '2026-04-20T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'FIELD_INTEGRITY_EXCEPTION',
        timestamp: '2026-04-20T00:00:10.000Z',
      },
      metadata: {
        skipTests: true,
      },
      cycleRemediation: {
        cycleId: 'ApexClass:Alpha|ApexClass:Beta',
        strategy: 'comment-reference',
        activePhase: 2,
        startedAt: '2026-04-20T00:00:05.000Z',
        completedPhases: [1],
        editRecords: [],
      },
    });

    const summary = await service.getStatus();
    const formatted = service.formatStatus(summary);

    expect(formatted).to.include('Status: Failed');
    expect(formatted).to.include('Current Wave: 2/2');
    expect(formatted).to.include('Failure: Wave 2 - FIELD_INTEGRITY_EXCEPTION');
    expect(formatted).to.include('Cycle Remediation: Phase 2 of 2');
    expect(formatted).to.include('Remediation Strategy: comment-reference');
    expect(formatted).to.include('Test Status: No tests run');
  });
});
