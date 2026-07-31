import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseBot } from '../../parsers/bot-parser.js';
import { parseFlow } from '../../parsers/flow-parser.js';
import { parseGenAiPrompt } from '../../parsers/genai-prompt-parser.js';
import type { AiEvaluationDefinition, MetadataComponent } from '../../types/metadata.js';
import { parseSalesforceMetadata } from '../../utils/xml.js';

type AiEvaluationDefinitionXml = {
  AiEvaluationDefinition?: {
    subjectName?: unknown;
    subjectType?: unknown;
    subjectVersion?: unknown;
  };
};

function addAll(target: Set<string>, values: Iterable<string>, defaultType?: string): void {
  for (const value of values) {
    target.add(defaultType && !value.includes(':') ? `${defaultType}:${value}` : value);
  }
}

export async function parseFlowComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = parseFlow(filePath, content);

  const deps = new Set<string>();
  parsed.dependencies.forEach((dependency) => {
    if (dependency.type === 'apex_action' || dependency.type === 'subflow') {
      deps.add(dependency.name);
    }
  });

  return {
    name: parsed.flowName,
    type: 'Flow' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseBotComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const botName = path.basename(filePath, '.bot-meta.xml');
  const parsed = await parseBot(filePath, botName);

  const deps = new Set<string>();
  addAll(deps, parsed.flows, 'Flow');
  addAll(deps, parsed.apexActions, 'ApexClass');
  addAll(deps, parsed.genAiPrompts, 'GenAiPromptTemplate');
  addAll(deps, parsed.sobjects);

  return {
    name: botName,
    type: 'Bot' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export function parseAiAuthoringBundleComponent(filePath: string): MetadataComponent {
  const bundleName = path.basename(filePath, '.agent');

  return {
    name: bundleName,
    type: 'AiAuthoringBundle',
    filePath,
    dependencies: new Set<string>(),
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseAiEvaluationDefinitionComponent(filePath: string): Promise<AiEvaluationDefinition> {
  const parsed = await parseSalesforceMetadata<AiEvaluationDefinitionXml>(filePath);
  const definition = parsed.AiEvaluationDefinition;
  if (!definition) {
    throw new Error('Expected AiEvaluationDefinition root element.');
  }

  const subjectName = requiredString(definition.subjectName, 'subjectName');
  const subjectType = requiredString(definition.subjectType, 'subjectType');
  if (subjectType !== 'AGENT') {
    throw new Error(`Unsupported subjectType "${subjectType}"; expected "AGENT".`);
  }

  const subjectVersion = optionalString(definition.subjectVersion);
  const dependencyNodeId = `Bot:${subjectName}`;

  return {
    name: path.basename(filePath, '.aiEvaluationDefinition-meta.xml'),
    type: 'AiEvaluationDefinition',
    filePath,
    subjectName,
    subjectType,
    subjectVersion,
    dependencies: new Set([dependencyNodeId]),
    dependencyDetails: [
      {
        nodeId: dependencyNodeId,
        kind: 'hard',
        source: 'parser',
        reason: 'AiEvaluationDefinition subjectName identifies the evaluated Agentforce Bot.',
      },
    ],
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

export async function parseGenAiPlannerBundleComponent(directoryPath: string): Promise<MetadataComponent> {
  const bundleName = path.basename(directoryPath);
  const deps = await parseGenAiPlannerBundleDependencies(directoryPath);

  return {
    name: bundleName,
    type: 'GenAiPlannerBundle',
    filePath: directoryPath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}

async function parseGenAiPlannerBundleDependencies(directoryPath: string): Promise<Set<string>> {
  const deps = new Set<string>();
  const entries = await fs.readdir(directoryPath, { recursive: true, withFileTypes: true });
  const files = entries
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(entry.parentPath, entry.name))
    .filter((filePath) => /\.(?:json|xml|yaml|yml)$/iu.test(filePath));
  const contents = await Promise.all(files.map((filePath) => fs.readFile(filePath, 'utf8')));

  for (const content of contents) {
    collectNamedReferences(deps, content, ['flow', 'flowName', 'targetFlow', 'subflow'], 'Flow');
    collectNamedReferences(deps, content, ['apexClass', 'apexAction', 'invocableApexClass'], 'ApexClass');
    collectNamedReferences(deps, content, ['prompt', 'promptTemplate', 'genAiPromptTemplate'], 'GenAiPromptTemplate');
  }

  return deps;
}

function collectNamedReferences(
  dependencies: Set<string>,
  content: string,
  propertyNames: readonly string[],
  metadataType: string
): void {
  for (const propertyName of propertyNames) {
    const quotedProperty = new RegExp(`"${propertyName}"\\s*:\\s*"([^"/]+)"`, 'giu');
    const xmlElement = new RegExp(`<${propertyName}>([^<]+)</${propertyName}>`, 'giu');

    for (const match of content.matchAll(quotedProperty)) {
      dependencies.add(`${metadataType}:${match[1]}`);
    }

    for (const match of content.matchAll(xmlElement)) {
      dependencies.add(`${metadataType}:${match[1]}`);
    }
  }
}

function requiredString(value: unknown, fieldName: string): string {
  const normalized = optionalString(value);
  if (!normalized) {
    throw new Error(`Missing required ${fieldName}.`);
  }

  return normalized;
}

function optionalString(value: unknown): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized || undefined;
}

export async function parseGenAiPromptComponent(filePath: string): Promise<MetadataComponent | undefined> {
  const promptName = path.basename(filePath, '.genAiPromptTemplate-meta.xml');
  const parsed = await parseGenAiPrompt(filePath, promptName);

  const deps = new Set<string>();
  parsed.sobjects.forEach((sObjectName: string) => deps.add(sObjectName));
  parsed.dependencies.sobjects.forEach((sObjectName: string) => deps.add(sObjectName));

  return {
    name: promptName,
    type: 'GenAiPromptTemplate' as const,
    filePath,
    dependencies: deps,
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}
