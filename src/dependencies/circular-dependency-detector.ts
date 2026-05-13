/**
 * Circular Dependency Detector
 * Detects and reports circular dependencies in the dependency graph
 *
 * @ac US-030-AC-1: Detect simple cycles (A→B→A)
 * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
 * @ac US-030-AC-3: Report all nodes in cycle
 * @ac US-030-AC-4: Suggest where to break cycle
 * @ac US-030-AC-5: Support user-defined cycle breaks
 * @ac US-030-AC-6: Handle multiple separate cycles
 *
 * @issue #30
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId, DependencyGraph, CircularDependency } from '../types/dependency.js';
import { generateBreakSuggestions } from './cycle-break-suggestions.js';
import { CycleDiscovery, type RawCycle } from './cycle-discovery.js';

const logger = getLogger('CircularDependencyDetector');

/**
 * Cycle break suggestion
 */
export type CycleBreakSuggestion = {
  from: NodeId;
  to: NodeId;
  reason: string;
  priority: number; // Higher = better candidate
};

/**
 * Detected cycle with break suggestions
 */
export type DetectedCycle = CircularDependency & {
  id: string;
  breakSuggestions: CycleBreakSuggestion[];
};

/**
 * Options for cycle detection
 */
export type CycleDetectionOptions = {
  /** Maximum depth to search for cycles */
  maxDepth?: number;
  /** User-defined edges to ignore (cycle breaks) */
  ignoreEdges?: Array<{ from: NodeId; to: NodeId }>;
  /** Generate break suggestions */
  generateSuggestions?: boolean;
};

/**
 * Circular Dependency Detector
 *
 * Uses depth-first search (DFS) to detect cycles in the dependency graph.
 * Supports both simple (A→B→A) and complex (A→B→C→A) cycles.
 *
 * Performance: O(V + E) where V = vertices, E = edges
 *
 * @example
 * const detector = new CircularDependencyDetector(graph);
 * const cycles = detector.detectCycles();
 * if (cycles.length > 0) {
 *   console.log(`Found ${cycles.length} circular dependencies`);
 *   console.log('Suggestion:', cycles[0].breakSuggestions[0]);
 * }
 */
export class CircularDependencyDetector {
  private graph: DependencyGraph;
  private options: Required<CycleDetectionOptions>;
  private ignoredEdges: Set<string>;
  private discovery: CycleDiscovery;

  public constructor(graph: DependencyGraph, options: CycleDetectionOptions = {}) {
    this.graph = graph;
    this.options = {
      maxDepth: options.maxDepth ?? 100,
      ignoreEdges: options.ignoreEdges ?? [],
      generateSuggestions: options.generateSuggestions ?? true,
    };

    // Create set of ignored edges for O(1) lookup
    this.ignoredEdges = new Set(this.options.ignoreEdges.map(({ from, to }) => `${from}->${to}`));
    this.discovery = new CycleDiscovery(this.graph, this.options.maxDepth, this.ignoredEdges);

    logger.debug('Initialized CircularDependencyDetector', {
      nodes: this.graph.size,
      ignoredEdges: this.ignoredEdges.size,
    });
  }

  /**
   * Generate a unique ID for a cycle (order-independent)
   */
  private static generateCycleId(cycle: NodeId[]): string {
    // Sort to make it order-independent: [A,B,C] and [B,C,A] are the same cycle
    const sorted = [...cycle].sort();
    return sorted.join('->');
  }

  /**
   * Check if a cycle is a duplicate of already found cycles
   */
  private static isDuplicateCycle(cycle: NodeId[], existingCycles: DetectedCycle[]): boolean {
    const cycleId = CircularDependencyDetector.generateCycleId(cycle);
    return existingCycles.some((c) => c.id === cycleId);
  }

  // Public methods
  /**
   * Detect all circular dependencies in the graph
   *
   * @ac US-030-AC-1: Detect simple cycles (A→B→A)
   * @ac US-030-AC-2: Detect complex cycles (A→B→C→A)
   * @ac US-030-AC-6: Handle multiple separate cycles
   */
  public detectCycles(): DetectedCycle[] {
    const startTime = Date.now();
    const visited = new Set<NodeId>();
    const rawCycles = this.discovery.discoverAcrossGraph(visited);
    const allCycles = this.materializeUniqueCycles(rawCycles);

    const duration = Date.now() - startTime;
    logger.info('Cycle detection completed', {
      cyclesFound: allCycles.length,
      nodesScanned: visited.size,
      durationMs: duration,
    });

    return allCycles;
  }

  /**
   * Detect cycles starting from a specific node
   */
  public detectCyclesFromNode(startNode: NodeId): DetectedCycle[] {
    const rawCycles = this.discovery.discoverFromNode(startNode);
    return this.materializeUniqueCycles(rawCycles);
  }

  /**
   * Check if a specific path creates a cycle
   */
  public wouldCreateCycle(from: NodeId, to: NodeId): boolean {
    // Check if adding edge from->to would create a cycle
    // This means: can we reach 'from' starting from 'to'?

    const visited = new Set<NodeId>();
    const queue: NodeId[] = [to];

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current === from) {
        return true; // Found a path back to 'from'
      }

      if (visited.has(current)) {
        continue;
      }

      visited.add(current);

      const deps = this.graph.get(current) ?? new Set();
      for (const dep of deps) {
        if (!this.isEdgeIgnored(current, dep) && !visited.has(dep)) {
          queue.push(dep);
        }
      }
    }

    return false;
  }

  /**
   * @ac US-030-AC-3: Report all nodes in cycle
   *
   * Create a detected cycle with full information
   */
  private createDetectedCycle(cycle: NodeId[], closingNode: NodeId): DetectedCycle {
    const cycleId = CircularDependencyDetector.generateCycleId(cycle);
    const message = `Circular dependency: ${cycle.join(' → ')} → ${closingNode}`;

    const detected: DetectedCycle = {
      id: cycleId,
      cycle: [...cycle],
      severity: cycle.length <= 2 ? 'error' : 'warning',
      message,
      breakSuggestions: [],
    };

    if (this.options.generateSuggestions) {
      detected.breakSuggestions = generateBreakSuggestions(cycle, closingNode);
    }

    return detected;
  }

  private materializeUniqueCycles(rawCycles: RawCycle[]): DetectedCycle[] {
    const cycles: DetectedCycle[] = [];

    for (const rawCycle of rawCycles) {
      if (!CircularDependencyDetector.isDuplicateCycle(rawCycle.cycle, cycles)) {
        cycles.push(this.createDetectedCycle(rawCycle.cycle, rawCycle.closingNode));
      }
    }

    return cycles;
  }

  /**
   * @ac US-030-AC-5: Support user-defined cycle breaks
   *
   * Check if an edge is in the ignore list
   */
  private isEdgeIgnored(from: NodeId, to: NodeId): boolean {
    return this.ignoredEdges.has(`${from}->${to}`);
  }

  /**
   * Get summary statistics
   */
  public getStats(): {
    totalNodes: number;
    totalEdges: number;
    ignoredEdges: number;
  } {
    let totalEdges = 0;
    for (const deps of this.graph.values()) {
      totalEdges += deps.size;
    }

    return {
      totalNodes: this.graph.size,
      totalEdges,
      ignoredEdges: this.ignoredEdges.size,
    };
  }
}
