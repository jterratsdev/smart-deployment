import { expect } from 'chai';
import { describe, it } from 'mocha';
import { createComponentIntake } from '../../../src/dependencies/dependency-graph-intake.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('createComponentIntake', () => {
  function component(): MetadataComponent {
    return {
      name: 'AccountService',
      type: 'ApexClass',
      filePath: 'force-app/main/default/classes/AccountService.cls',
      dependencies: new Set(['ApexClass:Logger', 'ApexClass:OptionalHelper']),
      optionalDependencies: new Set(['ApexClass:OptionalHelper']),
      dependents: new Set(),
      priorityBoost: 0,
    };
  }

  it('normalizes component identity and legacy dependencies into typed details', () => {
    const intake = createComponentIntake(component());
    const loggerDependency = intake.dependencyDetails.find((dependency) => dependency.nodeId === 'ApexClass:Logger');
    const optionalDependency = intake.dependencyDetails.find(
      (dependency) => dependency.nodeId === 'ApexClass:OptionalHelper'
    );

    expect(intake.nodeId).to.equal('ApexClass:AccountService');
    expect(loggerDependency).to.include({
      kind: 'hard',
      source: 'parser',
      reason: 'Declared dependency',
    });
    expect(optionalDependency).to.include({
      kind: 'soft',
      source: 'parser',
      reason: 'Declared optional dependency',
    });
  });
});
