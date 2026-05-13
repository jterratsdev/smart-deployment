import { buildFieldListReference, parseSoqlReference, type DynamicQueryReference } from './dynamic-query-reference.js';

export function extractCustomMetadataDynamicQueryReferences(
  recordName: string,
  values: Readonly<Record<string, unknown>>
): DynamicQueryReference[] {
  const references: DynamicQueryReference[] = [];
  const seen = new Set<string>();
  const objectName = findConfiguredObjectName(values);

  for (const [fieldName, value] of Object.entries(values)) {
    if (typeof value !== 'string') {
      continue;
    }

    const source = { recordName, fieldName };
    const soqlReference = parseSoqlReference(value, 'custom-metadata-value', source);
    if (soqlReference) {
      addUniqueReference(references, seen, soqlReference);
      continue;
    }

    if (isFieldListConfigName(fieldName)) {
      const fieldListReference = buildFieldListReference(objectName, value, 'custom-metadata-value', source);
      if (fieldListReference) {
        addUniqueReference(references, seen, fieldListReference);
      }
    }
  }

  return references;
}

function addUniqueReference(
  references: DynamicQueryReference[],
  seen: Set<string>,
  reference: DynamicQueryReference
): void {
  const key = `${reference.source?.recordName ?? ''}:${reference.source?.fieldName ?? ''}:${
    reference.objectName ?? ''
  }:${reference.fieldNames.join(',')}:${reference.rawQuery}`;
  if (seen.has(key)) {
    return;
  }

  seen.add(key);
  references.push(reference);
}

function findConfiguredObjectName(values: Readonly<Record<string, unknown>>): string | undefined {
  for (const [fieldName, value] of Object.entries(values)) {
    if (typeof value === 'string' && isObjectConfigName(fieldName) && isObjectApiName(value)) {
      return value;
    }
  }

  return undefined;
}

function isObjectConfigName(fieldName: string): boolean {
  return /(?:^|_)(?:Object|SObject|Entity|TargetObject|ObjectApiName)(?:__c)?$/i.test(fieldName);
}

function isFieldListConfigName(fieldName: string): boolean {
  return /(?:^|_)(?:Fields|FieldList|SelectFields|QueryFields|Columns)(?:__c)?$/i.test(fieldName);
}

function isObjectApiName(value: string): boolean {
  return /^[a-zA-Z][a-zA-Z0-9_]*(?:__c|__mdt)?$/.test(value);
}
