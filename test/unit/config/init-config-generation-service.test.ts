import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { InitConfigGenerationService } from '../../../src/config/init-config-generation-service.js';

async function createProject(): Promise<string> {
  const projectRoot = path.join(tmpdir(), 'sd-init-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  await mkdir(path.join(projectRoot, 'force-app/main/default/classes'), { recursive: true });
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
  return projectRoot;
}

describe('InitConfigGenerationService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('generates config with source detection, cache, CI preset, and report defaults', async () => {
    const projectRoot = await createProject();
    tempDirs.push(projectRoot);

    const result = await new InitConfigGenerationService().generate({
      startPath: projectRoot,
      validationMode: 'warn-only',
    });
    const saved = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment.json'), 'utf8')
    ) as typeof result.config;

    expect(result.created).to.equal(true);
    expect(result.sourcePath).to.equal('force-app');
    expect(saved.source).to.deep.equal({ path: 'force-app', packageDirectories: ['force-app'], apiVersion: '61.0' });
    expect(saved.cache).to.deep.equal({ enabled: true, strategy: 'file-hash' });
    expect(saved.ci?.preset).to.deep.include({ validationMode: 'warn-only', skipTests: false });
    expect(saved.reports?.planDir).to.equal('.smart-deployment/reports/start-dry-run');
  });

  it('protects existing config unless force is set', async () => {
    const projectRoot = await createProject();
    tempDirs.push(projectRoot);
    await writeFile(path.join(projectRoot, '.smart-deployment.json'), '{"testLevel":"RunLocalTests"}\n', 'utf8');

    try {
      await new InitConfigGenerationService().generate({ startPath: projectRoot });
      throw new Error('Expected init to reject existing config');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('--force');
    }
  });

  it('overwrites existing config with force and supports non-default automation flags', async () => {
    const projectRoot = await createProject();
    tempDirs.push(projectRoot);
    await writeFile(path.join(projectRoot, '.smart-deployment.json'), '{"testLevel":"RunLocalTests"}\n', 'utf8');

    const result = await new InitConfigGenerationService().generate({
      startPath: projectRoot,
      force: true,
      cacheEnabled: false,
      validationMode: 'local-only',
      reportDir: 'reports/ci',
      skipTests: true,
    });

    expect(result.overwritten).to.equal(true);
    expect(result.config.cache).to.deep.equal({ enabled: false, strategy: 'file-hash' });
    expect(result.config.ci?.preset).to.deep.equal({
      validationMode: 'local-only',
      skipTests: true,
      reportDir: 'reports/ci',
    });
  });
});
