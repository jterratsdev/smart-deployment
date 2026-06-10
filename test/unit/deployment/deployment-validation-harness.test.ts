import { access, chmod, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, beforeEach, describe, it } from 'mocha';
import { DeploymentRunner } from '../../../src/deployment/deployment-runner.js';
import { DeploymentTracker } from '../../../src/deployment/deployment-tracker.js';
import { SfCliIntegration } from '../../../src/deployment/sf-cli-integration.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import { TestExecutor } from '../../../src/deployment/test-executor.js';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

type FakeSfInvocation = {
  args: string[];
  cwd: string;
  manifestPath?: string;
  manifest?: string;
  scenario?: string;
};

const fakeSfScript = `#!/usr/bin/env node
const { appendFileSync, readFileSync } = require('node:fs');

const args = process.argv.slice(2);
const logPath = process.env.SMART_DEPLOYMENT_FAKE_SF_LOG;
const scenario = process.env.SMART_DEPLOYMENT_FAKE_SF_SCENARIO || 'success';

function flagValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function record(extra = {}) {
  const manifestPath = flagValue('--manifest');
  let manifest;
  if (manifestPath) {
    try {
      manifest = readFileSync(manifestPath, 'utf8');
    } catch (error) {
      manifest = String(error);
    }
  }

  if (logPath) {
    appendFileSync(logPath, JSON.stringify({ args, cwd: process.cwd(), manifestPath, manifest, ...extra }) + '\\n');
  }
}

function printDeployResult(result) {
  process.stdout.write(JSON.stringify({ status: result.status === 'Succeeded' ? 0 : 1, result }, null, 2) + '\\n');
}

if (args.join(' ').startsWith('project deploy start')) {
  record({ command: 'start', scenario });

  if (scenario === 'partial-failure') {
    process.stderr.write(JSON.stringify({ status: 1, result: {
      id: '0AfPARTIAL000001',
      status: 'Failed',
      numberComponentsDeployed: 1,
      numberComponentErrors: 1,
      numberTestsTotal: 2,
      numberTestErrors: 1,
      details: { componentFailures: [{ fullName: 'HarnessService', problem: 'Missing field Account.Legacy_Id__c' }] },
    } }, null, 2) + '\\n');
    process.exit(1);
  }

  if (scenario === 'timeout') {
    process.stderr.write('Polling timed out before deployment completed. Use sf project deploy report --job-id 0AfTIMEOUT00001 --json.\\n');
    process.exit(1);
  }

  printDeployResult({
    id: '0AfSUCCESS000001',
    status: 'Succeeded',
    numberComponentsDeployed: 1,
    numberComponentErrors: 0,
    numberTestsTotal: 0,
    numberTestErrors: 0,
  });
  process.exit(0);
}

record({ command: 'unknown', scenario });
process.stderr.write('Unexpected fake sf invocation: ' + args.join(' ') + '\\n');
process.exit(1);
`;

