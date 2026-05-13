import type { WaveValidationIssue, WaveValidationResult } from './wave-validation-service.js';

export function formatWaveValidationReport(result: WaveValidationResult): string {
  const lines: string[] = [];

  lines.push('🔍 AI Wave Validation Report');
  lines.push('═══════════════════════════════════════');

  if (!result.aiAnalyzed) {
    lines.push('⚠️  AI validation unavailable (using basic checks)');
    lines.push('');
  }

  lines.push(`Overall Risk: ${getRiskIcon(result.overallRisk)} ${result.overallRisk.toUpperCase()}`);
  lines.push(`Execution Time: ${result.executionTime}ms`);
  lines.push('');

  appendIssueSection(lines, result);
  appendOptimizationSection(lines, result);
  appendRiskAssessmentSection(lines, result);

  return lines.join('\n');
}

function appendIssueSection(lines: string[], result: WaveValidationResult): void {
  if (result.issues.length === 0) {
    lines.push('✅ No critical issues found');
    lines.push('');
    return;
  }

  lines.push(`❌ Issues Found: ${result.issues.length}`);
  lines.push('');

  const bySeverity = groupIssuesBySeverity(result.issues);
  for (const [severity, issues] of bySeverity.entries()) {
    lines.push(`${getSeverityIcon(severity)} ${severity.toUpperCase()} (${issues.length}):`);
    for (const issue of issues.slice(0, 5)) {
      lines.push(`   Wave ${issue.waveNumber}: ${issue.message}`);
      if (issue.suggestion) {
        lines.push(`   💡 ${issue.suggestion}`);
      }
    }
    if (issues.length > 5) {
      lines.push(`   ... and ${issues.length - 5} more`);
    }
    lines.push('');
  }
}

function groupIssuesBySeverity(issues: WaveValidationIssue[]): Map<string, WaveValidationIssue[]> {
  const bySeverity = new Map<string, WaveValidationIssue[]>();

  for (const issue of issues) {
    const currentIssues = bySeverity.get(issue.severity) ?? [];
    currentIssues.push(issue);
    bySeverity.set(issue.severity, currentIssues);
  }

  return bySeverity;
}

function appendOptimizationSection(lines: string[], result: WaveValidationResult): void {
  if (result.optimizations.length === 0) {
    return;
  }

  lines.push(`💡 Optimization Suggestions: ${result.optimizations.length}`);
  lines.push('');

  for (const opt of result.optimizations.slice(0, 5)) {
    lines.push(`   Wave ${opt.waveNumber}: ${opt.type.toUpperCase()}`);
    lines.push(`   ${opt.description}`);
    lines.push(`   Confidence: ${(opt.confidence * 100).toFixed(0)}%`);
    lines.push(`   Impact: ${opt.estimatedImprovement}`);
    lines.push('');
  }
}

function appendRiskAssessmentSection(lines: string[], result: WaveValidationResult): void {
  if (result.riskAssessments.length === 0) {
    return;
  }

  lines.push('📊 Risk Assessment by Wave:');
  lines.push('');

  for (const assessment of result.riskAssessments) {
    lines.push(
      `   Wave ${assessment.waveNumber}: ${getRiskIcon(assessment.riskLevel)} ${assessment.riskLevel.toUpperCase()}`
    );

    if (assessment.riskFactors.length > 0) {
      lines.push(`   Factors: ${assessment.riskFactors.join(', ')}`);
    }

    if (assessment.mitigation.length > 0) {
      lines.push(`   Mitigation: ${assessment.mitigation.join(', ')}`);
    }
  }
}

function getRiskIcon(risk: string): string {
  switch (risk) {
    case 'critical':
      return '🔴';
    case 'high':
      return '🟠';
    case 'medium':
      return '🟡';
    case 'low':
      return '🟢';
    default:
      return '⚪';
  }
}

function getSeverityIcon(severity: string): string {
  return getRiskIcon(severity);
}
