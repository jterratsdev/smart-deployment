import type { NodeId } from '../types/dependency.js';
import type { Wave } from './wave-builder.js';

export type OptimizerPolicy = {
  alwaysRunAllTests: boolean;
  minCoverageRequired: number;
  includeRelatedTests: boolean;
};

export type WaveTestContext = {
  waveNumber: number;
  waveComponents: NodeId[];
  waveMetadata: Wave['metadata'];
  codeClasses: NodeId[];
  triggers: NodeId[];
  needsTests: boolean;
};

export type WaveTestPlan = {
  testClasses: NodeId[];
  estimatedCoverage: number;
  decision: OptimizationDecision;
};

export type OptimizationPlanningState = {
  allTestClasses: NodeId[];
  waveContexts: WaveTestContext[];
  wavePlans: WaveTestPlan[];
};

/**
 * Test optimization result
 */
export type TestOptimizationResult = {
  /** Original waves */
  originalWaves: Wave[];
  /** Optimized waves with test classes */
  optimizedWaves: OptimizedWave[];
  /** Optimization decisions */
  decisions: OptimizationDecision[];
  /** Statistics */
  stats: OptimizationStats;
};

/**
 * Optimized wave with test information
 */
export type OptimizedWave = Wave & {
  /** Test classes included in this wave */
  testClasses: NodeId[];
  /** Code classes in this wave */
  codeClasses: NodeId[];
  /** Triggers in this wave */
  triggers: NodeId[];
  /** Needs test execution */
  needsTests: boolean;
  /** Estimated test coverage % */
  estimatedCoverage: number;
};

/**
 * Optimization decision
 */
export type OptimizationDecision = {
  /** Wave number */
  waveNumber: number;
  /** Decision type */
  type: 'include-tests' | 'skip-tests' | 'sync-tests';
  /** Reason for decision */
  reason: string;
  /** Tests affected */
  testsAffected: number;
};

/**
 * Optimization statistics
 */
export type OptimizationStats = {
  /** Total waves */
  totalWaves: number;
  /** Waves with tests */
  wavesWithTests: number;
  /** Waves without tests */
  wavesWithoutTests: number;
  /** Total test classes added */
  totalTestsAdded: number;
  /** Estimated time saved (seconds) */
  timeSaved: number;
};

/**
 * Optimizer options
 */
export type OptimizerOptions = {
  /** Always run all tests (disable optimization) */
  alwaysRunAllTests?: boolean;
  /** Minimum test coverage required (0-100) */
  minCoverageRequired?: number;
  /** Include related tests (not just direct) */
  includeRelatedTests?: boolean;
};
