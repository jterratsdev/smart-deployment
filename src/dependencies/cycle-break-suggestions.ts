import type { NodeId } from '../types/dependency.js';
import type { CycleBreakSuggestion } from './circular-dependency-detector.js';

export function generateBreakSuggestions(cycle: NodeId[], closingNode: NodeId): CycleBreakSuggestion[] {
  const fullCycle = [...cycle, closingNode];
  const suggestions: CycleBreakSuggestion[] = [];

  for (let index = 0; index < fullCycle.length - 1; index++) {
    const from = fullCycle[index];
    const to = fullCycle[index + 1];
    const priority = calculateBreakPriority(from, to);

    suggestions.push({
      from,
      to,
      reason: getBreakReason(from, to, priority),
      priority,
    });
  }

  return suggestions.sort((a, b) => b.priority - a.priority);
}

function calculateBreakPriority(from: NodeId, to: NodeId): number {
  let priority = 50;

  if (from.includes('Test') || to.includes('Test')) {
    priority += 30;
  }

  if (isUtilityClass(from) || isUtilityClass(to)) {
    priority += 20;
  }

  if (from.includes('Handler') && to.includes('Service')) {
    priority += 15;
  }

  if (from.includes('Controller') && to.includes('Service')) {
    priority += 15;
  }

  if (from.includes('Trigger') && to.includes('Handler')) {
    priority -= 20;
  }

  if (isCoreDomainClass(from) && isCoreDomainClass(to)) {
    priority -= 15;
  }

  return Math.max(0, Math.min(100, priority));
}

function getBreakReason(from: NodeId, to: NodeId, priority: number): string {
  if (priority >= 80) {
    return `High priority: ${from} → ${to} is a test or utility dependency`;
  } else if (priority >= 65) {
    return `Medium priority: ${from} → ${to} can be broken safely`;
  } else if (priority >= 50) {
    return `Low priority: ${from} → ${to} may be tightly coupled`;
  }

  return `Not recommended: ${from} → ${to} appears to be core business logic`;
}

function isUtilityClass(nodeId: NodeId): boolean {
  const name = nodeId.toLowerCase();
  return name.includes('util') || name.includes('helper') || name.includes('constant') || name.includes('logger');
}

function isCoreDomainClass(nodeId: NodeId): boolean {
  const name = nodeId.toLowerCase();
  return (
    !name.includes('test') &&
    !name.includes('handler') &&
    !name.includes('controller') &&
    !name.includes('util') &&
    !name.includes('helper')
  );
}
