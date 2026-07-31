import * as path from 'node:path';
import type {
  ReleaseCommandEvidenceV1,
  ReleaseItemV1,
  ReleasePhaseV1,
  ReleaseReportV1,
} from '../types/release-report.js';

const ANSI_SEQUENCE = new RegExp(
  `${String.fromCharCode(27)}(?:\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(7)}|${String.fromCharCode(
    27
  )}\\\\)|\\[[0-?]*[ -/]*[@-~])`,
  'gu'
);
const CONTROL_CHARACTER = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}${String.fromCharCode(
    12
  )}${String.fromCharCode(14)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
  'gu'
);
const AUTH_URL = /\b(?:force|sfdx):\/\/[^\s]+/giu;
const BEARER_TOKEN = /\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu;
const CREDENTIAL_ASSIGNMENT =
  /\b(access[_-]?token|auth(?:orization)?|client[_-]?secret|password|refresh[_-]?token|secret|token)\s*[:=]\s*[^\s,;]+/giu;

export type ReleaseReportSanitizerOptions = {
  projectRoot?: string;
};

export function sanitizeReleaseReport(
  report: ReleaseReportV1,
  options: ReleaseReportSanitizerOptions = {}
): ReleaseReportV1 {
  return {
    schemaVersion: report.schemaVersion,
    generatedAt: report.generatedAt,
    command: sanitizeText(report.command, 128),
    targetOrg: optionalText(report.targetOrg, 256),
    analysisMode: report.analysisMode,
    enrichment: {
      status: report.enrichment.status,
      warnings: sanitizeList(report.enrichment.warnings, 1000),
    },
    outcome: report.outcome,
    summary: { ...report.summary },
    phases: report.phases.map((phase) => sanitizePhase(phase, options)),
    items: report.items.map((item) => sanitizeItem(item, options)),
    reportWarnings: sanitizeList(report.reportWarnings, 1000) ?? [],
  };
}

function sanitizePhase(phase: ReleasePhaseV1, options: ReleaseReportSanitizerOptions): ReleasePhaseV1 {
  return {
    id: phase.id,
    route: phase.route,
    operation: phase.operation,
    status: phase.status,
    evidence: phase.evidence?.map((entry) => sanitizeEvidence(entry, options)),
    remediation: sanitizeList(phase.remediation, 1000),
  };
}

function sanitizeItem(item: ReleaseItemV1, options: ReleaseReportSanitizerOptions): ReleaseItemV1 {
  return {
    phaseId: item.phaseId,
    metadataType: sanitizeText(item.metadataType, 256),
    fullName: sanitizeText(item.fullName, 512),
    route: item.route,
    operation: item.operation,
    status: item.status,
    targetOrg: optionalText(item.targetOrg, 256),
    evidenceReferences: sanitizeReferences(item.evidenceReferences, options.projectRoot),
    remediation: sanitizeList(item.remediation, 1000),
  };
}

function sanitizeEvidence(
  evidence: ReleaseCommandEvidenceV1,
  options: ReleaseReportSanitizerOptions
): ReleaseCommandEvidenceV1 {
  return {
    tool: evidence.tool,
    operationId: sanitizeText(evidence.operationId, 256),
    exitCode: Number.isSafeInteger(evidence.exitCode) ? evidence.exitCode : undefined,
    deploymentId: optionalText(evidence.deploymentId, 256),
    artifact: sanitizeReference(evidence.artifact, options.projectRoot),
  };
}

function sanitizeReferences(references: string[] | undefined, projectRoot: string | undefined): string[] | undefined {
  if (!references) return undefined;
  const safe = references
    .map((reference) => sanitizeReference(reference, projectRoot))
    .filter((reference): reference is string => reference !== undefined);
  return safe.length > 0 ? [...new Set(safe)].sort() : undefined;
}

function sanitizeReference(reference: string | undefined, projectRoot: string | undefined): string | undefined {
  if (!reference) return undefined;
  const clean = sanitizeText(reference, 1024);
  const pathApi = isWindowsPath(clean) || (projectRoot ? isWindowsPath(projectRoot) : false) ? path.win32 : path;
  const resolvedRoot = projectRoot ? pathApi.resolve(projectRoot) : undefined;
  const candidate = pathApi.isAbsolute(clean) ? pathApi.resolve(clean) : pathApi.resolve(resolvedRoot ?? '.', clean);

  if (pathApi.isAbsolute(clean)) {
    if (!resolvedRoot) return undefined;
    const relative = pathApi.relative(resolvedRoot, candidate);
    if (!isSafeRelativePath(relative, pathApi)) return undefined;
    return normalizeReference(relative);
  }

  if (!isSafeRelativePath(clean, pathApi)) return undefined;
  return normalizeReference(clean);
}

function isSafeRelativePath(reference: string, pathApi: path.PlatformPath): boolean {
  return (
    reference.length > 0 &&
    !pathApi.isAbsolute(reference) &&
    reference !== '..' &&
    !reference.startsWith('../') &&
    !reference.startsWith('..\\')
  );
}

function isWindowsPath(reference: string): boolean {
  return /^[A-Za-z]:[\\/]/u.test(reference) || reference.startsWith('\\\\');
}

function normalizeReference(reference: string): string {
  return reference.replaceAll('\\', '/').split(path.sep).join('/');
}

function sanitizeList(values: string[] | undefined, maxLength: number): string[] | undefined {
  if (!values) return undefined;
  const safe = values.map((value) => sanitizeText(value, maxLength)).filter((value) => value.length > 0);
  return safe.length > 0 ? [...new Set(safe)].sort() : undefined;
}

function optionalText(value: string | undefined, maxLength: number): string | undefined {
  if (value === undefined) return undefined;
  const safe = sanitizeText(value, maxLength);
  return safe.length > 0 ? safe : undefined;
}

function sanitizeText(value: string, maxLength: number): string {
  const redacted = value
    .replace(ANSI_SEQUENCE, '')
    .replace(CONTROL_CHARACTER, '')
    .replace(AUTH_URL, '[REDACTED]')
    .replace(BEARER_TOKEN, 'Bearer [REDACTED]')
    .replace(CREDENTIAL_ASSIGNMENT, '$1=[REDACTED]')
    .replace(/\s+/gu, ' ')
    .trim();
  return redacted.length <= maxLength ? redacted : `${redacted.slice(0, maxLength - 3)}...`;
}
