import { expect } from 'chai';
import { describe, it } from 'mocha';
import { assessFieldMigration, type FieldSnapshot } from '../../../src/analysis/field-migration-assessment.js';

const source: FieldSnapshot = { objectName: 'Account', fieldName: 'Plant__c', type: 'Picklist', valueSetName: 'Old' };

describe('assessFieldMigration', () => {
  it('never authorizes deletion when the org observation or consumer inventory is missing', () => {
    const result = assessFieldMigration({ source, consumers: [], isConsumerInventoryComplete: false });
    expect(result).to.include({ transition: 'unverified', status: 'blocked' });
    expect(result.blockers).to.have.length(2);
  });

  it('reports the exact type and value-set transition with sorted, unmodified consumers', () => {
    const consumers = [
      { type: 'Flow' as const, name: 'UpdatePlant', reference: 'assignment[0].value' },
      { type: 'ApexClass' as const, name: 'PlantService', reference: 'method:update' },
    ];
    const result = assessFieldMigration({
      source: { ...source, type: 'Text', valueSetName: undefined },
      target: { ...source },
      consumers,
      isConsumerInventoryComplete: true,
    });
    expect(result).to.include({ field: 'Account.Plant__c', transition: 'multiple', status: 'blocked' });
    expect(result.consumers.map((consumer) => consumer.name)).to.deep.equal(['PlantService', 'UpdatePlant']);
    expect(consumers[0].name).to.equal('UpdatePlant');
    expect(result.phases).to.have.length(4);
  });

  it('requires manual review even with no known consumers for a type change', () => {
    const result = assessFieldMigration({
      source,
      target: { ...source, type: 'Text' },
      consumers: [],
      isConsumerInventoryComplete: true,
    });
    expect(result).to.include({ transition: 'type', status: 'manual-review-required' });
  });

  it('recognizes a formula transition without assuming the underlying field type changes', () => {
    const result = assessFieldMigration({
      source: { ...source, type: 'Text', valueSetName: undefined },
      target: { ...source, type: 'Text', valueSetName: undefined, formula: 'Other__c' },
      consumers: [],
      isConsumerInventoryComplete: true,
    });
    expect(result).to.include({ transition: 'formula', status: 'manual-review-required' });
  });

  it('does not invent a migration for matching metadata', () => {
    const result = assessFieldMigration({
      source,
      target: { ...source },
      consumers: [],
      isConsumerInventoryComplete: true,
    });
    expect(result).to.include({ transition: 'none', status: 'no-migration' });
    expect(result.phases).to.deep.equal([]);
  });

  it('rejects mismatched field identities instead of comparing unrelated fields', () => {
    expect(() =>
      assessFieldMigration({
        source,
        target: { ...source, fieldName: 'Other__c' },
        consumers: [],
        isConsumerInventoryComplete: true,
      })
    ).to.throw('Source and target field identities must match');
  });
});
