import { getLogger } from '../utils/logger.js';
import type { MetadataComponent, MetadataDependencyKind } from '../types/metadata.js';
import type {
  NodeId,
  DependencyGraph,
  ReverseGraph,
  DependencyAnalysisResult,
  DependencyStats,
  DependencyEdge,
} from '../types/dependency.js';
import { getDependencySourceForKind } from './dependency-semantics.js';
import {
  createComponentIntake,
  type ComponentIntake,
  type ExpandedDependencyDetail,
} from './dependency-graph-intake.js';
import { countGraphEdges, generateDependencyGraphStats } from './dependency-graph-stats.js';
import {
  collectBuildAnnotations,
  collectValidationSummary,
  type BuildAnnotations,
} from './dependency-graph-validation.js';

const logger = getLogger('DependencyGraphBuilder');

type EdgeEndpoints = {
  from: NodeId;
  to: NodeId;
};

/**
 * Dependency types for tracking relationship strength
 */
export type DependencyType = MetadataDependencyKind;

/**
 * Options for building the dependency graph
 */
export type GraphBuilderOptions = {
  /** Track dependency types (hard/soft/inferred) */
  trackDependencyTypes?: boolean;
  /** Validate graph structure during build */
  validateStructure?: boolean;
  /** Max nodes before warning (performance) */
  maxNodes?: number;
};

export class DependencyGraphBuilder {
  private components: Map<NodeId, MetadataComponent> = new Map();
  private graph: DependencyGraph = new Map();
  private reverseGraph: ReverseGraph = new Map();
  private edges: Map<string, DependencyEdge> = new Map(); // "from->to" => edge
  private options: Required<GraphBuilderOptions>;
  private cachedBuildResult?: DependencyAnalysisResult;

  public constructor(options: GraphBuilderOptions = {}) {
    this.options = {
      trackDependencyTypes: options.trackDependencyTypes ?? true,
      validateStructure: options.validateStructure ?? true,
      maxNodes: options.maxNodes ?? 50_000,
    };

    logger.debug('Initialized DependencyGraphBuilder', {
      options: this.options,
    });
  }

  /**
   * Get current size of the graph
   */
  public get size(): number {
    return this.components.size;
  }

  /**
   * Check if graph is empty
   */
  public get isEmpty(): boolean {
    return this.components.size === 0;
  }

  /**
   * Add a metadata component to the graph
   *
   * @ac US-028-AC-1: Add nodes for each component
   * @ac US-028-AC-5: Support incremental graph building
   */
  public addComponent(component: MetadataComponent): void {
    this.invalidateBuildCache();
    const intake = this.normalizeComponentIntake(component);
    this.ingestComponentDependencies(intake);

    logger.debug('Added component to graph', {
      nodeId: intake.nodeId,
      dependencies: intake.dependencyDetails.length,
    });
  }

  /**
   * Add multiple components at once
   *
   * @ac US-028-AC-5: Support incremental graph building
   */
  public addComponents(components: MetadataComponent[]): void {
    const startTime = Date.now();

    for (const component of components) {
      this.addComponent(component);
    }

    const duration = Date.now() - startTime;
    logger.info('Added multiple components', {
      count: components.length,
      totalNodes: this.components.size,
      durationMs: duration,
    });
  }

  /**
   * Add a dependency edge between two nodes
   *
   * @ac US-028-AC-2: Add edges for each dependency
   * @ac US-028-AC-3: Handle bidirectional dependencies
   * @ac US-028-AC-4: Track dependency types
   */
  public addEdge(from: NodeId, to: NodeId, type: DependencyType = 'hard', reason?: string, confidence?: number): void {
    if (from === to) {
      logger.warn('Ignoring self dependency edge', { from, to, type });
      return;
    }

    this.invalidateBuildCache();
    this.ensureEdgeEndpoints(from, to);
    this.graph.get(from)!.add(to);
    this.reverseGraph.get(to)!.add(from);

    if (this.options.trackDependencyTypes) {
      const edgeKey = `${from}->${to}`;
      this.edges.set(edgeKey, {
        from,
        to,
        type,
        reason,
        confidence,
        source: getDependencySourceForKind(type),
      });
    }

    logger.debug('Added dependency edge', { from, to, type });
  }

