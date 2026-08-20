import { readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { StateManager } from '../src/deployment/state-manager.js';
import { createFakeSfCli, readDeploymentState } from './nut/command-fixtures.js';
import {
  cleanupNutContexts,
  createNutContext,
  createSalesforceProject,
  execNutCommand,
  execNutCommandWithOptions,
  parseJsonStdout,
} from './helpers/nut-helpers.js';

describe('NUT: validate, status, and resume commands', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await cleanupNutContexts(tempDirs);
  });

  it('validate succeeds against a standard project wave plan', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-project', {
      'force-app/main/default/classes/Healthy.cls': 'public class Healthy {}\n',
      'force-app/main/default/classes/Healthy.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; components: number; waves: number; issueCount: number }>(
      `validate --source-path ${projectRoot} --json`,
      homeDir
    );

    const output = parseJsonStdout<{ success: boolean; components: number; issueCount: number }>(
      result.shellOutput.stdout
    );

    expect(output.success).to.equal(true);
    expect(output.components).to.equal(1);
    expect(output.issueCount).to.equal(0);
  });

  it('validate can run with AI validation enabled and report AI summary fields', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-ai-project', {
      'force-app/main/default/classes/Healthy.cls': 'public class Healthy {}\n',
      'force-app/main/default/classes/Healthy.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; components: number; waves: number; issueCount: number }>(
      `validate --source-path ${projectRoot} --use-ai --json`,
      homeDir
    );

    const output = parseJsonStdout<{
      success: boolean;
      components: number;
      issueCount: number;
      ai?: { analyzed?: boolean; provider?: string; fallback?: boolean };
    }>(result.shellOutput.stdout);

    expect(output.success).to.equal(true);
    expect(output.components).to.equal(1);
    expect(output.issueCount).to.equal(0);
    expect(output.ai?.analyzed).to.be.a('boolean');
    expect(output.ai?.provider).to.be.a('string');
    expect(output.ai?.fallback).to.be.a('boolean');
  });

  it('validate help exposes AI validation flags clearly', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);

    const result = execNutCommand('validate --help', homeDir);

    expect(result.shellOutput.stdout).to.include('--use-ai');
    expect(result.shellOutput.stdout).to.include('configured provider');
  });

  it('validate reports XML problems as validation issues', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'validate-broken-project', {
      'force-app/main/default/classes/Broken.cls': 'public class Broken {}\n',
      'force-app/main/default/classes/Broken.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <status>Active',
        '',
      ].join('\n'),
    });

    const result = execNutCommand<{ success: boolean; issueCount: number }>(
      `validate --source-path ${projectRoot} --json`,
      homeDir
    );

    const output = parseJsonStdout<{ success: boolean; issueCount: number }>(result.shellOutput.stdout);

    expect(output.success).to.equal(false);
    expect(output.issueCount).to.be.greaterThan(0);
  });

  it('status reports not-started when no deployment state exists', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'status-empty-project', {
      'force-app/main/default/classes/StatusOnly.cls': 'public class StatusOnly {}\n',
    });

    const result = execNutCommand<{ status: string; canResume: boolean }>(
      `status --source-path ${projectRoot} --json`,
      homeDir
    );

    const output = parseJsonStdout<{ status: string; canResume: boolean }>(result.shellOutput.stdout);

    expect(output.status).to.equal('Not Started');
    expect(output.canResume).to.equal(false);
  });

  it('status reports resumable failed state for a project', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'status-failed-project', {
      'force-app/main/default/classes/Failed.cls': 'public class Failed {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });

    await stateManager.saveState({
      deploymentId: 'deploy-status-1',
      targetOrg: 'status@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 4,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'UNABLE_TO_LOCK_ROW',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
      metadata: {
        testStatus: 'Blocked by previous failure',
        aiProvider: 'openai',
        aiModel: 'gpt-4o-mini',
        aiFallback: true,
        aiAdjustments: 2,
        aiUnknownTypes: ['BotVersion'],
        aiInferenceFallback: false,
        aiInferredDependencies: 1,
      },
    });

    const result = execNutCommand<{ status: string; canResume: boolean; currentWave: number }>(
      `status --source-path ${projectRoot} --json`,
      homeDir
    );

    const output = parseJsonStdout<{
      status: string;
      canResume: boolean;
      currentWave: number;
      ai?: { provider?: string; fallback?: boolean };
    }>(result.shellOutput.stdout);

    expect(output.status).to.equal('Failed');
    expect(output.canResume).to.equal(true);
    expect(output.currentWave).to.equal(2);
    expect(output.ai?.provider).to.equal('openai');
    expect(output.ai?.fallback).to.equal(true);
  });

  it('resume updates persisted state from the failed wave', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'resume-project', {
      'force-app/main/default/classes/Resume.cls': 'public class Resume {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });

    await stateManager.saveState({
      deploymentId: 'deploy-resume-1',
      targetOrg: 'resume@example.com',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 5,
      completedWaves: [1, 2],
      currentWave: 3,
      failedWave: {
        waveNumber: 3,
        error: 'REQUEST_LIMIT_EXCEEDED',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
      metadata: {
        testStatus: 'Blocked by previous failure',
      },
    });

    const result = execNutCommand<{ success: boolean; resumedFromWave: number; remainingWaves: number }>(
      `resume --source-path ${projectRoot} --retry-strategy quick --json`,
      homeDir
    );

    const persistedState = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment/deployment-state.json'), 'utf8')
    ) as {
      failedWave?: unknown;
      metadata?: Record<string, unknown>;
    };

    const output = parseJsonStdout<{ success: boolean; resumedFromWave: number }>(result.shellOutput.stdout);

    expect(output.success).to.equal(true);
    expect(output.resumedFromWave).to.equal(3);
    expect(persistedState.failedWave).to.equal(undefined);
    expect(persistedState.metadata).to.deep.include({
      retryStrategy: 'quick',
      resumedFromWave: 3,
      lastKnownStatus: 'Resumed',
    });
  });

  it('start persists remote deployment id and generated manifest when sf deploy reports partial failure', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'start-partial-failure-project', {
      'force-app/main/default/classes/BrokenClass.cls': 'public class BrokenClass { MissingDependency value; }\n',
      'force-app/main/default/classes/BrokenClass.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });
    const fakeSf = await createFakeSfCli(tempDir, 'partial-failure');

    const result = execNutCommandWithOptions(
      `start --source-path ${projectRoot} --target-org fake-org --skip-tests --json`,
      { homeDir, env: fakeSf.env, ensureExitCode: 'nonZero' }
    );

    const state = await readDeploymentState(projectRoot);
    const manifest = await readFile(path.join(projectRoot, '.smart-deployment/manifests/wave-001.xml'), 'utf8');
    const calls = await fakeSf.readCalls();

    expect(result.shellOutput.stderr).to.include('Wave 1 failed');
    expect(state.deploymentId).to.equal('0AfFakePartialFailure');
    expect(state.failedWave?.waveNumber).to.equal(1);
    expect(state.metadata?.lastKnownStatus).to.equal('Failed');
    expect(manifest).to.include('<members>BrokenClass</members>');
    expect(calls.some((call) => call.args.join(' ').startsWith('project deploy start'))).to.equal(true);
  });

  it('start pauses at a configured checkpoint and resume approves it with JSON output', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'checkpoint-project', {
      'force-app/main/default/classes/CheckpointClass.cls': 'public class CheckpointClass {}\n',
      'force-app/main/default/classes/CheckpointClass.cls-meta.xml': [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <apiVersion>61.0</apiVersion>',
        '  <status>Active</status>',
        '</ApexClass>',
        '',
      ].join('\n'),
    });
    await writeFile(
      path.join(projectRoot, '.smart-deployment.json'),
      JSON.stringify({ checkpoints: [{ id: 'approve-wave', phase: 'before', waveNumber: 1 }] })
    );
    const fakeSf = await createFakeSfCli(tempDir, 'success');

    const startResult = execNutCommandWithOptions(
      `start --source-path ${projectRoot} --target-org fake-org --skip-tests --json`,
      { homeDir, env: fakeSf.env }
    );
    const startOutput = parseJsonStdout<{ outcome: string; checkpoint?: { id: string } }>(
      startResult.shellOutput.stdout
    );
    const pausedState = await readDeploymentState(projectRoot);
    const callsBeforeResume = await fakeSf.readCalls();

    expect(startOutput.outcome).to.equal('paused');
    expect(startOutput.checkpoint?.id).to.equal('approve-wave');
    expect(pausedState.status).to.equal('paused');
    expect(callsBeforeResume).to.deep.equal([]);

    const resumeResult = execNutCommandWithOptions(
      `resume --source-path ${projectRoot} --target-org fake-org --approve-checkpoint approve-wave --json`,
      { homeDir, env: fakeSf.env }
    );
    const resumeOutput = parseJsonStdout<{ success: boolean; outcome: string }>(resumeResult.shellOutput.stdout);
    const callsAfterResume = await fakeSf.readCalls();

    expect(resumeOutput).to.deep.include({ success: true, outcome: 'completed' });
    expect(callsAfterResume.filter((call) => call.args.join(' ').startsWith('project deploy start'))).to.have.length(1);
  });

  it('status refreshes persisted state from sf project deploy report when target org is provided', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'status-report-project', {
      'force-app/main/default/classes/StatusRemote.cls': 'public class StatusRemote {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });
    const fakeSf = await createFakeSfCli(tempDir, 'report-in-progress');

    await stateManager.saveState({
      deploymentId: '0AfFakeReportInProgress',
      targetOrg: 'fake-org',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 2,
      completedWaves: [],
      currentWave: 1,
      failedWave: {
        waveNumber: 1,
        error: 'Previous timeout',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
    });

    const result = execNutCommandWithOptions<{ status: string; canResume: boolean }>(
      `status --source-path ${projectRoot} --target-org fake-org --json`,
      { homeDir, env: fakeSf.env }
    );

    const output = parseJsonStdout<{ status: string; canResume: boolean }>(result.shellOutput.stdout);
    const refreshed = await readDeploymentState(projectRoot);
    const calls = await fakeSf.readCalls();

    expect(output.status).to.equal('In Progress');
    expect(output.canResume).to.equal(false);
    expect(refreshed.failedWave).to.equal(undefined);
    expect(refreshed.metadata?.lastKnownStatus).to.equal('InProgress');
    expect(calls.some((call) => call.args.join(' ').startsWith('project deploy report'))).to.equal(true);
  });

  it('resume delegates to sf project deploy resume before updating local state when target org is provided', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'resume-remote-project', {
      'force-app/main/default/classes/ResumeRemote.cls': 'public class ResumeRemote {}\n',
    });
    const stateManager = new StateManager({ baseDir: projectRoot });
    const fakeSf = await createFakeSfCli(tempDir, 'resume-success');

    await stateManager.saveState({
      deploymentId: '0AfFakeResumeStart',
      targetOrg: 'fake-org',
      timestamp: '2026-04-22T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'Timeout waiting for deploy result',
        timestamp: '2026-04-22T00:01:00.000Z',
      },
    });

    const result = execNutCommandWithOptions<{ success: boolean; deploymentId: string }>(
      `resume --source-path ${projectRoot} --target-org fake-org --retry-strategy standard --json`,
      { homeDir, env: fakeSf.env }
    );

    const output = parseJsonStdout<{ success: boolean; deploymentId: string }>(result.shellOutput.stdout);
    const state = await readDeploymentState(projectRoot);
    const calls = await fakeSf.readCalls();

    expect(output.success).to.equal(true);
    expect(output.deploymentId).to.equal('0AfFakeResumeStart');
    expect(state.failedWave).to.equal(undefined);
    expect(state.metadata).to.deep.include({
      retryStrategy: 'standard',
      resumedFromWave: 2,
      remoteResumeStatus: 'Succeeded',
    });
    expect(calls.some((call) => call.args.join(' ').startsWith('project deploy resume'))).to.equal(true);
  });

  it('resume fails when there is no failed deployment state to resume', async () => {
    const { tempDir, homeDir } = await createNutContext();
    tempDirs.push(tempDir);
    const projectRoot = await createSalesforceProject(tempDir, 'resume-empty-project', {
      'force-app/main/default/classes/ResumeOnly.cls': 'public class ResumeOnly {}\n',
    });

    const result = execNutCommand(`resume --source-path ${projectRoot}`, homeDir, 'nonZero');

    expect(result.shellOutput.stderr).to.include('No failed deployment state found to resume');
  });
});
