import { parseXml, validateXml } from '../utils/xml.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

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

export function parseMatchingRules(objectName: string, content: string): ParsedMatchingRules {
  const validation = validateXml(content);
  if (validation !== true) throw new Error(`Invalid MatchingRules XML: ${validation.err.msg}`);
  const parsed = parseXml<XmlNode>(content);
  const root = parsed.MatchingRules as XmlNode | undefined;
  if (!root) throw new Error('Expected MatchingRules XML root');

  const rules = normalizeArray(root.matchingRules as XmlNode | XmlNode[] | undefined)
    .map((rule) => {
      const name = asString(rule.fullName);
      if (!name) throw new Error('Matching rule fullName is required');
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

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}
