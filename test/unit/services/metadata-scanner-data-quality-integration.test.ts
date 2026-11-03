import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';

describe('MetadataScannerService data quality integration', () => {
  let root: string | undefined;
  afterEach(async () => {
    if (root) await rm(root, { recursive: true, force: true });
  });

  it('resolves a DuplicateRule reference to a MatchingRules container across package directories (T13)', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-data-quality-'));
    await writeFile(
      path.join(root, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'schema' }, { path: 'rules' }], sourceApiVersion: '67.0' })
    );
    const fieldDir = path.join(root, 'schema', 'main', 'default', 'objects', 'Account', 'fields');
    const matchingDir = path.join(root, 'schema', 'main', 'default', 'matchingRules');
    const duplicateDir = path.join(root, 'rules', 'main', 'default', 'duplicateRules');
    await Promise.all([
      mkdir(fieldDir, { recursive: true }),
      mkdir(matchingDir, { recursive: true }),
      mkdir(duplicateDir, { recursive: true }),
    ]);
    await writeFile(
      path.join(fieldDir, 'Email__c.field-meta.xml'),
      '<CustomField><fullName>Email__c</fullName><type>Email</type></CustomField>'
    );
    await writeFile(
      path.join(matchingDir, 'Account.matchingRule-meta.xml'),
      '<MatchingRules><matchingRules><fullName>Email_Rule</fullName><matchingRuleItems><fieldName>Email__c</fieldName></matchingRuleItems><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
    );
    await writeFile(
      path.join(duplicateDir, 'Account.Email_Duplicate.duplicateRule-meta.xml'),
      '<DuplicateRule><duplicateRuleFilter><duplicateRuleFilterItems><field>Email__c</field><table>Account</table></duplicateRuleFilterItems></duplicateRuleFilter><duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>Email_Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
    );

    const result = await new MetadataScannerService().scan({ sourcePath: root });

    expect(result.errors).to.deep.equal([]);
    const components = result.dependencyResult.components;
    const matching = components.get('MatchingRules:Account');
    const duplicate = components.get('DuplicateRule:Account.Email_Duplicate');

    expect(matching?.facts).to.deep.equal({
      kind: 'matching-rules',
      objectName: 'Account',
      rules: [{ name: 'Email_Rule', fields: ['Email__c'], isActive: true }],
    });
    expect([...(duplicate?.dependencies ?? [])].sort()).to.deep.equal([
      'CustomField:Account.Email__c',
      'MatchingRules:Account',
    ]);
    expect(
      duplicate?.facts?.kind === 'duplicate-rule' &&
        duplicate.facts.references.find((reference) => reference.kind === 'object')?.outcome
    ).to.equal('target-unknown');
    expect(
      duplicate?.facts?.kind === 'duplicate-rule' &&
        duplicate.facts.references
          .filter((reference) => reference.kind !== 'object')
          .every((reference) => reference.outcome === 'local')
    ).to.equal(true);
  });

  it('reports target-unknown for a DuplicateRule referencing a standard object with no local container (T8 via scan)', async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'metadata-scanner-data-quality-standard-'));
    await writeFile(
      path.join(root, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'force-app' }], sourceApiVersion: '67.0' })
    );
    const duplicateDir = path.join(root, 'force-app', 'main', 'default', 'duplicateRules');
    await mkdir(duplicateDir, { recursive: true });
    await writeFile(
      path.join(duplicateDir, 'Lead.Standard_Duplicate.duplicateRule-meta.xml'),
      '<DuplicateRule><duplicateRuleMatchRules><matchRuleSObjectType>Lead</matchRuleSObjectType><matchingRule>Standard_Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
    );

    const result = await new MetadataScannerService().scan({ sourcePath: root });

    expect(result.errors).to.deep.equal([]);
    const duplicate = result.dependencyResult.components.get('DuplicateRule:Lead.Standard_Duplicate');
    expect(duplicate?.dependencies).to.deep.equal(new Set());
    expect(
      duplicate?.facts?.kind === 'duplicate-rule' &&
        duplicate.facts.references.every((reference) => reference.outcome === 'target-unknown')
    ).to.equal(true);
  });
});
