import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { ReleaseReportStore, type ReleaseReportFileSystem } from '../../../src/reports/release-report-store.js';

describe('ReleaseReportStore', () => {
  const tempDirectories: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirectories.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirectories.length = 0;
  });

  it('writes and atomically replaces the fixed v1 report destination', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'release-report-store-'));
    tempDirectories.push(projectRoot);
    const store = new ReleaseReportStore(undefined, (finalPath) => `${finalPath}.sibling.tmp`);

    const first = await store.write('{"version":1}\n', { projectRoot });
    const second = await store.write('{"version":2}\n', { projectRoot });
    const expectedPath = path.join(projectRoot, '.smart-deployment/reports/release-report.json');

    expect(first).to.deep.equal({ kind: 'written', path: expectedPath });
    expect(second).to.deep.equal({ kind: 'written', path: expectedPath });
    expect(await readFile(expectedPath, 'utf8')).to.equal('{"version":2}\n');
  });

  it('uses a relocated directory while retaining the fixed filename', () => {
    const store = new ReleaseReportStore();
    expect(store.resolvePath({ projectRoot: '/workspace', reportDir: 'artifacts' })).to.equal(
      path.resolve('/workspace/artifacts/release-report.json')
    );
  });

  for (const failureStage of ['mkdir', 'write', 'rename'] as const) {
    it(`returns a non-throwing unavailable result and cleans up after ${failureStage} failure`, async () => {
      const calls: string[] = [];
      const fileSystem = createFailingFileSystem(failureStage, calls);
      const store = new ReleaseReportStore(fileSystem, (finalPath) => `${finalPath}.temporary`);

      const result = await store.write('{}\n', { projectRoot: '/workspace/project' });

      expect(result.kind).to.equal('unavailable');
      expect(calls).to.include('unlink');
      if (failureStage !== 'mkdir') expect(calls).to.include('close');
    });
  }
});

function createFailingFileSystem(failureStage: 'mkdir' | 'write' | 'rename', calls: string[]): ReleaseReportFileSystem {
  return {
    mkdir: async () => {
      calls.push('mkdir');
      if (failureStage === 'mkdir') throw new Error('mkdir failed');
    },
    openExclusive: async () => {
      calls.push('open');
      return {
        writeFile: async () => {
          calls.push('write');
          if (failureStage === 'write') throw new Error('write failed');
        },
        sync: async () => {
          calls.push('sync');
        },
        close: async () => {
          calls.push('close');
        },
      };
    },
    rename: async () => {
      calls.push('rename');
      if (failureStage === 'rename') throw new Error('rename failed');
    },
    unlink: async () => {
      calls.push('unlink');
    },
  };
}
