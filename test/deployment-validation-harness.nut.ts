import { execFile } from 'node:child_process';
import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommandWithOptions,
  parseJsonStdout,
} from './helpers/nut-helpers.js';
import { writeDeploymentState } from './nut/command-fixtures.js';

type FakeSfInvocation = {
  args: string[];
  cwd: string;
};

type ValidateResult = {
  success: boolean;
  components: number;
  issueCount: number;
};

type StatusResult = {
  status: string;
  canResume: boolean;
  currentWave: number;
};

type ResumeResult = {
  success: boolean;
  resumedFromWave: number;
  remainingWaves: number;
  deploymentId: string;
};

const execFileAsync = promisify(execFile);

const fakeSfScript = `#!/usr/bin/env node
const { appendFileSync } = require('node:fs');

const args = process.argv.slice(2);
const logPath = process.env.SMART_DEPLOYMENT_FAKE_SF_LOG;
const scenario = process.env.SMART_DEPLOYMENT_FAKE_SF_SCENARIO || 'success';

function flagValue(name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

function record(extra = {}) {
  if (logPath) {
    appendFileSync(logPath, JSON.stringify({ args, cwd: process.cwd(), ...extra }) + '\\n');
  }
}

function printDeployResult(result) {
  process.stdout.write(JSON.stringify({ status: result.status === 'Succeeded' ? 0 : 1, result }, null, 2) + '\\n');
}

if (args.join(' ').startsWith('project deploy report')) {
  record({ command: 'report', scenario });
  printDeployResult({
    id: flagValue('--job-id') || '0AfREPORT000001',
    status: scenario === 'status-polling' ? 'InProgress' : 'Succeeded',
    numberComponentsDeployed: scenario === 'status-polling' ? 1 : 2,
    numberComponentErrors: 0,
    numberTestsTotal: 0,
    numberTestErrors: 0,
  });
  process.exit(0);
}

if (args.join(' ').startsWith('project deploy resume')) {
  record({ command: 'resume', scenario });
  printDeployResult({
    id: flagValue('--job-id') || '0AfRESUME000001',
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

describe('NUT: production-like deployment command validation harness', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('validate remains local-only while deterministic sf fixtures expose report and resume responses', async () => {
    const harness = await createHarness('status-polling');
    const projectRoot = await createHarnessProject(harness.tempDir, 'validate-local-project');

    const validateResult = execNutCommandWithOptions<ValidateResult>(
      `validate --source-path ${projectRoot} --json`,
      harness.commandOptions
    );
    const validate = parseJsonStdout<ValidateResult>(validateResult.shellOutput.stdout);
    const emptyInvocations = await readFakeSfInvocations(harness.logPath);

    expect(validate.success).to.equal(true);
    expect(validate.components).to.equal(1);
    expect(validate.issueCount).to.equal(0);
    expect(emptyInvocations).to.deep.equal([]);

    await runFakeSfFixture(harness, ['project', 'deploy', 'report', '--job-id', '0AfPOLL000001', '--json']);
    await runFakeSfFixture(harness, ['project', 'deploy', 'resume', '--job-id', '0AfPOLL000001', '--json']);
    const invocations = await readFakeSfInvocations(harness.logPath);

    expect(invocations.map((invocation) => invocation.args.slice(0, 3).join(' '))).to.deep.equal([
      'project deploy report',
      'project deploy resume',
    ]);
  });

  it('status refreshes remote deployment state and prints real command JSON output', async () => {
    const harness = await createHarness('success');
    const projectRoot = await createHarnessProject(harness.tempDir, 'status-remote-refresh-project');

    await writeDeploymentState(projectRoot, {
      deploymentId: '0AfREMOTE000001',
      targetOrg: 'harness@example.com',
      timestamp: '2026-06-05T12:00:00.000Z',
      totalWaves: 2,
      completedWaves: [],
      currentWave: 1,
      failedWave: {
        waveNumber: 1,
        error: 'Polling timed out before deployment completed',
        timestamp: '2026-06-05T12:01:00.000Z',
      },
      metadata: {
        lastKnownStatus: 'Failed',
      },
    });

    const result = execNutCommandWithOptions<StatusResult>(
      `status --source-path ${projectRoot} --target-org release-org --json`,
      harness.commandOptions
    );
    const status = parseJsonStdout<StatusResult>(result.shellOutput.stdout);
    const state = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), 'utf8')
    ) as { failedWave?: unknown; metadata?: Record<string, unknown>; targetOrg?: string };
    const invocations = await readFakeSfInvocations(harness.logPath);

    expect(status.status).to.equal('Completed');
    expect(status.canResume).to.equal(false);
    expect(status.currentWave).to.equal(2);
    expect(result.shellOutput.stdout).to.include('0AfREMOTE000001');
    expect(state.targetOrg).to.equal('release-org');
    expect(state.failedWave).to.equal(undefined);
    expect(state.metadata).to.deep.include({
      lastKnownStatus: 'Succeeded',
      remoteStatus: 'Succeeded',
      remoteComponentSuccesses: 2,
      remoteComponentFailures: 0,
      remoteTestsRun: 0,
      remoteTestFailures: 0,
    });
    expect(invocations.map((invocation) => invocation.args)).to.deep.equal([
      ['project', 'deploy', 'report', '--job-id', '0AfREMOTE000001', '--target-org', 'release-org', '--json'],
    ]);
  });

  it('resume invokes remote sf resume and prints real command JSON output', async () => {
    const harness = await createHarness('success');
    const projectRoot = await createHarnessProject(harness.tempDir, 'resume-remote-command-project');

    await writeDeploymentState(projectRoot, {
      deploymentId: '0AfREMOTE000001',
      targetOrg: 'harness@example.com',
      timestamp: '2026-06-05T12:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'Remote deployment failed after polling',
        timestamp: '2026-06-05T12:01:00.000Z',
      },
      metadata: {
        lastKnownStatus: 'Failed',
      },
    });

    const result = execNutCommandWithOptions<ResumeResult>(
      `resume --source-path ${projectRoot} --target-org release-org --retry-strategy validate-only --json`,
      harness.commandOptions
    );
    const resume = parseJsonStdout<ResumeResult>(result.shellOutput.stdout);
    const state = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'deployment-state.json'), 'utf8')
    ) as { deploymentId: string; failedWave?: unknown; metadata?: Record<string, unknown>; targetOrg?: string };
    const invocations = await readFakeSfInvocations(harness.logPath);

    expect(resume.success).to.equal(true);
    expect(resume.deploymentId).to.equal('0AfREMOTE000001');
    expect(resume.resumedFromWave).to.equal(2);
    expect(resume.remainingWaves).to.equal(2);
    expect(state.deploymentId).to.equal('0AfREMOTE000001');
    expect(state.targetOrg).to.equal('release-org');
    expect(state.failedWave).to.equal(undefined);
    expect(state.metadata).to.deep.include({
      retryStrategy: 'validate-only',
      resumedFromWave: 2,
      lastKnownStatus: 'Resumed',
      remoteResumeStatus: 'Succeeded',
      remoteComponentSuccesses: 1,
      remoteComponentFailures: 0,
      remoteTestsRun: 0,
      remoteTestFailures: 0,
    });
    expect(invocations.map((invocation) => invocation.args)).to.deep.equal([
      ['project', 'deploy', 'resume', '--job-id', '0AfREMOTE000001', '--json'],
    ]);
  });

  async function createHarness(scenario: string): Promise<{
    tempDir: string;
    logPath: string;
    fakeSfPath: string;
    fakeSfNodePath: string;
    commandOptions: Parameters<typeof execNutCommandWithOptions>[1];
  }> {
    const { tempDir, homeDir } = await createNutContext('smart-deployment-validation-harness-');
    tempDirs.push(tempDir);
    const binDir = path.join(tempDir, 'fake-bin');
    const fakeSfNodePath = path.join(binDir, 'sf-node.js');
    const fakeSfPath = path.join(binDir, process.platform === 'win32' ? 'sf.cmd' : 'sf');
    const logPath = path.join(tempDir, 'fake-sf-invocations.jsonl');

    await mkdir(binDir, { recursive: true });
    await writeFile(fakeSfNodePath, fakeSfScript, 'utf8');
    if (process.platform === 'win32') {
      await writeFile(fakeSfPath, ['@echo off', 'node "%~dp0sf-node.js" %*', ''].join('\r\n'), 'utf8');
    } else {
      await writeFile(fakeSfPath, ['#!/bin/sh', 'exec node "$(dirname "$0")/sf-node.js" "$@"', ''].join('\n'), 'utf8');
      await chmod(fakeSfPath, 0o755);
    }
    await writeFile(logPath, '', 'utf8');

    return {
      tempDir,
      logPath,
      fakeSfPath,
      fakeSfNodePath,
      commandOptions: {
        homeDir,
        env: {
          PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
          SMART_DEPLOYMENT_FAKE_SF_LOG: logPath,
          SMART_DEPLOYMENT_FAKE_SF_SCENARIO: scenario,
        },
      },
    };
  }
});

async function createHarnessProject(rootDir: string, projectName: string): Promise<string> {
  return createSalesforceProject(rootDir, projectName, {
    'force-app/main/default/classes/HarnessService.cls': 'public class HarnessService {}\n',
    'force-app/main/default/classes/HarnessService.cls-meta.xml': [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
      '  <apiVersion>61.0</apiVersion>',
      '  <status>Active</status>',
      '</ApexClass>',
      '',
    ].join('\n'),
  });
}

async function readFakeSfInvocations(logPath: string): Promise<FakeSfInvocation[]> {
  const content = await readFile(logPath, 'utf8');
  return content
    .split(/\r?\n/u)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => JSON.parse(line) as FakeSfInvocation);
}

async function runFakeSfFixture(
  harness: { commandOptions: Parameters<typeof execNutCommandWithOptions>[1]; fakeSfNodePath: string },
  args: readonly string[]
): Promise<void> {
  const env = { ...process.env, ...harness.commandOptions.env };
  await execFileAsync(process.execPath, [harness.fakeSfNodePath, ...args], { env });
}
