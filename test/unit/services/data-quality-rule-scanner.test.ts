import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  addLocalDataQualityRuleDependencies,
  parseCustomFieldComponent,
  parseDuplicateRuleComponent,
  parseMatchingRulesComponent,
} from '../../../src/services/scanners/data-quality-rule-scanner.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('data-quality-rule-scanner', () => {
  let tempDir: string | undefined;
  afterEach(async () => {
    if (tempDir) await rm(tempDir, { recursive: true, force: true });
  });

  it('creates canonical nodes and promotes only local object, field, and matching dependencies', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'data-quality-rules-'));
    const matchingFile = path.join(tempDir, 'matchingRules', 'Account.matchingRule-meta.xml');
    const duplicateFile = path.join(tempDir, 'duplicateRules', 'Account.Email_Duplicate.duplicateRule-meta.xml');
    const fieldFile = path.join(tempDir, 'objects', 'Account', 'fields', 'Email__c.field-meta.xml');
    await Promise.all([
      mkdir(path.dirname(matchingFile), { recursive: true }),
      mkdir(path.dirname(duplicateFile), { recursive: true }),
      mkdir(path.dirname(fieldFile), { recursive: true }),
    ]);
    await writeFile(
      matchingFile,
      '<MatchingRules><matchingRules><fullName>Email_Rule</fullName><matchingRuleItems><fieldName>Email__c</fieldName></matchingRuleItems><matchingRuleItems><fieldName>Phone</fieldName></matchingRuleItems><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
    );
    await writeFile(
      duplicateFile,
      '<DuplicateRule><duplicateRuleFilter><duplicateRuleFilterItems><field>Email__c</field><table>Account</table></duplicateRuleFilterItems></duplicateRuleFilter><duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>Email_Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
    );
    await writeFile(fieldFile, '<CustomField />');
    const object = component('CustomObject', 'Account');
    const field = parseCustomFieldComponent(fieldFile);
    const matching = await parseMatchingRulesComponent(matchingFile);
    const duplicate = await parseDuplicateRuleComponent(duplicateFile);
    expect(matching).not.to.equal(undefined);

    const normalized = addLocalDataQualityRuleDependencies([object, field, matching!, duplicate]);
    const byId = new Map(normalized.map((item) => [`${item.type}:${item.name}`, item]));

    expect(byId.get('CustomField:Account.Email__c')?.dependencies).to.deep.equal(new Set(['CustomObject:Account']));
    expect([...byId.get('MatchingRules:Account')!.dependencies].sort()).to.deep.equal([
      'CustomField:Account.Email__c',
      'CustomObject:Account',
    ]);
    expect([...byId.get('DuplicateRule:Account.Email_Duplicate')!.dependencies].sort()).to.deep.equal([
      'CustomField:Account.Email__c',
      'CustomObject:Account',
      'MatchingRules:Account',
    ]);
    expect([...byId.get('MatchingRules:Account')!.dependencies]).not.to.include('CustomField:Account.Phone');
  });

  it('rejects duplicate-rule filenames without object ownership', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'data-quality-rule-name-'));
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

  it('omits empty containers retrieved for non-retrievable standard matching rules', async () => {
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'standard-matching-rules-'));
    const matchingFile = path.join(tempDir, 'matchingRules', 'Account.matchingRule-meta.xml');
    await mkdir(path.dirname(matchingFile), { recursive: true });
    await writeFile(matchingFile, '<MatchingRules xmlns="http://soap.sforce.com/2006/04/metadata" />');

    expect(await parseMatchingRulesComponent(matchingFile)).to.equal(undefined);
  });

  it('keeps a standard matching-rule reference target-owned when no local container is discovered', () => {
    const duplicate = component('DuplicateRule', 'Account.Standard_Rule');
    duplicate.facts = {
      kind: 'duplicate-rule',
      objectName: 'Account',
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Standard_Match_Rule' }],
      filterFields: [],
      isActive: true,
    };

    const normalized = addLocalDataQualityRuleDependencies([duplicate]);

    expect(normalized[0].dependencies).to.deep.equal(new Set());
  });

  it('orders deactivation with DuplicateRule before MatchingRules', async () => {
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
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Rule' }],
      filterFields: [],
      isActive: false,
    };

    const normalized = addLocalDataQualityRuleDependencies([matching, duplicate]);
    expect(normalized.find((item) => item.type === 'MatchingRules')?.dependencies).to.deep.equal(
      new Set(['DuplicateRule:Account.Rule'])
    );
    expect(normalized.find((item) => item.type === 'DuplicateRule')?.dependencies).to.deep.equal(new Set());
  });

  it('blocks an active DuplicateRule that references a local inactive matching rule', () => {
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
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Rule' }],
      filterFields: [],
      isActive: true,
    };

    expect(() => addLocalDataQualityRuleDependencies([matching, duplicate])).to.throw(
      'Active DuplicateRule Account.Rule references inactive matching rule Account.Rule'
    );
  });

  it('blocks a DuplicateRule that references a missing rule in a local MatchingRules container', () => {
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
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Missing_Rule' }],
      filterFields: [],
      isActive: true,
    };

    expect(() => addLocalDataQualityRuleDependencies([matching, duplicate])).to.throw(
      'DuplicateRule Account.Rule references missing local matching rule Account.Missing_Rule'
    );
  });

  it('does not strand a decomposed field when its object definition is target-only', () => {
    const field = component('CustomField', 'Account.Email__c');
    const normalized = addLocalDataQualityRuleDependencies([field]);
    expect(normalized[0].dependencies).to.deep.equal(new Set());
  });
});

function component(type: MetadataComponent['type'], name: string): MetadataComponent {
  return { type, name, filePath: name, dependencies: new Set(), dependents: new Set(), priorityBoost: 0 };
}
