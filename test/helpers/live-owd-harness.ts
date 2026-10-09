import { access, readdir } from 'node:fs/promises';
import * as path from 'node:path';
import type {
  SharingModelObservation,
  SharingModelQueryResult,
} from '../../src/deployment/deployment-postcondition.js';

export type LiveOwdHarnessOperations = {
  observe: () => Promise<SharingModelQueryResult>;
  retrieveBaseline: () => Promise<string>;
  deployTransition: () => Promise<void>;
  pollTransition: () => Promise<void>;
  deployRules: () => Promise<void>;
  restore: (sourceDir: string) => Promise<void>;
  pollRestoration: (expected: SharingModelObservation) => Promise<void>;
  cleanup: () => Promise<void>;
};

export type SharingModelPollOptions = {
  timeoutMs: number;
  initialDelayMs: number;
  maximumDelayMs: number;
};

export async function runLiveOwdHarness(operations: LiveOwdHarnessOperations): Promise<void> {
  let baseline: { observation: SharingModelObservation; sourceDir: string } | undefined;
  let mutationStarted = false;
  let primaryError: unknown;

  try {
    const initial = await operations.observe();
    if (initial.kind !== 'observed') {
      throw new Error(
        `Initial Case sharing-model observation unavailable (${initial.error.category}); refusing deploy.`
      );
    }
    const retrievedRoot = await operations.retrieveBaseline();
    const sourceDir = await validateRestorationSource(retrievedRoot);
    baseline = { observation: initial.observation, sourceDir };

    mutationStarted = true;
    await operations.deployTransition();
    await operations.pollTransition();
    await operations.deployRules();
  } catch (error) {
    primaryError = error;
  }

  try {
    if (baseline && mutationStarted) {
      await operations.restore(baseline.sourceDir);
      await operations.pollRestoration(baseline.observation);
    }
  } catch (error) {
    primaryError = primaryError
      ? new AggregateError([primaryError, error], 'Live OWD execution and restoration failed')
      : error;
  }

  try {
    await operations.cleanup();
  } catch (error) {
    primaryError = primaryError
      ? new AggregateError([primaryError, error], 'Live OWD execution or cleanup failed')
      : error;
  }

  if (primaryError) throw primaryError;
}

export async function validateRestorationSource(projectRoot: string): Promise<string> {
  await access(path.join(projectRoot, 'sfdx-project.json'));
  const files = await listFiles(projectRoot);
  const objectFile = files.find((file) => file.endsWith('/objects/Case/Case.object-meta.xml'));
  if (!objectFile) throw new Error('Retrieved baseline is missing Case.object-meta.xml; refusing mutation.');

  const metadataMarker = '/main/default/objects/Case/Case.object-meta.xml';
  const markerIndex = objectFile.indexOf(metadataMarker);
  if (markerIndex < 0)
    throw new Error('Retrieved Case metadata is not in Salesforce source format; refusing mutation.');
  const sourceDir = objectFile.slice(0, markerIndex);
  const hasSharingRules = files.some(
    (file) =>
      file.startsWith(`${sourceDir}/`) &&
      (file.endsWith('/sharingRules/Case.sharingRules-meta.xml') ||
        file.endsWith('/objects/Case/Case.sharingRules-meta.xml'))
  );
  if (!hasSharingRules) throw new Error('Retrieved baseline is missing Case SharingRules metadata; refusing mutation.');
  await access(sourceDir);
  return sourceDir;
}

export async function pollSharingModels(
  query: () => Promise<SharingModelQueryResult>,
  expected: SharingModelObservation,
  options: SharingModelPollOptions,
  dependencies: { now?: () => number; sleep?: (milliseconds: number) => Promise<void> } = {}
): Promise<void> {
  if (!expected.internalSharingModel) throw new Error('Expected internal sharing model is required for restoration.');
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? ((milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)));
  const startedAt = now();
  let delay = options.initialDelayMs;
  const maximumAttempts = Math.ceil(options.timeoutMs / options.initialDelayMs) + 1;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    const result = await query();
    if (
      result.kind === 'observed' &&
      result.observation.internalSharingModel === expected.internalSharingModel &&
      result.observation.externalSharingModel === expected.externalSharingModel
    ) {
      return;
    }
    const waitedMs = Math.max(0, now() - startedAt);
    if (result.kind === 'unavailable') {
      throw new Error(`Restoration observation unavailable (${result.error.category}).`);
    }
    if (waitedMs >= options.timeoutMs) throw new Error('Restoration timed out before both sharing models matched.');
    const sleepMs = Math.min(delay, options.maximumDelayMs, options.timeoutMs - waitedMs);
    await sleep(sleepMs);
    delay = Math.min(delay * 2, options.maximumDelayMs);
  }

  throw new Error('Restoration polling exhausted its bounded attempts.');
}

async function listFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath.replaceAll('\\', '/')];
    })
  );
  return nested.flat();
}
