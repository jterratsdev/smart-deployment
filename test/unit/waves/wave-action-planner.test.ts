import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { createDeploymentPlanFingerprint } from '../../../src/types/manual-checkpoint.js';
import type { Wave } from '../../../src/waves/wave-builder.js';
import {
  addWaveActionCheckpoints,
  hydrateWaveActionScripts,
  mergeWaveActionRules,
  WaveActionPlanner,
} from '../../../src/waves/wave-action-planner.js';

describe('WaveActionPlanner', () => {
  it('attaches typed actions to the waves containing selected components or types', () => {
    const result = new WaveActionPlanner().plan(waves(), [
      {
        id: 'seed-account-data',
        phase: 'after',
        when: { components: ['CustomObject:Account'] },
        action: { kind: 'apex-anonymous', script: 'scripts/apex/seed-account.apex' },
      },
      {
        id: 'activate-flow',
        phase: 'before',
        when: { types: ['Flow'] },
        action: { kind: 'manual', instruction: 'Activate the prerequisite provider resource.' },
      },
    ]);

    expect(result.unmatchedRuleIds).to.deep.equal([]);
    expect(result.waves[0].metadata.requiredActions).to.deep.include({
      id: 'seed-account-data',
      phase: 'after',
      action: { kind: 'apex-anonymous', script: 'scripts/apex/seed-account.apex' },
      matchedComponents: ['CustomObject:Account'],
    });
    expect(result.waves[1].metadata.requiredActions?.[0]).to.deep.include({
      id: 'activate-flow',
      matchedComponents: ['Flow:Account_Onboarding'],
    });
  });

  it('reports rules that do not match the generated plan', () => {
    const result = new WaveActionPlanner().plan(waves(), [
      {
        id: 'missing-component',
        phase: 'after',
        when: { components: ['ApexClass:Missing'] },
        action: { kind: 'manual', instruction: 'Review the missing component.' },
      },
    ]);

    expect(result.unmatchedRuleIds).to.deep.equal(['missing-component']);
    expect(result.waves.every((wave) => wave.metadata.requiredActions === undefined)).to.equal(true);
  });

  it('creates one durable boundary and merges it with an explicit checkpoint', () => {
    const planned = new WaveActionPlanner().plan(waves(), [
      {
        id: 'verify-apex',
        phase: 'after',
        when: { types: ['ApexClass'] },
        action: { kind: 'manual', instruction: 'Verify Apex runtime behavior.' },
      },
    ]).waves;

    const checkpoints = addWaveActionCheckpoints(planned, [
      { id: 'release-approval', phase: 'after', waveNumber: 2, message: 'Approve release.' },
    ]);

    expect(checkpoints).to.have.lengthOf(1);
    expect(checkpoints[0]).to.deep.include({
      id: 'release-approval',
      phase: 'after',
      waveNumber: 2,
      message: 'Approve release.',
    });
    expect(checkpoints[0].requiredActions?.map((action) => action.id)).to.deep.equal(['verify-apex']);
  });

  it('combines multiple generated actions at the same boundary', () => {
    const planned = new WaveActionPlanner().plan(waves(), [
      {
        id: 'seed-data',
        phase: 'after',
        when: { components: ['CustomObject:Account'] },
        action: { kind: 'apex-anonymous', script: 'scripts/apex/seed.apex' },
      },
      {
        id: 'verify-data',
        phase: 'after',
        when: { components: ['ApexClass:AccountSeed'] },
        action: { kind: 'manual', instruction: 'Verify seeded records.' },
      },
    ]).waves;

    const checkpoints = addWaveActionCheckpoints(planned);

    expect(checkpoints).to.have.lengthOf(1);
    expect(checkpoints[0].requiredActions?.map((action) => action.id)).to.deep.equal(['seed-data', 'verify-data']);
    expect(checkpoints[0].message).to.include('scripts/apex/seed.apex');
    expect(checkpoints[0].message).to.include('Verify seeded records.');
  });

  it('fingerprints configured Apex scripts and rejects changed content', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'wave-action-script-'));
    try {
      await mkdir(path.join(projectRoot, 'scripts/apex'), { recursive: true });
      await writeFile(path.join(projectRoot, 'scripts/apex/seed.apex'), "System.debug('seed');\n");
      const planned = new WaveActionPlanner().plan(waves(), [
        {
          id: 'seed-data',
          phase: 'after',
          when: { components: ['CustomObject:Account'] },
          action: { kind: 'apex-anonymous', script: 'scripts/apex/seed.apex' },
        },
      ]).waves;

      await expectReject(hydrateWaveActionScripts(planned, `${projectRoot}-missing`), 'was not found');

      const hydrated = await hydrateWaveActionScripts(planned, projectRoot);
      const action = hydrated[0].metadata.requiredActions?.[0]?.action;
      expect(action)
        .to.have.property('sha256')
        .that.matches(/^[a-f0-9]{64}$/u);
      const checkpoints = addWaveActionCheckpoints(hydrated);
      const fingerprint = createDeploymentPlanFingerprint({
        waves: hydrated,
        checkpoints,
        destructive: false,
        skipTests: true,
      });
      await writeFile(path.join(projectRoot, 'scripts/apex/seed.apex'), "System.debug('changed');\n");
      const changed = await hydrateWaveActionScripts(planned, projectRoot);
      const changedFingerprint = createDeploymentPlanFingerprint({
        waves: changed,
        checkpoints: addWaveActionCheckpoints(changed),
        destructive: false,
        skipTests: true,
      });
      expect(changedFingerprint).to.not.equal(fingerprint);
      await expectReject(hydrateWaveActionScripts(hydrated, projectRoot), 'hash does not match');
    } finally {
      await rm(projectRoot, { recursive: true, force: true });
    }
  });

  it('rejects generated checkpoint ID collisions and incompatible action merges', () => {
    const collisionWaves = waves();
    collisionWaves[0].metadata.requiredActions = [
      {
        id: 'generated-action',
        phase: 'after',
        action: { kind: 'manual', instruction: 'Run the generated action.' },
        matchedComponents: ['CustomObject:Account'],
      },
    ];
    expect(() =>
      addWaveActionCheckpoints(collisionWaves, [{ id: 'required-actions-after-wave-1', phase: 'after', waveNumber: 2 }])
    ).to.throw('conflicts with explicit checkpoint');

    const planned = waves();
    planned[0].metadata.requiredActions = [
      {
        id: 'same-id',
        phase: 'after',
        action: { kind: 'manual', instruction: 'First instruction.' },
        matchedComponents: ['CustomObject:Account'],
      },
    ];
    const explicit = {
      id: 'existing',
      phase: 'after' as const,
      waveNumber: 1,
      requiredActions: [
        {
          id: 'same-id',
          phase: 'after' as const,
          action: { kind: 'manual' as const, instruction: 'Different instruction.' },
          matchedComponents: [],
        },
      ],
    };
    expect(() => addWaveActionCheckpoints(planned, [explicit])).to.throw('Conflicting wave action definitions');
  });

  it('rejects duplicate action IDs across configuration sources', () => {
    const rule = {
      id: 'same-id',
      phase: 'after' as const,
      when: { types: ['Flow' as const] },
      action: { kind: 'manual' as const, instruction: 'Review the flow.' },
    };
    expect(() =>
      mergeWaveActionRules([rule], [{ ...rule, action: { ...rule.action, instruction: 'Other.' } }])
    ).to.throw('Duplicate wave action id across configuration and scripts');
  });
});

async function expectReject(promise: Promise<unknown>, message: string): Promise<void> {
  try {
    await promise;
    expect.fail(`Expected rejection containing ${message}`);
  } catch (error) {
    expect(String(error)).to.include(message);
  }
}

function waves(): Wave[] {
  return [
    {
      number: 1,
      components: ['CustomObject:Account', 'ApexClass:AccountSeed'],
      metadata: {
        componentCount: 2,
        types: ['CustomObject', 'ApexClass'],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 1,
      },
    },
    {
      number: 2,
      components: ['Flow:Account_Onboarding', 'ApexClass:AccountController'],
      metadata: {
        componentCount: 2,
        types: ['Flow', 'ApexClass'],
        maxDepth: 1,
        hasCircularDeps: false,
        estimatedTime: 1,
      },
    },
  ];
}
