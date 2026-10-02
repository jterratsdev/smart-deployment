import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { parseDuplicateRule } from '../../parsers/duplicate-rule-parser.js';
import { parseMatchingRules } from '../../parsers/matching-rules-parser.js';
import type { MetadataComponent } from '../../types/metadata.js';

export async function parseMatchingRulesComponent(filePath: string): Promise<MetadataComponent> {
  const objectName = path.basename(filePath, '.matchingRule-meta.xml');
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

export async function parseDuplicateRuleComponent(filePath: string): Promise<MetadataComponent> {
  const name = path.basename(filePath, '.duplicateRule-meta.xml');
  const separator = name.indexOf('.');
  if (separator <= 0 || separator === name.length - 1) {
    throw new Error(`DuplicateRule filename must be Object.RuleName: ${name}`);
  }
  const objectName = name.slice(0, separator);
  const parsed = parseDuplicateRule(objectName, await readFile(filePath, 'utf8'));
  return {
    name,
    type: 'DuplicateRule',
    filePath,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
    facts: {
      kind: 'duplicate-rule',
      objectName,
      matchingRules: parsed.matchingRules,
      filterFields: parsed.filterFields,
      isActive: parsed.isActive,
    },
  };
}

export function parseCustomFieldComponent(filePath: string): MetadataComponent {
  const fieldName = path.basename(filePath, '.field-meta.xml');
  const objectName = path.basename(path.dirname(path.dirname(filePath)));
  const name = `${objectName}.${fieldName}`;
  return {
    name,
    type: 'CustomField',
    filePath,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

export function addLocalDataQualityRuleDependencies(components: MetadataComponent[]): MetadataComponent[] {
  const localNodeIds = new Set(components.map((component) => `${component.type}:${component.name}`));
  const byNodeId = new Map(components.map((component) => [`${component.type}:${component.name}`, clone(component)]));
  for (const component of byNodeId.values()) {
    const candidates = dependencyCandidates(component);
    const localDependencies = candidates.filter((candidate) => localNodeIds.has(candidate.nodeId));
    addDependencies(component, localDependencies);
  }
  applyMatchingRuleLifecycleEdges(byNodeId);
  return components.map((component) => byNodeId.get(`${component.type}:${component.name}`)!);
}

function dependencyCandidates(
  component: MetadataComponent
): Array<{ nodeId: string; kind: 'hard'; source: 'parser'; reason: string }> {
  if (component.facts?.kind === 'matching-rules') {
    const facts = component.facts;
    return [
      dependency(`CustomObject:${facts.objectName}`, 'MatchingRules owning object'),
      ...facts.rules.flatMap((rule) =>
        rule.fields.map((field) =>
          dependency(`CustomField:${facts.objectName}.${field}`, `Matching rule ${rule.name} field`)
        )
      ),
    ];
  }
  if (component.type === 'CustomField') {
    const objectName = component.name.split('.')[0];
    return [dependency(`CustomObject:${objectName}`, 'CustomField owning object')];
  }
  if (component.facts?.kind === 'duplicate-rule') {
    return [
      dependency(`CustomObject:${component.facts.objectName}`, 'DuplicateRule owning object'),
      ...component.facts.filterFields.map((field) => dependency(`CustomField:${field}`, 'DuplicateRule filter field')),
    ];
  }
  return [];
}

function dependency(
  nodeId: string,
  reason: string
): { nodeId: string; kind: 'hard'; source: 'parser'; reason: string } {
  return { nodeId, kind: 'hard', source: 'parser', reason };
}

function applyMatchingRuleLifecycleEdges(components: Map<string, MetadataComponent>): void {
  for (const duplicate of components.values()) {
    if (duplicate.facts?.kind !== 'duplicate-rule') continue;
    for (const reference of duplicate.facts.matchingRules) {
      const matchingNodeId = `MatchingRules:${reference.objectName}`;
      const matching = components.get(matchingNodeId);
      if (matching?.facts?.kind !== 'matching-rules') continue;
      const rule = matching.facts.rules.find((candidate) => candidate.name === reference.matchingRuleName);
      if (!rule) {
        throw new Error(
          `DuplicateRule ${duplicate.name} references missing local matching rule ${reference.objectName}.${reference.matchingRuleName}`
        );
      }
      if (duplicate.facts.isActive && !rule.isActive) {
        throw new Error(
          `Active DuplicateRule ${duplicate.name} references inactive matching rule ${reference.objectName}.${reference.matchingRuleName}`
        );
      }
      if (duplicate.facts.isActive) {
        addDependencies(duplicate, [
          dependency(matchingNodeId, `Active DuplicateRule requires matching rule ${reference.matchingRuleName}`),
        ]);
      } else {
        addDependencies(matching, [
          dependency(
            `DuplicateRule:${duplicate.name}`,
            `Deactivate DuplicateRule before matching rule ${reference.matchingRuleName}`
          ),
        ]);
      }
    }
  }
}

function addDependencies(
  component: MetadataComponent,
  dependencies: Array<{ nodeId: string; kind: 'hard'; source: 'parser'; reason: string }>
): void {
  const existing = new Set((component.dependencyDetails ?? []).map((item) => item.nodeId));
  for (const item of dependencies) {
    component.dependencies.add(item.nodeId);
    if (!existing.has(item.nodeId)) component.dependencyDetails?.push(item);
  }
}

function clone(component: MetadataComponent): MetadataComponent {
  return {
    ...component,
    dependencies: new Set(component.dependencies),
    dependencyDetails: [...(component.dependencyDetails ?? [])],
    dependents: new Set(component.dependents),
  };
}
