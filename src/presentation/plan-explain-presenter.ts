import type { PlanExplainResult } from '../deployment/plan-explain-service.js';

export type PlanExplainPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class PlanExplainPresenter {
  public report(io: PlanExplainPresenterIO, result: PlanExplainResult): void {
    io.log(this.formatSummary(result));

    if (result.unresolvedReferences.length > 0) {
      io.warn(`Plan contains ${result.unresolvedReferences.length} unresolved reference(s).`);
    }
  }

  public formatSummary(result: PlanExplainResult): string {
    const lines = [
      'Plan Explain:',
      `Components: ${result.summary.componentCount}`,
      `Dependencies: ${result.summary.dependencyCount}`,
      `Unresolved References: ${result.summary.unresolvedReferenceCount}`,
      `Provider Decisions: ${result.summary.providerDecisionCount}`,
      `Waves: ${result.summary.waves}`,
    ];

    if (result.ai?.enabled) {
      lines.push(`AI Provider: ${result.ai.provider ?? 'unknown'}`);
      if (result.ai.model) {
        lines.push(`AI Model: ${result.ai.model}`);
      }
    }

    if (result.components.length > 0) {
      lines.push('');
      lines.push('Wave Placement:');
      for (const component of result.components) {
        lines.push(`- ${component.nodeId}: ${component.placement.rationale}`);
      }
    }

    if (result.providerDecisions.length > 0) {
      lines.push('');
      lines.push('Provider Decisions:');
      for (const decision of result.providerDecisions) {
        lines.push(`- ${decision.kind}: ${decision.decision} (${decision.reason || 'No action required.'})`);
      }
    }

    return lines.join('\n');
  }
}
