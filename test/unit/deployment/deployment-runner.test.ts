import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { DeploymentRunner } from '../../../src/deployment/deployment-runner.js';
import { DeploymentTracker } from '../../../src/deployment/deployment-tracker.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import type { DeploymentResult, SfCliIntegration } from '../../../src/deployment/sf-cli-integration.js';
import { TestExecutor } from '../../../src/deployment/test-executor.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('DeploymentRunner', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('deploys waves from a forceignore-sanitized staging project', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-runner-'));
    await writeProjectFile(tempDir);
    await writeNestedFile(
      tempDir,
      'force-app/main/default/classes/AccountService.cls',
      'public class AccountService {}'
    );
    await writeNestedFile(
      tempDir,
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json',
      '{"ignored":true}'
    );
    await writeFile(
      path.join(tempDir, '.forceignore'),
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/\n',
      'utf8'
    );

    const workingDirectories: string[] = [];
    const sfCli = {
      deploy: async (options: { manifestPath: string; workingDirectory?: string }): Promise<DeploymentResult> => {
        expect(options.workingDirectory).to.be.a('string');
        workingDirectories.push(options.workingDirectory ?? '');
        await expectMissing(
          path.join(
            options.workingDirectory ?? '',
            'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
          )
        );
        expect(await readFile(options.manifestPath, 'utf8')).to.include('<members>AccountService</members>');
        return {
          success: true,
          status: 'Succeeded',
          componentSuccesses: 1,
          componentFailures: 0,
          output: 'ok',
        };
      },
    } as unknown as SfCliIntegration;

    await new DeploymentRunner().execute({
      deploymentId: 'test-deployment',
      targetOrg: 'test-org',
      sourcePath: tempDir,
      orderedWaves: [wave()],
      componentMap: componentMap(),
      apiVersion: '66.0',
      skipTests: true,
      destructive: false,
      testExecutor: new TestExecutor(),
      tracker: new DeploymentTracker(),
      stateManager: new StateManager({ baseDir: tempDir }),
      sfCli,
      log: () => undefined,
    });

    expect(workingDirectories).to.have.length(1);
    expect(workingDirectories[0]).to.not.equal(tempDir);
    expect(
      await readFile(
        path.join(
          tempDir,
          'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
        ),
        'utf8'
      )
    ).to.equal('{"ignored":true}');
    await expectMissing(workingDirectories[0]);
  });

  it('deploys destructive waves from forceignore-sanitized staging with post destructive manifests', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-runner-destructive-'));
    await writeProjectFile(tempDir);
    await writeNestedFile(
      tempDir,
      'force-app/main/default/classes/AccountService.cls',
      'public class AccountService {}'
    );
    await writeNestedFile(
      tempDir,
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json',
      '{"ignored":true}'
    );
    await writeFile(
      path.join(tempDir, '.forceignore'),
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/\n',
      'utf8'
    );

    const sfCli = {
      deploy: async (options: {
        manifestPath: string;
        destructiveChangesPath?: string;
        testLevel?: string;
        workingDirectory?: string;
      }): Promise<DeploymentResult> => {
        expect(options.workingDirectory).to.be.a('string');
        await expectMissing(
          path.join(
            options.workingDirectory ?? '',
            'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
          )
        );
        expect(await readFile(options.manifestPath, 'utf8')).to.not.include('<types>');
        expect(options.destructiveChangesPath).to.be.a('string');
        expect(await readFile(options.destructiveChangesPath ?? '', 'utf8')).to.include(
          '<members>AccountService</members>'
        );
        expect(options.testLevel).to.equal('NoTestRun');
        return {
          success: true,
          status: 'Succeeded',
          componentSuccesses: 1,
          componentFailures: 0,
          output: 'ok',
        };
      },
    } as unknown as SfCliIntegration;

    await new DeploymentRunner().execute({
      deploymentId: 'test-destructive-deployment',
      targetOrg: 'test-org',
      sourcePath: tempDir,
      orderedWaves: [wave()],
      componentMap: componentMap(),
      apiVersion: '66.0',
      skipTests: false,
      destructive: true,
      testExecutor: new TestExecutor(),
      tracker: new DeploymentTracker(),
      stateManager: new StateManager({ baseDir: tempDir }),
      sfCli,
      log: () => undefined,
    });
  });

  it('pauses before a wave without invoking Salesforce', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-runner-pause-before-'));
    await writeProjectFile(tempDir);
    const stateManager = new StateManager({ baseDir: tempDir });
    let deployCalls = 0;
    const sfCli = {
      deploy: async (): Promise<DeploymentResult> => {
        deployCalls += 1;
        throw new Error('deploy should not be called');
      },
    } as unknown as SfCliIntegration;

    const result = await new DeploymentRunner().execute({
      deploymentId: 'pause-before',
      targetOrg: 'test-org',
      sourcePath: tempDir,
      orderedWaves: [wave()],
      componentMap: componentMap(),
      apiVersion: '66.0',
      skipTests: true,
      destructive: false,
      testExecutor: new TestExecutor(),
      tracker: new DeploymentTracker(),
      stateManager,
      sfCli,
      checkpoints: [{ id: 'approve-wave-1', phase: 'before', waveNumber: 1, message: 'Approve deployment' }],
      log: () => undefined,
    });

    expect(result.kind).to.equal('paused');
    expect(deployCalls).to.equal(0);
    const state = await stateManager.loadState();
    expect(state?.status).to.equal('paused');
    expect(state?.completedWaves).to.deep.equal([]);
    expect(state?.execution?.nextExecutionIndex).to.equal(0);
    expect(state?.pausedCheckpoint?.id).to.equal('approve-wave-1');
  });

  it('records execution position correctly for reversed destructive waves', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-runner-reverse-pause-'));
    await writeProjectFile(tempDir);
    const stateManager = new StateManager({ baseDir: tempDir });
    const components = componentMapWithTwoComponents();
    const waves = [wave(2, 'ApexClass:SecondClass'), wave(1, 'ApexClass:AccountService')];
    const sfCli = {
      deploy: async (): Promise<DeploymentResult> => ({
        success: true,
        status: 'Succeeded',
        componentSuccesses: 1,
        componentFailures: 0,
        output: 'ok',
      }),
    } as unknown as SfCliIntegration;

    const result = await new DeploymentRunner().execute({
      deploymentId: 'reverse-pause',
      targetOrg: 'test-org',
      sourcePath: tempDir,
      orderedWaves: waves,
      componentMap: components,
      apiVersion: '66.0',
      skipTests: true,
      destructive: true,
      testExecutor: new TestExecutor(),
      tracker: new DeploymentTracker(),
      stateManager,
      sfCli,
      checkpoints: [{ id: 'after-wave-2', phase: 'after', waveNumber: 2 }],
      log: () => undefined,
    });

    expect(result.kind).to.equal('paused');
    const state = await stateManager.loadState();
    expect(state?.completedWaves).to.deep.equal([2]);
    expect(state?.execution?.orderedWaveNumbers).to.deep.equal([2, 1]);
    expect(state?.execution?.nextExecutionIndex).to.equal(1);
  });
});

function wave(number = 1, component = 'ApexClass:AccountService'): Wave {
  return {
    number,
    components: [component],
    metadata: {
      componentCount: 1,
      types: ['ApexClass'],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 0,
    },
  };
}

function componentMapWithTwoComponents(): ReadonlyMap<string, MetadataComponent> {
  return new Map([
    ...componentMap(),
    [
      'ApexClass:SecondClass',
      {
        name: 'SecondClass',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/SecondClass.cls',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      } as MetadataComponent,
    ],
  ]);
}

function componentMap(): ReadonlyMap<string, MetadataComponent> {
  return new Map([
    [
      'ApexClass:AccountService',
      {
        name: 'AccountService',
        type: 'ApexClass',
        filePath: 'force-app/main/default/classes/AccountService.cls',
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      },
    ],
  ]);
}

async function writeProjectFile(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '66.0',
    }),
    'utf8'
  );
}

async function writeNestedFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function expectMissing(filePath: string): Promise<void> {
  try {
    await access(filePath);
    throw new Error(`${filePath} exists`);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('exists')) {
      throw error;
    }
  }
}
