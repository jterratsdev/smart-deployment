/**
 * Dependency Resolver
 * Resolves component dependencies and generates deployment order
 *
 * @ac US-033-AC-1: Resolve direct dependencies
 * @ac US-033-AC-2: Resolve transitive dependencies
 * @ac US-033-AC-3: Handle optional dependencies
 * @ac US-033-AC-4: Skip managed package dependencies
 * @ac US-033-AC-5: Report unresolved dependencies
 * @ac US-033-AC-6: Generate dependency report
 *
 * @issue #33
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import { DependencyResolutionClassifier } from './dependency-resolution-classifier.js';
import { sortDependencyGraph, type UnresolvedDependencyNode } from './topological-dependency-sorter.js';

const logger = getLogger('DependencyResolver');

type ResolutionPipelineState = {
  filteredGraph: DependencyGraph;
  deploymentOrder: NodeId[];
  unresolved: UnresolvedDependencyNode[];
  resolved: Map<NodeId, ResolvedDependency>;
  optional: NodeId[];
  managed: NodeId[];
};

/**
 * Dependency resolution status
 */
export type ResolutionStatus = 'resolved' | 'unresolved' | 'optional' | 'managed' | 'circular';

/**
 * Resolved dependency information
 */
export type ResolvedDependency = {
  nodeId: NodeId;
  dependencies: NodeId[];
  status: ResolutionStatus;
  order: number; // Position in deployment order
  reason?: string; // Reason for status
};

/**
 * Dependency resolution result
 */
export type ResolutionResult = {
  resolved: Map<NodeId, ResolvedDependency>;
  deploymentOrder: NodeId[];
  unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }>;
  optional: NodeId[];
  managed: NodeId[];
  circular: CircularDependency[];
  report: DependencyReport;
};

/**
 * Dependency report
 */
export type DependencyReport = {
  totalComponents: number;
  resolvedCount: number;
  unresolvedCount: number;
  optionalCount: number;
  managedCount: number;
  circularCount: number;
  deploymentLevels: number;
};

/**
 * Resolver options
 */
export type ResolverOptions = {
  /** Include optional dependencies in resolution */
  includeOptional?: boolean;
  /** Skip managed package components */
  skipManaged?: boolean;
  /** Circular dependencies to handle */
  circularDependencies?: CircularDependency[];
  /** Manual ordering constraints: [before, after] */
  orderingConstraints?: Array<{ before: NodeId; after: NodeId }>;
};

/**
 * Dependency Resolver
 *
 * Resolves dependencies and generates deployment order using topological sort.
 * Handles circular dependencies, optional dependencies, and managed packages.
 *
 * Performance: O(V + E) using Kahn's algorithm
 *
 * @example
 * const resolver = new DependencyResolver(graph, components);
 * const result = resolver.resolve();
 * console.log(`Deployment order: ${result.deploymentOrder.join(' → ')}`);
 * console.log(`Unresolved: ${result.unresolved.length}`);
 */
export class DependencyResolver {
  private graph: DependencyGraph;
  private components: Map<NodeId, MetadataComponent>;
  private options: Required<ResolverOptions>;
  private classifier: DependencyResolutionClassifier;
  private cachedResult?: ResolutionResult;

  public constructor(
    graph: DependencyGraph,
    components: Map<NodeId, MetadataComponent>,
    options: ResolverOptions = {}
  ) {
    this.graph = graph;
    this.components = components;
    this.options = {
      includeOptional: options.includeOptional ?? false,
      skipManaged: options.skipManaged ?? true,
      circularDependencies: options.circularDependencies ?? [],
      orderingConstraints: options.orderingConstraints ?? [],
    };
    this.classifier = new DependencyResolutionClassifier(this.components, {
      includeOptional: this.options.includeOptional,
      skipManaged: this.options.skipManaged,
    });

    logger.debug('Initialized DependencyResolver', {
      components: this.components.size,
      includeOptional: this.options.includeOptional,
      skipManaged: this.options.skipManaged,
      circularDeps: this.options.circularDependencies.length,
    });
  }

