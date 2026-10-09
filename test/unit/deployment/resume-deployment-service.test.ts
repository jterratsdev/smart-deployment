import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResumeDeploymentService } from '../../../src/deployment/resume-deployment-service.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';
import { createDeploymentPlanFingerprint, createSourceFingerprint } from '../../../src/types/manual-checkpoint.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { StartExecutionOptions } from '../../../src/deployment/start-execution-service.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

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

  it('approves a manual checkpoint and continues from the persisted execution index', async () => {
    const waves = [createWave(1), createWave(2)];
    const checkpoints = [{ id: 'activate-table', phase: 'after' as const, waveNumber: 1 }];
    const planFingerprint = createDeploymentPlanFingerprint({
      waves,
      checkpoints,
      destructive: false,
      skipTests: true,
      apiVersion: '66.0',
      sourceFingerprint: await createSourceFingerprint(new Map()),
    });
    const context = createContext(waves);
    let executionOptions: StartExecutionOptions | undefined;
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: 'deploy-checkpoint',
          targetOrg: 'test-org',
          timestamp: '2026-08-05T00:00:00.000Z',
          totalWaves: 2,
          completedWaves: [1],
          currentWave: 2,
          status: 'paused',
          pausedCheckpoint: {
            ...checkpoints[0],
            deploymentId: 'deploy-checkpoint',
            executionIndex: 1,
            totalExecutionWaves: 2,
            reachedAt: '2026-08-05T00:00:00.000Z',
            planFingerprint,
          },
          execution: {
            sourcePath: '/fixture',
            orderedWaveNumbers: [1, 2],
            nextExecutionIndex: 1,
            destructive: false,
            skipTests: true,
            apiVersion: '66.0',
            planFingerprint,
            checkpoints,
          },
        }),
      } as never,
      undefined,
      {
        deploymentContextService: { buildContext: async () => context } as never,
        loadConfig: async () => ({ checkpoints }),
        startExecutionService: {
          execute: async (options: StartExecutionOptions) => {
            executionOptions = options;
            return { kind: 'completed' as const, postconditions: [] };
          },
        } as never,
      }
    );

    const result = await service.resumeCheckpoint({ approveCheckpoint: 'activate-table' });

    expect(result).to.deep.equal({ kind: 'completed', postconditions: [] });
    expect(executionOptions?.deploymentId).to.equal('deploy-checkpoint');
    expect(executionOptions?.startExecutionIndex).to.equal(1);
    expect([...(executionOptions?.approvedCheckpointIds ?? [])]).to.deep.equal(['activate-table']);
  });

  it('rejects checkpoint continuation when the source-derived plan changes', async () => {
    const originalWaves = [createWave(1)];
    const changedWaves = [createWave(1), createWave(2)];
    const checkpoints = [{ id: 'approval', phase: 'before' as const, waveNumber: 1 }];
    const planFingerprint = createDeploymentPlanFingerprint({
      waves: originalWaves,
      checkpoints,
      destructive: false,
      skipTests: true,
      apiVersion: '66.0',
      sourceFingerprint: await createSourceFingerprint(new Map()),
    });
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: 'deploy-changed',
          targetOrg: 'test-org',
          timestamp: '2026-08-05T00:00:00.000Z',
          totalWaves: 1,
          completedWaves: [],
          currentWave: 1,
          pausedCheckpoint: {
            ...checkpoints[0],
            deploymentId: 'deploy-changed',
            executionIndex: 0,
            totalExecutionWaves: 1,
            reachedAt: '2026-08-05T00:00:00.000Z',
            planFingerprint,
          },
          execution: {
            sourcePath: '/fixture',
            orderedWaveNumbers: [1],
            nextExecutionIndex: 0,
            destructive: false,
            skipTests: true,
            apiVersion: '66.0',
            planFingerprint,
            checkpoints,
          },
        }),
      } as never,
      undefined,
      {
        deploymentContextService: { buildContext: async () => createContext(changedWaves) } as never,
        loadConfig: async () => ({ checkpoints }),
      }
    );

    let thrownError: Error | undefined;
    try {
      await service.resumeCheckpoint({ approveCheckpoint: 'approval' });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.include('Deployment plan changed');
  });

  it('continues a failed local wave from its persisted execution index', async () => {
    const waves = [createWave(1), createWave(2)];
    const sourceFingerprint = await createSourceFingerprint(new Map());
    const planFingerprint = createDeploymentPlanFingerprint({
      waves,
      checkpoints: [],
      destructive: false,
      skipTests: true,
      apiVersion: '66.0',
      sourceFingerprint,
    });
    let executionOptions: StartExecutionOptions | undefined;
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: 'deploy-failed-local',
          targetOrg: 'test-org',
          timestamp: '2026-08-05T00:00:00.000Z',
          totalWaves: 2,
          completedWaves: [1],
          currentWave: 2,
          failedWave: { waveNumber: 2, error: 'failed', timestamp: '2026-08-05T00:00:00.000Z' },
          execution: {
            sourcePath: '/fixture',
            orderedWaveNumbers: [1, 2],
            nextExecutionIndex: 1,
            destructive: false,
            skipTests: true,
            apiVersion: '66.0',
            planFingerprint,
            checkpoints: [],
          },
        }),
      } as never,
      undefined,
      {
        deploymentContextService: { buildContext: async () => createContext(waves) } as never,
        startExecutionService: {
          execute: async (options: StartExecutionOptions) => {
            executionOptions = options;
            return { kind: 'completed' as const, postconditions: [] };
          },
        } as never,
      }
    );

    const result = await service.resumeFailedWaves();

    expect(result).to.deep.equal({ kind: 'completed', postconditions: [] });
    expect(executionOptions?.startExecutionIndex).to.equal(1);
    expect(executionOptions?.deploymentId).to.equal('deploy-failed-local');
  });

  it('resumes legacy checkpoint state whose fingerprint omitted postconditions', async () => {
    await assertLegacyStateResumes('checkpoint');
  });

  it('resumes legacy failed-wave state whose fingerprint omitted postconditions', async () => {
    await assertLegacyStateResumes('failed');
  });

  it('resumes a postcondition at the next cursor without redeploying the completed OWD wave', async () => {
    const waves = [createNamedWave(1, 'CustomObject:Case'), createNamedWave(2, 'SharingRules:Case')];
    const componentMap = new Map([
      [
        'CustomObject:Case',
        {
          name: 'Case',
          type: 'CustomObject' as const,
          filePath: '/missing/Case.object-meta.xml',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
          facts: { kind: 'custom-object-sharing-model' as const, sharingModel: 'Private' },
        },
      ],
      [
        'SharingRules:Case',
        {
          name: 'Case',
          type: 'SharingRules' as const,
          filePath: '/missing/Case.sharingRules-meta.xml',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
          facts: { kind: 'sharing-rules' as const, objectName: 'Case', criteriaFields: [], principals: [] },
        },
      ],
    ]);
    const postconditions = [
      {
        id: 'owd:Case:Private',
        kind: 'owd-internal-sharing-model' as const,
        objectName: 'Case',
        afterWaveNumber: 1,
        expectedInternalSharingModel: 'Private',
      },
    ];
    const planFingerprint = createDeploymentPlanFingerprint({
      waves,
      checkpoints: [],
      postconditions,
      destructive: false,
      skipTests: true,
      apiVersion: '66.0',
      sourceFingerprint: await createSourceFingerprint(componentMap),
    });
    let options: StartExecutionOptions | undefined;
    const service = new ResumeDeploymentService(
      {
        loadState: async () => ({
          deploymentId: 'deploy-owd',
          targetOrg: 'org',
          timestamp: '2026-09-30T00:00:00.000Z',
          totalWaves: 2,
          completedWaves: [1],
          currentWave: 2,
          status: 'paused',
          pausedPostcondition: {
            ...postconditions[0],
            status: 'timed-out',
            attempts: 3,
            waitedMs: 1000,
            pausedAt: '2026-09-30T00:00:00.000Z',
          },
          execution: {
            sourcePath: '/fixture',
            orderedWaveNumbers: [1, 2],
            nextExecutionIndex: 1,
            destructive: false,
            skipTests: true,
            apiVersion: '66.0',
            planFingerprint,
            checkpoints: [],
            postconditions,
          },
        }),
      } as never,
      undefined,
      {
        deploymentContextService: { buildContext: async () => createContext(waves, componentMap) } as never,
        startExecutionService: {
          execute: async (received: StartExecutionOptions) => {
            options = received;
            return {
              kind: 'completed' as const,
              postconditions: [
                {
                  ...postconditions[0],
                  status: 'satisfied' as const,
                  observedInternalSharingModel: 'Private',
                  attempts: 2,
                  waitedMs: 250,
                  resumedPhase: 2,
                },
              ],
            };
          },
        } as never,
      }
    );

    const result = await service.resumePostcondition();
    expect(result).to.deep.include({ kind: 'completed' });
    if (result.kind !== 'completed') throw new Error('Expected completed resume result');
    expect(result.postconditions[0]).to.deep.include({
      status: 'satisfied',
      observedInternalSharingModel: 'Private',
      attempts: 5,
      waitedMs: 1250,
      resumedPhase: 2,
    });
    expect(options?.startExecutionIndex).to.equal(1);
    expect(options?.postconditions).to.deep.equal(postconditions);
  });
});

