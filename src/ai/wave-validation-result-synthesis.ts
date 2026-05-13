import type { WaveRiskAssessment, WaveValidationResult } from './wave-validation-service.js';
import type { WaveValidationPayload } from './wave-validation-response-parser.js';

export function createDefaultWaveValidationResult(): WaveValidationResult {
  return {
    isValid: true,
    issues: [],
    optimizations: [],
    riskAssessments: [],
    overallRisk: 'low',
    executionTime: 0,
    aiAnalyzed: false,
  };
}

export function applyValidationPayload(
  result: WaveValidationResult,
  validation: WaveValidationPayload
): WaveValidationResult {
  return {
    ...result,
    issues: validation.issues,
    optimizations: validation.optimizations,
    riskAssessments: validation.riskAssessments,
    overallRisk: calculateOverallRisk(validation.riskAssessments),
    isValid: !validation.issues.some((issue) => issue.severity === 'critical'),
  };
}

export function completeAIAnalysis(result: WaveValidationResult, executionTime: number): WaveValidationResult {
  return {
    ...result,
    aiAnalyzed: true,
    executionTime,
  };
}

export function completeValidationFailure(result: WaveValidationResult, executionTime: number): WaveValidationResult {
  return {
    ...result,
    executionTime,
  };
}

function calculateOverallRisk(assessments: WaveRiskAssessment[]): 'low' | 'medium' | 'high' | 'critical' {
  if (assessments.length === 0) {
    return 'low';
  }

  const riskScores = { low: 1, medium: 2, high: 3, critical: 4 };
  const maxRisk = Math.max(...assessments.map((assessment) => riskScores[assessment.riskLevel]));

  if (maxRisk >= 4) return 'critical';
  if (maxRisk >= 3) return 'high';
  if (maxRisk >= 2) return 'medium';
  return 'low';
}
