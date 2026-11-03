import { parseXml, validateXml } from '../utils/xml.js';
import {
  assertNoIdentitySeparators,
  extractSingleXmlRoot,
  normalizeArray,
  uniqueDefinedStrings,
} from './parser-utils.js';

type XmlNode = Record<string, unknown>;

export type ParsedMatchingRule = {
  name: string;
  fields: string[];
  isActive: boolean;
};

export type ParsedMatchingRules = {
  objectName: string;
  rules: ParsedMatchingRule[];
};

/**
 * Parses a `.matchingRule-meta.xml` container. The root must be exactly `MatchingRules` —
 * a singular `<MatchingRule />` or any other root is rejected. Each `<matchingRules>` child
 * requires a `fullName` and a `ruleStatus` in {Active, Inactive}. A `fullName` prefixed with
 * the container object (`<Object>.<Rule>`) has that prefix stripped so the rule name is bare.
 * Duplicate rule names are rejected. A valid root with zero children is accepted (empty rules
 * array); the caller still emits a component for it (design §2, "empty container").
 */
export function parseMatchingRules(objectName: string, content: string): ParsedMatchingRules {
  assertNoIdentitySeparators(objectName, 'MatchingRules object name');
  const validation = validateXml(content);
  if (validation !== true) throw new Error(`Invalid MatchingRules XML: ${validation.err.msg}`);
  const parsed = parseXml<XmlNode>(content);
  const root = extractSingleXmlRoot<XmlNode>(parsed, 'MatchingRules');

  const seenNames = new Set<string>();
  const rules = normalizeArray(root.matchingRules as XmlNode | XmlNode[] | undefined)
    .map((rule) => {
      const rawName = asString(rule.fullName);
      if (!rawName) throw new Error('Matching rule fullName is required');
      const name = stripObjectPrefix(rawName, objectName);
      assertNoIdentitySeparators(name, 'Matching rule name');
      if (seenNames.has(name)) throw new Error(`Duplicate matching rule name: ${name}`);
      seenNames.add(name);

      const status = asString(rule.ruleStatus);
      if (status !== 'Active' && status !== 'Inactive') {
        throw new Error(`Matching rule ${name} has invalid ruleStatus: ${status ?? 'missing'}`);
      }
      return {
        name,
        fields: uniqueDefinedStrings(
          normalizeArray(rule.matchingRuleItems as XmlNode | XmlNode[] | undefined).map((item) =>
            asString(item.fieldName)
          )
        ).sort(),
        isActive: status === 'Active',
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));

  return { objectName, rules };
}

function stripObjectPrefix(rawName: string, objectName: string): string {
  const prefix = `${objectName}.`;
  if (!rawName.includes('.')) return rawName;
  if (!rawName.startsWith(prefix)) {
    throw new Error(`Matching rule fullName ${rawName} does not belong to object ${objectName}`);
  }
  const name = rawName.slice(prefix.length);
  if (!name) throw new Error('Matching rule fullName is required');
  return name;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
