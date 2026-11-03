import type { ObjectFlexipageOperationPlan } from './object-flexipage-operation-plan.js';

export type ObjectFlexipageOperationState = {
  id: string;
  status: 'pending' | 'started' | 'verified';
  jobId?: string;
};

export type ObjectFlexipageResumeState = {
  targetOrgId: string;
  planFingerprint: string;
  operations: ObjectFlexipageOperationState[];
};

export type ObjectFlexipageResumeAssessment =
  | { kind: 'blocked'; reason: string }
  | { kind: 'candidate'; operationId: string }
  | { kind: 'complete' };

function validateOperationState(
  operation: ObjectFlexipageOperationPlan['operations'][number],
  persisted: ObjectFlexipageOperationState,
  byId: ReadonlyMap<string, ObjectFlexipageOperationState>,
  observedCompleted: ReadonlyMap<string, 'matches' | 'mismatch' | 'unknown'>
): string | undefined {
  if (persisted.status !== 'pending' && persisted.status !== 'started' && persisted.status !== 'verified') {
    return `Invalid persisted status for ${operation.id}.`;
  }
  if (
    persisted.status === 'verified' &&
    operation.after.some((dependency) => byId.get(dependency)?.status !== 'verified')
  ) {
    return `Verified operation ${operation.id} has an unverified prerequisite.`;
  }
  if (persisted.status === 'started') {
    return `Reconcile in-flight operation ${operation.id} (${persisted.jobId ?? 'job unknown'}) before resuming.`;
  }
  if (persisted.status === 'verified' && observedCompleted.get(operation.id) !== 'matches') {
    return `Fresh target verification is missing or diverged for ${operation.id}.`;
  }
  if (persisted.status === 'pending' && persisted.jobId) {
    return `Pending operation ${operation.id} has a remote job that must be reconciled.`;
  }
  return undefined;
}

// An advisory decision only: the caller must still independently verify the
// pending operation's preconditions before any deployment is permitted.
export function assessObjectFlexipageResume(options: {
  plan: ObjectFlexipageOperationPlan;
  state: ObjectFlexipageResumeState;
  targetOrgId: string;
  observedCompleted: ReadonlyMap<string, 'matches' | 'mismatch' | 'unknown'>;
}): ObjectFlexipageResumeAssessment {
  const { plan, state, targetOrgId, observedCompleted } = options;
  if (!targetOrgId || state.targetOrgId !== targetOrgId) {
    return { kind: 'blocked', reason: 'Target org identity changed or is unavailable.' };
  }
  if (plan.fingerprint !== state.planFingerprint) {
    return { kind: 'blocked', reason: 'Operation plan or source hashes changed.' };
  }
  const byId = new Map(state.operations.map((operation) => [operation.id, operation]));
  if (
    byId.size !== plan.operations.length ||
    state.operations.length !== plan.operations.length ||
    plan.operations.some((operation) => !byId.has(operation.id))
  ) {
    return { kind: 'blocked', reason: 'Persisted operation set differs from the plan.' };
  }

  for (const operation of plan.operations) {
    const reason = validateOperationState(operation, byId.get(operation.id)!, byId, observedCompleted);
    if (reason) return { kind: 'blocked', reason };
  }

  const next = plan.operations.find((operation) => byId.get(operation.id)?.status === 'pending');
  if (!next) return { kind: 'complete' };
  if (next.after.some((dependency) => byId.get(dependency)?.status !== 'verified')) {
    return { kind: 'blocked', reason: `Prerequisites for ${next.id} are not verified.` };
  }
  return { kind: 'candidate', operationId: next.id };
}
