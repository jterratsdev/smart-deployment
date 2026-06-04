import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import Init from '../../../src/commands/init.js';

type ParseResult = {
  flags: Record<string, unknown>;
  args: Record<string, unknown>;
  argv: string[];
  raw: unknown[];
  metadata: { flags: Record<string, unknown>; args: Record<string, unknown> };
  nonExistentFlags: string[];
  _runtime: unknown;
};

type InitCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  warn: (message?: string | Error) => void;
};

async function createProject(): Promise<string> {
  const projectRoot = path.join(tmpdir(), 'sd-init-command-' + Date.now() + '-' + Math.random().toString(16).slice(2));
  await mkdir(path.join(projectRoot, 'force-app'), { recursive: true });
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '61.0' }),
    'utf8'
  );
  return projectRoot;
}

describe('InitCommand', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('writes config using non-interactive defaults', async () => {
    const projectRoot = await createProject();
    tempDirs.push(projectRoot);
    const command = new Init([], {} as never);
    const logs: string[] = [];
    (command as unknown as InitCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': projectRoot,
        force: false,
        'cache-enabled': true,
        'validation-mode': 'strict',
        'skip-tests': false,
        'non-interactive': true,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as InitCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as InitCommandTestDouble).warn = () => {};

    const result = await command.run();
    const saved = JSON.parse(await readFile(path.join(projectRoot, '.smart-deployment.json'), 'utf8')) as {
      source: { path: string };
    };

    expect(result.success).to.equal(true);
    expect(saved.source.path).to.equal('force-app');
    expect(logs.join('\n')).to.include('Smart Deployment config created');
  });
});
