import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseMatchingRules } from '../../../src/parsers/matching-rules-parser.js';

describe('matching-rules-parser', () => {
  it('parses deterministic rule names, fields, and active state (T1)', () => {
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

  it('accepts a valid container with zero rules (T5, empty container)', () => {
    const parsed = parseMatchingRules(
      'Account',
      '<MatchingRules xmlns="http://soap.sforce.com/2006/04/metadata"></MatchingRules>'
    );

    expect(parsed).to.deep.equal({ objectName: 'Account', rules: [] });
  });

  it('strips an Object.Rule prefix that matches the container object', () => {
    const parsed = parseMatchingRules(
      'Account',
      '<MatchingRules><matchingRules><fullName>Account.Email_Rule</fullName><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
    );

    expect(parsed.rules).to.deep.equal([{ name: 'Email_Rule', fields: [], isActive: true }]);
  });

  it('rejects a singular MatchingRule root (T2)', () => {
    expect(() => parseMatchingRules('Account', '<MatchingRule />')).to.throw('Expected MatchingRules XML root');
  });

  it('rejects a DuplicateRule root and malformed XML (T3)', () => {
    expect(() => parseMatchingRules('Account', '<DuplicateRule />')).to.throw('Expected MatchingRules XML root');
    expect(() => parseMatchingRules('Account', '<MatchingRules><unterminated')).to.throw('Invalid MatchingRules XML');
  });

  it('rejects missing fullName, bad ruleStatus, duplicate rule names, and a mismatched object prefix (T4)', () => {
    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw('Matching rule fullName is required');

    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><fullName>Rule</fullName><ruleStatus>Pending</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw('Matching rule Rule has invalid ruleStatus: Pending');

    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules>' +
          '<matchingRules><fullName>Rule</fullName><ruleStatus>Active</ruleStatus></matchingRules>' +
          '<matchingRules><fullName>Rule</fullName><ruleStatus>Inactive</ruleStatus></matchingRules>' +
          '</MatchingRules>'
      )
    ).to.throw('Duplicate matching rule name: Rule');

    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><fullName>Contact.Rule</fullName><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw('Matching rule fullName Contact.Rule does not belong to object Account');
  });

  it('rejects an extra top-level sibling element alongside the MatchingRules root (F4)', () => {
    expect(() => parseMatchingRules('Account', '<X/><MatchingRules/>')).to.throw('Expected MatchingRules XML root');
  });

  it('rejects a text-only or numeric root instead of accepting it as an empty container (F4)', () => {
    expect(() => parseMatchingRules('Account', '<MatchingRules>hello</MatchingRules>')).to.throw(
      'Expected MatchingRules XML root'
    );
    expect(() => parseMatchingRules('Account', '<MatchingRules>123</MatchingRules>')).to.throw(
      'Expected MatchingRules XML root'
    );
  });

  it('still accepts an empty element or an element with only attributes as an empty container', () => {
    expect(parseMatchingRules('Account', '<MatchingRules/>')).to.deep.equal({ objectName: 'Account', rules: [] });
    expect(parseMatchingRules('Account', '<MatchingRules xmlns="a"></MatchingRules>')).to.deep.equal({
      objectName: 'Account',
      rules: [],
    });
  });

  it('rejects a rule name containing an identity separator character (F5)', () => {
    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><fullName>R#x</fullName><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw("Matching rule name \"R#x\" must not contain ':' or '#'");
    expect(() =>
      parseMatchingRules(
        'Account',
        '<MatchingRules><matchingRules><fullName>R:x</fullName><ruleStatus>Active</ruleStatus></matchingRules></MatchingRules>'
      )
    ).to.throw("Matching rule name \"R:x\" must not contain ':' or '#'");
  });
});
