import type { NodeId } from '../types/dependency.js';
import type { OptimizerPolicy, WaveTestContext } from './test-optimizer-model.js';

function getComponentName(component: NodeId): string {
  return component.split(':')[1];
}

function matchesCodeClass(testClass: NodeId, codeClass: NodeId): boolean {
  const testName = getComponentName(testClass).toLowerCase();
  const codeName = getComponentName(codeClass).toLowerCase();

  return testName.includes(codeName) || codeName.includes(testName.replace('test', ''));
}

function matchesTrigger(testClass: NodeId, trigger: NodeId): boolean {
  const testName = getComponentName(testClass).toLowerCase();
  const triggerName = getComponentName(trigger).toLowerCase();

  return testName.includes(triggerName) || testName.includes('trigger');
}

function addRelatedTestSubset(matchedTests: Set<NodeId>, allTestClasses: readonly NodeId[]): void {
  for (let index = 0; index < Math.min(10, allTestClasses.length); index++) {
    matchedTests.add(allTestClasses[index]);
  }
}

/**
 * Sync test classes with production classes
 */
export function matchTestClasses(
  context: WaveTestContext,
  allTestClasses: readonly NodeId[],
  policy: OptimizerPolicy
): NodeId[] {
  const matchedTests = new Set<NodeId>();

  for (const codeClass of context.codeClasses) {
    for (const testClass of allTestClasses) {
      if (matchesCodeClass(testClass, codeClass)) {
        matchedTests.add(testClass);
      }
    }
  }

  for (const trigger of context.triggers) {
    for (const testClass of allTestClasses) {
      if (matchesTrigger(testClass, trigger)) {
        matchedTests.add(testClass);
      }
    }
  }

  if (matchedTests.size === 0 && policy.includeRelatedTests) {
    addRelatedTestSubset(matchedTests, allTestClasses);
  }

  return Array.from(matchedTests);
}
