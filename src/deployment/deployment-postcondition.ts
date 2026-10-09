export type SharingModelObservation = {
  internalSharingModel?: string;
  externalSharingModel?: string;
};

export type SharingModelObservationUnavailable = {
  category: 'authentication' | 'network' | 'query' | 'entity-not-found' | 'invalid-response';
  message: string;
};

export type SharingModelQueryResult =
  | { kind: 'observed'; observation: SharingModelObservation }
  | { kind: 'unavailable'; error: SharingModelObservationUnavailable };

export type OwdPostcondition = {
  id: string;
  kind: 'owd-internal-sharing-model';
  objectName: string;
  afterWaveNumber: number;
  expectedInternalSharingModel: string;
  expectedExternalSharingModel?: string;
  initialObservation?: SharingModelObservation;
  initialObservationError?: SharingModelObservationUnavailable;
};

export type PausedPostcondition = OwdPostcondition & {
  status: 'timed-out' | 'observation-unavailable' | 'blocked-before-deploy';
  observedInternalSharingModel?: string;
  observedExternalSharingModel?: string;
  observationError?: SharingModelObservationUnavailable;
  attempts: number;
  waitedMs: number;
  pausedAt: string;
  resumedPhase?: number;
};

export type SatisfiedPostcondition = OwdPostcondition & {
  status: 'satisfied';
  observedInternalSharingModel?: string;
  observedExternalSharingModel?: string;
  attempts: number;
  waitedMs: number;
  resumedPhase?: number;
};

export type DeploymentPostconditionResult = PausedPostcondition | SatisfiedPostcondition;

const CONTROL_CHARACTER = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(31)}${String.fromCharCode(127)}-${String.fromCharCode(159)}]`,
  'gu'
);

export function sanitizeSatisfiedPostcondition(condition: SatisfiedPostcondition): SatisfiedPostcondition {
  return {
    ...condition,
    id: sanitizeEvidenceText(condition.id, 512),
    objectName: sanitizeEvidenceText(condition.objectName, 256),
    expectedInternalSharingModel: sanitizeEvidenceText(condition.expectedInternalSharingModel, 128),
    expectedExternalSharingModel: sanitizeOptionalEvidenceText(condition.expectedExternalSharingModel, 128),
    observedInternalSharingModel: sanitizeOptionalEvidenceText(condition.observedInternalSharingModel, 128),
    observedExternalSharingModel: sanitizeOptionalEvidenceText(condition.observedExternalSharingModel, 128),
  };
}

function sanitizeOptionalEvidenceText(value: string | undefined, maxLength: number): string | undefined {
  return value === undefined ? undefined : sanitizeEvidenceText(value, maxLength);
}

function sanitizeEvidenceText(value: string, maxLength: number): string {
  const sanitized = value
    .replace(/\b(?:force|sfdx):\/\/[^\s]+/giu, '[REDACTED]')
    .replace(/\bBearer\s+[A-Za-z0-9._~+/-]+=*/giu, 'Bearer [REDACTED]')
    .replace(
      /\b(access[_-]?token|auth(?:orization)?|client[_-]?secret|password|refresh[_-]?token|secret|token)\s*[:=]\s*[^\s,;]+/giu,
      '$1=[REDACTED]'
    )
    .replace(CONTROL_CHARACTER, '')
    .replace(/\s+/gu, ' ')
    .trim();
  return sanitized.length <= maxLength ? sanitized : `${sanitized.slice(0, maxLength - 3)}...`;
}
