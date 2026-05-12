import type { NodeId, DependencyGraph, DependencyStats, ReverseGraph } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

type GraphCounts = {
  dependencyCounts: Map<NodeId, number>;
  dependentCounts: Map<NodeId, number>;
};

type GraphMetrics = {
  totalComponents: number;
  totalDependencies: number;
  maxDepth: number;
  componentsByType: Record<string, number>;
  counts: GraphCounts;
};

export function generateDependencyGraphStats(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph,
  reverseGraph: ReverseGraph
): DependencyStats {
  const metrics = collectGraphMetrics(components, graph, reverseGraph);

  return {
    totalComponents: metrics.totalComponents,
    totalDependencies: metrics.totalDependencies,
    componentsByType: metrics.componentsByType,
    maxDepth: metrics.maxDepth,
    mostDepended: findMaxCountEntry(metrics.counts.dependentCounts),
    mostDependencies: findMaxCountEntry(metrics.counts.dependencyCounts),
  };
}

export function countGraphEdges(graph: DependencyGraph): number {
  let count = 0;

  for (const deps of graph.values()) {
    count += deps.size;
  }

  return count;
}

function collectGraphMetrics(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph,
  reverseGraph: ReverseGraph
): GraphMetrics {
  return {
    totalComponents: components.size,
    totalDependencies: countGraphEdges(graph),
    maxDepth: calculateMaxDepth(components, graph),
    componentsByType: collectComponentsByType(components),
    counts: collectGraphCounts(graph, reverseGraph),
  };
}

function collectComponentsByType(components: ReadonlyMap<NodeId, MetadataComponent>): Record<string, number> {
  const componentsByType: Record<string, number> = {};

  for (const component of components.values()) {
    componentsByType[component.type] = (componentsByType[component.type] ?? 0) + 1;
  }

  return componentsByType;
}

function calculateMaxDepth(components: ReadonlyMap<NodeId, MetadataComponent>, graph: DependencyGraph): number {
  let maxDepth = 0;

  for (const startNode of components.keys()) {
    const depth = bfsDepth(startNode, graph);
    maxDepth = Math.max(maxDepth, depth);
  }

  return maxDepth;
}

function bfsDepth(startNode: NodeId, graph: DependencyGraph): number {
  const visited = new Set<NodeId>();
  const queue: Array<{ node: NodeId; depth: number }> = [{ node: startNode, depth: 0 }];
  let maxDepth = 0;

  while (queue.length > 0) {
    const { node, depth } = queue.shift()!;

    if (visited.has(node)) continue;
    visited.add(node);

    maxDepth = Math.max(maxDepth, depth);

    const deps = graph.get(node) ?? new Set();
    for (const depId of deps) {
      if (!visited.has(depId)) {
        queue.push({ node: depId, depth: depth + 1 });
      }
    }
  }

  return maxDepth;
}

function collectGraphCounts(graph: DependencyGraph, reverseGraph: ReverseGraph): GraphCounts {
  const dependencyCounts = new Map<NodeId, number>();
  const dependentCounts = new Map<NodeId, number>();

  for (const [nodeId, deps] of graph.entries()) {
    dependencyCounts.set(nodeId, deps.size);
  }

  for (const [nodeId, dependents] of reverseGraph.entries()) {
    dependentCounts.set(nodeId, dependents.size);
  }

  return { dependencyCounts, dependentCounts };
}

function findMaxCountEntry(counts: ReadonlyMap<NodeId, number>): { nodeId: NodeId; count: number } {
  let maxEntry: { nodeId: NodeId; count: number } = { nodeId: '', count: 0 };

  for (const [nodeId, count] of counts.entries()) {
    if (count > maxEntry.count) {
      maxEntry = { nodeId, count };
    }
  }

  return maxEntry;
}
