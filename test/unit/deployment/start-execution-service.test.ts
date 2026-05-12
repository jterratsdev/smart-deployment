import { mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { StartExecutionService } from '../../../src/deployment/start-execution-service.js';
import {
  SfCliIntegration,
  type DeploymentOptions,
  type DeploymentResult,
} from '../../../src/deployment/sf-cli-integration.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

class FailingSfCli extends SfCliIntegration {
  public readonly deployCalls: DeploymentOptions[] = [];

  public override async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    this.deployCalls.push(options);
    return {
      success: false,
      deploymentId: '0AfFakeDeployment001',
      status: 'Failed',
      componentSuccesses: 0,
      componentFailures: 1,
      testsRun: 1,
      testFailures: 1,
      output: JSON.stringify({
        result: {
          id: '0AfFakeDeployment001',
          status: 'Failed',
          numberComponentsDeployed: 0,
          numberComponentErrors: 1,
          numberTestsTotal: 1,
          numberTestErrors: 1,
        },
      }),
    };
  }
}

describe('StartExecutionService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('generates a manifest and persists failed wave state for a real deployment attempt', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'start-execution-service-'));
    const sfCli = new FailingSfCli();
    const component = createComponent(tempDir);
    const context = createDeploymentContext(component);
    const service = new StartExecutionService({
      createSfCli: () => sfCli,
      createStateManager: (baseDir?: string) => new StateManager({ baseDir }),
      createDeploymentId: () => 'deployment-fixture-001',
    });

    let thrownError: Error | undefined;
    try {
      await service.execute({
        dryRun: false,
        validateOnly: false,
        allowCycleRemediation: false,
        skipTests: false,
        targetOrg: 'fixture@example.com',
        sourcePath: tempDir,
        deploymentContext: context,
        log: () => {},
      });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.include('Wave 1 failed');
    expect(sfCli.deployCalls).to.have.lengthOf(1);
    expect(sfCli.deployCalls[0]).to.include({
      targetOrg: 'fixture@example.com',
    });
    expect(sfCli.deployCalls[0].manifestPath).to.match(/wave-001\.xml$/);

    const manifest = await readFile(path.join(tempDir, '.smart-deployment/manifests/wave-001.xml'), 'utf8');
    expect(manifest).to.include('<members>TestClass</members>');
    expect(manifest).to.include('<name>ApexClass</name>');

    const state = JSON.parse(await readFile(path.join(tempDir, '.smart-deployment/deployment-state.json'), 'utf8')) as {
      deploymentId: string;
      targetOrg: string;
      totalWaves: number;
      currentWave?: number;
      completedWaves: number[];
      failedWave?: { waveNumber: number; error: string };
      metadata?: Record<string, unknown>;
    };

    expect(state.deploymentId).to.equal('deployment-fixture-001');
    expect(state.targetOrg).to.equal('fixture@example.com');
    expect(state.totalWaves).to.equal(1);
    expect(state.currentWave).to.equal(1);
    expect(state.completedWaves).to.deep.equal([]);
    expect(state.failedWave?.waveNumber).to.equal(1);
    expect(state.failedWave?.error).to.include('"status":"Failed"');
    expect(state.metadata?.lastKnownStatus).to.equal('Failed');
    expect(state.metadata?.testFailures).to.equal(1);
  });
});

function createComponent(baseDir: string): MetadataComponent {
  return {
    name: 'TestClass',
    type: 'ApexClass',
    filePath: path.join(baseDir, 'force-app/main/default/classes/TestClass.cls'),
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function createDeploymentContext(component: MetadataComponent): DeploymentContext {
  const nodeId = 'ApexClass:TestClass';
  return {
    scanResult: {
      components: [component],
      dependencyResult: {
        components: new Map([[nodeId, component]]),
        graph: new Map([[nodeId, new Set()]]),
        reverseGraph: new Map([[nodeId, new Set()]]),
        edges: [],
        circularDependencies: [],
        isolatedComponents: [nodeId],
        stats: {
          totalComponents: 1,
          totalDependencies: 0,
          componentsByType: { ApexClass: 1 },
          maxDepth: 0,
          mostDepended: { nodeId, count: 0 },
          mostDependencies: { nodeId, count: 0 },
        },
      },
      projectRoot: path.dirname(component.filePath),
      executionTime: 0,
      errors: [],
      warnings: [],
    },
    orderedWaves: [
      {
        number: 1,
        components: [nodeId],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 0,
          hasCircularDeps: false,
          estimatedTime: 0.5,
        },
      },
    ],
    messages: {
      logs: [],
      warnings: [],
    },
  };
}
