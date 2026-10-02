import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseDuplicateRule } from '../../../src/parsers/duplicate-rule-parser.js';

describe('duplicate-rule-parser', () => {
  it('parses matching references, filter fields, and active state', () => {
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
      matchingRules: [{ objectName: 'Account', matchingRuleName: 'Email_Rule' }],
      filterFields: ['Account.Region__c'],
      isActive: true,
    });
  });

  it('rejects missing matching references and invalid booleans', () => {
    expect(() =>
      parseDuplicateRule(
        'Account',
        '<DuplicateRule><duplicateRuleMatchRules><matchingRule>Rule</matchingRule></duplicateRuleMatchRules><isActive>true</isActive></DuplicateRule>'
      )
    ).to.throw('DuplicateRule matching references require matchRuleSObjectType and matchingRule');
    expect(() => parseDuplicateRule('Account', '<DuplicateRule><isActive>1</isActive></DuplicateRule>')).to.throw(
      'DuplicateRule isActive must be true or false'
    );
  });
});
