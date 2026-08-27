/**
 * Wave Builder
 * Generates deployment waves using topological sort
 *
 * @ac US-038-AC-1: Generate waves from dependency graph
 * @ac US-038-AC-2: Each wave contains independent components
 * @ac US-038-AC-3: Components in wave N don't depend on wave N+1
 * @ac US-038-AC-4: Handle components with no dependencies (wave 1)
 * @ac US-038-AC-5: Handle isolated components
 * @ac US-038-AC-6: Generate wave metadata
 *
 * @issue #38
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';
import { CircularDependencyDetector } from '../dependencies/circular-dependency-detector.js';
import { parseNodeId } from '../utils/node-id.js';

const logger = getLogger('WaveBuilder');

/**
 * Wave of independent components
 */
export type Wave = {
  /** Wave number (1-based) */
  number: number;
  /** Components in this wave */
  components: NodeId[];
  /** Metadata about the wave */
  metadata: WaveMetadata;
};

/**
 * Wave metadata
 */
export type WaveMetadata = {
  /** Number of components */
  componentCount: number;
  /** Component types in this wave */
  types: MetadataType[];
  /** Maximum dependency depth in this wave */
  maxDepth: number;
  /** Whether this wave has circular dependencies */
  hasCircularDeps: boolean;
  /** Estimated deployment time (seconds) */
  estimatedTime: number;
};

/**
 * Wave generation result
 */
export type WaveResult = {
  /** Generated waves */
  waves: Wave[];
  /** Total number of components */
  totalComponents: number;
  /** Components that couldn't be placed (circular deps) */
  unplacedComponents: NodeId[];
  /** Circular dependencies detected */
  circularDependencies: CircularDependency[];
  /** Statistics */
  stats: WaveStats;
};

/**
 * Wave statistics
 */
export type WaveStats = {
  /** Total number of waves */
  totalWaves: number;
  /** Average components per wave */
  avgComponentsPerWave: number;
  /** Largest wave size */
  largestWaveSize: number;
  /** Smallest wave size */
  smallestWaveSize: number;
  /** Total estimated time (seconds) */
  totalEstimatedTime: number;
};

/**
 * Wave builder options
 */
export type WaveBuilderOptions = {
  /** Maximum components per wave (0 = unlimited) */
  maxComponentsPerWave?: number;
  /** Respect metadata type deployment order */
  respectTypeOrder?: boolean;
  /** Handle circular dependencies */
  handleCircularDeps?: boolean;
};

/**
 * Metadata type deployment order (Salesforce recommended)
 */
const TYPE_DEPLOYMENT_ORDER: MetadataType[] = [
  'CustomObject',
  'CustomField',
  'RecordType',
  'BusinessProcess',
  'CompactLayout',
  'Layout',
  'Profile',
  'PermissionSet',
  'ApexClass',
  'ApexTrigger',
  'GenAiPromptTemplate',
  'Flow',
  'AiAuthoringBundle',
  'ValidationRule',
  'WorkflowRule',
  'EmailTemplate',
  'FlexiPage',
];

/**
 * Wave Builder
 *
 * Generates deployment waves using topological sort algorithm.
 * Each wave contains components that can be deployed in parallel.
 *
 * Algorithm:
 * 1. Calculate in-degree for all nodes
 * 2. Add nodes with in-degree 0 to first wave
 * 3. Remove those nodes and update in-degrees
 * 4. Repeat until all nodes are placed
 *
 * Performance: O(V + E)
 *
 * @example
 * const builder = new WaveBuilder({
 *   maxComponentsPerWave: 10000,
 *   respectTypeOrder: true
 * });
 *
 * const result = builder.generateWaves(graph);
 * console.log(`Generated ${result.waves.length} waves`);
 */
export class WaveBuilder {
  private options: Required<WaveBuilderOptions>;

  public constructor(options: WaveBuilderOptions = {}) {
    this.options = {
      maxComponentsPerWave: options.maxComponentsPerWave ?? 0,
      respectTypeOrder: options.respectTypeOrder ?? true,
      handleCircularDeps: options.handleCircularDeps ?? true,
    };

    logger.debug('Initialized WaveBuilder', {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      respectTypeOrder: this.options.respectTypeOrder,
    });
  }

