import { parseXml, validateXml } from '../utils/xml.js';
import {
  assertNoIdentitySeparators,
  extractSingleXmlRoot,
  normalizeArray,
  uniqueDefinedStrings,
} from './parser-utils.js';

type XmlNode = Record<string, unknown>;

export type DuplicateRuleMatchReference = {
  /** `matchRuleSObjectType`: the object that owns the referenced matching rule container. */
  matchObjectName: string;
  matchingRuleName: string;
};

export type ParsedDuplicateRule = {
  objectName: string;
  isActive: boolean;
  matchReferences: DuplicateRuleMatchReference[];
  /** `Table.Field` strings; `table` defaults to the owning object when absent (TBD-4). */
  filterFields: string[];
};

/**
 * Parses a `.duplicateRule-meta.xml` file. The root must be exactly `DuplicateRule`.
 * `duplicateRuleMatchRules` requires both `matchRuleSObjectType` and `matchingRule`.
 * `duplicateRuleFilter.duplicateRuleFilterItems` resolves to `(table ?? objectName).field`.
 * `isActive` is required and must be a boolean literal `true`/`false`.
 */
export function parseDuplicateRule(objectName: string, content: string): ParsedDuplicateRule {
  assertNoIdentitySeparators(objectName, 'DuplicateRule object name');
  const validation = validateXml(content);
  if (validation !== true) throw new Error(`Invalid DuplicateRule XML: ${validation.err.msg}`);
  const parsed = parseXml<XmlNode>(content);
  const root = extractSingleXmlRoot<XmlNode>(parsed, 'DuplicateRule');

  const matchReferences = normalizeArray(root.duplicateRuleMatchRules as XmlNode | XmlNode[] | undefined)
    .map((reference) => {
      const matchObjectName = asString(reference.matchRuleSObjectType);
      const matchingRuleName = asString(reference.matchingRule);
      if (!matchObjectName || !matchingRuleName) {
        throw new Error('DuplicateRule matching references require matchRuleSObjectType and matchingRule');
      }
      assertNoIdentitySeparators(matchObjectName, 'DuplicateRule matchRuleSObjectType');
      assertNoIdentitySeparators(matchingRuleName, 'DuplicateRule matchingRule');
      return { matchObjectName, matchingRuleName };
    })
    .sort((left, right) =>
      `${left.matchObjectName}:${left.matchingRuleName}`.localeCompare(
        `${right.matchObjectName}:${right.matchingRuleName}`
      )
    );

  const filter = root.duplicateRuleFilter as XmlNode | undefined;
  const filterFields = uniqueDefinedStrings(
    normalizeArray(filter?.duplicateRuleFilterItems as XmlNode | XmlNode[] | undefined).map((item) => {
      const table = asString(item.table) ?? objectName;
      const field = asString(item.field);
      return field ? `${table}.${field}` : undefined;
    })
  ).sort();

  const isActive = readRequiredBoolean(root.isActive, 'isActive');

  return { objectName, isActive, matchReferences, filterFields };
}

function readRequiredBoolean(value: unknown, field: string): boolean {
  if (typeof value === 'boolean') return value;
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`DuplicateRule ${field} must be true or false`);
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
