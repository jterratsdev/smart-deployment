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
        postDestructiveChangesPath?: string;
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
        expect(options.postDestructiveChangesPath).to.be.a('string');
        expect(await readFile(options.postDestructiveChangesPath ?? '', 'utf8')).to.include(
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
      testExecutor: new TestExecutor(),
      tracker: new DeploymentTracker(),
      stateManager: new StateManager({ baseDir: tempDir }),
      sfCli,
      mode: 'destructive',
      log: () => undefined,
    });
  });
});

function wave(): Wave {
  return {
    number: 1,
    components: ['ApexClass:AccountService'],
    metadata: {
      componentCount: 1,
      types: ['ApexClass'],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 0,
    },
  };
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
