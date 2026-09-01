/* eslint-disable import/no-extraneous-dependencies */
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import sinon from 'sinon';
import Resume from '../../src/commands/smart-deployment/resume.js';
import { ManifestGenerator } from '../../src/deployment/manifest-generator.js';
import { ManifestValidator } from '../../src/deployment/manifest-validator.js';
import { SfCliIntegration } from '../../src/deployment/sf-cli-integration.js';
import type { DeploymentOptions } from '../../src/deployment/sf-cli-integration.js';
import type { DeploymentState } from '../../src/deployment/state-manager.js';
import { StateManager } from '../../src/deployment/state-manager.js';
import { MetadataScannerService } from '../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';
import { WavePostProcessor } from '../../src/waves/wave-post-processor.js';

describe('resume local integration', () => {
  const originalCwd = process.cwd();
  const temporaryProjects: string[] = [];

  afterEach(async () => {
    sinon.restore();
    process.chdir(originalCwd);
    await Promise.all(temporaryProjects.splice(0).map((project) => fs.rm(project, { recursive: true, force: true })));
  });

  async function createProject(): Promise<string> {
    const project = await fs.mkdtemp(path.join(originalCwd, '.tmp-resume-integration-'));
    temporaryProjects.push(project);

    const files: Record<string, string> = {
      'sfdx-project.json': JSON.stringify({
        packageDirectories: [{ path: 'force-app', default: true }],
        sourceApiVersion: '65.0',
      }),
      '.smart-deployment.json': JSON.stringify({ deployment: { retry: { maxAttempts: 3 } } }),
      'force-app/main/default/classes/OfflineAction.cls': `public with sharing class OfflineAction {
  public static String run() { return 'offline'; }
}`,
      'force-app/main/default/classes/OfflineAction.cls-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<ApexClass xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>65.0</apiVersion>
  <status>Active</status>
</ApexClass>`,
      'force-app/main/default/flows/OfflineFlow.flow-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<Flow xmlns="http://soap.sforce.com/2006/04/metadata">
  <actionCalls>
    <name>RunOffline</name>
    <actionName>OfflineAction</actionName>
    <actionType>apex</actionType>
  </actionCalls>
  <processType>AutoLaunchedFlow</processType>
  <status>Active</status>
</Flow>`,
      'force-app/main/default/aiAuthoringBundles/OfflineAgent.agent': `name: OfflineAgent
actions:
  run:
    target: "flow://OfflineFlow"
`,
      'force-app/main/default/aiAuthoringBundles/OfflineAgent.bundle-meta.xml': `<?xml version="1.0" encoding="UTF-8"?>
<AiAuthoringBundle xmlns="http://soap.sforce.com/2006/04/metadata">
  <apiVersion>65.0</apiVersion>
</AiAuthoringBundle>`,
    };

    await Promise.all(
      Object.entries(files).map(async ([relativePath, content]) => {
        const filePath = path.join(project, relativePath);
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, content, 'utf8');
      })
    );

    return project;
  }

  it('resumes the failed wave, retries transient failure, persists progress, and clears completed state', async () => {
    const project = await createProject();
    process.chdir(project);

    const stateFile = path.join(project, '.smart-deployment', 'deployment-state.json');
    const initialState: DeploymentState = {
      status: 'failed',
      deploymentId: 'local-resume-integration',
      targetOrg: 'offline-org',
      timestamp: '2026-09-01T10:00:00.000Z',
      totalWaves: 2,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'Previous deployment failure',
        timestamp: '2026-09-01T10:01:00.000Z',
      },
      metadata: { fixture: 'local', retryAttempts: { '2': 1 } },
    };
    await fs.mkdir(path.dirname(stateFile), { recursive: true });
    await fs.writeFile(stateFile, JSON.stringify(initialState, null, 2), 'utf8');

    const scannerSpy = sinon.spy(MetadataScannerService.prototype, 'scan');
    const waveBuilderSpy = sinon.spy(WaveBuilder.prototype, 'generateWaves');
    const postProcessorSpy = sinon.spy(WavePostProcessor.prototype, 'processWaves');
    const manifestGeneratorSpy = sinon.spy(ManifestGenerator.prototype, 'generateManifests');
    const manifestValidatorSpy = sinon.spy(ManifestValidator.prototype, 'validateManifest');
    const saveStateSpy = sinon.spy(StateManager.prototype, 'saveState');
    const clearStateSpy = sinon.spy(StateManager.prototype, 'clearState');

    let transientState: DeploymentState | undefined;
    const deployStub = sinon.stub(SfCliIntegration.prototype, 'deploy');
    deployStub.onFirstCall().rejects(new Error('CONNECTION_ERROR: simulated temporary outage'));
    deployStub.onSecondCall().callsFake(async () => {
      transientState = JSON.parse(await fs.readFile(stateFile, 'utf8')) as DeploymentState;
      return {
        success: true,
        deploymentId: 'offline-deploy-id',
        status: 'Succeeded',
        componentSuccesses: 1,
        componentFailures: 0,
        testsRun: 0,
        testFailures: 0,
        output: 'Simulated local success',
      };
    });

    const result = await Resume.run(['--target-org', 'offline-org', '--source-path', project]);

    expect(result).to.deep.equal({ success: true, resumedFromWave: 2 });
    expect(scannerSpy.calledOnceWithExactly({ sourcePath: project })).to.equal(true);
    expect(waveBuilderSpy.calledOnce).to.equal(true);
    expect(postProcessorSpy.calledOnce).to.equal(true);
    expect(manifestGeneratorSpy.calledOnce).to.equal(true);
    expect(manifestValidatorSpy.callCount).to.equal(2);

    expect(deployStub.callCount).to.equal(2);
    for (const call of deployStub.getCalls()) {
      const options = call.firstArg as DeploymentOptions;
      expect(options).to.deep.include({ targetOrg: 'offline-org', checkOnly: false });
      expect(options.manifestPath).to.equal(
        path.join(project, '.smart-deployment', 'manifests', 'wave-002-package.xml')
      );
    }

    expect(transientState).to.deep.include({
      status: 'failed',
      completedWaves: [1],
      currentWave: 2,
    });
    expect(transientState?.failedWave?.waveNumber).to.equal(2);
    expect(transientState?.metadata).to.deep.equal({ fixture: 'local', retryAttempts: { '2': 2 } });

    const persistedStates = saveStateSpy.getCalls().map((call) => call.firstArg as DeploymentState);
    expect(persistedStates).to.have.length(3);
    expect(persistedStates.map(({ status, completedWaves }) => ({ status, completedWaves }))).to.deep.equal([
      { status: 'failed', completedWaves: [1] },
      { status: 'deploying', completedWaves: [1, 2] },
      { status: 'completed', completedWaves: [1, 2] },
    ]);
    expect(persistedStates.map((state) => state.metadata)).to.deep.equal([
      { fixture: 'local', retryAttempts: { '2': 2 } },
      { fixture: 'local', retryAttempts: { '2': 2 } },
      { fixture: 'local', retryAttempts: { '2': 2 } },
    ]);
    expect(persistedStates[2].failedWave).to.equal(undefined);

    const manifestDir = path.join(project, '.smart-deployment', 'manifests');
    const manifestNames = (await fs.readdir(manifestDir)).sort();
    expect(manifestNames).to.deep.equal(['wave-001-package.xml', 'wave-002-package.xml']);
    expect(await fs.readFile(path.join(manifestDir, 'wave-001-package.xml'), 'utf8')).to.include('OfflineAction');
    expect(await fs.readFile(path.join(manifestDir, 'wave-002-package.xml'), 'utf8')).to.include('OfflineAgent');

    expect(clearStateSpy.calledOnce).to.equal(true);
    expect(
      await fs.access(stateFile).then(
        () => true,
        () => false
      )
    ).to.equal(false);
  });
});
