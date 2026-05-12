import type { NodeId, DependencyGraph } from '../types/dependency.js';

export type UnresolvedDependencyNode = {
  nodeId: NodeId;
  missingDependencies: NodeId[];
};

export type TopologicalSortResult = {
  deploymentOrder: NodeId[];
  unresolved: UnresolvedDependencyNode[];
};

type TopologicalTraversalState = {
  deploymentOrder: NodeId[];
  inDegree: Map<NodeId, number>;
  queue: NodeId[];
};

export function sortDependencyGraph(graph: DependencyGraph): TopologicalSortResult {
  const traversalState = createTopologicalTraversalState(graph);
  processTopologicalQueue(graph, traversalState);

  return {
    deploymentOrder: traversalState.deploymentOrder,
    unresolved: collectUnresolvedNodes(graph, traversalState.inDegree),
  };
}

function createTopologicalTraversalState(graph: DependencyGraph): TopologicalTraversalState {
  const inDegree = calculateInDegree(graph);

  return {
    deploymentOrder: [],
    inDegree,
    queue: collectZeroDegreeNodes(inDegree),
  };
}

function processTopologicalQueue(graph: DependencyGraph, state: TopologicalTraversalState): void {
  while (state.queue.length > 0) {
    const nodeId = state.queue.shift()!;
    state.deploymentOrder.push(nodeId);
    releaseResolvedDependencies(nodeId, graph, state);
  }
}

function releaseResolvedDependencies(
  nodeId: NodeId,
  graph: DependencyGraph,
  state: Pick<TopologicalTraversalState, 'inDegree' | 'queue'>
): void {
  const deps = graph.get(nodeId) ?? new Set();

  for (const dep of deps) {
    if (!state.inDegree.has(dep)) {
      continue;
    }

    const newDegree = (state.inDegree.get(dep) ?? 0) - 1;
    state.inDegree.set(dep, newDegree);

    if (newDegree === 0) {
      state.queue.push(dep);
    }
  }
}

function collectUnresolvedNodes(
  graph: DependencyGraph,
  inDegree: ReadonlyMap<NodeId, number>
): UnresolvedDependencyNode[] {
  const unresolved: UnresolvedDependencyNode[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree <= 0) {
      continue;
    }

    unresolved.push({
      nodeId,
      missingDependencies: findMissingDependencies(nodeId, graph),
    });
  }

  return unresolved;
}

function findMissingDependencies(nodeId: NodeId, graph: DependencyGraph): NodeId[] {
  const deps = graph.get(nodeId) ?? new Set();
  const missing: NodeId[] = [];

  for (const dep of deps) {
    if (!graph.has(dep)) {
      missing.push(dep);
    }
  }

  return missing;
}

function calculateInDegree(graph: DependencyGraph): Map<NodeId, number> {
  const inDegree = new Map<NodeId, number>();

  for (const nodeId of graph.keys()) {
    inDegree.set(nodeId, 0);
  }

  for (const dependencies of graph.values()) {
    for (const dependencyId of dependencies) {
      if (!inDegree.has(dependencyId)) {
        continue;
      }

      inDegree.set(dependencyId, (inDegree.get(dependencyId) ?? 0) + 1);
    }
  }

  return inDegree;
}

function collectZeroDegreeNodes(inDegree: ReadonlyMap<NodeId, number>): NodeId[] {
  const queue: NodeId[] = [];

  for (const [nodeId, degree] of inDegree.entries()) {
    if (degree === 0) {
      queue.push(nodeId);
    }
  }

  return queue;
}
