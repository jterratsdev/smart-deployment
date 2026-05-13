import { parseSoqlReference } from './dynamic-query-reference.js';
import type { DynamicQueryReference, DynamicQueryReferenceOrigin } from './dynamic-query-reference.js';

const DYNAMIC_QUERY_CALL_PATTERN = /\b(?:Database\.(?:query|getQueryLocator)|Search\.query)\s*\(/g;
const STRING_ASSIGNMENT_PATTERN = /\bString\s+([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*([^;]+);/g;
const IDENTIFIER_PATTERN = /^[a-zA-Z][a-zA-Z0-9_]*$/;

type ResolvedExpression = {
  value: string;
  fullyResolved: boolean;
  origin: DynamicQueryReferenceOrigin;
};

export function extractDynamicQueryReferences(code: string): DynamicQueryReference[] {
  const constants = collectStringAssignments(code);
  const references: DynamicQueryReference[] = [];
  const seen = new Set<string>();

  for (const expression of collectDynamicQueryExpressions(code)) {
    const resolved = resolveStringExpression(expression, constants);
    const reference = parseDynamicQueryReference(resolved);
    if (!reference) {
      continue;
    }

    const key = `${reference.objectName ?? ''}:${reference.fieldNames.join(',')}:${reference.rawQuery}`;
    if (!seen.has(key)) {
      seen.add(key);
      references.push(reference);
    }
  }

  return references;
}

function collectStringAssignments(code: string): Map<string, ResolvedExpression> {
  const assignments = new Map<string, ResolvedExpression>();

  for (const match of code.matchAll(STRING_ASSIGNMENT_PATTERN)) {
    assignments.set(match[1], resolveStringExpression(match[2], assignments));
  }

  return assignments;
}

function collectDynamicQueryExpressions(code: string): string[] {
  const expressions: string[] = [];

  for (const match of code.matchAll(DYNAMIC_QUERY_CALL_PATTERN)) {
    const startIndex = match.index + match[0].length;
    const expression = readCallExpression(code, startIndex);
    if (expression) {
      expressions.push(expression);
    }
  }

  return expressions;
}

function readCallExpression(code: string, startIndex: number): string | null {
  let depth = 1;
  let stringDelimiter: "'" | '"' | null = null;
  let escapeNext = false;

  for (let index = startIndex; index < code.length; index++) {
    const current = code[index];

    if (stringDelimiter) {
      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === stringDelimiter) {
        stringDelimiter = null;
      }

      continue;
    }

    if (current === "'" || current === '"') {
      stringDelimiter = current;
      continue;
    }

    if (current === '(') {
      depth++;
    } else if (current === ')') {
      depth--;
      if (depth === 0) {
        return code.slice(startIndex, index).trim();
      }
    }
  }

  return null;
}

function resolveStringExpression(
  expression: string,
  constants: ReadonlyMap<string, ResolvedExpression>
): ResolvedExpression {
  const parts = splitStringExpression(expression);
  let value = '';
  let fullyResolved = true;
  let usedConstant = false;

  for (const part of parts) {
    const literal = readStringLiteral(part);
    if (literal !== null) {
      value += literal;
      continue;
    }

    if (IDENTIFIER_PATTERN.test(part) && constants.has(part)) {
      const resolved = constants.get(part)!;
      value += resolved.value;
      fullyResolved = fullyResolved && resolved.fullyResolved;
      usedConstant = true;
      continue;
    }

    value += `{${part}}`;
    fullyResolved = false;
  }

  return {
    value,
    fullyResolved,
    origin: usedConstant ? 'apex-constant' : 'apex-string',
  };
}

function splitStringExpression(expression: string): string[] {
  const parts: string[] = [];
  let stringDelimiter: "'" | '"' | null = null;
  let escapeNext = false;
  let partStartIndex = 0;

  for (let index = 0; index < expression.length; index++) {
    const current = expression[index];

    if (stringDelimiter) {
      if (escapeNext) {
        escapeNext = false;
      } else if (current === '\\') {
        escapeNext = true;
      } else if (current === stringDelimiter) {
        stringDelimiter = null;
      }

      continue;
    }

    if (current === "'" || current === '"') {
      stringDelimiter = current;
      continue;
    }

    if (current === '+') {
      parts.push(expression.slice(partStartIndex, index).trim());
      partStartIndex = index + 1;
    }
  }

  parts.push(expression.slice(partStartIndex).trim());
  return parts;
}

function readStringLiteral(expression: string): string | null {
  const match = /^'((?:\\'|[^'])*)'$|^"((?:\\"|[^"])*)"$/.exec(expression);
  if (!match) {
    return null;
  }

  return (match[1] ?? match[2] ?? '').replaceAll("\\'", "'").replaceAll('\\"', '"');
}

function parseDynamicQueryReference(resolved: ResolvedExpression): DynamicQueryReference | null {
  const reference = parseSoqlReference(resolved.value, resolved.origin);
  if (!reference) {
    return null;
  }

  return {
    ...reference,
    confidence: resolved.fullyResolved ? reference.confidence : 'low',
  };
}
