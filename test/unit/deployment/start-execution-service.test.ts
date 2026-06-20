import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
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
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

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
      diagnostics: [
        {
          component: 'ApexClass:TestClass',
          problem: 'No such column Missing__c on entity Account',
          probableCause: 'A referenced field is not present in the target org or is deployed in a later wave.',
          remediation:
            'Deploy the missing CustomField before this component, add it to the same or earlier wave, or remove the stale field reference.',
          rawDetails: '{"problem":"No such column Missing__c on entity Account"}',
          category: 'missing-field',
        },
      ],
    };
  }
}

class SequencedSfCli extends SfCliIntegration {
  public readonly deployCalls: DeploymentOptions[] = [];

  public constructor(private readonly results: DeploymentResult[]) {
    super();
  }

  public override async deploy(options: DeploymentOptions): Promise<DeploymentResult> {
    this.deployCalls.push(options);
    const result = this.results[this.deployCalls.length - 1];
    if (!result) {
      throw new Error(`Missing fake deployment result for call ${this.deployCalls.length}`);
    }
    return result;
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
      workingDirectory: tempDir,
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

    expect(state.deploymentId).to.equal('0AfFakeDeployment001');
    expect(state.targetOrg).to.equal('fixture@example.com');
    expect(state.totalWaves).to.equal(1);
    expect(state.currentWave).to.equal(1);
    expect(state.completedWaves).to.deep.equal([]);
    expect(state.failedWave?.waveNumber).to.equal(1);
    expect(state.failedWave?.error).to.include('"status":"Failed"');
    expect(state.failedWave?.error).to.include('Remediation: Deploy the missing CustomField');
    expect(state.metadata?.lastKnownStatus).to.equal('Failed');
    expect(state.metadata?.testFailures).to.equal(1);
    expect(state.metadata?.diagnostics).to.deep.equal([
      {
        component: 'ApexClass:TestClass',
        problem: 'No such column Missing__c on entity Account',
        probableCause: 'A referenced field is not present in the target org or is deployed in a later wave.',
        remediation:
          'Deploy the missing CustomField before this component, add it to the same or earlier wave, or remove the stale field reference.',
        rawDetails: '{"problem":"No such column Missing__c on entity Account"}',
        category: 'missing-field',
      },
    ]);
    expect(state.metadata?.waveGraphContext).to.deep.equal({
      waves: [{ number: 1, components: ['ApexClass:TestClass'] }],
      dependencies: [],
    });
  });

  it('clears persisted deployment state after all waves succeed', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'start-execution-service-'));
    const sfCli = new SequencedSfCli([
      createDeploymentResult({ deploymentId: '0AfFakeDeployment001', status: 'Succeeded', success: true }),
      createDeploymentResult({ deploymentId: '0AfFakeDeployment002', status: 'Succeeded', success: true }),
    ]);
    const classComponent = createComponent(tempDir, 'FirstClass');
    const triggerComponent = createComponent(tempDir, 'SecondTrigger', 'ApexTrigger');
    const context = createDeploymentContext(
      [classComponent, triggerComponent],
      [['ApexClass:FirstClass'], ['ApexTrigger:SecondTrigger']]
    );
    const service = new StartExecutionService({
      createSfCli: () => sfCli,
      createStateManager: (baseDir?: string) => new StateManager({ baseDir }),
      createDeploymentId: () => 'deployment-fixture-002',
    });

    const result = await service.execute({
      dryRun: false,
      validateOnly: false,
      allowCycleRemediation: false,
      skipTests: true,
      targetOrg: 'fixture@example.com',
      sourcePath: tempDir,
      deploymentContext: context,
      log: () => {},
    });

    expect(result.kind).to.equal('executed');
    expect(sfCli.deployCalls).to.have.lengthOf(2);
    expect(sfCli.deployCalls.map((call) => path.basename(call.manifestPath))).to.deep.equal([
      'wave-001.xml',
      'wave-002.xml',
    ]);
    expect(sfCli.deployCalls.map((call) => call.workingDirectory)).to.deep.equal([tempDir, tempDir]);
    await expectMissingFile(path.join(tempDir, '.smart-deployment/deployment-state.json'));
  });

  it('persists completed waves when a later wave fails', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'start-execution-service-'));
    const sfCli = new SequencedSfCli([
      createDeploymentResult({ deploymentId: '0AfFakeDeployment001', status: 'Succeeded', success: true }),
      createDeploymentResult({
        deploymentId: '0AfFakeDeployment002',
        status: 'Failed',
        success: false,
        testFailures: 2,
      }),
    ]);
    const classComponent = createComponent(tempDir, 'FirstClass');
    const triggerComponent = createComponent(tempDir, 'SecondTrigger', 'ApexTrigger');
    const context = createDeploymentContext(
      [classComponent, triggerComponent],
      [['ApexClass:FirstClass'], ['ApexTrigger:SecondTrigger']]
    );
    const service = new StartExecutionService({
      createSfCli: () => sfCli,
      createStateManager: (baseDir?: string) => new StateManager({ baseDir }),
      createDeploymentId: () => 'deployment-fixture-003',
    });

    let thrownError: Error | undefined;
    try {
      await service.execute({
        dryRun: false,
        validateOnly: false,
        allowCycleRemediation: false,
        skipTests: true,
        targetOrg: 'fixture@example.com',
        sourcePath: tempDir,
        deploymentContext: context,
        log: () => {},
      });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.include('Wave 2 failed');
    expect(sfCli.deployCalls).to.have.lengthOf(2);

    const state = JSON.parse(await readFile(path.join(tempDir, '.smart-deployment/deployment-state.json'), 'utf8')) as {
      currentWave?: number;
      completedWaves: number[];
      failedWave?: { waveNumber: number };
      metadata?: Record<string, unknown>;
    };

    expect(state.currentWave).to.equal(2);
    expect(state.completedWaves).to.deep.equal([1]);
    expect(state.failedWave?.waveNumber).to.equal(2);
    expect(state.metadata?.lastKnownStatus).to.equal('Failed');
    expect(state.metadata?.testFailures).to.equal(2);
    expect(state.metadata?.waveGraphContext).to.deep.equal({
      waves: [
        { number: 1, components: ['ApexClass:FirstClass'] },
        { number: 2, components: ['ApexTrigger:SecondTrigger'] },
      ],
      dependencies: [],
    });
  });

  it('executes destructive deployments in reverse wave order', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'start-execution-service-destructive-'));
    const sfCli = new SequencedSfCli([
      createDeploymentResult({ deploymentId: '0AfFakeDeployment002', status: 'Succeeded', success: true }),
      createDeploymentResult({ deploymentId: '0AfFakeDeployment001', status: 'Succeeded', success: true }),
    ]);
    const dependencyComponent = createComponent(tempDir, 'DependencyClass');
    const dependentComponent = createComponent(tempDir, 'DependentTrigger', 'ApexTrigger');
    const context = createDeploymentContext(
      [dependencyComponent, dependentComponent],
      [['ApexClass:DependencyClass'], ['ApexTrigger:DependentTrigger']]
    );
    const service = new StartExecutionService({
      createSfCli: () => sfCli,
      createStateManager: (baseDir?: string) => new StateManager({ baseDir }),
      createDeploymentId: () => 'deployment-fixture-destructive',
    });

    const result = await service.execute({
      dryRun: false,
      validateOnly: false,
      allowCycleRemediation: false,
      skipTests: false,
      destructive: true,
      targetOrg: 'fixture@example.com',
      sourcePath: tempDir,
      deploymentContext: context,
      log: () => {},
    });

    expect(result.kind).to.equal('executed');
    expect(sfCli.deployCalls).to.have.lengthOf(2);
    expect(sfCli.deployCalls.map((call) => path.basename(call.destructiveChangesPath ?? ''))).to.deep.equal([
      'wave-002-destructiveChanges.xml',
      'wave-001-destructiveChanges.xml',
    ]);
    expect(sfCli.deployCalls.every((call) => call.testLevel === 'NoTestRun')).to.equal(true);
  });
});

