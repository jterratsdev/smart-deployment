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

  it('promotes dependencies across package directories without stranding target-only objects', async () => {
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
    await writeFile(path.join(fieldDir, 'Email__c.field-meta.xml'), '<CustomField><type>Email</type></CustomField>');
    await writeFile(
      path.join(matchingDir, 'Account.matchingRule-meta.xml'),
      '<MatchingRules><matchingRules><fullName>Email_Rule</fullName><matchingRuleItems><fieldName>Email__c</fieldName></matchingRuleItems><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
    );
    await writeFile(
      path.join(duplicateDir, 'Account.Email_Duplicate.duplicateRule-meta.xml'),
      '<DuplicateRule><duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>Email_Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
    );

    const result = await new MetadataScannerService().scan({ sourcePath: root });
    const components = result.dependencyResult.components;

    expect(components.get('CustomField:Account.Email__c')?.dependencies).to.deep.equal(new Set());
    expect(components.get('MatchingRules:Account')?.dependencies).to.deep.equal(
      new Set(['CustomField:Account.Email__c'])
    );
    expect(components.get('DuplicateRule:Account.Email_Duplicate')?.dependencies).to.deep.equal(
      new Set(['MatchingRules:Account'])
    );
  });
});
