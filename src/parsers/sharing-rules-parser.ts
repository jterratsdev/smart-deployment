import { parseXml } from '../utils/xml.js';
import { normalizeArray, uniqueDefinedStrings } from './parser-utils.js';

export type SharingRulePrincipal = {
  type: 'Role' | 'Group' | 'Queue' | 'RoleAndSubordinates' | 'Territory2' | 'Territory2AndSubordinates';
  name: string;
};

export type ParsedSharingRules = {
  objectName: string;
  criteriaFields: string[];
  principals: SharingRulePrincipal[];
};

type XmlNode = Record<string, unknown>;

export function parseSharingRules(objectName: string, content: string): ParsedSharingRules {
  const parsed = parseXml<XmlNode>(content);
  const root = (parsed.SharingRules as XmlNode | undefined) ?? parsed;
  const rules = [
    ...normalizeArray(root.sharingCriteriaRules as XmlNode | XmlNode[] | undefined),
    ...normalizeArray(root.sharingOwnerRules as XmlNode | XmlNode[] | undefined),
    ...normalizeArray(root.sharingTerritoryRules as XmlNode | XmlNode[] | undefined),
    ...normalizeArray(root.criteriaBasedRules as XmlNode | XmlNode[] | undefined),
    ...normalizeArray(root.ownerRules as XmlNode | XmlNode[] | undefined),
  ];
  const criteriaFields = uniqueDefinedStrings(
    rules.flatMap((rule) =>
      normalizeArray(rule.criteriaItems as XmlNode | XmlNode[] | undefined).map((item) => asString(item.field))
    )
  ).sort();
  const principals = rules.flatMap((rule) => [
    ...extractPrincipals(rule.sharedTo),
    ...extractPrincipals(rule.sharedFrom),
  ]);

  return {
    objectName,
    criteriaFields,
    principals: deduplicatePrincipals(principals),
  };
}

function extractPrincipals(value: unknown): SharingRulePrincipal[] {
  return normalizeArray(value as XmlNode | XmlNode[] | undefined).flatMap((node) => {
    const mappings: Array<[keyof XmlNode, SharingRulePrincipal['type']]> = [
      ['role', 'Role'],
      ['group', 'Group'],
      ['queue', 'Queue'],
      ['roleAndSubordinates', 'RoleAndSubordinates'],
      ['roleAndSubordinatesInternal', 'RoleAndSubordinates'],
      ['territory', 'Territory2'],
      ['territoryAndSubordinates', 'Territory2AndSubordinates'],
    ];
    return mappings.flatMap(([key, type]) => {
      const name = asString(node[key]);
      return name ? [{ type, name }] : [];
    });
  });
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function deduplicatePrincipals(principals: SharingRulePrincipal[]): SharingRulePrincipal[] {
  return [...new Map(principals.map((principal) => [`${principal.type}:${principal.name}`, principal])).values()].sort(
    (left, right) => `${left.type}:${left.name}`.localeCompare(`${right.type}:${right.name}`)
  );
}
