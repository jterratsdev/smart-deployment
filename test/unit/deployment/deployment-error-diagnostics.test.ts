import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  formatDeploymentDiagnostics,
  normalizeDeploymentDiagnostics,
} from '../../../src/deployment/deployment-error-diagnostics.js';

describe('deployment-error-diagnostics', () => {
  it('normalizes missing field deploy errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure(
        'CustomField',
        'Account.Missing__c',
        'In field: field - no CustomField named Account.Missing__c found'
      )
    );

    expect(diagnostics[0]).to.deep.include({
      component: 'CustomField:Account.Missing__c',
      category: 'missing-field',
      problem: 'In field: field - no CustomField named Account.Missing__c found',
    });
    expect(diagnostics[0].remediation).to.include('Deploy the missing CustomField');
  });

  it('normalizes missing object deploy errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure('ApexClass', 'AccountService', "sObject type 'Invoice__c' is not supported")
    );

    expect(diagnostics[0].category).to.equal('missing-object');
    expect(diagnostics[0].probableCause).to.include('referenced object');
  });

  it('normalizes duplicate metadata deploy errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure('CustomObject', 'Account', 'duplicate value found: <unknown> duplicates value on record with id')
    );

    expect(diagnostics[0].category).to.equal('duplicate-metadata');
    expect(diagnostics[0].remediation).to.include('Remove duplicate package entries');
  });

  it('normalizes permission deploy errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure('PermissionSet', 'Sales_Access', 'insufficient access rights on cross-reference id')
    );

    expect(diagnostics[0].category).to.equal('permission');
    expect(diagnostics[0].remediation).to.include('Grant the deployment user');
  });

  it('normalizes invalid reference deploy errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure('Flow', 'Case_Routing', 'invalid reference to QuickAction Case.Send_Email')
    );

    expect(diagnostics[0].category).to.equal('invalid-reference');
    expect(diagnostics[0].probableCause).to.include('references a component');
  });

  it('normalizes source tracking conflict errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics('Source tracking conflict detected for force-app/main/default');

    expect(diagnostics[0].category).to.equal('source-tracking-conflict');
    expect(diagnostics[0].remediation).to.include('reconcile conflicts');
  });

  it('keeps raw details and generic remediation for unknown errors', () => {
    const diagnostics = normalizeDeploymentDiagnostics(deployFailure('ApexClass', 'Mystery', 'Something unexpected'));

    expect(diagnostics[0]).to.deep.include({
      component: 'ApexClass:Mystery',
      category: 'unknown',
      problem: 'Something unexpected',
    });
    expect(diagnostics[0].rawDetails).to.include('Something unexpected');
    expect(diagnostics[0].remediation).to.include('Review the raw Salesforce deploy output');
  });

  it('formats diagnostics for failed wave output', () => {
    const diagnostics = normalizeDeploymentDiagnostics(
      deployFailure('ApexClass', 'AccountService', 'No such column Missing__c on entity Account')
    );

    const formatted = formatDeploymentDiagnostics(diagnostics);

    expect(formatted).to.include('Diagnostic 1: ApexClass:AccountService');
    expect(formatted).to.include('Probable cause:');
    expect(formatted).to.include('Remediation:');
  });
});

function deployFailure(componentType: string, fullName: string, problem: string): string {
  return JSON.stringify({
    result: {
      status: 'Failed',
      details: {
        componentFailures: {
          componentType,
          fullName,
          problem,
          problemType: 'Error',
        },
      },
    },
  });
}
