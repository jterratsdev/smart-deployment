import type { NodeId } from '../types/dependency.js';
import type { ComponentImpact, ImpactLevel } from './dependency-impact-analyzer.js';

export function calculateRiskScore(directDependents: number, totalAffected: number, criticalThreshold: number): number {
  const directScore = Math.min((directDependents / criticalThreshold) * 40, 40);
  const totalScore = Math.min((totalAffected / (criticalThreshold * 3)) * 60, 60);

  return Math.round(directScore + totalScore);
}

export function getImpactLevel(riskScore: number): ImpactLevel {
  if (riskScore >= 80) return 'critical';
  if (riskScore >= 60) return 'high';
  if (riskScore >= 40) return 'medium';
  if (riskScore >= 20) return 'low';
  return 'minimal';
}

export function calculateOverallImpactLevel(impacts: ReadonlyMap<NodeId, ComponentImpact>): ImpactLevel {
  let maxScore = 0;

  for (const impact of impacts.values()) {
    maxScore = Math.max(maxScore, impact.riskScore);
  }

  return getImpactLevel(maxScore);
}
