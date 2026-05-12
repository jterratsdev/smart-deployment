import { expect } from 'chai';
import { describe, it } from 'mocha';
import { sortDependencyGraph } from '../../../src/dependencies/topological-dependency-sorter.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('sortDependencyGraph', () => {
  it('preserves resolver ordering semantics for acyclic graphs', () => {
    const graph: DependencyGraph = new Map([
      ['ApexClass:A', new Set(['ApexClass:B'])],
      ['ApexClass:B', new Set(['ApexClass:C'])],
      ['ApexClass:C', new Set()],
    ]);

    const result = sortDependencyGraph(graph);

    expect(result.deploymentOrder).to.deep.equal(['ApexClass:A', 'ApexClass:B', 'ApexClass:C']);
    expect(result.unresolved).to.deep.equal([]);
  });

  it('reports nodes left blocked by circular dependency state', () => {
    const graph: DependencyGraph = new Map([
      ['ApexClass:A', new Set(['ApexClass:B'])],
      ['ApexClass:B', new Set(['ApexClass:A'])],
    ]);

    const result = sortDependencyGraph(graph);

    expect(result.deploymentOrder).to.deep.equal([]);
    expect(result.unresolved.map((entry) => entry.nodeId)).to.have.members(['ApexClass:A', 'ApexClass:B']);
  });

  it('ignores dependencies that are not present as graph nodes', () => {
    const graph: DependencyGraph = new Map([['ApexClass:A', new Set(['ApexClass:Missing'])]]);

    const result = sortDependencyGraph(graph);

    expect(result.deploymentOrder).to.deep.equal(['ApexClass:A']);
    expect(result.unresolved).to.deep.equal([]);
  });
});