  /**
   * Remove a component and its edges from the graph
   */
  public removeComponent(nodeId: NodeId): boolean {
    if (!this.components.has(nodeId)) {
      return false;
    }

    this.invalidateBuildCache();

    // Remove component
    this.components.delete(nodeId);

    // Remove outgoing edges
    this.removeOutgoingEdges(nodeId);

    // Remove incoming edges
    this.removeIncomingEdges(nodeId);

    logger.debug('Removed component from graph', { nodeId });
    return true;
  }

  /**
   * Get all dependencies of a component (outgoing edges)
   */
  public getDependencies(nodeId: NodeId): Set<NodeId> {
    return this.graph.get(nodeId) ?? new Set();
  }

  /**
   * Get all dependents of a component (incoming edges)
   */
  public getDependents(nodeId: NodeId): Set<NodeId> {
    return this.reverseGraph.get(nodeId) ?? new Set();
  }

  /**
   * Check if there's a direct dependency between two nodes
   */
  public hasDependency(from: NodeId, to: NodeId): boolean {
    return this.graph.get(from)?.has(to) ?? false;
  }

  /**
   * Build the final dependency analysis result
   *
   * @ac US-028-AC-6: Validate graph structure
   */
  public build(): DependencyAnalysisResult {
    if (this.cachedBuildResult !== undefined) {
      return this.cachedBuildResult;
    }

    const startTime = Date.now();
    const totalEdges = countGraphEdges(this.graph);

    logger.info('Building dependency analysis result', {
      components: this.components.size,
      edges: totalEdges,
    });

    this.removeSelfDependencyEdges();

    if (this.options.validateStructure) {
      this.validate();
    }

    const annotations = this.createBuildAnnotations();
    const stats = generateDependencyGraphStats(this.components, this.graph, this.reverseGraph);

    const duration = Date.now() - startTime;
    logger.info('Dependency graph built successfully', {
      totalComponents: stats.totalComponents,
      totalDependencies: stats.totalDependencies,
      circularDeps: annotations.circularDependencies.length,
      isolated: annotations.isolatedComponents.length,
      durationMs: duration,
    });

    this.cachedBuildResult = this.createBuildResult(stats, annotations);
    return this.cachedBuildResult;
  }

  /**
   * Clear the entire graph
   */
  public clear(): void {
    this.invalidateBuildCache();
    this.components.clear();
    this.graph.clear();
    this.reverseGraph.clear();
    this.edges.clear();
    logger.debug('Graph cleared');
  }

  private createBuildResult(stats: DependencyStats, annotations: BuildAnnotations): DependencyAnalysisResult {
    return {
      components: new Map(this.components),
      graph: new Map(this.graph),
      reverseGraph: new Map(this.reverseGraph),
      edges: [...this.edges.values()],
      circularDependencies: annotations.circularDependencies,
      isolatedComponents: annotations.isolatedComponents,
      stats,
    };
  }

  private invalidateBuildCache(): void {
    this.cachedBuildResult = undefined;
  }

  /**
   * Collect non-statistical build annotations from the graph.
   */
  private createBuildAnnotations(): BuildAnnotations {
    return collectBuildAnnotations(this.components, this.graph, this.reverseGraph);
  }

  private removeSelfDependencyEdges(): void {
    for (const [nodeId, dependencies] of this.graph.entries()) {
      if (!dependencies.delete(nodeId)) {
        continue;
      }

      this.reverseGraph.get(nodeId)?.delete(nodeId);
      this.edges.delete(`${nodeId}->${nodeId}`);
      logger.warn('Ignoring self dependency edge', { from: nodeId, to: nodeId });
    }
  }

