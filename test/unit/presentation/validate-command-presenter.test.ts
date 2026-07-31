import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ValidateCommandPresenter } from '../../../src/presentation/validate-command-presenter.js';
import type { DeploymentValidationSummary } from '../../../src/deployment/deployment-validation-service.js';

function createSummary(overrides: Partial<DeploymentValidationSummary> = {}): DeploymentValidationSummary {
  return {
    projectRoot: '/tmp/sfdx-project',
    componentIds: ['ApexClass:Base', 'ApexClass:Service'],
    valid: true,
    components: 2,
    dependencies: 3,
    dependencyBreakdown: {
      hard: 1,
      soft: 1,
      inferred: 1,
    },
    totalWaves: 2,
    estimatedTime: 15,
    xmlFilesValidated: 4,
    issues: [],
    ...overrides,
  };
}

describe('ValidateCommandPresenter', () => {
  it('formats a readable validation summary', () => {
    const presenter = new ValidateCommandPresenter();

    const formatted = presenter.formatSummary(createSummary());

    expect(formatted).to.include('Validation: PASSED');
    expect(formatted).to.include('Components: 2');
    expect(formatted).to.include('Dependencies: 3');
    expect(formatted).to.include('Hard / Soft / Inferred: 1 / 1 / 1');
    expect(formatted).to.include('Waves: 2');
    expect(formatted).to.include('XML Files Validated: 4');
  });

  it('explains commit scope inclusion, exclusions, and retained dependencies', () => {
    const presenter = new ValidateCommandPresenter();

    const formatted = presenter.formatSummary(
      createSummary({
        commitScope: {
          enabled: true,
          commits: ['abc123'],
          manifestPath: 'manifests/story-scope.generated.json',
          changedFiles: [{ commit: 'abc123', status: 'changed', path: 'force-app/main/default/classes/Service.cls' }],
          changedComponents: ['ApexClass:Service'],
          dependencyComponents: ['ApexClass:Base'],
          explicitComponents: ['CustomObject:Feature__c'],
          includedComponents: ['ApexClass:Base', 'ApexClass:Service', 'CustomObject:Feature__c'],
          ignoredComponents: ['ApexClass:FutureWork'],
        },
      })
    );

    expect(formatted).to.include('Commit Scope:');
    expect(formatted).to.include('- Changed metadata: 1');
    expect(formatted).to.include('- Dependency-retained metadata: 1');
    expect(formatted).to.include('- Explicit metadata: 1');
    expect(formatted).to.include('- Included metadata: 3');
    expect(formatted).to.include('- Ignored trunk metadata: 1');
    expect(formatted).to.include('- Scope manifest: manifests/story-scope.generated.json');
  });

  it('reports summary and success message for valid projects', () => {
    const presenter = new ValidateCommandPresenter();
    const logs: string[] = [];
    const warnings: string[] = [];

    presenter.reportValidationResult(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      createSummary()
    );

    expect(logs[0]).to.include('Validation: PASSED');
    expect(logs[1]).to.equal('Validation completed successfully. No deployment was executed.');
    expect(warnings).to.deep.equal([]);
  });

  it('reports issues and warning message for invalid projects', () => {
    const presenter = new ValidateCommandPresenter();
    const logs: string[] = [];
    const warnings: string[] = [];

    presenter.reportValidationResult(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      createSummary({
        valid: false,
        issues: [
          {
            severity: 'error',
            message: 'Broken metadata',
            filePath: 'force-app/main/default/classes/Broken.cls-meta.xml',
          },
        ],
      })
    );

    expect(logs[0]).to.include('Validation: FAILED');
    expect(logs[0]).to.include('Broken metadata');
    expect(warnings).to.deep.equal(['Validation found 1 issue(s). No deployment was executed.']);
  });
});
