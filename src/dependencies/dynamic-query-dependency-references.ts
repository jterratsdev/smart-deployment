import type { DynamicQueryReference } from '../parsers/dynamic-query-reference.js';
import type { MetadataDependencyReference } from '../types/metadata.js';

export function buildDynamicQueryDependencyReferences(
  references: readonly DynamicQueryReference[]
): MetadataDependencyReference[] {
  const dependencies: MetadataDependencyReference[] = [];
  const seen = new Set<string>();

  for (const reference of references) {
    if (!reference.objectName || reference.fieldNames.length === 0) {
      continue;
    }

    for (const fieldName of reference.fieldNames) {
      const nodeId = `CustomField:${reference.objectName}.${fieldName}`;
      if (seen.has(nodeId)) {
        continue;
      }

      seen.add(nodeId);
      dependencies.push({
        nodeId,
        kind: 'hard',
        source: 'parser',
        reason: buildDynamicQueryReason(reference),
        confidence: getDynamicQueryDependencyConfidence(reference),
      });
    }
  }

  return dependencies;
}

function buildDynamicQueryReason(reference: DynamicQueryReference): string {
  if (reference.source?.recordName && reference.source.fieldName) {
    return `Dynamic SOQL configured in ${reference.source.recordName}.${reference.source.fieldName}`;
  }

  return `Dynamic SOQL ${reference.origin} reference`;
}

function getDynamicQueryDependencyConfidence(reference: DynamicQueryReference): number {
  switch (reference.confidence) {
    case 'high':
      return 1;
    case 'medium':
      return 0.75;
    case 'low':
      return 0.4;
  }
}
