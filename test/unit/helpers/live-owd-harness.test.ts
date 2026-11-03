import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { pollSharingModels, runLiveOwdHarness, validateRestorationSource } from '../../helpers/live-owd-harness.js';

describe('live OWD harness safety', () => {
  const workspaces: string[] = [];

  afterEach(async () => {
    await Promise.all(workspaces.splice(0).map((workspace) => rm(workspace, { recursive: true, force: true })));
  });

  it('performs zero deploys when the initial observation is unavailable', async () => {
    const calls: string[] = [];

    let error: Error | undefined;
    try {
      await runLiveOwdHarness({
        observe: async () => ({ kind: 'unavailable', error: { category: 'network', message: 'offline' } }),
        retrieveBaseline: async () => {
          calls.push('retrieve');
          return '/unused';
        },
        deployTransition: async () => void calls.push('deploy-transition'),
        pollTransition: async () => void calls.push('poll-transition'),
        deployRules: async () => void calls.push('deploy-rules'),
        restore: async () => void calls.push('restore'),
        pollRestoration: async () => void calls.push('poll-restoration'),
        cleanup: async () => void calls.push('cleanup'),
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error?.message).to.include('refusing deploy');
    expect(calls).to.deep.equal(['cleanup']);
  });

  it('restores only after mutation and verifies both models through bounded polling', async () => {
    const workspace = await createRestorationProject();
    const calls: string[] = [];

    await runLiveOwdHarness({
      observe: async () => ({
        kind: 'observed',
        observation: { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
      }),
      retrieveBaseline: async () => workspace,
      deployTransition: async () => void calls.push('deploy-transition'),
      pollTransition: async () => void calls.push('poll-transition-internal-and-external'),
      deployRules: async () => void calls.push('deploy-rules'),
      restore: async (sourceDir) => void calls.push(`restore:${path.basename(sourceDir)}`),
      pollRestoration: async (expected) => {
        calls.push(`poll-restore:${expected.internalSharingModel}:${expected.externalSharingModel}`);
      },
      cleanup: async () => void calls.push('cleanup'),
    });

    expect(calls).to.deep.equal([
      'deploy-transition',
      'poll-transition-internal-and-external',
      'deploy-rules',
      'restore:force-app',
      'poll-restore:ReadWriteTransfer:Private',
      'cleanup',
    ]);
  });

  it('rejects a retrieved directory without a source-format Case object before mutation', async () => {
    const workspace = await mkdtemp(path.join(tmpdir(), 'owd-invalid-restore-'));
    workspaces.push(workspace);
    await writeFile(path.join(workspace, 'sfdx-project.json'), '{}');

    let error: Error | undefined;
    try {
      await validateRestorationSource(workspace);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include('missing Case.object-meta.xml');
  });

  it('fails when restoration verification fails and still attempts cleanup', async () => {
    const workspace = await createRestorationProject();
    const calls: string[] = [];

    let error: Error | undefined;
    try {
      await runLiveOwdHarness({
        observe: async () => ({ kind: 'observed', observation: { internalSharingModel: 'ReadWriteTransfer' } }),
        retrieveBaseline: async () => workspace,
        deployTransition: async () => void calls.push('deploy-transition'),
        pollTransition: async () => undefined,
        deployRules: async () => undefined,
        restore: async () => void calls.push('restore'),
        pollRestoration: async () => {
          calls.push('poll-restoration');
          throw new Error('restoration timed out');
        },
        cleanup: async () => void calls.push('cleanup'),
      });
    } catch (caught) {
      error = caught as Error;
    }

    expect(error?.message).to.equal('restoration timed out');
    expect(calls).to.deep.equal(['deploy-transition', 'restore', 'poll-restoration', 'cleanup']);
  });

  it('polls eventual consistency until internal and external restoration values both match', async () => {
    const observations = [
      { internalSharingModel: 'Private', externalSharingModel: 'Private' },
      { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'PublicReadOnly' },
      { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
    ];
    const sleeps: number[] = [];
    let now = 0;

    await pollSharingModels(
      async () => ({ kind: 'observed', observation: observations.shift() ?? {} }),
      { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
      { timeoutMs: 1000, initialDelayMs: 100, maximumDelayMs: 200 },
      {
        now: () => now,
        sleep: async (milliseconds) => {
          sleeps.push(milliseconds);
          now += milliseconds;
        },
      }
    );

    expect(sleeps).to.deep.equal([100, 200]);
    expect(observations).to.deep.equal([]);
  });

  async function createRestorationProject(): Promise<string> {
    const workspace = await mkdtemp(path.join(tmpdir(), 'owd-valid-restore-'));
    workspaces.push(workspace);
    const objectDirectory = path.join(workspace, 'force-app/main/default/objects/Case');
    const sharingRulesDirectory = path.join(workspace, 'force-app/main/default/sharingRules');
    await mkdir(objectDirectory, { recursive: true });
    await mkdir(sharingRulesDirectory, { recursive: true });
    await writeFile(path.join(workspace, 'sfdx-project.json'), '{}');
    await writeFile(path.join(objectDirectory, 'Case.object-meta.xml'), '<CustomObject/>');
    await writeFile(path.join(sharingRulesDirectory, 'Case.sharingRules-meta.xml'), '<SharingRules/>');
    return workspace;
  }
});
