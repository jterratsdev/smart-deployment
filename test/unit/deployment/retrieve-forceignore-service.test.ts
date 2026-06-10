import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  RetrieveForceIgnoreService,
  retrieveForceIgnoreInternals,
} from '../../../src/deployment/retrieve-forceignore-service.js';

const execFileAsync = promisify(execFile);

describe('RetrieveForceIgnoreService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('restores tracked protected bundle paths and removes untracked protected paths after retrieve', async () => {
    const projectRoot = await createGitProject(tempDirs);
    const protectedPath =
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/_meta.json';
    const protectedNewPath =
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/content.json';
    const allowedPath = 'force-app/main/default/digitalExperiences/site/PHP_Portal1/routes/home.json';
    await writeNestedFile(projectRoot, protectedPath, '{"name":"Privacy baseline"}\n');
    await writeNestedFile(projectRoot, allowedPath, '{"name":"Home baseline"}\n');
    await writeFile(
      path.join(projectRoot, '.forceignore'),
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/\n',
      'utf8'
    );
    await commitAll(projectRoot, 'baseline');

    const service = new RetrieveForceIgnoreService({
      sfRetrieveRunner: {
        retrieve: async () => {
          await writeNestedFile(projectRoot, protectedPath, '{"name":"Privacy retrieved"}\n');
          await writeNestedFile(projectRoot, protectedNewPath, '{"name":"New protected"}\n');
          await writeNestedFile(projectRoot, allowedPath, '{"name":"Home retrieved"}\n');
          return '{"status":0}';
        },
      },
    });

    const result = await service.retrieve({ projectRoot });

    expect(result.success).to.equal(true);
    expect(result.protectedPaths).to.deep.equal([protectedPath, protectedNewPath]);
    expect(result.restoredPaths).to.deep.equal([protectedPath, protectedNewPath]);
    expect(await readFile(path.join(projectRoot, protectedPath), 'utf8')).to.equal('{"name":"Privacy baseline"}\n');
    expect(await exists(path.join(projectRoot, protectedNewPath))).to.equal(false);
    expect(await readFile(path.join(projectRoot, allowedPath), 'utf8')).to.equal('{"name":"Home retrieved"}\n');
  });

  it('fails strict-ignore after restoring protected paths', async () => {
    const projectRoot = await createGitProject(tempDirs);
    const protectedPath = 'force-app/main/default/lwc/protectedComponent/protectedComponent.js';
    await writeNestedFile(projectRoot, protectedPath, 'export const value = 1;\n');
    await writeFile(path.join(projectRoot, '.forceignore'), 'force-app/main/default/lwc/protectedComponent/\n', 'utf8');
    await commitAll(projectRoot, 'baseline');
    const service = new RetrieveForceIgnoreService({
      sfRetrieveRunner: {
        retrieve: async () => {
          await writeNestedFile(projectRoot, protectedPath, 'export const value = 2;\n');
          return '{"status":0}';
        },
      },
    });

    const result = await service.retrieve({ projectRoot, strictIgnore: true });

    expect(result.success).to.equal(false);
    expect(result.strictViolation).to.equal(true);
    expect(result.restoredPaths).to.deep.equal([protectedPath]);
    expect(await readFile(path.join(projectRoot, protectedPath), 'utf8')).to.equal('export const value = 1;\n');
  });

  it('normalizes DigitalExperience *_meta.json files when requested', async () => {
    const projectRoot = await createGitProject(tempDirs);
    const metaPath = 'force-app/main/default/digitalExperiences/site/PHP_Portal1/routes/home_meta.json';
    await writeNestedFile(projectRoot, metaPath, '{"label":"Home"}\n');
    await writeFile(path.join(projectRoot, '.forceignore'), 'unrelated/**\n', 'utf8');
    await commitAll(projectRoot, 'baseline');
    const service = new RetrieveForceIgnoreService({
      sfRetrieveRunner: {
        retrieve: async () => {
          await writeNestedFile(projectRoot, metaPath, '{"label" : "Home","active" : true}');
          return '{"status":0}';
        },
      },
    });

    const result = await service.retrieve({ projectRoot, normalizeMeta: true });

    expect(result.success).to.equal(true);
    expect(result.normalizedPaths).to.deep.equal([metaPath]);
    expect(await readFile(path.join(projectRoot, metaPath), 'utf8')).to.equal(
      ['{', '  "label": "Home",', '  "active": true', '}', ''].join('\n')
    );
  });

  it('parses porcelain status entries including untracked and renames', () => {
    const entries = retrieveForceIgnoreInternals.parseGitStatus(
      [
        ' M force-app/main/default/classes/Changed.cls',
        '?? force-app/main/default/classes/New.cls',
        'R  old.cls -> new.cls',
      ].join('\n')
    );

    expect(entries).to.deep.include({
      path: 'force-app/main/default/classes/Changed.cls',
      indexStatus: ' ',
      workingTreeStatus: 'M',
      untracked: false,
    });
    expect(entries).to.deep.include({
      path: 'force-app/main/default/classes/New.cls',
      indexStatus: '?',
      workingTreeStatus: '?',
      untracked: true,
    });
    expect(entries).to.deep.include({ path: 'new.cls', indexStatus: 'R', workingTreeStatus: ' ', untracked: false });
  });
});

async function createGitProject(tempDirs: string[]): Promise<string> {
  const projectRoot = await mkdtemp(path.join(tmpdir(), 'retrieve-forceignore-'));
  tempDirs.push(projectRoot);
  await mkdir(path.join(projectRoot, 'force-app/main/default'), { recursive: true });
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '61.0' }),
    'utf8'
  );
  await git(projectRoot, 'init');
  await git(projectRoot, 'config', 'user.email', 'qa@example.invalid');
  await git(projectRoot, 'config', 'user.name', 'Smart Deployment QA');
  return projectRoot;
}

async function writeNestedFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function commitAll(projectRoot: string, message: string): Promise<void> {
  await git(projectRoot, 'add', '.');
  await git(projectRoot, 'commit', '-m', message);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function git(projectRoot: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd: projectRoot });
}
