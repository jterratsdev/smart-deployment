import { expect } from 'chai';
import { describe, it } from 'mocha';
import { addDataQualityReadinessCheckpoints } from '../../../src/deployment/data-quality-readiness-planner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('data-quality-readiness-planner', () => {
  it('adds a deterministic after-wave checkpoint only for active matching rules with duplicate dependents', () => {
    const components = new Map<string, MetadataComponent>([
      ['MatchingRules:Account', matchingRules(true)],
      ['DuplicateRule:Account.Email_Duplicate', duplicateRule()],
    ]);
    const waves = [wave(1, ['MatchingRules:Account']), wave(2, ['DuplicateRule:Account.Email_Duplicate'])];

    const checkpoints = addDataQualityReadinessCheckpoints(waves, components, []);

    expect(checkpoints).to.deep.equal([
      {
        id: 'matching-rules-ready:wave-1',
        phase: 'after',
        waveNumber: 1,
        message: 'Confirm matching-rule activation completed for Account before deploying DuplicateRule metadata.',
      },
    ]);
    expect(addDataQualityReadinessCheckpoints(waves, components, checkpoints)).to.deep.equal(checkpoints);
  });

  it('does not add readiness for inactive rules or override an existing after-wave checkpoint', () => {
    const waves = [wave(1, ['MatchingRules:Account']), wave(2, ['DuplicateRule:Account.Email_Duplicate'])];
    expect(
      addDataQualityReadinessCheckpoints(
        waves,
        new Map([
          ['MatchingRules:Account', matchingRules(false)],
          ['DuplicateRule:Account.Email_Duplicate', duplicateRule()],
        ]),
        []
      )
    ).to.deep.equal([]);
    const existing = [{ id: 'custom', phase: 'after' as const, waveNumber: 1 }];
    expect(() =>
      addDataQualityReadinessCheckpoints(
        waves,
        new Map([
          ['MatchingRules:Account', matchingRules(true)],
          ['DuplicateRule:Account.Email_Duplicate', duplicateRule()],
        ]),
        existing
      )
    ).to.throw('Matching-rule readiness checkpoint conflicts with custom at after wave 1');
  });

  it('rejects a reserved checkpoint id collision in a different position', () => {
    const waves = [wave(1, ['MatchingRules:Account']), wave(2, ['DuplicateRule:Account.Email_Duplicate'])];
    const collision = [{ id: 'matching-rules-ready:wave-1', phase: 'after' as const, waveNumber: 2 }];
    expect(() =>
      addDataQualityReadinessCheckpoints(
        waves,
        new Map([
          ['MatchingRules:Account', matchingRules(true)],
          ['DuplicateRule:Account.Email_Duplicate', duplicateRule()],
        ]),
        collision
      )
    ).to.throw('Reserved matching-rule readiness checkpoint id collision: matching-rules-ready:wave-1');
  });
});

function matchingRules(isActive: boolean): MetadataComponent {
  return {
    type: 'MatchingRules',
    name: 'Account',
    filePath: 'Account',
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
    facts: {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Email_Rule', fields: ['Email__c'], isActive }],
    },
  };
}
function duplicateRule(): MetadataComponent {
  return {
    type: 'DuplicateRule',
    name: 'Account.Email_Duplicate',
    filePath: 'duplicate',
    dependencies: new Set(['MatchingRules:Account']),
    dependents: new Set(),
    priorityBoost: 0,
    facts: {
      kind: 'duplicate-rule',
      objectName: 'Account',
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Email_Rule' }],
      filterFields: [],
      isActive: true,
    },
  };
}
function wave(number: number, components: string[]): Wave {
  return {
    number,
    components,
    metadata: {
      componentCount: components.length,
      types: components.map((nodeId) => nodeId.split(':')[0] as MetadataComponent['type']),
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 1,
    },
  };
}
