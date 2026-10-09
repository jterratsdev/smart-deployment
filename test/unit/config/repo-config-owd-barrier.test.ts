import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { loadRepoConfigStrict } from '../../../src/config/repo-config.js';

describe('OWD barrier repo config', () => {
  let root: string | undefined;
  afterEach(async () => root && rm(root, { recursive: true, force: true }));

  it('rejects invalid polling values while loading configuration', async () => {
    root = await mkdtemp(path.join(tmpdir(), 'owd-config-'));
    await mkdir(root, { recursive: true });
    await writeFile(
      path.join(root, '.smart-deployment.json'),
      JSON.stringify({ owdBarrier: { timeoutMs: 100, initialDelayMs: -1, maximumDelayMs: 10 } })
    );
    let error: Error | undefined;
    try {
      await loadRepoConfigStrict(root);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include('OWD barrier initialDelayMs');
  });
});
