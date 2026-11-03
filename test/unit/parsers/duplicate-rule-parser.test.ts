import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseDuplicateRule } from '../../../src/parsers/duplicate-rule-parser.js';

describe('duplicate-rule-parser', () => {
  it('parses matching references, filter fields, and active state (T7)', () => {
    const parsed = parseDuplicateRule(
      'Account',
      `<?xml version="1.0"?>
<DuplicateRule xmlns="http://soap.sforce.com/2006/04/metadata">
  <duplicateRuleFilter>
    <duplicateRuleFilterItems><field>Region__c</field><table>Account</table></duplicateRuleFilterItems>
  </duplicateRuleFilter>
  <duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>Email_Rule</matchingRule></duplicateRuleMatchRules>
  <isActive>true</isActive>
</DuplicateRule>`
    );

    expect(parsed).to.deep.equal({
      objectName: 'Account',
      isActive: true,
      matchReferences: [{ matchObjectName: 'Account', matchingRuleName: 'Email_Rule' }],
      filterFields: ['Account.Region__c'],
    });
  });

  it('defaults an absent filter table to the owning object (TBD-4)', () => {
    const parsed = parseDuplicateRule(
      'Account',
      '<DuplicateRule><duplicateRuleFilter><duplicateRuleFilterItems><field>Region__c</field></duplicateRuleFilterItems></duplicateRuleFilter><isActive>false</isActive></DuplicateRule>'
    );

    expect(parsed.filterFields).to.deep.equal(['Account.Region__c']);
  });

  it('rejects a non-DuplicateRule root and invalid XML (T11)', () => {
    expect(() => parseDuplicateRule('Account', '<MatchingRules />')).to.throw('Expected DuplicateRule XML root');
    expect(() => parseDuplicateRule('Account', '<DuplicateRule><unterminated')).to.throw('Invalid DuplicateRule XML');
  });

  it('rejects missing matching references and invalid booleans (T11)', () => {
    expect(() =>
      parseDuplicateRule(
        'Account',
        '<DuplicateRule><duplicateRuleMatchRules><matchingRule>Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
      )
    ).to.throw('DuplicateRule matching references require matchRuleSObjectType and matchingRule');
    expect(() => parseDuplicateRule('Account', '<DuplicateRule><isActive>1</isActive></DuplicateRule>')).to.throw(
      'DuplicateRule isActive must be true or false'
    );
    expect(() => parseDuplicateRule('Account', '<DuplicateRule></DuplicateRule>')).to.throw(
      'DuplicateRule isActive must be true or false'
    );
  });

  it('rejects an extra top-level sibling element alongside the DuplicateRule root (F4)', () => {
    expect(() =>
      parseDuplicateRule('Account', '<X/><DuplicateRule><isActive>true</isActive></DuplicateRule>')
    ).to.throw('Expected DuplicateRule XML root');
  });

  it('rejects a text-only root instead of accepting it as empty (F4)', () => {
    expect(() => parseDuplicateRule('Account', '<DuplicateRule>hello</DuplicateRule>')).to.throw(
      'Expected DuplicateRule XML root'
    );
  });

  it('rejects a matching reference containing an identity separator character (F5)', () => {
    expect(() =>
      parseDuplicateRule(
        'Account',
        '<DuplicateRule><duplicateRuleMatchRules><matchRuleSObjectType>Account</matchRuleSObjectType><matchingRule>R#x</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
      )
    ).to.throw("DuplicateRule matchingRule \"R#x\" must not contain ':' or '#'");
    expect(() =>
      parseDuplicateRule(
        'Account',
        '<DuplicateRule><duplicateRuleMatchRules><matchRuleSObjectType>Acc#ount</matchRuleSObjectType><matchingRule>Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
      )
    ).to.throw("DuplicateRule matchRuleSObjectType \"Acc#ount\" must not contain ':' or '#'");
  });
});
