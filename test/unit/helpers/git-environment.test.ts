import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { createIsolatedGitEnvironment, execIsolatedGit } from '../../helpers/git-environment.js';

const execFileAsync = promisify(execFile);

describe('Git test environment', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('removes every repository-local variable reported by Git', async () => {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8' });
    const localVariableNames = stdout.split(/\r?\n/).filter((name) => name.length > 0);
    const source = Object.fromEntries(localVariableNames.map((name) => [name, `inherited-${name}`]));
    source.UNRELATED_VALUE = 'preserved';

    const environment = createIsolatedGitEnvironment(source);

    expect(environment.UNRELATED_VALUE).to.equal('preserved');
    for (const variableName of localVariableNames) {
      expect(environment).to.not.have.property(variableName);
    }
  });

  it('keeps child Git operations isolated from an inherited parent repository', async () => {
    const root = await mkdtemp(path.join(tmpdir(), 'git-environment-'));
    tempDirs.push(root);
    const parentRoot = path.join(root, 'parent');
    const childRoot = path.join(root, 'child');
    await mkdir(parentRoot);
    await mkdir(childRoot);

    await execIsolatedGit(parentRoot, 'init');
    await execIsolatedGit(parentRoot, 'config', 'user.email', 'qa@example.invalid');
    await execIsolatedGit(parentRoot, 'config', 'user.name', 'Smart Deployment QA');
    await writeFile(path.join(parentRoot, 'parent.txt'), 'parent\n', 'utf8');
    await execIsolatedGit(parentRoot, 'add', '.');
    await execIsolatedGit(parentRoot, 'commit', '-m', 'parent baseline');

    const parentGitDir = path.join(parentRoot, '.git');
    const beforeHead = (await execIsolatedGit(parentRoot, 'rev-parse', 'HEAD')).stdout.trim();
    const beforeIndex = await readFile(path.join(parentGitDir, 'index'));
    const beforeBare = (await execIsolatedGit(parentRoot, 'config', '--bool', 'core.bare')).stdout.trim();
    const inheritedEnvironment = {
      ...process.env,
      GIT_DIR: parentGitDir,
      GIT_WORK_TREE: parentRoot,
      GIT_INDEX_FILE: path.join(parentGitDir, 'index'),
    };

    const childEnvironment = createIsolatedGitEnvironment(inheritedEnvironment);
    await execFileAsync('git', ['init'], { cwd: childRoot, env: childEnvironment });
    await execFileAsync('git', ['config', 'user.email', 'qa@example.invalid'], {
      cwd: childRoot,
      env: childEnvironment,
    });
    await execFileAsync('git', ['config', 'user.name', 'Smart Deployment QA'], {
      cwd: childRoot,
      env: childEnvironment,
    });
    await writeFile(path.join(childRoot, 'child.txt'), 'child\n', 'utf8');
    await execFileAsync('git', ['add', '.'], { cwd: childRoot, env: childEnvironment });
    await execFileAsync('git', ['commit', '-m', 'child commit'], { cwd: childRoot, env: childEnvironment });

    expect((await execIsolatedGit(childRoot, 'rev-parse', '--show-toplevel')).stdout.trim()).to.equal(
      await realpath(childRoot)
    );
    expect((await execIsolatedGit(parentRoot, 'rev-parse', 'HEAD')).stdout.trim()).to.equal(beforeHead);
    expect(await readFile(path.join(parentGitDir, 'index'))).to.deep.equal(beforeIndex);
    expect((await execIsolatedGit(parentRoot, 'config', '--bool', 'core.bare')).stdout.trim()).to.equal(beforeBare);
  });
});
