import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { ForceIgnoreStagingService } from '../../../src/deployment/forceignore-staging-service.js';

describe('ForceIgnoreStagingService', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('creates a staged Salesforce project without forceignored source files', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-forceignore-stage-'));
    await writeProjectFile(tempDir);
    await writeFile(
      path.join(tempDir, '.forceignore'),
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/\n',
      'utf8'
    );
    await writeNestedFile(
      tempDir,
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json',
      '{"ignored":true}'
    );
    await writeNestedFile(
      tempDir,
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/routes/home.json',
      '{"kept":true}'
    );

    const workspace = await new ForceIgnoreStagingService().prepare({ projectRoot: tempDir });

    try {
      expect(workspace.isStaged).to.equal(true);
      expect(workspace.projectRoot).to.not.equal(tempDir);
      await expectMissing(
        path.join(
          workspace.projectRoot,
          'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
        )
      );
      expect(
        await readFile(
          path.join(
            workspace.projectRoot,
            'force-app/main/default/digitalExperiences/site/PHP_Portal1/routes/home.json'
          ),
          'utf8'
        )
      ).to.equal('{"kept":true}');
      expect(
        await readFile(
          path.join(
            tempDir,
            'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
          ),
          'utf8'
        )
      ).to.equal('{"ignored":true}');
    } finally {
      await workspace.cleanup();
    }

    await expectMissing(workspace.projectRoot);
  });

  it('returns the original project when .forceignore does not hide source files', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-forceignore-stage-'));
    await writeProjectFile(tempDir);
    await writeFile(path.join(tempDir, '.forceignore'), 'unrelated/**\n', 'utf8');
    await writeNestedFile(
      tempDir,
      'force-app/main/default/classes/AccountService.cls',
      'public class AccountService {}'
    );

    const workspace = await new ForceIgnoreStagingService().prepare({ projectRoot: path.join(tempDir, 'force-app') });

    expect(workspace.isStaged).to.equal(false);
    expect(workspace.projectRoot).to.equal(tempDir);
    await workspace.cleanup();
  });

  it('rejects package directories outside the Salesforce project root', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-forceignore-stage-'));
    await writeFile(
      path.join(tempDir, 'sfdx-project.json'),
      JSON.stringify({
        packageDirectories: [{ path: '../outside' }],
        sourceApiVersion: '66.0',
      }),
      'utf8'
    );
    await writeFile(path.join(tempDir, '.forceignore'), '**/secret.json\n', 'utf8');

    try {
      await new ForceIgnoreStagingService().prepare({ projectRoot: tempDir });
      throw new Error('Expected prepare to fail');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('Package directory must stay inside the Salesforce project');
    }
  });
});

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
