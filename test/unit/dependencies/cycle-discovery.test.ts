import { expect } from 'chai';
import { describe, it } from 'mocha';
import { CycleDiscovery } from '../../../src/dependencies/cycle-discovery.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('CycleDiscovery', () => {
  it('discovers raw cycles without materializing suggestions', () => {
    const discovery = new CycleDiscovery(
      createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:A'],
      ]),
      100,
      new Set()
    );

    const cycles = discovery.discoverAcrossGraph(new Set());

    expect(cycles).to.have.lengthOf(1);
    expect(cycles[0].cycle).to.include.members(['ApexClass:A', 'ApexClass:B', 'ApexClass:C']);
    expect(cycles[0].cycle).to.include(cycles[0].closingNode);
  });

  it('respects ignored edges during raw cycle discovery', () => {
    const discovery = new CycleDiscovery(
      createGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:A'],
      ]),
      100,
      new Set(['ApexClass:B->ApexClass:A'])
    );

    expect(discovery.discoverFromNode('ApexClass:A')).to.deep.equal([]);
  });
});

function createGraph(edges: Array<[string, string]>): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const [from, to] of edges) {
    if (!graph.has(to)) {
      graph.set(to, new Set());
    }

    const dependencies = graph.get(from) ?? new Set();
    dependencies.add(to);
    graph.set(from, dependencies);
  }

  return graph;
}
