import type { NodeId, CircularDependency, DependencyGraph, ReverseGraph } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

export type DanglingDependencyReference = {
  from: NodeId;
  to: NodeId;
};

export type ValidationSummary = {
  selfLoopErrors: string[];
  danglingReferences: DanglingDependencyReference[];
};

export type BuildAnnotations = {
  circularDependencies: CircularDependency[];
  isolatedComponents: NodeId[];
};

export function collectValidationSummary(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph
): ValidationSummary {
  return {
    selfLoopErrors: collectSelfLoopErrors(graph),
    danglingReferences: collectDanglingReferences(components, graph),
  };
}

export function collectBuildAnnotations(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph,
  reverseGraph: ReverseGraph
): BuildAnnotations {
  return {
    circularDependencies: detectCircularDependencies(graph),
    isolatedComponents: findIsolatedComponents(components, graph, reverseGraph),
  };
}

function collectSelfLoopErrors(graph: DependencyGraph): string[] {
  const selfLoopErrors: string[] = [];

  for (const [nodeId, deps] of graph.entries()) {
    if (deps.has(nodeId)) {
      selfLoopErrors.push(`Self-loop detected: ${nodeId}`);
    }
  }

  return selfLoopErrors;
}

function collectDanglingReferences(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph
): DanglingDependencyReference[] {
  const danglingReferences: DanglingDependencyReference[] = [];

  for (const [nodeId, deps] of graph.entries()) {
    for (const depId of deps) {
      if (!components.has(depId) && !graph.has(depId)) {
        danglingReferences.push({ from: nodeId, to: depId });
      }
    }
  }

  return danglingReferences;
}

function detectCircularDependencies(graph: DependencyGraph): CircularDependency[] {
  const cycles: CircularDependency[] = [];
  const visited = new Set<NodeId>();
  const recursionStack = new Set<NodeId>();
  const currentPath: NodeId[] = [];

  const dfs = (nodeId: NodeId): void => {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    const deps = graph.get(nodeId) ?? new Set();
    for (const depId of deps) {
      if (!visited.has(depId)) {
        dfs(depId);
      } else if (recursionStack.has(depId)) {
        const cycleStart = currentPath.indexOf(depId);
        const cycle = currentPath.slice(cycleStart);
        cycles.push({
          cycle,
          severity: 'warning',
          message: `Circular dependency detected: ${cycle.join(' → ')} → ${depId}`,
        });
      }
    }

    recursionStack.delete(nodeId);
    currentPath.pop();
  };

  for (const nodeId of graph.keys()) {
    if (!visited.has(nodeId)) {
      dfs(nodeId);
    }
  }

  return cycles;
}

function findIsolatedComponents(
  components: ReadonlyMap<NodeId, MetadataComponent>,
  graph: DependencyGraph,
  reverseGraph: ReverseGraph
): NodeId[] {
  const isolated: NodeId[] = [];

  for (const nodeId of components.keys()) {
    const deps = graph.get(nodeId)?.size ?? 0;
    const dependents = reverseGraph.get(nodeId)?.size ?? 0;

    if (deps === 0 && dependents === 0) {
      isolated.push(nodeId);
    }
  }

  return isolated;
}