function createWave(number: number): Wave {
  return {
    number,
    components: [`ApexClass:Class${number}`],
    metadata: { componentCount: 1, types: ['ApexClass'], maxDepth: 0, hasCircularDeps: false, estimatedTime: 0 },
  };
}

async function assertLegacyStateResumes(kind: 'checkpoint' | 'failed'): Promise<void> {
  const waves = [createWave(1), createWave(2)];
  const checkpoints = kind === 'checkpoint' ? [{ id: 'legacy', phase: 'after' as const, waveNumber: 1 }] : [];
  const sourceFingerprint = await createSourceFingerprint(new Map());
  const legacyFingerprint = createDeploymentPlanFingerprint({
    waves,
    checkpoints,
    destructive: false,
    skipTests: true,
    apiVersion: '66.0',
    sourceFingerprint,
  });
  let called = false;
  const state: DeploymentState = {
    deploymentId: `legacy-${kind}`,
    targetOrg: 'org',
    timestamp: '2026-01-01T00:00:00.000Z',
    totalWaves: 2,
    completedWaves: [1],
    currentWave: 2,
    ...(kind === 'checkpoint'
      ? {
          pausedCheckpoint: {
            ...checkpoints[0],
            deploymentId: 'legacy-checkpoint',
            executionIndex: 1,
            totalExecutionWaves: 2,
            reachedAt: '2026-01-01T00:00:00.000Z',
            planFingerprint: legacyFingerprint,
          },
        }
      : { failedWave: { waveNumber: 2, error: 'failed', timestamp: '2026-01-01T00:00:00.000Z' } }),
    execution: {
      sourcePath: '/fixture',
      orderedWaveNumbers: [1, 2],
      nextExecutionIndex: 1,
      destructive: false,
      skipTests: true,
      apiVersion: '66.0',
      planFingerprint: legacyFingerprint,
      checkpoints,
    },
  };
  const service = new ResumeDeploymentService(stateManagerStub(state), undefined, {
    deploymentContextService: { buildContext: async () => createContext(waves) } as never,
    loadConfig: async () => ({ checkpoints }),
    startExecutionService: {
      execute: async () => {
        called = true;
        return { kind: 'completed' as const, postconditions: [] };
      },
    } as never,
  });

  if (kind === 'checkpoint') await service.resumeCheckpoint({ approveCheckpoint: 'legacy' });
  else await service.resumeFailedWaves();
  expect(called).to.equal(true);
}

function stateManagerStub(state: DeploymentState): never {
  return { loadState: async () => state } as never;
}

function createNamedWave(number: number, nodeId: string): Wave {
  return {
    number,
    components: [nodeId],
    metadata: { componentCount: 1, types: [], maxDepth: 0, hasCircularDeps: false, estimatedTime: 0 },
  };
}

function createContext(waves: Wave[], components = new Map()): DeploymentContext {
  return {
    scanResult: {
      components: [],
      dependencyResult: {
        components,
        graph: new Map(),
        reverseGraph: new Map(),
        edges: [],
        circularDependencies: [],
        isolatedComponents: [],
        stats: {
          totalComponents: 0,
          totalDependencies: 0,
          componentsByType: {},
          maxDepth: 0,
          mostDepended: { nodeId: '', count: 0 },
          mostDependencies: { nodeId: '', count: 0 },
        },
      },
      projectRoot: '/fixture',
      apiVersion: '66.0',
      executionTime: 0,
      errors: [],
      warnings: [],
    },
    orderedWaves: waves,
    messages: { logs: [], warnings: [] },
  };
}
