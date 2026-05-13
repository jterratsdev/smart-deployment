import { getLogger } from '../utils/logger.js';
import type { DependencyGraph, NodeId } from '../types/dependency.js';
import { DEFAULT_GRAPH_DEPENDENCY_KIND, shouldTraverseDependencyKind } from './dependency-semantics.js';

const logger = getLogger('CycleDiscovery');

export type RawCycle = {
  cycle: NodeId[];
  closingNode: NodeId;
};

export class CycleDiscovery {
  public constructor(
    private readonly graph: DependencyGraph,
    private readonly maxDepth: number,
    private readonly ignoredEdges: ReadonlySet<string>
  ) {}

  public discoverAcrossGraph(visited: Set<NodeId>): RawCycle[] {
    const rawCycles: RawCycle[] = [];
    const recursionStack = new Set<NodeId>();
    const currentPath: NodeId[] = [];

    for (const nodeId of this.graph.keys()) {
      if (!visited.has(nodeId)) {
        this.walkForCycles(nodeId, 0, visited, recursionStack, currentPath, rawCycles, true);
      }
    }

    return rawCycles;
  }

  public discoverFromNode(startNode: NodeId): RawCycle[] {
    const rawCycles: RawCycle[] = [];
    this.walkForCycles(startNode, 0, undefined, new Set<NodeId>(), [], rawCycles, false);
    return rawCycles;
  }

  private walkForCycles(
    nodeId: NodeId,
    depth: number,
    visited: Set<NodeId> | undefined,
    recursionStack: Set<NodeId>,
    currentPath: NodeId[],
    cycles: RawCycle[],
    warnOnDepthLimit: boolean
  ): void {
    if (depth > this.maxDepth) {
      if (warnOnDepthLimit) {
        logger.warn('Max depth reached during cycle detection', { nodeId, depth });
      }

      return;
    }

    visited?.add(nodeId);
    recursionStack.add(nodeId);
    currentPath.push(nodeId);

    for (const depId of this.getTraversableDependencies(nodeId)) {
      if (recursionStack.has(depId)) {
        const cycleStartIndex = currentPath.indexOf(depId);
        cycles.push({
          cycle: currentPath.slice(cycleStartIndex),
          closingNode: depId,
        });
        continue;
      }

      if (visited?.has(depId)) {
        continue;
      }

      this.walkForCycles(depId, depth + 1, visited, recursionStack, currentPath, cycles, warnOnDepthLimit);
    }

    recursionStack.delete(nodeId);
    currentPath.pop();
  }

  private getTraversableDependencies(nodeId: NodeId): NodeId[] {
    const dependencies = this.graph.get(nodeId) ?? new Set<NodeId>();
    const traversable: NodeId[] = [];

    for (const depId of dependencies) {
      if (!this.isEdgeIgnored(nodeId, depId) && shouldTraverseDependencyKind(DEFAULT_GRAPH_DEPENDENCY_KIND)) {
        traversable.push(depId);
      }
    }

    return traversable;
  }

  private isEdgeIgnored(from: NodeId, to: NodeId): boolean {
    return this.ignoredEdges.has(`${from}->${to}`);
  }
}