  /**
   * Stage 1: normalize node identity and typed dependency details for intake.
   */
  private normalizeComponentIntake(component: MetadataComponent): ComponentIntake {
    const intake = createComponentIntake(component);
    this.intakeComponentNode(intake.nodeId, component);

    return intake;
  }

  /**
   * Stage 2 orchestration: ingest expanded dependency details for a component.
   */
  private ingestComponentDependencies(component: ComponentIntake): void {
    this.assembleComponentEdges(component.nodeId, component.dependencyDetails);
  }

  private removeOutgoingEdges(nodeId: NodeId): void {
    const outgoing = this.graph.get(nodeId);
    if (!outgoing) {
      return;
    }

    for (const to of outgoing) {
      this.reverseGraph.get(to)?.delete(nodeId);
      this.edges.delete(`${nodeId}->${to}`);
    }

    this.graph.delete(nodeId);
  }

  private removeIncomingEdges(nodeId: NodeId): void {
    const incoming = this.reverseGraph.get(nodeId);
    if (!incoming) {
      return;
    }

    for (const from of incoming) {
      this.graph.get(from)?.delete(nodeId);
      this.edges.delete(`${from}->${nodeId}`);
    }

    this.reverseGraph.delete(nodeId);
  }

  /**
   * Stage 1a: intake and register the component node.
   */
  private intakeComponentNode(nodeId: NodeId, component: MetadataComponent): void {
    this.warnIfGraphIsLarge();
    this.components.set(nodeId, component);
    this.initializeNodeEntries(nodeId);
  }

  /**
   * Stage 3: assemble graph edges from expanded dependency details.
   */
  private assembleComponentEdges(nodeId: NodeId, dependencyDetails: ExpandedDependencyDetail[]): void {
    for (const dependency of dependencyDetails) {
      const edge = this.createDependencyEdgeInput(nodeId, dependency);
      this.addEdge(edge.from, edge.to, dependency.kind, dependency.reason, dependency.confidence);
    }
  }

  private createDependencyEdgeInput(nodeId: NodeId, dependency: ExpandedDependencyDetail): EdgeEndpoints {
    return {
      from: nodeId,
      to: dependency.nodeId,
    };
  }

  /**
   * Validation orchestration.
   *
   * @ac US-028-AC-6: Validate graph structure
   */
  private validate(): void {
    const summary = collectValidationSummary(this.components, this.graph);
    this.reportDanglingReferences(summary.danglingReferences);

    if (summary.selfLoopErrors.length > 0) {
      logger.error('Graph validation failed', { errors: summary.selfLoopErrors });
      throw new Error(`Graph validation failed:\n${summary.selfLoopErrors.join('\n')}`);
    }

    logger.debug('Graph validation passed');
  }

  private warnIfGraphIsLarge(): void {
    if (this.components.size >= this.options.maxNodes) {
      logger.warn('Graph size exceeds recommended maximum', {
        current: this.components.size,
        max: this.options.maxNodes,
      });
    }
  }

  private initializeNodeEntries(nodeId: NodeId): void {
    if (!this.graph.has(nodeId)) {
      this.graph.set(nodeId, new Set());
    }

    if (!this.reverseGraph.has(nodeId)) {
      this.reverseGraph.set(nodeId, new Set());
    }
  }

  private ensureEdgeEndpoints(from: NodeId, to: NodeId): void {
    this.initializeOutgoingNode(from);
    this.initializeIncomingNode(to);
  }

  private initializeOutgoingNode(nodeId: NodeId): void {
    if (!this.graph.has(nodeId)) {
      this.graph.set(nodeId, new Set());
    }
  }

  private initializeIncomingNode(nodeId: NodeId): void {
    if (!this.reverseGraph.has(nodeId)) {
      this.reverseGraph.set(nodeId, new Set());
    }
  }

  private reportDanglingReferences(danglingReferences: Array<{ from: NodeId; to: NodeId }>): void {
    for (const reference of danglingReferences) {
      logger.warn('Dangling reference detected', {
        from: reference.from,
        to: reference.to,
      });
    }
  }
}