  /**
   * @ac US-038-AC-1: Generate waves from dependency graph
   * @ac US-038-AC-2: Each wave contains independent components
   * @ac US-038-AC-3: Components in wave N don't depend on wave N+1
   */
  public generateWaves(graph: DependencyGraph): WaveResult {
    const startTime = Date.now();

    // Calculate in-degree for all nodes
    const inDegree = this.calculateInDegree(graph);
    const waves: Wave[] = [];
    const processed = new Set<NodeId>();
    const unplacedComponents: NodeId[] = [];
    let waveNumber = 1;

    // Build waves using topological sort
    while (processed.size < graph.size) {
      // Find nodes with in-degree 0
      const currentWave: NodeId[] = [];

      for (const [nodeId, degree] of inDegree.entries()) {
        if (degree === 0 && !processed.has(nodeId)) {
          currentWave.push(nodeId);
        }
      }

      // No progress - circular dependency detected
      if (currentWave.length === 0) {
        const remaining: NodeId[] = [];
        for (const nodeId of graph.keys()) {
          if (!processed.has(nodeId)) {
            remaining.push(nodeId);
          }
        }

        logger.warn('Circular dependencies detected', {
          remaining: remaining.length,
        });

        if (this.options.handleCircularDeps) {
          // Try to automatically resolve cycles by breaking them
          const resolved = this.resolveCircularDependencies(graph, remaining, processed, inDegree);

          if (resolved.broken) {
            logger.info('Automatically resolved circular dependencies', {
              cyclesBroken: resolved.cyclesBroken,
              edgesBroken: resolved.edgesBroken.length,
              componentsResolved: resolved.componentsResolved,
            });

            // Continue with topological sort after breaking cycles
            // Don't break the loop, continue processing
            continue;
          } else {
            // Could not resolve automatically - add remaining to final wave
            for (const nodeId of remaining) {
              unplacedComponents.push(nodeId);
            }

            waves.push({
              number: waveNumber,
              components: remaining,
              metadata: this.generateWaveMetadata(remaining, true),
            });

            break;
          }
        } else {
          // Not handling circular deps - mark as unplaced
          for (const nodeId of remaining) {
            unplacedComponents.push(nodeId);
          }
          break;
        }
      }

      // Sort by type order if configured
      if (this.options.respectTypeOrder) {
        currentWave.sort((a, b) => this.compareByTypeOrder(a, b));
      }

      // Split into multiple waves if exceeds max size
      if (this.options.maxComponentsPerWave > 0 && currentWave.length > this.options.maxComponentsPerWave) {
        const chunks = this.chunkArray(currentWave, this.options.maxComponentsPerWave);
        for (const chunk of chunks) {
          waves.push({
            number: waveNumber++,
            components: chunk,
            metadata: this.generateWaveMetadata(chunk, false),
          });

          // Mark as processed
          for (const nodeId of chunk) {
            processed.add(nodeId);
          }
        }
      } else {
        // Add wave
        waves.push({
          number: waveNumber++,
          components: currentWave,
          metadata: this.generateWaveMetadata(currentWave, false),
        });

        // Mark as processed
        for (const nodeId of currentWave) {
          processed.add(nodeId);
        }
      }

      // Update in-degrees: reduce count for nodes that depended on current wave nodes
      for (const [nodeId, deps] of graph.entries()) {
        if (processed.has(nodeId)) continue;

        // Count how many of its dependencies were in the current wave
        let removedDeps = 0;
        for (const dep of deps) {
          if (currentWave.includes(dep)) {
            removedDeps++;
          }
        }

        if (removedDeps > 0) {
          inDegree.set(nodeId, (inDegree.get(nodeId) ?? 0) - removedDeps);
        }
      }
    }

    // Calculate statistics
    const stats = this.calculateStats(waves);

    const duration = Date.now() - startTime;
    logger.info('Wave generation completed', {
      waves: waves.length,
      components: processed.size,
      unplaced: unplacedComponents.length,
      durationMs: duration,
    });

    return {
      waves,
      totalComponents: graph.size,
      unplacedComponents,
      circularDependencies: [],
      stats,
    };
  }

