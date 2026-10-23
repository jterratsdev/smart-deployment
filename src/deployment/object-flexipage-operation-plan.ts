import { createHash } from 'node:crypto';
import { XMLParser, XMLValidator } from 'fast-xml-parser';
import type { NodeId } from '../types/dependency.js';
import { buildObjectFlexipageOverlay } from './object-flexipage-overlay.js';

export type ObjectFlexipageObservation = {
  object: 'absent' | 'present' | 'unknown';
  pages: ReadonlyMap<string, 'absent' | 'present' | 'unknown'>;
};

export type ObjectFlexipageOperation = {
  id: string;
  kind: 'foundation' | 'page' | 'activation';
  nodeId: NodeId;
  after: string[];
  sourceHash: string;
};

export type ObjectFlexipageOperationPlan = {
  ready: false;
  reason: string;
  operations: ObjectFlexipageOperation[];
  fingerprint: string;
  sourceHash?: string;
  foundationHash?: string;
};

// This is an advisory plan. No target observation can authorize execution until
// the runner can persist and independently verify each operation.
export function planObjectFlexipageOperations(options: {
  objectName: string;
  source: string;
  pages: readonly string[];
  pageSources: ReadonlyMap<string, string>;
  observation: ObjectFlexipageObservation;
}): ObjectFlexipageOperationPlan {
  const { objectName, source, pages, pageSources, observation } = options;
  if (!objectName.trim() || objectName !== objectName.trim()) throw new Error('Invalid CustomObject identity');
  const overlay = buildObjectFlexipageOverlay(source, pages);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const foundationHash = createHash('sha256').update(overlay.foundation).digest('hex');
  const objectId = `CustomObject:${objectName}`;
  const foundationId = `foundation:${objectId}`;
  const pageIds = overlay.pages.map((page) => `page:FlexiPage:${page}`);
  for (const page of overlay.pages) {
    const pageSource = pageSources.get(page);
    if (!pageSource?.trim()) throw new Error(`Missing FlexiPage source: ${page}`);
    if (XMLValidator.validate(pageSource) !== true) throw new Error(`Invalid FlexiPage source: ${page}`);
    const parsed = new XMLParser({ ignoreAttributes: false }).parse(pageSource) as Record<string, unknown>;
    if (
      !parsed.FlexiPage ||
      typeof parsed.FlexiPage !== 'object' ||
      (parsed.FlexiPage as Record<string, unknown>)['@_xmlns'] !== 'http://soap.sforce.com/2006/04/metadata'
    ) {
      throw new Error(`Unexpected FlexiPage root or namespace: ${page}`);
    }
    if (
      (parsed.FlexiPage as Record<string, unknown>).sobjectType !== objectName ||
      (parsed.FlexiPage as Record<string, unknown>).type !== 'RecordPage'
    ) {
      throw new Error(`FlexiPage ${page} is not a record page for ${objectName}`);
    }
  }
  const operations: ObjectFlexipageOperation[] = [
    { id: foundationId, kind: 'foundation', nodeId: objectId, after: [], sourceHash: foundationHash },
    ...overlay.pages.map((page) => ({
      id: `page:FlexiPage:${page}`,
      kind: 'page' as const,
      nodeId: `FlexiPage:${page}`,
      after: [foundationId],
      sourceHash: createHash('sha256').update(pageSources.get(page)!).digest('hex'),
    })),
    { id: `activation:${objectId}`, kind: 'activation', nodeId: objectId, after: pageIds, sourceHash },
  ];
  const unknownPages = overlay.pages.filter(
    (page) => !observation.pages.has(page) || observation.pages.get(page) === 'unknown'
  );
  const reason =
    observation.object === 'unknown' || unknownPages.length > 0
      ? 'Target object or page state is unknown.'
      : observation.object === 'present'
      ? 'Existing object requires verified preservation and activation semantics.'
      : 'Operation execution, post-deploy verification and no-replay resume are not implemented.';
  const fingerprint = createHash('sha256').update(JSON.stringify(operations)).digest('hex');
  return { ready: false, reason, operations, fingerprint, sourceHash, foundationHash };
}
