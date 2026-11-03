export function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

export function normalizeOptionalArray<T>(value: T | T[] | undefined): T[] | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value : [value];
}

export function uniqueDefinedStrings(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value)))];
}

/**
 * Extracts the single top-level element matching `rootName` from a parsed XML document,
 * rejecting shapes that `Object.hasOwn(parsed, rootName)` alone would miss: extra sibling
 * root elements, a duplicated root (parsed to an array), and a text-only/numeric/boolean
 * root. An empty element (`<Root/>` or `<Root></Root>`) parses to `''` and is accepted as an
 * empty object, since that is the valid "empty container" shape. The `?xml` declaration
 * pseudo-key is ignored when counting top-level elements.
 */
export function extractSingleXmlRoot<T extends Record<string, unknown>>(
  parsed: Record<string, unknown>,
  rootName: string
): T {
  const topLevelKeys = Object.keys(parsed).filter((key) => key !== '?xml');
  if (topLevelKeys.length !== 1 || topLevelKeys[0] !== rootName) {
    throw new Error(`Expected ${rootName} XML root`);
  }

  const rawRoot = parsed[rootName];
  if (rawRoot === '') {
    return {} as T;
  }
  if (rawRoot !== null && typeof rawRoot === 'object' && !Array.isArray(rawRoot)) {
    return rawRoot as T;
  }

  throw new Error(`Expected ${rootName} XML root`);
}

const IDENTITY_SEPARATOR_PATTERN = /[:#]/u;

/**
 * Rejects a name containing `:` or `#` — the separators used to build graph node identities
 * (`Type:Name`) and the matching-rule reference identity (`MatchingRules:Object#Rule`). A
 * name with an embedded separator would otherwise be silently misparsed when that identity
 * is later split back apart (e.g. `R#x` inside a rule name ambiguates `Object#Rule#x`).
 */
export function assertNoIdentitySeparators(value: string, label: string): void {
  if (IDENTITY_SEPARATOR_PATTERN.test(value)) {
    throw new Error(`${label} "${value}" must not contain ':' or '#'`);
  }
}
