import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  addDataQualityReferenceOutcomes,
  parseDuplicateRuleComponent,
  parseMatchingRulesComponent,
} from '../../../src/services/scanners/data-quality-rule-scanner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('data-quality-rule-scanner', () => {
  let tempDir: string | undefined;
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('builds the MatchingRules container component (T1)', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'matching-rules-component-'));
    const filePath = path.join(tempDir, 'Account.matchingRule-meta.xml');
    await writeFile(
      filePath,
      '<MatchingRules><matchingRules><fullName>Email_Rule</fullName><matchingRuleItems><fieldName>Email__c</fieldName></matchingRuleItems><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
    );

    const matchingComponent = await parseMatchingRulesComponent(filePath);

    expect(matchingComponent.type).to.equal('MatchingRules');
    expect(matchingComponent.name).to.equal('Account');
    expect(matchingComponent.facts).to.deep.equal({
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Email_Rule', fields: ['Email__c'], isActive: true }],
    });
  });

  it('builds an empty MatchingRules component for a valid container with zero rules (T5)', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'matching-rules-empty-'));
    const filePath = path.join(tempDir, 'Account.matchingRule-meta.xml');
    await writeFile(filePath, '<MatchingRules></MatchingRules>');

    const matchingComponent = await parseMatchingRulesComponent(filePath);

    expect(matchingComponent.facts).to.deep.equal({ kind: 'matching-rules', objectName: 'Account', rules: [] });
    expect(matchingComponent.dependencies).to.deep.equal(new Set());
  });

  it('rejects a MatchingRules filename that is not a bare object API name', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'matching-rules-bad-name-'));
    const filePath = path.join(tempDir, 'Account.Extra.matchingRule-meta.xml');
    await writeFile(filePath, '<MatchingRules></MatchingRules>');

    let error: Error | undefined;
    try {
      await parseMatchingRulesComponent(filePath);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include('MatchingRules filename must be a bare object API name');
  });

  it('builds the DuplicateRule component with target-unknown placeholder references (T7 setup)', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'duplicate-rule-component-'));
    const filePath = path.join(tempDir, 'Account.Email_Duplicate.duplicateRule-meta.xml');
    await writeFile(
      filePath,
      '<DuplicateRule><duplicateRuleFilter><duplicateRuleFilterItems><field>Email__c</field><table>Account</table></duplicateRuleFilterItems></duplicateRuleFilter><duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>Email_Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
    );

    const duplicateComponent = await parseDuplicateRuleComponent(filePath);

    expect(duplicateComponent.type).to.equal('DuplicateRule');
    expect(duplicateComponent.name).to.equal('Account.Email_Duplicate');
    expect(duplicateComponent.facts).to.deep.equal({
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        {
          kind: 'object',
          identity: 'CustomObject:Account',
          outcome: 'target-unknown',
          reason: 'DuplicateRule owning object',
        },
        {
          kind: 'field',
          identity: 'CustomField:Account.Email__c',
          outcome: 'target-unknown',
          reason: 'DuplicateRule filter field',
        },
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Email_Rule',
          outcome: 'target-unknown',
          reason: 'DuplicateRule matching rule reference',
        },
      ],
    });
  });

  it('rejects a DuplicateRule filename without object ownership (T11)', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'duplicate-rule-bad-name-'));
    const filePath = path.join(tempDir, 'Rule.duplicateRule-meta.xml');
    await writeFile(filePath, '<DuplicateRule><isActive>false</isActive></DuplicateRule>');

    let error: Error | undefined;
    try {
      await parseDuplicateRuleComponent(filePath);
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include('DuplicateRule filename must be Object.RuleName');
  });

  it('resolves local object, field, and matching-rule references into hard edges (T7)', () => {
    const object = component('CustomObject', 'Account');
    const field = component('CustomField', 'Account.Email__c');
    const matching = component('MatchingRules', 'Account');
    matching.facts = {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Email_Rule', fields: ['Email__c'], isActive: true }],
    };
    const duplicate = component('DuplicateRule', 'Account.Email_Duplicate');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        { kind: 'object', identity: 'CustomObject:Account', outcome: 'target-unknown', reason: 'owning object' },
        { kind: 'field', identity: 'CustomField:Account.Email__c', outcome: 'target-unknown', reason: 'filter field' },
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Email_Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };

    const errors: string[] = [];
    const normalized = addDataQualityReferenceOutcomes([object, field, matching, duplicate], errors);
    const byId = new Map(normalized.map((item) => [`${item.type}:${item.name}`, item]));
    const duplicateResult = byId.get('DuplicateRule:Account.Email_Duplicate')!;

    expect(errors).to.deep.equal([]);
    expect([...duplicateResult.dependencies].sort()).to.deep.equal([
      'CustomField:Account.Email__c',
      'CustomObject:Account',
      'MatchingRules:Account',
    ]);
    expect(duplicateResult.facts).to.deep.equal({
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        { kind: 'object', identity: 'CustomObject:Account', outcome: 'local', reason: 'owning object' },
        { kind: 'field', identity: 'CustomField:Account.Email__c', outcome: 'local', reason: 'filter field' },
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Email_Rule',
          outcome: 'local',
          reason: 'matching rule',
        },
      ],
    });
  });

  it('reports target-unknown for a standard object/field with no local container, with no edge and no error (T8)', () => {
    const duplicate = component('DuplicateRule', 'Lead.Standard_Dup');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Lead',
      isActive: true,
      references: [
        { kind: 'object', identity: 'CustomObject:Lead', outcome: 'target-unknown', reason: 'owning object' },
        { kind: 'field', identity: 'CustomField:Lead.Email', outcome: 'target-unknown', reason: 'filter field' },
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Lead#Standard_Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };

    const errors: string[] = [];
    const normalized = addDataQualityReferenceOutcomes([duplicate], errors);

    expect(errors).to.deep.equal([]);
    expect(normalized[0].dependencies).to.deep.equal(new Set());
    expect(normalized[0].facts).to.deep.equal({
      ...duplicate.facts,
      references: duplicate.facts.references.map((reference) => ({ ...reference, outcome: 'target-unknown' })),
    });
  });

  it('reports local-missing and appends a scan error when the local container lacks the referenced rule (T9)', () => {
    const matching = component('MatchingRules', 'Account');
    matching.facts = {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Other_Rule', fields: [], isActive: true }],
    };
    const duplicate = component('DuplicateRule', 'Account.Rule');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Missing_Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };

    const errors: string[] = [];
    const normalized = addDataQualityReferenceOutcomes([matching, duplicate], errors);
    const duplicateResult = normalized.find((item) => item.type === 'DuplicateRule')!;

    expect(errors).to.deep.equal([
      'DuplicateRule Account.Rule references missing local matching rule Account.Missing_Rule',
    ]);
    expect(duplicateResult.facts?.kind === 'duplicate-rule' && duplicateResult.facts.references[0].outcome).to.equal(
      'local-missing'
    );
    expect(duplicateResult.dependencies).to.deep.equal(new Set());
  });

  it('appends a scan error when an active DuplicateRule references a local inactive matching rule (T10)', () => {
    const matching = component('MatchingRules', 'Account');
    matching.facts = {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Rule', fields: [], isActive: false }],
    };
    const duplicate = component('DuplicateRule', 'Account.Rule');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };

    const errors: string[] = [];
    addDataQualityReferenceOutcomes([matching, duplicate], errors);

    expect(errors).to.deep.equal(['Active DuplicateRule Account.Rule references inactive matching rule Account.Rule']);
  });

  it('orders deactivation with DuplicateRule before MatchingRules (T12)', () => {
    const matching = component('MatchingRules', 'Account');
    matching.facts = {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Rule', fields: [], isActive: false }],
    };
    const duplicate = component('DuplicateRule', 'Account.Rule');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: false,
      references: [
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };

    const errors: string[] = [];
    const normalized = addDataQualityReferenceOutcomes([matching, duplicate], errors);

    expect(errors).to.deep.equal([]);
    expect(normalized.find((item) => item.type === 'MatchingRules')?.dependencies).to.deep.equal(
      new Set(['DuplicateRule:Account.Rule'])
    );
    expect(normalized.find((item) => item.type === 'DuplicateRule')?.dependencies).to.deep.equal(new Set());
  });

  it('is deterministic across repeated runs on the same fixture (T16)', () => {
    const matching = component('MatchingRules', 'Account');
    matching.facts = {
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Rule', fields: ['Email__c'], isActive: true }],
    };
    const duplicate = component('DuplicateRule', 'Account.Rule');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      isActive: true,
      references: [
        { kind: 'object', identity: 'CustomObject:Account', outcome: 'target-unknown', reason: 'owning object' },
        {
          kind: 'matching-rule',
          identity: 'MatchingRules:Account#Rule',
          outcome: 'target-unknown',
          reason: 'matching rule',
        },
      ],
    };
    const object = component('CustomObject', 'Account');

    const errorsA: string[] = [];
    const errorsB: string[] = [];
    const resultA = addDataQualityReferenceOutcomes([object, matching, duplicate].map(cloneForInput), errorsA);
    const resultB = addDataQualityReferenceOutcomes([object, matching, duplicate].map(cloneForInput), errorsB);

    expect(serialize(resultA)).to.deep.equal(serialize(resultB));
    expect(errorsA).to.deep.equal(errorsB);
  });
});

function component(type: MetadataComponent['type'], name: string): MetadataComponent {
  return { type, name, filePath: name, dependencies: new Set(), dependents: new Set(), priorityBoost: 0 };
}

function cloneForInput(input: MetadataComponent): MetadataComponent {
  return {
    ...input,
    dependencies: new Set(input.dependencies),
    dependents: new Set(input.dependents),
    dependencyDetails: input.dependencyDetails ? [...input.dependencyDetails] : undefined,
  };
}

function serialize(components: MetadataComponent[]): string {
  return JSON.stringify(
    components.map((item) => ({
      type: item.type,
      name: item.name,
      dependencies: [...item.dependencies].sort(),
      dependencyDetails: item.dependencyDetails,
      facts: item.facts,
    }))
  );
}
