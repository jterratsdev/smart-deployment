/**
 * Test Optimizer
 * Optimizes test execution per wave to reduce deployment time
 *
 * @ac US-040-AC-1: Identify waves with Apex/Trigger changes
 * @ac US-040-AC-2: Include tests only in waves with code
 * @ac US-040-AC-3: Sync test classes with production classes
 * @ac US-040-AC-4: Ensure trigger tests are included
 * @ac US-040-AC-5: Calculate test coverage per wave
 * @ac US-040-AC-6: Report test optimization savings
 *
 * @issue #40
 */

import { getLogger } from '../utils/logger.js';
import type { NodeId } from '../types/dependency.js';
import type { Wave } from './wave-builder.js';
import { analyzeWave, collectAllTestClasses } from './test-optimizer-discovery.js';
import { matchTestClasses } from './test-optimizer-matching.js';
import type {
  OptimizerOptions,
  OptimizerPolicy,
  OptimizationPlanningState,
  OptimizationDecision,
  OptimizedWave,
  TestOptimizationResult,
  WaveTestContext,
  WaveTestPlan,
} from './test-optimizer-model.js';
import { calculateStats, collectOptimizationDecisions, scoreEstimatedCoverage } from './test-optimizer-scoring.js';

const logger = getLogger('TestOptimizer');

export type {
  OptimizerOptions,
  OptimizationDecision,
  OptimizationStats,
  OptimizedWave,
  TestOptimizationResult,
} from './test-optimizer-model.js';

/**
 * Test Optimizer
 *
 * Optimizes test execution by only including tests in waves
 * that contain Apex classes or triggers.
 *
 * Strategy:
 * 1. Identify waves with code changes (ApexClass, ApexTrigger)
 * 2. Match test classes to production classes
 * 3. Include only relevant tests per wave
 * 4. Skip tests for metadata-only waves
 *
 * Performance: O(V)
 *
 * @example
 * const optimizer = new TestOptimizer({
 *   minCoverageRequired: 75,
 *   includeRelatedTests: true
 * });
 *
 * const result = optimizer.optimizeTests(waves);
 * console.log(`Time saved: ${result.stats.timeSaved}s`);
 */
export class TestOptimizer {
  private options: Required<OptimizerOptions>;

  public constructor(options: OptimizerOptions = {}) {
    this.options = {
      alwaysRunAllTests: options.alwaysRunAllTests ?? false,
      minCoverageRequired: options.minCoverageRequired ?? 75,
      includeRelatedTests: options.includeRelatedTests ?? false,
    };

    logger.debug('Initialized TestOptimizer', {
      alwaysRunAllTests: this.options.alwaysRunAllTests,
      minCoverageRequired: this.options.minCoverageRequired,
    });
  }

  /**
   * @ac US-040-AC-1: Identify waves with Apex/Trigger changes
   * @ac US-040-AC-2: Include tests only in waves with code
   * @ac US-040-AC-3: Sync test classes with production classes
   */
  public optimizeTests(waves: Wave[]): TestOptimizationResult {
    const startTime = Date.now();
    const planningState = this.createOptimizationPlanningState(waves);
    const optimizedWaves = planningState.waveContexts.map((context, index) =>
      this.createOptimizedWave(context, planningState.wavePlans[index])
    );
    const decisions = collectOptimizationDecisions(planningState.wavePlans);
    const stats = calculateStats(optimizedWaves, planningState.allTestClasses.length);

    const duration = Date.now() - startTime;
    logger.info('Test optimization completed', {
      totalWaves: stats.totalWaves,
      wavesWithTests: stats.wavesWithTests,
      testsAdded: stats.totalTestsAdded,
      timeSaved: stats.timeSaved,
      durationMs: duration,
    });

    return {
      originalWaves: waves,
      optimizedWaves,
      decisions,
      stats,
    };
  }

  private getPolicy(): OptimizerPolicy {
    return {
      alwaysRunAllTests: this.options.alwaysRunAllTests,
      minCoverageRequired: this.options.minCoverageRequired,
      includeRelatedTests: this.options.includeRelatedTests,
    };
  }

  private createOptimizationPlanningState(waves: Wave[]): OptimizationPlanningState {
    const policy = this.getPolicy();
    const allTestClasses = collectAllTestClasses(waves);
    const waveContexts = waves.map((wave) => analyzeWave(wave));
    const wavePlans = waveContexts.map((context) => this.createWaveTestPlan(context, allTestClasses, policy));

    return {
      allTestClasses,
      waveContexts,
      wavePlans,
    };
  }