  /**
   * Resolve circular dependencies by automatically breaking cycles
   *
   * @param graph - The dependency graph
   * @param remaining - Nodes that couldn't be placed
   * @param processed - Set of already processed nodes
   * @param inDegree - Map of in-degrees for each node
   * @returns Object indicating if cycles were broken and how many
   */
  private resolveCircularDependencies(
    graph: DependencyGraph,
    remaining: NodeId[],
    processed: Set<NodeId>,
    inDegree: Map<NodeId, number>
  ): {
    broken: boolean;
    cyclesBroken: number;
    edgesBroken: Array<{ from: NodeId; to: NodeId }>;
    componentsResolved: number;
  } {
    // Create a subgraph with only remaining nodes
    const subgraph: DependencyGraph = new Map();
    for (const nodeId of remaining) {
      const deps = graph.get(nodeId);
      if (deps) {
        const filteredDeps = new Set<NodeId>();
        for (const dep of deps) {
          if (remaining.includes(dep)) {
            filteredDeps.add(dep);
          }
        }
        if (filteredDeps.size > 0) {
          subgraph.set(nodeId, filteredDeps);
        }
      }
    }

    if (subgraph.size === 0) {
      return { broken: false, cyclesBroken: 0, edgesBroken: [], componentsResolved: 0 };
    }

    // Detect cycles in the subgraph
    const detector = new CircularDependencyDetector(subgraph, {
      generateSuggestions: true,
      maxDepth: 100, // Increase depth to find longer cycles
    });

    const cycles = detector.detectCycles();

    if (cycles.length === 0) {
      // No cycles detected - might be missing dependencies or the subgraph is too disconnected
      // Try a different approach: break edges based on heuristics even without detected cycles
      // This handles cases where components are stuck due to complex dependency patterns
      logger.debug('No cycles detected in subgraph, trying heuristic-based breaking', {
        subgraphSize: subgraph.size,
        remainingSize: remaining.length,
      });

      // Use heuristic-based breaking: prioritize test classes, utility classes, etc.
      return this.breakEdgesByHeuristics(graph, remaining, inDegree);
    }

    logger.debug('Detected cycles to resolve', {
      cycleCount: cycles.length,
      totalNodesInCycles: new Set(cycles.flatMap((c) => c.cycle)).size,
    });

    // Collect all break suggestions, prioritizing by priority
    const edgesToBreak: Array<{ from: NodeId; to: NodeId; priority: number }> = [];
    const seenEdges = new Set<string>();

    for (const cycle of cycles) {
      for (const suggestion of cycle.breakSuggestions) {
        const edgeKey = `${suggestion.from}->${suggestion.to}`;
        if (!seenEdges.has(edgeKey)) {
          seenEdges.add(edgeKey);
          edgesToBreak.push({
            from: suggestion.from,
            to: suggestion.to,
            priority: suggestion.priority,
          });
        }
      }
    }

    // Sort by priority (highest first) and take top suggestions
    edgesToBreak.sort((a, b) => b.priority - a.priority);

    // Break edges by removing them from the graph
    // We'll break up to 50% of cycles to avoid breaking too many dependencies
    const maxBreaks = Math.min(edgesToBreak.length, Math.ceil(cycles.length * 0.5));
    const edgesBroken: Array<{ from: NodeId; to: NodeId }> = [];

    for (let i = 0; i < maxBreaks; i++) {
      const edge = edgesToBreak[i];

      // Remove edge from graph
      const deps = graph.get(edge.from);
      if (deps && deps.has(edge.to)) {
        deps.delete(edge.to);
        edgesBroken.push({ from: edge.from, to: edge.to });

        // Update in-degree
        const currentDegree = inDegree.get(edge.to) ?? 0;
        if (currentDegree > 0) {
          inDegree.set(edge.to, currentDegree - 1);
        }

        logger.debug('Broke cycle edge', {
          from: edge.from,
          to: edge.to,
          priority: edge.priority,
        });
      }
    }

    // Count how many components can now be placed
    let componentsResolved = 0;
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0 && !processed.has(nodeId) && remaining.includes(nodeId)) {
        componentsResolved++;
      }
    }

    return {
      broken: edgesBroken.length > 0,
      cyclesBroken: cycles.length,
      edgesBroken,
      componentsResolved,
    };
  }

  /**
   * Break edges using heuristics when cycles are not clearly detected
   * Prioritizes breaking edges that are safe to break (test classes, utilities, etc.)
   */
  private breakEdgesByHeuristics(
    graph: DependencyGraph,
    remaining: NodeId[],
    inDegree: Map<NodeId, number>
  ): {
    broken: boolean;
    cyclesBroken: number;
    edgesBroken: Array<{ from: NodeId; to: NodeId }>;
    componentsResolved: number;
  } {
    const edgesToBreak: Array<{ from: NodeId; to: NodeId; priority: number }> = [];

    // Collect all edges in the remaining subgraph
    for (const nodeId of remaining) {
      const deps = graph.get(nodeId);
      if (deps) {
        for (const dep of deps) {
          if (remaining.includes(dep)) {
            // Calculate priority for breaking this edge
            let priority = 50; // Base priority

            // Test classes are high priority to break
            if (nodeId.includes('Test') || nodeId.includes('_Test')) {
              priority += 40;
            }
            if (dep.includes('Test') || dep.includes('_Test')) {
              priority += 30;
            }

            // Utility/Helper classes
            if (nodeId.includes('Helper') || nodeId.includes('Util') || nodeId.includes('Wrapper')) {
              priority += 20;
            }

            // Handler -> Service edges
            if (nodeId.includes('Handler') && dep.includes('Service')) {
              priority += 15;
            }

            // Controller -> Service edges
            if (nodeId.includes('Controller') && dep.includes('Service')) {
              priority += 15;
            }

            // Avoid breaking core domain classes
            if (nodeId.includes('Service') && dep.includes('Service')) {
              priority -= 10;
            }

            edgesToBreak.push({ from: nodeId, to: dep, priority });
          }
        }
      }
    }

    // Sort by priority and break top edges
    edgesToBreak.sort((a, b) => b.priority - a.priority);

    // Break up to 30% of edges to avoid breaking too many dependencies
    const maxBreaks = Math.min(edgesToBreak.length, Math.max(1, Math.ceil(edgesToBreak.length * 0.3)));
    const edgesBroken: Array<{ from: NodeId; to: NodeId }> = [];

    for (let i = 0; i < maxBreaks; i++) {
      const edge = edgesToBreak[i];

      // Remove edge from graph
      const deps = graph.get(edge.from);
      if (deps && deps.has(edge.to)) {
        deps.delete(edge.to);
        edgesBroken.push({ from: edge.from, to: edge.to });

        // Update in-degree
        const currentDegree = inDegree.get(edge.to) ?? 0;
        if (currentDegree > 0) {
          inDegree.set(edge.to, currentDegree - 1);
        }

        logger.debug('Broke edge by heuristic', {
          from: edge.from,
          to: edge.to,
          priority: edge.priority,
        });
      }
    }

    // Count how many components can now be placed
    let componentsResolved = 0;
    for (const [nodeId, degree] of inDegree.entries()) {
      if (degree === 0 && remaining.includes(nodeId)) {
        componentsResolved++;
      }
    }

    return {
      broken: edgesBroken.length > 0,
      cyclesBroken: 0, // Not detected cycles, but heuristic-based breaking
      edgesBroken,
      componentsResolved,
    };
  }

  /**
   * Calculate in-degree for all nodes
   * In-degree = number of dependencies this node has (how many nodes it depends on)
   * Nodes with in-degree 0 have no dependencies and can be deployed first
   */
  private calculateInDegree(graph: DependencyGraph): Map<NodeId, number> {
    const inDegree = new Map<NodeId, number>();

    // Dangling references can point to standard or managed-package metadata;
    // only dependencies represented by deployable graph nodes block a wave.
    for (const [nodeId, deps] of graph.entries()) {
      inDegree.set(nodeId, Array.from(deps).filter((dep) => graph.has(dep)).length);
    }

    return inDegree;
  }

  /**
   * @ac US-038-AC-6: Generate wave metadata
   */
  private generateWaveMetadata(components: NodeId[], hasCircularDeps: boolean): WaveMetadata {
    const types = new Set<MetadataType>();
    const maxDepth = 0;

    for (const component of components) {
      const type = parseNodeId(component)?.type;
      if (type) types.add(type as MetadataType);
    }

    // Estimate deployment time (rough estimate: 0.1s per component)
    const estimatedTime = Math.ceil(components.length * 0.1);

    return {
      componentCount: components.length,
      types: Array.from(types),
      maxDepth,
      hasCircularDeps,
      estimatedTime,
    };
  }

  /**
   * Compare nodes by type deployment order
   */
  private compareByTypeOrder(a: NodeId, b: NodeId): number {
    const typeA = parseNodeId(a)?.type as MetadataType | undefined;
    const typeB = parseNodeId(b)?.type as MetadataType | undefined;

    const orderA = typeA ? TYPE_DEPLOYMENT_ORDER.indexOf(typeA) : -1;
    const orderB = typeB ? TYPE_DEPLOYMENT_ORDER.indexOf(typeB) : -1;

    // If not in order list, put at end
    const finalOrderA = orderA === -1 ? 9999 : orderA;
    const finalOrderB = orderB === -1 ? 9999 : orderB;

    return finalOrderA - finalOrderB;
  }

  /**
   * Split array into chunks
   */
  private chunkArray<T>(array: T[], chunkSize: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }

  /**
   * Calculate wave statistics
   */
  private calculateStats(waves: Wave[]): WaveStats {
    if (waves.length === 0) {
      return {
        totalWaves: 0,
        avgComponentsPerWave: 0,
        largestWaveSize: 0,
        smallestWaveSize: 0,
        totalEstimatedTime: 0,
      };
    }

    const sizes = waves.map((w) => w.components.length);
    const totalComponents = sizes.reduce((sum, size) => sum + size, 0);
    const totalTime = waves.reduce((sum, w) => sum + w.metadata.estimatedTime, 0);

    return {
      totalWaves: waves.length,
      avgComponentsPerWave: Math.round(totalComponents / waves.length),
      largestWaveSize: Math.max(...sizes),
      smallestWaveSize: Math.min(...sizes),
      totalEstimatedTime: totalTime,
    };
  }

  /**
   * Get wave by number
   */
  public getWave(result: WaveResult, waveNumber: number): Wave | undefined {
    return result.waves.find((w) => w.number === waveNumber);
  }

  /**
   * Get component wave number
   */
  public getComponentWave(result: WaveResult, componentId: NodeId): number | undefined {
    for (const wave of result.waves) {
      if (wave.components.includes(componentId)) {
        return wave.number;
      }
    }
    return undefined;
  }
}
