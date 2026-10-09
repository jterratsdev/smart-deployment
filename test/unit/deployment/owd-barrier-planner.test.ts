import { expect } from 'chai';
import { describe, it } from 'mocha';
import { OwdBarrierPlanner } from '../../../src/deployment/owd-barrier-planner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('OwdBarrierPlanner', () => {
  it('isolates an internal OWD change before same-object SharingRules and reports external independently', async () => {
    const planner = new OwdBarrierPlanner({
      query: async () => ({
        kind: 'observed',
        observation: { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
      }),
    });
    const result = await planner.createPlan(
      [wave(['CustomObject:Case', 'ApexClass:Helper']), wave(['SharingRules:Case'])],
      components(),
      'org'
    );

    expect(result.waves.map((item) => item.components)).to.deep.equal([
      ['CustomObject:Case'],
      ['ApexClass:Helper'],
      ['SharingRules:Case'],
    ]);
    expect(result.postconditions[0]).to.deep.include({
      objectName: 'Case',
      afterWaveNumber: 1,
      expectedInternalSharingModel: 'Private',
      expectedExternalSharingModel: 'Private',
    });
    expect(result.transitions[0]).to.deep.include({
      sharingModel: { source: 'Private', observed: 'ReadWriteTransfer', changed: true },
      externalSharingModel: { source: 'Private', observed: 'Private', changed: false },
    });
  });

  it('does not create an internal barrier for an external-only transition', async () => {
    const map = components();
    map.set('CustomObject:Case', {
      ...map.get('CustomObject:Case')!,
      facts: { kind: 'custom-object-sharing-model', sharingModel: 'Private', externalSharingModel: 'Private' },
    });
    const planner = new OwdBarrierPlanner({
      query: async () => ({
        kind: 'observed',
        observation: { internalSharingModel: 'Private', externalSharingModel: 'ReadWrite' },
      }),
    });
    const result = await planner.createPlan([wave(['CustomObject:Case']), wave(['SharingRules:Case'])], map, 'org');
    expect(result.postconditions).to.deep.equal([]);
    expect(result.transitions[0].externalSharingModel?.changed).to.equal(true);
  });

  it('blocks before mutation when the target observation is unavailable', async () => {
    const planner = new OwdBarrierPlanner({
      query: async () => ({
        kind: 'unavailable',
        error: { category: 'network', message: 'EntityDefinition network unavailable' },
      }),
    });
    const original = [wave(['CustomObject:Case', 'SharingRules:Case'])];
    const result = await planner.createPlan(original, components(), 'org');

    expect(result.postconditions).to.deep.equal([]);
    expect(result.waves.map((item) => item.components)).to.deep.equal(original.map((item) => item.components));
    expect(result.blockedPostconditions[0]).to.deep.include({
      status: 'blocked-before-deploy',
      objectName: 'Case',
      attempts: 1,
      waitedMs: 0,
      observationError: { category: 'network', message: 'EntityDefinition network unavailable' },
    });
  });

  it('orders the changed object before same-object rules without disturbing unrelated wave order', async () => {
    const planner = new OwdBarrierPlanner({
      query: async () => ({
        kind: 'observed',
        observation: { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
      }),
    });
    const result = await planner.createPlan(
      [
        wave(['ApexClass:Before']),
        wave(['SharingRules:Case']),
        wave(['ApexClass:Middle']),
        wave(['CustomObject:Case']),
        wave(['ApexClass:After']),
      ],
      new Map([
        ...components(),
        ['ApexClass:Before', component('Before', 'ApexClass')],
        ['ApexClass:Middle', component('Middle', 'ApexClass')],
        ['ApexClass:After', component('After', 'ApexClass')],
      ]),
      'org'
    );

    expect(result.waves.map((item) => item.components)).to.deep.equal([
      ['ApexClass:Before'],
      ['CustomObject:Case'],
      ['SharingRules:Case'],
      ['ApexClass:Middle'],
      ['ApexClass:After'],
    ]);
  });

  it('remaps checkpoints to the same original wave boundary after isolation', async () => {
    const planner = changedOwdPlanner();
    const result = await planner.createPlan(
      [wave(['ApexClass:Helper', 'CustomObject:Case', 'SharingRules:Case'])],
      components(),
      'org',
      [
        { id: 'before-original', phase: 'before', waveNumber: 1 },
        { id: 'after-original', phase: 'after', waveNumber: 1 },
      ]
    );

    expect(result.waves.map((item) => item.components)).to.deep.equal([
      ['ApexClass:Helper'],
      ['CustomObject:Case'],
      ['SharingRules:Case'],
    ]);
    expect(result.checkpoints).to.deep.equal([
      { id: 'before-original', phase: 'before', waveNumber: 1 },
      { id: 'after-original', phase: 'after', waveNumber: 3 },
    ]);
  });

  it('topologically orders adversarial same-wave dependents before isolating the object', async () => {
    const map = components();
    map.set('ApexClass:Dependent', component('Dependent', 'ApexClass'));
    const result = await changedOwdPlanner().createPlan(
      [wave(['ApexClass:Dependent', 'CustomObject:Case', 'SharingRules:Case'])],
      map,
      'org',
      [],
      new Map([
        ['ApexClass:Dependent', new Set(['CustomObject:Case'])],
        ['SharingRules:Case', new Set(['CustomObject:Case'])],
        ['CustomObject:Case', new Set()],
      ])
    );

    expect(result.waves.map((item) => item.components)).to.deep.equal([
      ['CustomObject:Case'],
      ['ApexClass:Dependent', 'SharingRules:Case'],
    ]);
  });
});

function changedOwdPlanner(): OwdBarrierPlanner {
  return new OwdBarrierPlanner({
    query: async () => ({
      kind: 'observed',
      observation: { internalSharingModel: 'ReadWriteTransfer', externalSharingModel: 'Private' },
    }),
  });
}

function components(): Map<string, MetadataComponent> {
  return new Map([
    [
      'CustomObject:Case',
      component('Case', 'CustomObject', {
        kind: 'custom-object-sharing-model',
        sharingModel: 'Private',
        externalSharingModel: 'Private',
      }),
    ],
    [
      'SharingRules:Case',
      component('Case', 'SharingRules', {
        kind: 'sharing-rules',
        objectName: 'Case',
        criteriaFields: [],
        principals: [],
      }),
    ],
    ['ApexClass:Helper', component('Helper', 'ApexClass')],
  ]);
}

function component(
  name: string,
  type: MetadataComponent['type'],
  facts?: MetadataComponent['facts']
): MetadataComponent {
  return { name, type, filePath: name, dependencies: new Set(), dependents: new Set(), priorityBoost: 0, facts };
}

function wave(nodeIds: string[]): Wave {
  return {
    number: 1,
    components: nodeIds,
    metadata: { componentCount: nodeIds.length, types: [], maxDepth: 0, hasCircularDeps: false, estimatedTime: 0 },
  };
}
