import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyResolutionClassifier } from '../../../src/dependencies/dependency-resolution-classifier.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

describe('DependencyResolutionClassifier', () => {
  function component(nodeId: string): MetadataComponent {
    const [type, name] = nodeId.split(':') as [MetadataType, string];

    return {
      type,
      name,
      filePath: `/path/to/${nodeId}`,
      dependencies: new Set<string>(),
      optionalDependencies: new Set<string>(),
      dependents: new Set<string>(),
      priorityBoost: 0,
    };
  }

  it('excludes managed package nodes when skipManaged is enabled', () => {
    const components = new Map<string, MetadataComponent>([
      ['ApexClass:Local', component('ApexClass:Local')],
      ['ApexClass:ns__Managed', component('ApexClass:ns__Managed')],
    ]);
    const classifier = new DependencyResolutionClassifier(components, {
      includeOptional: false,
      skipManaged: true,
    });

    expect(classifier.shouldIncludeNode('ApexClass:Local')).to.equal(true);
    expect(classifier.shouldIncludeNode('ApexClass:ns__Managed')).to.equal(false);
    expect(classifier.findManagedPackages()).to.deep.equal(['ApexClass:ns__Managed']);
  });

  it('filters optional dependencies unless includeOptional is enabled', () => {
    const source = component('ApexClass:Source');
    source.dependencies.add('ApexClass:Optional');
    source.optionalDependencies?.add('ApexClass:Optional');

    const components = new Map<string, MetadataComponent>([
      ['ApexClass:Source', source],
      ['ApexClass:Optional', component('ApexClass:Optional')],
    ]);
    const graph: DependencyGraph = new Map([['ApexClass:Source', new Set(['ApexClass:Optional'])]]);
    const classifier = new DependencyResolutionClassifier(components, {
      includeOptional: false,
      skipManaged: true,
    });

    expect(classifier.classifyDependency('ApexClass:Source', 'ApexClass:Optional')).to.equal('exclude-optional');
    expect(
      classifier.collectIncludedDependencies('ApexClass:Source', graph.get('ApexClass:Source') ?? new Set())
    ).to.deep.equal(new Set());
    expect(classifier.findOptionalDependencies(graph)).to.deep.equal(['ApexClass:Optional']);
  });

  it('includes optional dependencies when configured', () => {
    const source = component('ApexClass:Source');
    source.optionalDependencies?.add('ApexClass:Optional');
    const components = new Map<string, MetadataComponent>([
      ['ApexClass:Source', source],
      ['ApexClass:Optional', component('ApexClass:Optional')],
    ]);
    const classifier = new DependencyResolutionClassifier(components, {
      includeOptional: true,
      skipManaged: true,
    });

    expect(classifier.classifyDependency('ApexClass:Source', 'ApexClass:Optional')).to.equal('include');
  });
});
