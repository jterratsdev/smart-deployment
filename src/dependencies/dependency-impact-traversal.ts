import type { DependencyGraph, NodeId } from '../types/dependency.js';
import { DEFAULT_GRAPH_DEPENDENCY_KIND, shouldTraverseDependencyKind } from './dependency-semantics.js';

type TraversalNode = {
  nodeId: NodeId;
  depth: number;
};

type DistanceNode = {
  nodeId: NodeId;
  distance: number;
};

export type ImpactTraversalOptions = {
  maxDepth: number;
  includeTests: boolean;
};

export type ImpactTraversal = {
  affected: Set<NodeId>;
  impactRadius: number;
};

export class DependencyImpactTraversal {
  public constructor(
    private readonly reverseGraph: DependencyGraph,
    private readonly options: ImpactTraversalOptions
  ) {}

  public analyzeDependents(nodeId: NodeId): ImpactTraversal {
    const affected = this.findAllDependents(nodeId);
    return {
      affected,
      impactRadius: this.calculateImpactRadius(nodeId, affected),
    };
  }

  public findAllDependents(nodeId: NodeId): Set<NodeId> {
    const affected = new Set<NodeId>();
    const queue: TraversalNode[] = [{ nodeId, depth: 0 }];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId: current, depth } = queue.shift()!;

      if (visited.has(current) || depth > this.options.maxDepth) {
        continue;
      }

      visited.add(current);
      affected.add(current);

      for (const dependent of this.collectTraversableDependents(current)) {
        if (!visited.has(dependent)) {
          queue.push({ nodeId: dependent, depth: depth + 1 });
        }
      }
    }

    affected.delete(nodeId);

    return affected;
  }

  private calculateImpactRadius(nodeId: NodeId, affected: ReadonlySet<NodeId>): number {
    let maxRadius = 0;
    const queue: DistanceNode[] = [{ nodeId, distance: 0 }];
    const visited = new Set<NodeId>();

    while (queue.length > 0) {
      const { nodeId: current, distance } = queue.shift()!;

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);
      maxRadius = Math.max(maxRadius, distance);

      const dependents = this.reverseGraph.get(current) ?? new Set<NodeId>();
      for (const dependent of dependents) {
        if (affected.has(dependent) && !visited.has(dependent)) {
          queue.push({ nodeId: dependent, distance: distance + 1 });
        }
      }
    }

    return maxRadius;
  }

  private collectTraversableDependents(nodeId: NodeId): NodeId[] {
    const dependents = this.reverseGraph.get(nodeId) ?? new Set<NodeId>();
    const traversable: NodeId[] = [];

    for (const dependent of dependents) {
      if (!shouldTraverseDependencyKind(DEFAULT_GRAPH_DEPENDENCY_KIND)) {
        continue;
      }

      if (!this.options.includeTests && isTestClass(dependent)) {
        continue;
      }

      traversable.push(dependent);
    }

    return traversable;
  }
}

function isTestClass(nodeId: NodeId): boolean {
  return nodeId.toLowerCase().includes('test');
}
