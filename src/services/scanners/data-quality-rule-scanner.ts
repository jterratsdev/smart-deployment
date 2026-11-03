import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parseDuplicateRule } from '../../parsers/duplicate-rule-parser.js';
import { parseMatchingRules } from '../../parsers/matching-rules-parser.js';
import type { DataQualityReference, MetadataComponent, MetadataDependencyReference } from '../../types/metadata.js';

/**
 * Builds the `MatchingRules:<Object>` container component. The basename must be a bare
 * object API name (non-empty, no `.`), otherwise this throws and `scanMetadataFiles` records
 * a scan error instead of a component. A valid container with zero `<matchingRules>` children
 * still returns a component with `rules: []` — it is never dropped (design §2).
 */
export async function parseMatchingRulesComponent(filePath: string): Promise<MetadataComponent> {
  const objectName = path.basename(filePath, '.matchingRule-meta.xml');
  if (!objectName || objectName.includes('.')) {
    throw new Error(`MatchingRules filename must be a bare object API name: ${path.basename(filePath)}`);
  }
  const parsed = parseMatchingRules(objectName, await readFile(filePath, 'utf8'));

  return {
    name: objectName,
    type: 'MatchingRules',
    filePath,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
    facts: {
      kind: 'matching-rules',
      objectName,
      rules: parsed.rules,
    },
  };
}

/**
 * Builds the `DuplicateRule:<Object>.<Rule>` component. The basename must split at the first
 * `.` into two non-empty parts, otherwise this throws. References (owning object, filter
 * fields, matching rule) are recorded with a `target-unknown` placeholder outcome here —
 * resolving them against the local graph requires every package directory to be scanned
 * first, so that happens later in {@link addDataQualityReferenceOutcomes}.
 */
export async function parseDuplicateRuleComponent(filePath: string): Promise<MetadataComponent> {
  const basename = path.basename(filePath, '.duplicateRule-meta.xml');
  const separator = basename.indexOf('.');
  if (separator <= 0 || separator === basename.length - 1) {
    throw new Error(`DuplicateRule filename must be Object.RuleName: ${basename}`);
  }
  const objectName = basename.slice(0, separator);
  const parsed = parseDuplicateRule(objectName, await readFile(filePath, 'utf8'));

  const references: DataQualityReference[] = [
    {
      kind: 'object',
      identity: `CustomObject:${objectName}`,
      outcome: 'target-unknown',
      reason: 'DuplicateRule owning object',
    },
    ...parsed.filterFields.map(
      (field): DataQualityReference => ({
        kind: 'field',
        identity: `CustomField:${field}`,
        outcome: 'target-unknown',
        reason: 'DuplicateRule filter field',
      })
    ),
    ...parsed.matchReferences.map(
      (reference): DataQualityReference => ({
        kind: 'matching-rule',
        identity: `MatchingRules:${reference.matchObjectName}#${reference.matchingRuleName}`,
        outcome: 'target-unknown',
        reason: 'DuplicateRule matching rule reference',
      })
    ),
  ];

  return {
    name: basename,
    type: 'DuplicateRule',
    filePath,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
    facts: {
      kind: 'duplicate-rule',
      objectName,
      isActive: parsed.isActive,
      references,
    },
  };
}

/**
 * Resolves every DuplicateRule reference against the fully flattened local component graph
 * (must run after all package directories are merged — references can cross package dirs).
 * `local` outcomes become hard dependency edges. A `local-missing` matching-rule reference
 * (the container is local but does not contain the referenced rule) and an active
 * DuplicateRule that references a local inactive matching rule are appended to `errors`
 * instead of throwing, so the scan always completes. `target-unknown` outcomes (not local —
 * standard or org-owned) are recorded in facts and never become edges or readiness claims.
 */
