export const RELEASE_REPORT_SCHEMA_VERSION = '1.0' as const;

export const RELEASE_ANALYSIS_MODES = ['deterministic', 'ai_enriched'] as const;
export const RELEASE_ENRICHMENT_STATUSES = ['available', 'unavailable', 'partial', 'skipped'] as const;
export const RELEASE_OUTCOMES = ['succeeded', 'failed', 'partial', 'skipped'] as const;
export const RELEASE_OPERATIONS = ['deploy', 'publish', 'activate', 'validate'] as const;
export const RELEASE_STATUSES = ['succeeded', 'failed', 'skipped', 'needs_review'] as const;
export const RELEASE_PHASE_IDS = [
  'core-metadata',
  'agentforce-publish',
  'agentforce-activate',
  'ai-evaluations',
  'community-publish',
  'omnistudio-vlocity',
  'validation',
] as const;
export const RELEASE_ROUTES = [
  'salesforce-metadata',
  'agentforce',
  'ai-evaluation',
  'experience-cloud',
  'omnistudio',
  'validation',
] as const;
export const RELEASE_EVIDENCE_TOOLS = ['sf', 'vlocity', 'smart-deployment'] as const;

export type ReleaseAnalysisMode = (typeof RELEASE_ANALYSIS_MODES)[number];
export type ReleaseEnrichmentStatus = (typeof RELEASE_ENRICHMENT_STATUSES)[number];
export type ReleaseOutcome = (typeof RELEASE_OUTCOMES)[number];
export type ReleaseOperation = (typeof RELEASE_OPERATIONS)[number];
export type ReleaseStatus = (typeof RELEASE_STATUSES)[number];
export type ReleasePhaseId = (typeof RELEASE_PHASE_IDS)[number];
export type ReleaseRoute = (typeof RELEASE_ROUTES)[number];
export type ReleaseEvidenceTool = (typeof RELEASE_EVIDENCE_TOOLS)[number];

export const RELEASE_PHASE_ORDER: Readonly<Record<ReleasePhaseId, number>> = {
  'core-metadata': 0,
  'agentforce-publish': 1,
  'agentforce-activate': 2,
  'ai-evaluations': 3,
  'community-publish': 4,
  'omnistudio-vlocity': 5,
  validation: 6,
};

export const RELEASE_ROUTE_ORDER: Readonly<Record<ReleaseRoute, number>> = {
  'salesforce-metadata': 0,
  agentforce: 1,
  'ai-evaluation': 2,
  'experience-cloud': 3,
  omnistudio: 4,
  validation: 5,
};

export type ReleaseCommandEvidenceV1 = {
  tool: ReleaseEvidenceTool;
  operationId: string;
  exitCode?: number;
  deploymentId?: string;
  artifact?: string;
};

export type ReleaseEnrichmentV1 = {
  status: ReleaseEnrichmentStatus;
  warnings?: string[];
};

export type ReleasePhaseV1 = {
  id: ReleasePhaseId;
  route: ReleaseRoute;
  operation: ReleaseOperation;
  status: ReleaseStatus;
  evidence?: ReleaseCommandEvidenceV1[];
  remediation?: string[];
};

export type ReleaseItemV1 = {
  phaseId: ReleasePhaseId;
  metadataType: string;
  fullName: string;
  route: ReleaseRoute;
  operation: ReleaseOperation;
  status: ReleaseStatus;
  targetOrg?: string;
  evidenceReferences?: string[];
  remediation?: string[];
};

export type ReleaseSummaryV1 = {
  total: number;
  succeeded: number;
  failed: number;
  skipped: number;
  needsReview: number;
};

export type ReleaseReportV1 = {
  schemaVersion: typeof RELEASE_REPORT_SCHEMA_VERSION;
  generatedAt: string;
  command: string;
  targetOrg?: string;
  analysisMode: ReleaseAnalysisMode;
  enrichment: ReleaseEnrichmentV1;
  outcome: ReleaseOutcome;
  summary: ReleaseSummaryV1;
  phases: ReleasePhaseV1[];
  items: ReleaseItemV1[];
  reportWarnings: string[];
};

export type ReleaseReportFacts = {
  command: string;
  targetOrg?: string;
  analysisMode: ReleaseAnalysisMode;
  enrichment: ReleaseEnrichmentV1;
  outcome: ReleaseOutcome;
  phases: ReleasePhaseFact[];
  items: ReleaseItemFact[];
  reportWarnings?: string[];
};

export type ReleaseFactStatus = ReleaseStatus | 'unknown' | 'inapplicable';

export type ReleasePhaseFact = Omit<ReleasePhaseV1, 'status'> & {
  status: ReleaseFactStatus;
};

export type ReleaseItemFact = Omit<ReleaseItemV1, 'status'> & {
  status: ReleaseFactStatus;
};

export type ReleaseReportClock = {
  now: () => Date;
};
