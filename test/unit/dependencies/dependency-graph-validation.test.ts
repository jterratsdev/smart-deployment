import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  collectBuildAnnotations,
  collectValidationSummary,
} from '../../../src/dependencies/dependency-graph-validation.js';
import type { DependencyGraph, ReverseGraph } from '../../../src/types/dependency.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('dependency graph validation', () => {
  function component(name: string): MetadataComponent {
    return {
      name,
      type: 'ApexClass',
      filePath: `force-app/main/default/classes/${name}.cls`,
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };
  }

  it('collects self-loop and dangling reference validation facts', () => {
    const components = new Map<string, MetadataComponent>([['ApexClass:ServiceA', component('ServiceA')]]);
    const graph: DependencyGraph = new Map([
      ['ApexClass:ServiceA', new Set(['ApexClass:ServiceA', 'ApexClass:Missing'])],
    ]);

    const summary = collectValidationSummary(components, graph);

    expect(summary.selfLoopErrors).to.deep.equal(['Self-loop detected: ApexClass:ServiceA']);
    expect(summary.danglingReferences).to.deep.equal([{ from: 'ApexClass:ServiceA', to: 'ApexClass:Missing' }]);
  });

  it('collects circular and isolated build annotations', () => {
    const components = new Map<string, MetadataComponent>([
      ['ApexClass:ServiceA', component('ServiceA')],
      ['ApexClass:ServiceB', component('ServiceB')],
      ['ApexClass:Isolated', component('Isolated')],
    ]);
    const graph: DependencyGraph = new Map([
      ['ApexClass:ServiceA', new Set(['ApexClass:ServiceB'])],
      ['ApexClass:ServiceB', new Set(['ApexClass:ServiceA'])],
      ['ApexClass:Isolated', new Set()],
    ]);
    const reverseGraph: ReverseGraph = new Map([
      ['ApexClass:ServiceA', new Set(['ApexClass:ServiceB'])],
      ['ApexClass:ServiceB', new Set(['ApexClass:ServiceA'])],
      ['ApexClass:Isolated', new Set()],
    ]);

    const annotations = collectBuildAnnotations(components, graph, reverseGraph);

    expect(annotations.circularDependencies).to.have.lengthOf(1);
    expect(annotations.isolatedComponents).to.deep.equal(['ApexClass:Isolated']);
  });
});