export function addDataQualityReferenceOutcomes(
  components: MetadataComponent[],
  errors: string[]
): MetadataComponent[] {
  const localNodeIds = new Set(components.map((component) => `${component.type}:${component.name}`));
  const matchingRulesByObject = new Map<string, MetadataComponent>();
  for (const component of components) {
    if (component.facts?.kind === 'matching-rules') {
      matchingRulesByObject.set(component.facts.objectName, component);
    }
  }

  const byNodeId = new Map(components.map((component) => [`${component.type}:${component.name}`, clone(component)]));

  for (const component of byNodeId.values()) {
    if (component.facts?.kind !== 'duplicate-rule') continue;
    const facts = component.facts;
    const resolvedReferences: DataQualityReference[] = [];
    const dependenciesToAdd: MetadataDependencyReference[] = [];

    for (const reference of facts.references) {
      if (reference.kind === 'object' || reference.kind === 'field') {
        const isLocal = localNodeIds.has(reference.identity);
        resolvedReferences.push({ ...reference, outcome: isLocal ? 'local' : 'target-unknown' });
        if (isLocal) {
          dependenciesToAdd.push(dependency(reference.identity, reference.reason));
        }
        continue;
      }

      const { objectName: matchObjectName, ruleName } = parseMatchingRuleIdentity(reference.identity);
      const containerNodeId = `MatchingRules:${matchObjectName}`;
      const container = matchingRulesByObject.get(matchObjectName);
      if (!container || container.facts?.kind !== 'matching-rules') {
        resolvedReferences.push({ ...reference, outcome: 'target-unknown' });
        continue;
      }

      const rule = container.facts.rules.find((candidate) => candidate.name === ruleName);
      if (!rule) {
        errors.push(
          `DuplicateRule ${component.name} references missing local matching rule ${matchObjectName}.${ruleName}`
        );
        resolvedReferences.push({ ...reference, outcome: 'local-missing' });
        continue;
      }

      resolvedReferences.push({ ...reference, outcome: 'local' });
      if (facts.isActive && !rule.isActive) {
        errors.push(
          `Active DuplicateRule ${component.name} references inactive matching rule ${matchObjectName}.${ruleName}`
        );
      }
      if (facts.isActive) {
        dependenciesToAdd.push(dependency(containerNodeId, `Active DuplicateRule requires matching rule ${ruleName}`));
      } else {
        const matchingComponent = byNodeId.get(containerNodeId);
        if (matchingComponent) {
          addDependencies(matchingComponent, [
            dependency(`DuplicateRule:${component.name}`, `Deactivate DuplicateRule before matching rule ${ruleName}`),
          ]);
        }
      }
    }

    const resolvedComponent: MetadataComponent = {
      ...component,
      facts: { ...facts, references: resolvedReferences },
    };
    byNodeId.set(`${component.type}:${component.name}`, resolvedComponent);
    addDependencies(resolvedComponent, dependenciesToAdd);
  }

  return components.map((component) => byNodeId.get(`${component.type}:${component.name}`) ?? component);
}

function parseMatchingRuleIdentity(identity: string): { objectName: string; ruleName: string } {
  const [, rest] = identity.split(':');
  const [objectName, ruleName] = (rest ?? '').split('#');
  return { objectName: objectName ?? '', ruleName: ruleName ?? '' };
}

function dependency(nodeId: string, reason: string): MetadataDependencyReference {
  return { nodeId, kind: 'hard', source: 'parser', reason };
}

function addDependencies(targetComponent: MetadataComponent, dependencies: MetadataDependencyReference[]): void {
  const component = targetComponent;
  component.dependencyDetails ??= [];
  const existing = new Set(component.dependencyDetails.map((item) => item.nodeId));
  for (const item of dependencies) {
    component.dependencies.add(item.nodeId);
    if (!existing.has(item.nodeId)) {
      component.dependencyDetails.push(item);
      existing.add(item.nodeId);
    }
  }
}

function clone(component: MetadataComponent): MetadataComponent {
  return {
    ...component,
    dependencies: new Set(component.dependencies),
    dependencyDetails: component.dependencyDetails ? [...component.dependencyDetails] : undefined,
    dependents: new Set(component.dependents),
  };
}
