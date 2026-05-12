import type { NodeId, DependencyGraph } from '../types/dependency.js';

export type WavePlacementPolicy = {
  maxComponentsPerWave: number;
  respectTypeOrder: boolean;
  handleCircularDeps: boolean;
};

export type WaveTopologyStage = {
  orderedCandidates: NodeId[];
  chunks: NodeId[][];
};

export type CircularWaveResolutionInput = {
  graph: DependencyGraph;
  processed: ReadonlySet<NodeId>;
};

export function calculateInDegree(graph: DependencyGraph): Map<NodeId, number> {
  const inDegree = new Map<NodeId, number>();

  for (const [nodeId, deps] of graph.entries()) {
    inDegree.set(nodeId, deps.size);
  }

  return inDegree;
}

export function planTopologyStage({
  inDegree,
  processed,
  policy,
  comparePriority,
}: {
  inDegree: ReadonlyMap<NodeId, number>;
  processed: ReadonlySet<NodeId>;
  policy: WavePlacementPolicy;
  comparePriority: (left: NodeId, right: NodeId) => number;
}): WaveTopologyStage {
  const orderedCandidates = collectWaveCandidates(inDegree, processed);

  if (policy.respectTypeOrder) {
    orderedCandidates.sort(comparePriority);
  }

  return {
    orderedCandidates,
    chunks: createWaveChunks(orderedCandidates, policy.maxComponentsPerWave),
  };
}

export function collectRemainingNodes(graph: DependencyGraph, processed: ReadonlySet<NodeId>): NodeId[] {
  const remaining: NodeId[] = [];

  for (const nodeId of graph.keys()) {
    if (!processed.has(nodeId)) {
      remaining.push(nodeId);
    }
  }

  return remaining;
}

export function updateInDegreeForPlacedCandidates({
  graph,
  inDegree,
  processed,
  placedCandidates,
}: {
  graph: DependencyGraph;
  inDegree: Map<NodeId, number>;
  processed: ReadonlySet<NodeId>;
  placedCandidates: readonly NodeId[];
}): void {
  for (const [nodeId, deps] of graph.entries()) {
    if (processed.has(nodeId)) {
      continue;
    }

    let removedDeps = 0;
    for (const dep of deps) {
      if (placedCandidates.includes(dep)) {
        removedDeps += 1;
      }
    }

    if (removedDeps > 0) {
      inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) - removedDeps);
    }
  }
}

function collectWaveCandidates(inDegree: ReadonlyMap<NodeId, number>, processed: ReadonlySet<NodeId>): NodeId[] {
  const candidates: NodeId[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0 && !processed.has(nodeId)) {
      candidates.push(nodeId);
    }
  }

  return candidates;
}

function createWaveChunks(candidates: NodeId[], maxComponentsPerWave: number): NodeId[][] {
  if (maxComponentsPerWave > 0 && candidates.length > maxComponentsPerWave) {
    return chunkArray(candidates, maxComponentsPerWave);
  }

  return [candidates];
}

function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}
