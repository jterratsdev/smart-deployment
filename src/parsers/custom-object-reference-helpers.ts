import type { CustomField } from '../types/salesforce/object.js';

const FORMULA_FUNCTIONS = ['IF', 'AND', 'OR', 'NOT', 'CASE', 'TEXT', 'VALUE', 'DATE', 'DATEVALUE', 'NOW', 'TODAY'];

type RelationshipField = {
  fieldName: string;
  referencedObjects: string[];
};

export function resolveFormulaReferences(formula: string, fields: CustomField[]): string[] {
  const rawReferences = extractFormulaReferences(formula);
  const relationshipFieldMap = createRelationshipFieldMap(fields);
  const resolved = new Set<string>();

  for (const rawReference of rawReferences) {
    const relationship = relationshipFieldMap.get(rawReference);
    if (relationship) {
      for (const referencedObject of relationship.referencedObjects) {
        resolved.add(referencedObject);
      }
      continue;
    }

    resolved.add(rawReference);
  }

  return [...resolved];
}

export function extractCustomFieldReferences(
  formula: string,
  fields: CustomField[],
  currentFieldName?: string
): string[] {
  const sanitizedFormula = sanitizeFormula(formula);
  const customFieldNames = new Set(fields.map((field) => field.fullName));
  const relationshipFieldMap = createRelationshipFieldMap(fields);
  const references = new Set<string>();

  const directFieldPattern = /\b([a-zA-Z][a-zA-Z0-9_]*__c)\b/g;
  for (const match of sanitizedFormula.matchAll(directFieldPattern)) {
    const fieldName = match[1];
    if (fieldName !== currentFieldName && customFieldNames.has(fieldName)) {
      references.add(fieldName);
    }
  }

  const relationshipPattern = /\b([a-zA-Z][a-zA-Z0-9_]*__r)\./g;
  for (const match of sanitizedFormula.matchAll(relationshipPattern)) {
    const relationshipName = match[1];
    const fieldReference = relationshipFieldMap.get(relationshipName)?.fieldName;
    if (fieldReference && fieldReference !== currentFieldName) {
      references.add(fieldReference);
    }
  }

  return [...references];
}

export function extractApexReferences(formula: string): string[] {
  const apexClasses = new Set<string>();
  const apexPattern = /\b([A-Z][a-zA-Z0-9_]*)\.[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;

  for (const match of formula.matchAll(apexPattern)) {
    apexClasses.add(match[1]);
  }

  return [...apexClasses];
}

function extractFormulaReferences(formula: string): string[] {
  const references = new Set<string>();
  const objectPattern = /\b([A-Z][a-zA-Z0-9_]*)\./g;

  for (const match of formula.matchAll(objectPattern)) {
    const objectName = match[1];
    if (!FORMULA_FUNCTIONS.includes(objectName)) {
      references.add(objectName);
    }
  }

  const objectTypePattern = /\$ObjectType\.([a-zA-Z][a-zA-Z0-9_]*)/g;
  for (const match of formula.matchAll(objectTypePattern)) {
    references.add(match[1]);
  }

  return [...references];
}

function sanitizeFormula(formula: string): string {
  return formula.replace(/"[^"]*"|'[^']*'/g, ' ');
}

function createRelationshipFieldMap(fields: CustomField[]): Map<string, RelationshipField> {
  const relationshipFieldMap = new Map<string, RelationshipField>();

  for (const field of fields) {
    if (!field.referenceTo || field.referenceTo.length === 0) {
      continue;
    }

    for (const key of collectRelationshipKeys(field)) {
      relationshipFieldMap.set(key, {
        fieldName: field.fullName,
        referencedObjects: field.referenceTo,
      });
    }
  }

  return relationshipFieldMap;
}

function collectRelationshipKeys(field: CustomField): Set<string> {
  const keys = new Set<string>();
  keys.add(field.fullName);

  if (field.fullName.endsWith('__c')) {
    keys.add(`${field.fullName.slice(0, -3)}__r`);
  }

  if (field.relationshipName) {
    keys.add(field.relationshipName);
  }

  return keys;
}
