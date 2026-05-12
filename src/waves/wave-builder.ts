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
import type { NodeId, DependencyEdge, DependencyGraph, CircularDependency } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';
import { assembleWaveMetadata, calculateWaveStats } from './wave-metadata.js';
import { buildEdgeTypesByFrom, compareWavePriority } from './wave-priority-policy.js';
import {
  calculateInDegree,
  collectRemainingNodes,
  planTopologyStage,
  updateInDegreeForPlacedCandidates,
  type WavePlacementPolicy,
} from './wave-topology.js';

const logger = getLogger('WaveBuilder');

type WavePlacementState = {
  inDegree: Map<NodeId, number>;
  waves: Wave[];
  processed: Set<NodeId>;
  unplacedComponents: NodeId[];
  nextWaveNumber: number;
};

type CircularWaveResolution = {
  remaining: NodeId[];
  fallbackWave?: Wave;
};

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
  /** Structured dependency edges for risk-aware ordering inside a wave */
  dependencyEdges?: DependencyEdge[];
};

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
  private readonly edgeTypesByFrom: Map<NodeId, Array<DependencyEdge['type']>>;

  public constructor(options: WaveBuilderOptions = {}) {
    this.options = {
      maxComponentsPerWave: options.maxComponentsPerWave ?? 0,
      respectTypeOrder: options.respectTypeOrder ?? true,
      handleCircularDeps: options.handleCircularDeps ?? true,
      dependencyEdges: options.dependencyEdges ?? [],
    };
    this.edgeTypesByFrom = buildEdgeTypesByFrom(this.options.dependencyEdges);

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
    const policy = this.getPlacementPolicy();
    const state = this.createPlacementState(graph);

    while (state.processed.size < graph.size) {
      const topologyStage = planTopologyStage({
        inDegree: state.inDegree,
        processed: state.processed,
        policy,
        comparePriority: (left, right) => this.compareWavePriority(left, right),
      });
      if (topologyStage.orderedCandidates.length === 0) {
        const circularResolution = this.resolveCircularWave(graph, state.processed, state.nextWaveNumber, policy);
        state.unplacedComponents.push(...circularResolution.remaining);
        if (circularResolution.fallbackWave) {
          state.waves.push(circularResolution.fallbackWave);
        }
        break;
      }

      for (const chunk of topologyStage.chunks) {
        state.waves.push(this.createWave(chunk, state.nextWaveNumber, false));
        state.nextWaveNumber += 1;
        this.markProcessed(state.processed, chunk);
      }

      updateInDegreeForPlacedCandidates({
        graph,
        inDegree: state.inDegree,
        processed: state.processed,
        placedCandidates: topologyStage.orderedCandidates,
      });
    }

    const stats = calculateWaveStats(state.waves);

    const duration = Date.now() - startTime;
    logger.info('Wave generation completed', {
      waves: state.waves.length,
      components: state.processed.size,
      unplaced: state.unplacedComponents.length,
      durationMs: duration,
    });

    state.waves.sort((a, b) => a.number - b.number);

    return {
      waves: state.waves,
      totalComponents: graph.size,
      unplacedComponents: state.unplacedComponents,
      circularDependencies: [],
      stats,
    };
  }

  private createPlacementState(graph: DependencyGraph): WavePlacementState {
    return {
      inDegree: calculateInDegree(graph),
      waves: [],
      processed: new Set<NodeId>(),
      unplacedComponents: [],
      nextWaveNumber: 1,
    };
  }

  private getPlacementPolicy(): WavePlacementPolicy {
    return {
      maxComponentsPerWave: this.options.maxComponentsPerWave,
      respectTypeOrder: this.options.respectTypeOrder,
      handleCircularDeps: this.options.handleCircularDeps,
    };
  }

  private createWave(components: NodeId[], waveNumber: number, hasCircularDeps: boolean): Wave {
    return {
      number: waveNumber,
      components,
      metadata: assembleWaveMetadata(components, hasCircularDeps),
    };
  }

  private markProcessed(processed: Set<NodeId>, components: Iterable<NodeId>): void {
    for (const nodeId of components) {
      processed.add(nodeId);
    }
  }

  private resolveCircularWave(
    graph: DependencyGraph,
    processed: ReadonlySet<NodeId>,
    waveNumber: number,
    policy: WavePlacementPolicy
  ): CircularWaveResolution {
    const remaining = collectRemainingNodes(graph, processed);

    logger.warn('Circular dependencies detected', {
      remaining: remaining.length,
    });

    if (policy.handleCircularDeps) {
      if (policy.respectTypeOrder) {
        remaining.sort((left, right) => this.compareWavePriority(left, right));
      }

      return {
        remaining,
        fallbackWave: this.createWave(remaining, waveNumber, true),
      };
    }

    return { remaining };
  }

  private compareWavePriority(a: NodeId, b: NodeId): number {
    return compareWavePriority(this.edgeTypesByFrom, a, b);
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
