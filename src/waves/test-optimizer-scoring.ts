import type { NodeId } from '../types/dependency.js';
import type { OptimizationStats, OptimizedWave, WaveTestContext, WaveTestPlan } from './test-optimizer-model.js';

/**
 * @ac US-040-AC-5: Calculate test coverage per wave
 */
export function scoreEstimatedCoverage(context: WaveTestContext, testClasses: readonly NodeId[]): number {
  const codeClassCount = context.codeClasses.length;
  const testClassCount = testClasses.length;

  if (codeClassCount === 0) return 100;
  if (testClassCount === 0) return 0;

  const coverage = Math.min(100, (testClassCount / codeClassCount) * 75);
  return Math.round(coverage);
}

export function collectOptimizationDecisions(wavePlans: readonly WaveTestPlan[]): Array<WaveTestPlan['decision']> {
  return wavePlans.map((plan) => plan.decision);
}

function collectWaveTestTotals(optimizedWaves: readonly OptimizedWave[]): {
  wavesWithTests: number;
  wavesWithoutTests: number;
  totalTestsAdded: number;
} {
  let wavesWithTests = 0;
  let wavesWithoutTests = 0;
  let totalTestsAdded = 0;

  for (const wave of optimizedWaves) {
    if (wave.testClasses.length > 0) {
      wavesWithTests++;
      totalTestsAdded += wave.testClasses.length;
      continue;
    }

    wavesWithoutTests++;
  }

  return {
    wavesWithTests,
    wavesWithoutTests,
    totalTestsAdded,
  };
}

function calculateTimeSaved(totalWaves: number, totalAvailableTests: number, totalTestsAdded: number): number {
  const testsSkipped = totalWaves * totalAvailableTests - totalTestsAdded;
  return testsSkipped * 5;
}

/**
 * Calculate optimization statistics
 */
export function calculateStats(
  optimizedWaves: readonly OptimizedWave[],
  totalAvailableTests: number
): OptimizationStats {
  const totals = collectWaveTestTotals(optimizedWaves);
  const timeSaved = calculateTimeSaved(optimizedWaves.length, totalAvailableTests, totals.totalTestsAdded);

  return {
    totalWaves: optimizedWaves.length,
    wavesWithTests: totals.wavesWithTests,
    wavesWithoutTests: totals.wavesWithoutTests,
    totalTestsAdded: totals.totalTestsAdded,
    timeSaved,
  };
}
