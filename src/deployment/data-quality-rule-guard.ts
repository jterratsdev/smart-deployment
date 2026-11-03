import type { MetadataComponent, MetadataType } from '../types/metadata.js';

/**
 * C1-RULES AC-004: MatchingRules and DuplicateRule stay blocked from every deployment path
 * until target-org retrieve, validate, and rule-behavior evidence is attached. Shared by
 * every manifest/deploy-plan producer so a new path cannot bypass the guard by building its
 * own package.xml instead of going through `WaveManifestService` (security review finding F1).
 */
export const DATA_QUALITY_RULE_TYPES: ReadonlySet<MetadataType> = new Set(['MatchingRules', 'DuplicateRule']);

export function isDataQualityRuleType(type: MetadataType): boolean {
  return DATA_QUALITY_RULE_TYPES.has(type);
}

export function buildDataQualityRuleGuardError(blockedKeys: readonly string[]): string {
  return (
    'MatchingRules and DuplicateRule cannot be deployed yet: target-org retrieve, validate, and ' +
    `rule-behavior evidence is required before enabling deployment for: ${blockedKeys.join(', ')}`
  );
}

export function findDataQualityRuleComponentKeys(components: readonly MetadataComponent[]): string[] {
  return components
    .filter((component) => isDataQualityRuleType(component.type))
    .map((component) => `${component.type}:${component.name}`)
    .sort();
}
