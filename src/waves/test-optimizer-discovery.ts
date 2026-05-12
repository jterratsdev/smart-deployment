import type { NodeId } from '../types/dependency.js';
import type { Wave } from './wave-builder.js';
import type { WaveTestContext } from './test-optimizer-model.js';

/**
 * Check if component is a test class
 */
export function isTestClass(component: NodeId): boolean {
  return (
    component.startsWith('ApexClass:') &&
    (component.toLowerCase().includes('test') || component.toLowerCase().endsWith('_test'))
  );
}

/**
 * Collect all test classes from all waves
 */
export function collectAllTestClasses(waves: readonly Wave[]): NodeId[] {
  const testClasses = new Set<NodeId>();

  for (const wave of waves) {
    for (const component of wave.components) {
      if (isTestClass(component)) {
        testClasses.add(component);
      }
    }
  }

  return Array.from(testClasses);
}

/**
 * Get code classes (non-test Apex classes)
 */
function getCodeClasses(wave: Wave): NodeId[] {
  return wave.components.filter((component) => component.startsWith('ApexClass:') && !isTestClass(component));
}

/**
 * @ac US-040-AC-4: Ensure trigger tests are included
 */
function getTriggers(wave: Wave): NodeId[] {
  return wave.components.filter((component) => component.startsWith('ApexTrigger:'));
}

export function analyzeWave(wave: Wave): WaveTestContext {
  const codeClasses = getCodeClasses(wave);
  const triggers = getTriggers(wave);

  return {
    waveNumber: wave.number,
    waveComponents: wave.components,
    waveMetadata: wave.metadata,
    codeClasses,
    triggers,
    needsTests: codeClasses.length > 0 || triggers.length > 0,
  };
}
