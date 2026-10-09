import type { OwdPostcondition, PausedPostcondition, SharingModelQueryResult } from './deployment-postcondition.js';

export type PostconditionPollResult =
  | {
      kind: 'satisfied';
      attempts: number;
      waitedMs: number;
      observation: NonNullable<Extract<SharingModelQueryResult, { kind: 'observed' }>['observation']>;
    }
  | { kind: 'paused'; postcondition: PausedPostcondition };

type PostconditionPollerDependencies = {
  query: (targetOrg: string, objectName: string) => Promise<SharingModelQueryResult>;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
};

export class PostconditionPoller {
  private readonly now: () => number;
  private readonly sleep: (milliseconds: number) => Promise<void>;

  public constructor(private readonly dependencies: PostconditionPollerDependencies) {
    this.now = dependencies.now ?? Date.now;
    this.sleep =
      dependencies.sleep ??
      ((milliseconds): Promise<void> => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  }

  public async wait(
    targetOrg: string,
    condition: OwdPostcondition,
    options: { timeoutMs: number; initialDelayMs: number; maximumDelayMs: number }
  ): Promise<PostconditionPollResult> {
    validatePostconditionPollingOptions(options);
    const startedAt = this.now();
    let attempts = 0;
    let delay = options.initialDelayMs;
    let last: SharingModelQueryResult | undefined;

    const isPolling = true;
    while (isPolling) {
      attempts += 1;
      last = await this.dependencies.query(targetOrg, condition.objectName);
      const waitedMs = Math.max(0, this.now() - startedAt);
      if (
        last.kind === 'observed' &&
        last.observation.internalSharingModel === condition.expectedInternalSharingModel
      ) {
        return { kind: 'satisfied', attempts, waitedMs, observation: last.observation };
      }
      if (last.kind === 'unavailable') {
        return { kind: 'paused', postcondition: this.pause(condition, last, attempts, waitedMs) };
      }
      if (waitedMs >= options.timeoutMs) {
        return { kind: 'paused', postcondition: this.pause(condition, last, attempts, waitedMs) };
      }

      const sleepMs = Math.min(delay, options.maximumDelayMs, options.timeoutMs - waitedMs);
      await this.sleep(sleepMs);
      delay = Math.min(delay * 2, options.maximumDelayMs);
    }

    throw new Error('Postcondition polling ended unexpectedly');
  }

  private pause(
    condition: OwdPostcondition,
    result: SharingModelQueryResult,
    attempts: number,
    waitedMs: number
  ): PausedPostcondition {
    return {
      ...condition,
      status: result.kind === 'unavailable' ? 'observation-unavailable' : 'timed-out',
      observedInternalSharingModel: result.kind === 'observed' ? result.observation.internalSharingModel : undefined,
      observedExternalSharingModel: result.kind === 'observed' ? result.observation.externalSharingModel : undefined,
      observationError: result.kind === 'unavailable' ? result.error : undefined,
      attempts,
      waitedMs,
      pausedAt: new Date(this.now()).toISOString(),
    };
  }
}

export function validatePostconditionPollingOptions(options: {
  timeoutMs: number;
  initialDelayMs: number;
  maximumDelayMs: number;
}): void {
  for (const [name, value] of Object.entries(options)) {
    if (!Number.isFinite(value) || value <= 0 || !Number.isSafeInteger(value)) {
      throw new Error(`OWD barrier ${name} must be a finite positive integer.`);
    }
  }
  if (options.initialDelayMs > options.maximumDelayMs) {
    throw new Error('OWD barrier initialDelayMs must not exceed maximumDelayMs.');
  }
  if (options.maximumDelayMs > options.timeoutMs) {
    throw new Error('OWD barrier maximumDelayMs must not exceed timeoutMs.');
  }
}
