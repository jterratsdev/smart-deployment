export type DynamicQueryReferenceOrigin = 'apex-string' | 'apex-constant' | 'custom-metadata-value';

export type DynamicQueryReferenceConfidence = 'high' | 'medium' | 'low';

export type DynamicQueryReferenceSource = {
  recordName?: string;
  fieldName?: string;
};

export type DynamicQueryReference = {
  objectName?: string;
  fieldNames: string[];
  rawQuery: string;
  confidence: DynamicQueryReferenceConfidence;
  origin: DynamicQueryReferenceOrigin;
  source?: DynamicQueryReferenceSource;
};

export function parseSoqlReference(
  rawValue: string,
  origin: DynamicQueryReferenceOrigin,
  source?: DynamicQueryReferenceSource
): DynamicQueryReference | null {
  const query = normalizeQueryWhitespace(rawValue);
  if (!/\bselect\b/i.test(query) || !/\bfrom\b/i.test(query)) {
    return null;
  }

  const soql = /\bselect\s+(.+?)\s+from\s+([a-zA-Z][a-zA-Z0-9_]*(?:__c|__mdt)?)/i.exec(query);
  if (!soql) {
    return withOptionalSource(
      {
        rawQuery: query,
        fieldNames: [],
        confidence: 'low',
        origin,
      },
      source
    );
  }

  const fieldNames = extractFieldNames(soql[1]);

  return withOptionalSource(
    {
      objectName: soql[2],
      fieldNames,
      rawQuery: query,
      confidence: fieldNames.length > 0 ? 'high' : 'low',
      origin,
    },
    source
  );
}

export function buildFieldListReference(
  objectName: string | undefined,
  rawFieldList: string,
  origin: DynamicQueryReferenceOrigin,
  source?: DynamicQueryReferenceSource
): DynamicQueryReference | null {
  const fieldNames = extractFieldNames(rawFieldList);
  if (fieldNames.length === 0) {
    return null;
  }

  return withOptionalSource(
    {
      objectName,
      fieldNames,
      rawQuery: normalizeQueryWhitespace(rawFieldList),
      confidence: objectName ? 'medium' : 'low',
      origin,
    },
    source
  );
}

function withOptionalSource(
  reference: Omit<DynamicQueryReference, 'source'>,
  source?: DynamicQueryReferenceSource
): DynamicQueryReference {
  if (!source) {
    return reference;
  }

  return {
    ...reference,
    source,
  };
}

function extractFieldNames(selectClause: string): string[] {
  const fields: string[] = [];
  const seen = new Set<string>();

  for (const candidate of selectClause.split(',')) {
    const fieldName = candidate.trim().split(/\s+/)[0];
    if (!isSimpleFieldReference(fieldName) || seen.has(fieldName)) {
      continue;
    }

    seen.add(fieldName);
    fields.push(fieldName);
  }

  return fields;
}

function isSimpleFieldReference(fieldName: string): boolean {
  return fieldName !== 'Id' && /^[a-zA-Z][a-zA-Z0-9_]*(?:__c)?$/.test(fieldName);
}

function normalizeQueryWhitespace(query: string): string {
  return query.replace(/\s+/g, ' ').trim();
}
