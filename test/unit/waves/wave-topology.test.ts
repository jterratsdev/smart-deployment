import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  calculateInDegree,
  collectRemainingNodes,
  planTopologyStage,
  updateInDegreeForPlacedCandidates,
} from '../../../src/waves/wave-topology.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';

describe('wave topology policy', () => {
  it('plans candidates and chunks without changing placement semantics', () => {
    const graph: DependencyGraph = new Map([
      ['ApexClass:A', new Set(['ApexClass:B'])],
      ['ApexClass:B', new Set()],
      ['ApexClass:C', new Set()],
    ]);
    const inDegree = calculateInDegree(graph);

    const stage = planTopologyStage({
      inDegree,
      processed: new Set(),
      policy: {
        maxComponentsPerWave: 1,
        respectTypeOrder: true,
        handleCircularDeps: true,
      },
      comparePriority: (left, right) => left.localeCompare(right),
    });

    expect(stage.orderedCandidates).to.deep.equal(['ApexClass:B', 'ApexClass:C']);
    expect(stage.chunks).to.deep.equal([['ApexClass:B'], ['ApexClass:C']]);
  });

  it('updates in-degree after placed candidates and reports remaining nodes', () => {
    const graph: DependencyGraph = new Map([
      ['ApexClass:A', new Set(['ApexClass:B'])],
      ['ApexClass:B', new Set()],
    ]);
    const inDegree = calculateInDegree(graph);
    const processed = new Set(['ApexClass:B']);

    updateInDegreeForPlacedCandidates({
      graph,
      inDegree,
      processed,
      placedCandidates: ['ApexClass:B'],
    });

    expect(inDegree.get('ApexClass:A')).to.equal(0);
    expect(collectRemainingNodes(graph, processed)).to.deep.equal(['ApexClass:A']);
  });
});