function createComponent(baseDir: string, name = 'TestClass', type: MetadataType = 'ApexClass'): MetadataComponent {
  return {
    name,
    type,
    filePath: path.join(baseDir, `force-app/main/default/${type}/${name}.xml`),
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function createDeploymentContext(
  components: MetadataComponent | MetadataComponent[],
  waveComponents?: string[][]
): DeploymentContext {
  const componentList = Array.isArray(components) ? components : [components];
  const nodeIds = componentList.map((component) => `${component.type}:${component.name}`);
  const waves = waveComponents ?? [nodeIds];
  return {
    scanResult: {
      components: componentList,
      dependencyResult: {
        components: new Map(componentList.map((component, index) => [nodeIds[index], component])),
        graph: new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()])),
        reverseGraph: new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()])),
        edges: [],
        circularDependencies: [],
        isolatedComponents: nodeIds,
        stats: {
          totalComponents: componentList.length,
          totalDependencies: 0,
          componentsByType: componentList.reduce<Record<string, number>>(
            (counts, component) => ({ ...counts, [component.type]: (counts[component.type] ?? 0) + 1 }),
            {}
          ),
          maxDepth: 0,
          mostDepended: { nodeId: nodeIds[0], count: 0 },
          mostDependencies: { nodeId: nodeIds[0], count: 0 },
        },
      },
      projectRoot: path.dirname(componentList[0].filePath),
      apiVersion: '61.0',
      executionTime: 0,
      errors: [],
      warnings: [],
    },
    orderedWaves: waves.map((componentsInWave, index) => ({
      number: index + 1,
      components: componentsInWave,
      metadata: {
        componentCount: componentsInWave.length,
        types: [...new Set(componentsInWave.map((nodeId) => nodeId.split(':')[0] as MetadataType))],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 0.5,
      },
    })),
    messages: {
      logs: [],
      warnings: [],
    },
  };
}

function createDeploymentResult(options: {
  deploymentId: string;
  status: string;
  success: boolean;
  testFailures?: number;
}): DeploymentResult {
  const testFailures = options.testFailures ?? 0;
  return {
    success: options.success,
    deploymentId: options.deploymentId,
    status: options.status,
    componentSuccesses: options.success ? 1 : 0,
    componentFailures: options.success ? 0 : 1,
    testsRun: 1,
    testFailures,
    output: JSON.stringify({
      result: {
        id: options.deploymentId,
        status: options.status,
        numberComponentsDeployed: options.success ? 1 : 0,
        numberComponentErrors: options.success ? 0 : 1,
        numberTestsTotal: 1,
        numberTestErrors: testFailures,
      },
    }),
  };
}

async function expectMissingFile(filePath: string): Promise<void> {
  let exists = true;
  try {
    await access(filePath);
  } catch {
    exists = false;
  }

  expect(exists).to.equal(false);
}
