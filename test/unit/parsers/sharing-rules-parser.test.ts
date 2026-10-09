import { expect } from 'chai';
import { describe, it } from 'mocha';
import { parseSharingRules } from '../../../src/parsers/sharing-rules-parser.js';

describe('parseSharingRules', () => {
  it('extracts custom criteria fields and structured principals without inventing metadata types', () => {
    const parsed = parseSharingRules(
      'Case',
      '<SharingRules><sharingCriteriaRules><fullName>Escalated</fullName><criteriaItems><field>Priority__c</field></criteriaItems><sharedTo><roleAndSubordinates>Support</roleAndSubordinates></sharedTo></sharingCriteriaRules><sharingOwnerRules><fullName>Owners</fullName><sharedTo><group>Case Reviewers</group></sharedTo></sharingOwnerRules></SharingRules>'
    );

    expect(parsed.criteriaFields).to.deep.equal(['Priority__c']);
    expect(parsed.principals).to.deep.equal([
      { type: 'Group', name: 'Case Reviewers' },
      { type: 'RoleAndSubordinates', name: 'Support' },
    ]);
  });

  it('extracts territory principals as structured facts', () => {
    const parsed = parseSharingRules(
      'Case',
      '<SharingRules><sharingTerritoryRules><sharedTo><territory>West</territory><territoryAndSubordinates>East</territoryAndSubordinates></sharedTo></sharingTerritoryRules></SharingRules>'
    );
    expect(parsed.principals).to.deep.equal([
      { type: 'Territory2', name: 'West' },
      { type: 'Territory2AndSubordinates', name: 'East' },
    ]);
  });
});
