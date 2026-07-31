import {
  RELEASE_PHASE_ORDER,
  RELEASE_REPORT_SCHEMA_VERSION,
  RELEASE_ROUTE_ORDER,
  type ReleaseCommandEvidenceV1,
  type ReleaseFactStatus,
  type ReleaseItemFact,
  type ReleaseItemV1,
  type ReleasePhaseFact,
  type ReleasePhaseV1,
  type ReleaseReportClock,
  type ReleaseReportFacts,
  type ReleaseReportV1,
  type ReleaseStatus,
} from '../types/release-report.js';

const SYSTEM_CLOCK: ReleaseReportClock = {
  now: () => new Date(),
};

export class ReleaseReportBuilder {
  public constructor(private readonly clock: ReleaseReportClock = SYSTEM_CLOCK) {}

  public build(facts: ReleaseReportFacts): ReleaseReportV1 {
    const phases = facts.phases.map(toPhase).sort(comparePhases);
    const items = facts.items.map(toItem).sort(compareItems);

    return {
      schemaVersion: RELEASE_REPORT_SCHEMA_VERSION,
      generatedAt: this.clock.now().toISOString(),
      command: facts.command,
      targetOrg: facts.targetOrg,
      analysisMode: facts.analysisMode,
      enrichment: {
        status: facts.enrichment.status,
        warnings: sortedUnique(facts.enrichment.warnings),
      },
      outcome: facts.outcome,
      summary: summarize(items),
      phases,
      items,
      reportWarnings: sortedUnique(facts.reportWarnings) ?? [],
    };
  }
}

function toPhase(phase: ReleasePhaseFact): ReleasePhaseV1 {
  return {
    ...phase,
    status: normalizeStatus(phase.status),
    evidence: sortEvidence(phase.evidence),
    remediation: sortedUnique(phase.remediation),
  };
}

function toItem(item: ReleaseItemFact): ReleaseItemV1 {
  return {
    ...item,
    status: normalizeStatus(item.status),
    evidenceReferences: sortedUnique(item.evidenceReferences),
    remediation: sortedUnique(item.remediation),
  };
}

function normalizeStatus(status: ReleaseFactStatus): ReleaseStatus {
  if (status === 'unknown') return 'needs_review';
  if (status === 'inapplicable') return 'skipped';
  return status;
}

function comparePhases(left: ReleasePhaseV1, right: ReleasePhaseV1): number {
  return (
    RELEASE_PHASE_ORDER[left.id] - RELEASE_PHASE_ORDER[right.id] ||
    RELEASE_ROUTE_ORDER[left.route] - RELEASE_ROUTE_ORDER[right.route] ||
    lexicalCompare(left.operation, right.operation)
  );
}

function compareItems(left: ReleaseItemV1, right: ReleaseItemV1): number {
  return (
    RELEASE_PHASE_ORDER[left.phaseId] - RELEASE_PHASE_ORDER[right.phaseId] ||
    RELEASE_ROUTE_ORDER[left.route] - RELEASE_ROUTE_ORDER[right.route] ||
    lexicalCompare(left.metadataType, right.metadataType) ||
    lexicalCompare(left.fullName, right.fullName) ||
    lexicalCompare(left.targetOrg ?? '', right.targetOrg ?? '')
  );
}

function sortEvidence(evidence: ReleaseCommandEvidenceV1[] | undefined): ReleaseCommandEvidenceV1[] | undefined {
  if (!evidence) return undefined;

  const byKey = new Map<string, ReleaseCommandEvidenceV1>();
  for (const entry of evidence) {
    const copy = { ...entry };
    byKey.set(JSON.stringify(copy), copy);
  }

  return [...byKey.values()].sort(
    (left, right) =>
      lexicalCompare(left.tool, right.tool) ||
      lexicalCompare(left.operationId, right.operationId) ||
      lexicalCompare(left.deploymentId ?? '', right.deploymentId ?? '') ||
      lexicalCompare(left.artifact ?? '', right.artifact ?? '') ||
      (left.exitCode ?? -1) - (right.exitCode ?? -1)
  );
}

function summarize(items: ReleaseItemV1[]): ReleaseReportV1['summary'] {
  let succeeded = 0;
  let failed = 0;
  let skipped = 0;
  let needsReview = 0;

  for (const item of items) {
    if (item.status === 'succeeded') succeeded += 1;
    else if (item.status === 'failed') failed += 1;
    else if (item.status === 'skipped') skipped += 1;
    else needsReview += 1;
  }

  return {
    total: items.length,
    succeeded,
    failed,
    skipped,
    needsReview,
  };
}

function sortedUnique(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  return [...new Set(values)].sort(lexicalCompare);
}

function lexicalCompare(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}
