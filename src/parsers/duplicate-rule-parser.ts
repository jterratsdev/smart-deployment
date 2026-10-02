import { parseXml, validateXml } from '../utils/xml.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

type XmlNode = Record<string, unknown>;

export type DuplicateRuleMatchingReference = {
  objectName: string;
  matchingRuleName: string;
};

export type ParsedDuplicateRule = {
  objectName: string;
  matchingRules: DuplicateRuleMatchingReference[];
  filterFields: string[];
  isActive: boolean;
};

export function parseDuplicateRule(objectName: string, content: string): ParsedDuplicateRule {
  const validation = validateXml(content);
  if (validation !== true) throw new Error(`Invalid DuplicateRule XML: ${validation.err.msg}`);
  const parsed = parseXml<XmlNode>(content);
  const root = parsed.DuplicateRule as XmlNode | undefined;
  if (!root) throw new Error('Expected DuplicateRule XML root');

  const matchingRules = normalizeArray(root.duplicateRuleMatchRules as XmlNode | XmlNode[] | undefined)
    .map((reference) => {
      const referencedObject = asString(reference.matchRuleSObjectType);
      const matchingRuleName = asString(reference.matchingRule);
      if (!referencedObject || !matchingRuleName) {
        throw new Error('DuplicateRule matching references require matchRuleSObjectType and matchingRule');
      }
      return { objectName: referencedObject, matchingRuleName };
    })
    .sort((left, right) =>
      `${left.objectName}:${left.matchingRuleName}`.localeCompare(`${right.objectName}:${right.matchingRuleName}`)
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

  return { objectName, matchingRules, filterFields, isActive };
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