  /**
   * Resolve all dependencies and generate deployment order
   *
   * @ac US-033-AC-1: Resolve direct dependencies
   * @ac US-033-AC-2: Resolve transitive dependencies
   * @ac US-033-AC-6: Generate dependency report
   */
  public resolve(): ResolutionResult {
    if (this.cachedResult !== undefined) {
      return this.cachedResult;
    }

    const startTime = Date.now();
    const pipelineState = this.runResolutionPipeline();
    const report = this.generateReport(
      pipelineState.resolved,
      pipelineState.unresolved,
      pipelineState.optional,
      pipelineState.managed
    );

    const duration = Date.now() - startTime;
    logger.info('Dependency resolution completed', {
      totalComponents: this.components.size,
      resolved: pipelineState.resolved.size,
      unresolved: pipelineState.unresolved.length,
      deploymentLevels: report.deploymentLevels,
      durationMs: duration,
    });

    this.cachedResult = {
      resolved: pipelineState.resolved,
      deploymentOrder: pipelineState.deploymentOrder,
      unresolved: pipelineState.unresolved,
      optional: pipelineState.optional,
      managed: pipelineState.managed,
      circular: this.options.circularDependencies,
      report,
    };

    return this.cachedResult;
  }

  /**
   * Orchestrate the staged resolution pipeline.
   */
  private runResolutionPipeline(): ResolutionPipelineState {
    const filteredGraph = this.buildFilteredGraph();
    const { deploymentOrder, unresolved } = sortDependencyGraph(filteredGraph);
    const resolved = this.buildResolvedMap(deploymentOrder, filteredGraph);
    const optional = this.classifier.findOptionalDependencies(this.graph);
    const managed = this.classifier.findManagedPackages();

    return {
      filteredGraph,
      deploymentOrder,
      unresolved,
      resolved,
      optional,
      managed,
    };
  }

  /**
   * Stage 1: build a graph filtered by component/dependency classification.
   */
  private buildFilteredGraph(): DependencyGraph {
    const filtered: DependencyGraph = new Map();

    for (const [nodeId, deps] of this.graph.entries()) {
      if (!this.classifier.shouldIncludeNode(nodeId)) {
        continue;
      }

      filtered.set(nodeId, this.classifier.collectIncludedDependencies(nodeId, deps));
    }

    this.applyOrderingConstraints(filtered);

    return filtered;
  }

  /**
   * Stage 2: apply manual ordering constraints after filtering.
   */
  private applyOrderingConstraints(graph: DependencyGraph): void {
    for (const { before, after } of this.options.orderingConstraints) {
      // Ensure 'before' depends on 'after' (before must be deployed after 'after')
      if (!graph.has(before)) {
        graph.set(before, new Set());
      }
      graph.get(before)!.add(after);
    }
  }

  /**
   * Stage 4: project the deployment order into resolved entries.
   */
  private buildResolvedMap(deploymentOrder: NodeId[], graph: DependencyGraph): Map<NodeId, ResolvedDependency> {
    const resolved = new Map<NodeId, ResolvedDependency>();

    for (let i = 0; i < deploymentOrder.length; i++) {
      const nodeId = deploymentOrder[i];
      const deps = Array.from(graph.get(nodeId) ?? []);

      resolved.set(nodeId, {
        nodeId,
        dependencies: deps,
        status: 'resolved',
        order: i,
      });
    }

    return resolved;
  }

  /**
   * @ac US-033-AC-6: Generate dependency report
   */
  private generateReport(
    resolved: Map<NodeId, ResolvedDependency>,
    unresolved: Array<{ nodeId: NodeId; missingDependencies: NodeId[] }>,
    optional: NodeId[],
    managed: NodeId[]
  ): DependencyReport {
    return {
      totalComponents: this.components.size,
      resolvedCount: resolved.size,
      unresolvedCount: unresolved.length,
      optionalCount: optional.length,
      managedCount: managed.length,
      circularCount: this.options.circularDependencies.length,
      deploymentLevels: this.calculateDeploymentLevels(resolved),
    };
  }

  private calculateDeploymentLevels(resolved: ReadonlyMap<NodeId, ResolvedDependency>): number {
    let maxOrder = 0;

    for (const dep of resolved.values()) {
      maxOrder = Math.max(maxOrder, dep.order);
    }

    return maxOrder + 1;
  }

  /**
   * Get resolution status for a specific component
   */
  public getResolution(nodeId: NodeId): ResolvedDependency | undefined {
    return this.resolve().resolved.get(nodeId);
  }

  /**
   * Check if a component can be resolved
   */
  public canResolve(nodeId: NodeId): boolean {
    return this.resolve().resolved.has(nodeId);
  }

  /**
   * Get deployment order for specific components
   */
  public getDeploymentOrder(nodeIds: NodeId[]): NodeId[] {
    const result = this.resolve();
    const orderMap = new Map<NodeId, number>();

    for (const dep of result.resolved.values()) {
      orderMap.set(dep.nodeId, dep.order);
    }

    // Sort by order
    return nodeIds.filter((id) => orderMap.has(id)).sort((a, b) => (orderMap.get(a) ?? 0) - (orderMap.get(b) ?? 0));
  }
}
