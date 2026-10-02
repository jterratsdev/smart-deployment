import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseMatchingRules } from '../../../src/parsers/matching-rules-parser.js';

describe('matching-rules-parser', () => {
  it('parses deterministic rule names, fields, and active state', () => {
    const parsed = parseMatchingRules(
      'Account',
      `<?xml version="1.0"?>
<MatchingRules xmlns="http://soap.sforce.com/2006/04/metadata">
  <matchingRules>
    <fullName>Email_And_Phone</fullName>
    <matchingRuleItems><fieldName>Email__c</fieldName></matchingRuleItems>
    <matchingRuleItems><fieldName>Phone</fieldName></matchingRuleItems>
    <ruleStatus>Active</ruleStatus>
  </matchingRules>
  <matchingRules>
    <fullName>Name_Only</fullName>
    <matchingRuleItems><fieldName>Name</fieldName></matchingRuleItems>
    <ruleStatus>Inactive</ruleStatus>
  </matchingRules>
</MatchingRules>`
    );

    expect(parsed).to.deep.equal({
      objectName: 'Account',
      rules: [
        { name: 'Email_And_Phone', fields: ['Email__c', 'Phone'], isActive: true },
        { name: 'Name_Only', fields: ['Name'], isActive: false },
      ],
    });
  });

  it('rejects malformed roots and unsupported rule status', () => {
    expect(() => parseMatchingRules('Account', '<DuplicateRule />')).to.throw('Expected MatchingRules XML root');
    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><fullName>Rule</fullName><ruleStatus>Pending</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw('Matching rule Rule has invalid ruleStatus: Pending');
  });
});
