import { expect } from 'chai';
import {
  DEPLOYMENT_ORDER,
  getDeploymentPriority,
  getDeploymentStage,
} from '../../../src/constants/deployment-order.js';

describe('DEPLOYMENT_ORDER', () => {
  /**
   * @ac US-005-AC-1: CustomObject has low priority (early deployment)
   */
  it('should assign low priority to CustomObject (early deployment)', () => {
    expect(DEPLOYMENT_ORDER.CustomObject).to.be.lessThan(10);
    expect(DEPLOYMENT_ORDER.CustomObject).to.equal(6);
  });

  /**
   * @ac US-005-AC-2: CustomField comes after CustomObject
   */
  it('should assign priority after CustomObject to CustomField', () => {
    expect(DEPLOYMENT_ORDER.CustomField).to.be.greaterThan(DEPLOYMENT_ORDER.CustomObject);
    expect(DEPLOYMENT_ORDER.CustomField).to.equal(11);
  });

  /**
   * @ac US-005-AC-3: ApexClass deployed in code tier
   */
  it('should assign code-tier priority to ApexClass', () => {
    expect(DEPLOYMENT_ORDER.ApexClass).to.be.greaterThan(DEPLOYMENT_ORDER.CustomField);
    expect(DEPLOYMENT_ORDER.ApexClass).to.equal(31);
  });

  /**
   * @ac US-005-AC-4: ApexTrigger comes after ApexClass
   */
  it('should assign priority after ApexClass to ApexTrigger', () => {
    expect(DEPLOYMENT_ORDER.ApexTrigger).to.be.greaterThan(DEPLOYMENT_ORDER.ApexClass);
    expect(DEPLOYMENT_ORDER.ApexTrigger).to.equal(36);
  });

  /**
   * @ac US-005-AC-5: Flow deployed after code
   */
  it('should assign priority after Apex to Flow', () => {
    expect(DEPLOYMENT_ORDER.Flow).to.be.greaterThan(DEPLOYMENT_ORDER.ApexTrigger);
    expect(DEPLOYMENT_ORDER.Flow).to.equal(48);
  });

  /**
   * @ac US-005-AC-6: Core metadata types have order defined (50+, extensible)
   */
  it('should have core metadata types defined with deployment order', () => {
    const metadataTypes = Object.keys(DEPLOYMENT_ORDER);

    // Verify we have at least 50 core types
    // NOTE: Salesforce has 100+ types total, we prioritize the most common ones
    expect(metadataTypes.length).to.be.at.least(50);

    // Verify critical types are included
    expect(metadataTypes).to.include.members([
      'CustomObject',
      'CustomField',
      'ApexClass',
      'Flow',
      'Profile',
      'PermissionSet',
    ]);
  });

  /**
   * @ac US-005-AC-7: Order follows Salesforce best practices
   * @ac US-005-AC-8: Constants are immutable (as const)
   */
  it('should follow Salesforce deployment best practices', () => {
    // Basic structure types must come first
    expect(DEPLOYMENT_ORDER.CustomObject).to.be.lessThan(DEPLOYMENT_ORDER.ApexClass);
    expect(DEPLOYMENT_ORDER.CustomField).to.be.lessThan(DEPLOYMENT_ORDER.ApexClass);

    // Triggers after classes
    expect(DEPLOYMENT_ORDER.ApexClass).to.be.lessThan(DEPLOYMENT_ORDER.ApexTrigger);

    // Profiles/PermissionSets should be after objects and classes
    expect(DEPLOYMENT_ORDER.Profile).to.be.greaterThan(DEPLOYMENT_ORDER.CustomObject);
    expect(DEPLOYMENT_ORDER.PermissionSet).to.be.greaterThan(DEPLOYMENT_ORDER.ApexClass);
    expect(DEPLOYMENT_ORDER.AiEvaluationDefinition).to.be.greaterThan(DEPLOYMENT_ORDER.BotVersion);
    expect(DEPLOYMENT_ORDER.AiEvaluationDefinition).to.be.greaterThan(DEPLOYMENT_ORDER.AiAuthoringBundle);

    // Object should be immutable
    expect(Object.isFrozen(DEPLOYMENT_ORDER)).to.be.true;
  });
});

describe('getDeploymentPriority', () => {
  it('should return priority for known metadata type', () => {
    expect(getDeploymentPriority('CustomObject')).to.equal(6);
    expect(getDeploymentPriority('ApexClass')).to.equal(31);
  });

  it('should reject an unknown metadata type', () => {
    expect(() => getDeploymentPriority('UnknownType')).to.throw(
      'Metadata type "UnknownType" has no deployment-order contract'
    );
  });

  it('should handle case-sensitive metadata types', () => {
    expect(() => getDeploymentPriority('customobject')).to.throw();
    expect(getDeploymentPriority('CustomObject')).to.equal(6);
  });

  it('should map priorities to executable deployment stages', () => {
    expect(getDeploymentStage('RetailExecutionSettings')).to.equal(0);
    expect(getDeploymentStage('CustomObject')).to.equal(1);
    expect(getDeploymentStage('ApexClass')).to.equal(3);
    expect(getDeploymentStage('Flow')).to.equal(5);
    expect(getDeploymentStage('PermissionSet')).to.equal(9);
  });
});