describe('Deployment validation harness', () => {
  let tempDir: string;
  let originalPath: string | undefined;
  let originalScenario: string | undefined;
  let originalLog: string | undefined;

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'deployment-validation-harness-'));
    originalPath = process.env.PATH;
    originalScenario = process.env.SMART_DEPLOYMENT_FAKE_SF_SCENARIO;
    originalLog = process.env.SMART_DEPLOYMENT_FAKE_SF_LOG;
  });

  afterEach(async () => {
    restoreEnv('PATH', originalPath);
    restoreEnv('SMART_DEPLOYMENT_FAKE_SF_SCENARIO', originalScenario);
    restoreEnv('SMART_DEPLOYMENT_FAKE_SF_LOG', originalLog);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('executes a successful start-style deployment through fake sf and generated manifests', async () => {
    const harness = await createHarness('success');
    const projectRoot = await createHarnessProject('success-project');

    await executeRunner(projectRoot, 'deployment-success');

    const invocations = await readFakeSfInvocations(harness.logPath);
    const stateExists = await fileExists(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'));

    expect(invocations).to.have.length(1);
    expect(invocations[0].args).to.include.members([
      'project',
      'deploy',
      'start',
      '--target-org',
      'harness@example.com',
      '--json',
      '--wait',
      '60',
    ]);
    expect(invocations[0].args).to.include('--manifest');
    expect(invocations[0].args).to.include('--test-level');
    expect(invocations[0].args).to.include('NoTestRun');
    expect(invocations[0].cwd).to.equal(await realpath(projectRoot));
    expect(invocations[0].manifestPath).to.match(/wave-001\.xml$/u);
    expect(invocations[0].manifest).to.include('<members>HarnessService</members>');
    expect(invocations[0].manifest).to.include('<name>ApexClass</name>');
    expect(stateExists).to.equal(false);
  });

  it('persists failed wave state when fake sf reports partial deployment failure', async () => {
    const harness = await createHarness('partial-failure');
    const projectRoot = await createHarnessProject('partial-failure-project');

    let thrownError: Error | undefined;
    try {
      await executeRunner(projectRoot, 'deployment-partial-failure');
    } catch (error) {
      thrownError = error as Error;
    }

    const state = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), 'utf8')
    ) as DeploymentState;
    const invocations = await readFakeSfInvocations(harness.logPath);

    expect(thrownError?.message).to.include('Wave 1 failed');
    expect(state.deploymentId).to.equal('deployment-partial-failure');
    expect(state.failedWave?.waveNumber).to.equal(1);
    expect(state.failedWave?.error).to.include('Missing field Account.Legacy_Id__c');
    expect(state.metadata).to.deep.include({
      lastKnownStatus: 'Failed',
      testsRun: 2,
      testFailures: 1,
    });
    expect(invocations).to.have.length(1);
    expect(invocations[0].manifest).to.include('<members>HarnessService</members>');
  });

  it('persists timeout diagnostics when fake sf start exits before completion', async () => {
    const harness = await createHarness('timeout');
    const projectRoot = await createHarnessProject('timeout-project');

    let thrownError: Error | undefined;
    try {
      await executeRunner(projectRoot, 'deployment-timeout');
    } catch (error) {
      thrownError = error as Error;
    }

    const state = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), 'utf8')
    ) as DeploymentState;
    const invocations = await readFakeSfInvocations(harness.logPath);

    expect(thrownError?.message).to.include('Polling timed out before deployment completed');
    expect(state.deploymentId).to.equal('deployment-timeout');
    expect(state.failedWave?.error).to.include('Polling timed out');
    expect(state.metadata?.lastKnownStatus).to.equal('Failed');
    expect(invocations).to.have.length(1);
  });

  async function createHarness(scenario: string): Promise<{ logPath: string }> {
    const binDir = path.join(tempDir, 'fake-bin');
    const fakeSfPath = path.join(binDir, 'sf');
    const logPath = path.join(tempDir, `${scenario}-sf-invocations.jsonl`);

    await mkdir(binDir, { recursive: true });
    await writeFile(fakeSfPath, fakeSfScript, 'utf8');
    await chmod(fakeSfPath, 0o755);
    await writeFile(logPath, '', 'utf8');

    process.env.PATH = `${binDir}${path.delimiter}${process.env.PATH ?? ''}`;
    process.env.SMART_DEPLOYMENT_FAKE_SF_SCENARIO = scenario;
    process.env.SMART_DEPLOYMENT_FAKE_SF_LOG = logPath;

    return { logPath };
  }

  async function createHarnessProject(projectName: string): Promise<string> {
    const projectRoot = path.join(tempDir, projectName);
    const classesDir = path.join(projectRoot, 'force-app/main/default/classes');
    await mkdir(classesDir, { recursive: true });
    await writeFile(
      path.join(projectRoot, 'sfdx-project.json'),
      JSON.stringify(
        {
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '61.0',
        },
        null,
        2
      ),
      'utf8'
    );
    await writeFile(path.join(projectRoot, '.forceignore'), '', 'utf8');
    await writeFile(path.join(classesDir, 'HarnessService.cls'), 'public class HarnessService {}\n', 'utf8');
    await writeFile(
      path.join(classesDir, 'HarnessService.cls-meta.xml'),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
      'utf8'
    );
    return projectRoot;
  }
});

async function executeRunner(projectRoot: string, deploymentId: string): Promise<void> {
  const component = createHarnessComponent(projectRoot);
  const nodeId = 'ApexClass:HarnessService';

  await new DeploymentRunner().execute({
    deploymentId,
    targetOrg: 'harness@example.com',
    sourcePath: projectRoot,
    orderedWaves: [createHarnessWave(nodeId)],
    dependencyGraph: new Map([[nodeId, new Set<string>()]]),
    componentMap: new Map([[nodeId, component]]),
    apiVersion: '61.0',
    skipTests: true,
    testExecutor: new TestExecutor(),
    tracker: new DeploymentTracker(),
    stateManager: new StateManager({ baseDir: projectRoot }),
    sfCli: new SfCliIntegration(),
    log: () => undefined,
  });
}

function createHarnessComponent(projectRoot: string): MetadataComponent {
  return {
    name: 'HarnessService',
    type: 'ApexClass',
    filePath: path.join(projectRoot, 'force-app/main/default/classes/HarnessService.cls'),
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function createHarnessWave(nodeId: string): Wave {
  return {
    number: 1,
    components: [nodeId],
    metadata: {
      componentCount: 1,
      types: ['ApexClass'],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 60,
    },
  };
}

async function readFakeSfInvocations(logPath: string): Promise<FakeSfInvocation[]> {
  const content = await readFile(logPath, 'utf8');
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FakeSfInvocation);
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}
