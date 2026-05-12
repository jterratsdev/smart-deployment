import { expect } from 'chai';
import { describe, it } from 'mocha';
import { countGraphEdges, generateDependencyGraphStats } from '../../../src/dependencies/dependency-graph-stats.js';
import type { DependencyGraph, ReverseGraph } from '../../../src/types/dependency.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('dependency graph stats', () => {
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

  it('counts graph edges and derives dependency stats', () => {
    const components = new Map<string, MetadataComponent>([
      ['ApexClass:ServiceA', component('ServiceA')],
      ['ApexClass:Logger', component('Logger')],
    ]);
    const graph: DependencyGraph = new Map([
      ['ApexClass:ServiceA', new Set(['ApexClass:Logger'])],
      ['ApexClass:Logger', new Set()],
    ]);
    const reverseGraph: ReverseGraph = new Map([
      ['ApexClass:ServiceA', new Set()],
      ['ApexClass:Logger', new Set(['ApexClass:ServiceA'])],
    ]);

    const stats = generateDependencyGraphStats(components, graph, reverseGraph);

    expect(countGraphEdges(graph)).to.equal(1);
    expect(stats.totalComponents).to.equal(2);
    expect(stats.totalDependencies).to.equal(1);
    expect(stats.mostDepended).to.deep.equal({ nodeId: 'ApexClass:Logger', count: 1 });
    expect(stats.mostDependencies).to.deep.equal({ nodeId: 'ApexClass:ServiceA', count: 1 });
  });
});
