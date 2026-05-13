import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DependencyImpactTraversal } from '../../../src/dependencies/dependency-impact-traversal.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('DependencyImpactTraversal', () => {
  it('finds transitive dependents and impact radius without scoring', () => {
    const traversal = new DependencyImpactTraversal(
      createReverseGraph([
        ['ApexClass:A', 'ApexClass:B'],
        ['ApexClass:B', 'ApexClass:C'],
        ['ApexClass:C', 'ApexClass:D'],
      ]),
      { maxDepth: Number.POSITIVE_INFINITY, includeTests: true }
    );

    const result = traversal.analyzeDependents('ApexClass:D');

    expect([...result.affected]).to.include.members(['ApexClass:C', 'ApexClass:B', 'ApexClass:A']);
    expect(result.impactRadius).to.equal(3);
  });

  it('respects max depth and test exclusion during traversal', () => {
    const traversal = new DependencyImpactTraversal(
      createReverseGraph([
        ['ApexClass:Service', 'ApexClass:Domain'],
        ['ApexClass:ServiceTest', 'ApexClass:Service'],
        ['ApexClass:Controller', 'ApexClass:Service'],
      ]),
      { maxDepth: 1, includeTests: false }
    );

    const result = traversal.analyzeDependents('ApexClass:Domain');

    expect([...result.affected]).to.deep.equal(['ApexClass:Service']);
    expect(result.impactRadius).to.equal(1);
  });
});

function createReverseGraph(edges: Array<[string, string]>): DependencyGraph {
  const reverseGraph: DependencyGraph = new Map();

  for (const [from, to] of edges) {
    if (!reverseGraph.has(from)) {
      reverseGraph.set(from, new Set());
    }

    const dependents = reverseGraph.get(to) ?? new Set();
    dependents.add(from);
    reverseGraph.set(to, dependents);
  }

  return reverseGraph;
}