  private createWaveTestPlan(
    context: WaveTestContext,
    allTestClasses: NodeId[],
    policy: OptimizerPolicy
  ): WaveTestPlan {
    if (policy.alwaysRunAllTests) {
      return {
        testClasses: allTestClasses,
        estimatedCoverage: 100,
        decision: {
          waveNumber: context.waveNumber,
          type: 'include-tests',
          reason: 'alwaysRunAllTests option enabled',
          testsAffected: allTestClasses.length,
        },
      };
    }

    if (!context.needsTests) {
      return {
        testClasses: [],
        estimatedCoverage: 100,
        decision: {
          waveNumber: context.waveNumber,
          type: 'skip-tests',
          reason: 'No Apex classes or triggers in wave',
          testsAffected: 0,
        },
      };
    }

    const testClasses = matchTestClasses(context, allTestClasses, policy);
    return {
      testClasses,
      estimatedCoverage: scoreEstimatedCoverage(context, testClasses),
      decision: {
        waveNumber: context.waveNumber,
        type: 'sync-tests',
        reason: `Matched ${testClasses.length} tests to ${context.codeClasses.length} classes`,
        testsAffected: testClasses.length,
      },
    };
  }

  private createOptimizedWave(context: WaveTestContext, plan: WaveTestPlan): OptimizedWave {
    return {
      number: context.waveNumber,
      components: context.waveComponents,
      metadata: context.waveMetadata,
      testClasses: plan.testClasses,
      codeClasses: context.codeClasses,
      triggers: context.triggers,
      needsTests: context.needsTests,
      estimatedCoverage: plan.estimatedCoverage,
    };
  }

  /**
   * @ac US-040-AC-6: Report test optimization savings
   */
  public generateReport(result: TestOptimizationResult): string {
    const lines: string[] = [];

    this.appendStatisticsSection(lines, result);
    this.appendDecisionsSection(lines, result.decisions);
    this.appendWaveDetailsSection(lines, result.optimizedWaves);

    return lines.join('\n');
  }

  private appendStatisticsSection(lines: string[], result: TestOptimizationResult): void {
    lines.push('# Test Optimization Report');
    lines.push('');
    lines.push('## Statistics');
    lines.push(`- Total Waves: ${result.stats.totalWaves}`);
    lines.push(`- Waves with Tests: ${result.stats.wavesWithTests}`);
    lines.push(`- Waves without Tests: ${result.stats.wavesWithoutTests}`);
    lines.push(`- Total Test Classes Added: ${result.stats.totalTestsAdded}`);
    lines.push(`- Estimated Time Saved: ${result.stats.timeSaved}s (${Math.round(result.stats.timeSaved / 60)}min)`);
    lines.push('');
  }

  private appendDecisionsSection(lines: string[], decisions: readonly OptimizationDecision[]): void {
    lines.push('## Optimization Decisions');
    lines.push('');

    for (const decision of decisions) {
      lines.push(`### Wave ${decision.waveNumber}`);
      lines.push(`- Type: ${decision.type}`);
      lines.push(`- Reason: ${decision.reason}`);
      lines.push(`- Tests Affected: ${decision.testsAffected}`);
      lines.push('');
    }
  }

  private appendWaveDetailsSection(lines: string[], optimizedWaves: readonly OptimizedWave[]): void {
    lines.push('## Wave Details');
    lines.push('');

    for (const wave of optimizedWaves) {
      lines.push(`### Wave ${wave.number}`);
      lines.push(`- Code Classes: ${wave.codeClasses.length}`);
      lines.push(`- Triggers: ${wave.triggers.length}`);
      lines.push(`- Test Classes: ${wave.testClasses.length}`);
      lines.push(`- Needs Tests: ${wave.needsTests ? 'Yes' : 'No'}`);
      lines.push(`- Estimated Coverage: ${wave.estimatedCoverage}%`);
      lines.push('');
    }
  }

  /**
   * Get waves that need test execution
   */
  public getWavesNeedingTests(result: TestOptimizationResult): OptimizedWave[] {
    return result.optimizedWaves.filter((w) => w.needsTests);
  }

  /**
   * Get total test count across all waves
   */
  public getTotalTestCount(result: TestOptimizationResult): number {
    return result.optimizedWaves.reduce((sum, wave) => sum + wave.testClasses.length, 0);
  }
}
