import { getLogger } from '../utils/logger.js';
import type { Wave } from '../waves/wave-builder.js';
import type { WaveOptimization, WaveRiskAssessment, WaveValidationIssue } from './wave-validation-service.js';

const logger = getLogger('WaveValidationResponseParser');

export type WaveValidationPayload = {
  issues: WaveValidationIssue[];
  optimizations: WaveOptimization[];
  riskAssessments: WaveRiskAssessment[];
};

type ParsedValidationEnvelope = {
  issues?: unknown[];
  optimizations?: unknown[];
  riskAssessments?: unknown[];
};

export function parseWaveValidationResponse(content: string, waves: Wave[]): WaveValidationPayload {
  try {
    const parsed = extractValidationJson(content);
    if (!parsed) {
      return createFallbackValidation(waves, 'No JSON found in validation response');
    }

    return normalizeValidationPayload(parsed);
  } catch (error) {
    logger.error('Failed to parse validation response', {
      error: error instanceof Error ? error.message : String(error),
    });

    return createFallbackValidation(waves);
  }
}

function extractValidationJson(content: string): ParsedValidationEnvelope | null {
  const jsonMatch = /\{[\s\S]*\}/.exec(content);
  if (!jsonMatch) {
    return null;
  }

  return JSON.parse(jsonMatch[0]) as ParsedValidationEnvelope;
}

function normalizeValidationPayload(parsed: ParsedValidationEnvelope): WaveValidationPayload {
  return {
    issues: parseIssues(parsed.issues ?? []),
    optimizations: parseOptimizations(parsed.optimizations ?? []),
    riskAssessments: parseRiskAssessments(parsed.riskAssessments ?? []),
  };
}

function createFallbackValidation(waves: Wave[], reason?: string): WaveValidationPayload {
  if (reason) {
    logger.warn(reason);
  }

  return {
    issues: [],
    optimizations: [],
    riskAssessments: waves.map(createFallbackRiskAssessment),
  };
}

function createFallbackRiskAssessment(wave: Wave): WaveRiskAssessment {
  const isLargeWave = wave.metadata.componentCount > 200;

  return {
    waveNumber: wave.number,
    riskLevel: isLargeWave ? 'high' : 'low',
    riskFactors: isLargeWave ? ['Large wave size'] : [],
    mitigation: isLargeWave ? ['Consider splitting wave'] : [],
    recommendedActions: [],
  };
}

function parseIssues(items: unknown[]): WaveValidationIssue[] {
  const issues: WaveValidationIssue[] = [];

  for (const item of items) {
    if (isIssueLike(item)) {
      issues.push({
        waveNumber: Number(item.waveNumber),
        severity: String(item.severity) as WaveValidationIssue['severity'],
        category: String(item.category) as WaveValidationIssue['category'],
        message: String(item.message),
        affectedComponents: Array.isArray(item.affectedComponents) ? item.affectedComponents.map(String) : [],
        suggestion: item.suggestion ? String(item.suggestion) : undefined,
      });
    }
  }

  return issues;
}

function parseOptimizations(items: unknown[]): WaveOptimization[] {
  const optimizations: WaveOptimization[] = [];

  for (const item of items) {
    if (isOptimizationLike(item)) {
      optimizations.push({
        waveNumber: Number(item.waveNumber),
        type: String(item.type) as WaveOptimization['type'],
        description: String(item.description),
        confidence: Number(item.confidence) || 0.5,
        estimatedImprovement: String(item.estimatedImprovement) || 'Unknown',
      });
    }
  }

  return optimizations;
}

function parseRiskAssessments(items: unknown[]): WaveRiskAssessment[] {
  const assessments: WaveRiskAssessment[] = [];

  for (const item of items) {
    if (isRiskAssessmentLike(item)) {
      assessments.push({
        waveNumber: Number(item.waveNumber),
        riskLevel: String(item.riskLevel) as WaveRiskAssessment['riskLevel'],
        riskFactors: Array.isArray(item.riskFactors) ? item.riskFactors.map(String) : [],
        mitigation: Array.isArray(item.mitigation) ? item.mitigation.map(String) : [],
        recommendedActions: Array.isArray(item.recommendedActions) ? item.recommendedActions.map(String) : [],
      });
    }
  }

  return assessments;
}

function isIssueLike(item: unknown): item is Record<string, unknown> {
  return (
    typeof item === 'object' &&
    item !== null &&
    'waveNumber' in item &&
    'severity' in item &&
    'category' in item &&
    'message' in item
  );
}

function isOptimizationLike(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && 'waveNumber' in item && 'type' in item && 'description' in item;
}

function isRiskAssessmentLike(item: unknown): item is Record<string, unknown> {
  return typeof item === 'object' && item !== null && 'waveNumber' in item && 'riskLevel' in item;
}
