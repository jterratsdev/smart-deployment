import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  collectUnresolvedDynamicQueryFields,
  DynamicQueryTargetValidator,
  type DynamicQueryTargetLookup,
} from '../../../src/deployment/dynamic-query-target-validator.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

describe('DynamicQueryTargetValidator', () => {
  function dependencyResult(): DependencyAnalysisResult {
    return {
      components: new Map([
        [
          'ApexClass:AccountQueryService',
          {
            name: 'AccountQueryService',
            type: 'ApexClass',
            filePath: 'classes/AccountQueryService.cls',
            dependencies: new Set(),
            dependents: new Set(),
            priorityBoost: 0,
          },
        ],
      ]),
      graph: new Map([['ApexClass:AccountQueryService', new Set(['CustomField:Account.External_Id__c'])]]),
      reverseGraph: new Map([['CustomField:Account.External_Id__c', new Set(['ApexClass:AccountQueryService'])]]),
      edges: [
        {
          from: 'ApexClass:AccountQueryService',
          to: 'CustomField:Account.External_Id__c',
          type: 'hard',
          source: 'parser',
          reason: 'Dynamic SOQL apex-string reference',
          confidence: 1,
        },
      ],
      circularDependencies: [],
      isolatedComponents: [],
      stats: {
        totalComponents: 1,
        totalDependencies: 1,
        componentsByType: {
          ApexClass: 1,
        },
        maxDepth: 1,
        mostDepended: {
          nodeId: 'CustomField:Account.External_Id__c',
          count: 1,
        },
        mostDependencies: {
          nodeId: 'ApexClass:AccountQueryService',
          count: 1,
        },
      },
    };
  }

  it('collects dynamic query field edges absent from local components', () => {
    const unresolvedFields = collectUnresolvedDynamicQueryFields(dependencyResult());

    expect(unresolvedFields).to.deep.equal([
      {
        consumerNodeId: 'ApexClass:AccountQueryService',
        fieldNodeId: 'CustomField:Account.External_Id__c',
        objectName: 'Account',
        fieldName: 'External_Id__c',
        reason: 'Dynamic SOQL apex-string reference',
        confidence: 1,
      },
    ]);
  });

  it('does not collect dynamic query fields already present locally', () => {
    const result = dependencyResult();
    result.components.set('CustomField:Account.External_Id__c', {
      name: 'Account.External_Id__c',
      type: 'CustomField',
      filePath: 'objects/Account/fields/External_Id__c.field-meta.xml',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    });

    expect(collectUnresolvedDynamicQueryFields(result)).to.deep.equal([]);
  });

  it('checks unresolved dynamic query fields against the target org', async () => {
    const lookup: DynamicQueryTargetLookup = {
      hasCustomField: async () => false,
    };
    const validator = new DynamicQueryTargetValidator(lookup);

    const result = await validator.validate(dependencyResult(), 'dev-org');

    expect(result.checked).to.equal(true);
    expect(result.missingFields.map((field) => field.fieldNodeId)).to.deep.equal([
      'CustomField:Account.External_Id__c',
    ]);
  });

  it('skips target checks when no target org is available', async () => {
    const lookup: DynamicQueryTargetLookup = {
      hasCustomField: async () => {
        throw new Error('should not be called');
      },
    };
    const validator = new DynamicQueryTargetValidator(lookup);

    const result = await validator.validate(dependencyResult());

    expect(result.checked).to.equal(false);
    expect(result.missingFields).to.deep.equal([]);
    expect(result.unresolvedFields).to.have.lengthOf(1);
  });
});
