import * as path from 'node:path';
import { parseXml } from '../utils/xml.js';

export type LegacyAgentforceType = 'GenAiFunction' | 'GenAiPlugin';

export type LegacyAgentforceParseResult = {
  name: string;
  dependencies: Set<string>;
};

type MetadataXml = Record<string, unknown>;

/** Parses legacy Agentforce XML references into normalized graph node IDs. */
export function parseLegacyAgentforce(
  filePath: string,
  content: string,
  type: LegacyAgentforceType
): LegacyAgentforceParseResult {
  const suffix = type === 'GenAiFunction' ? '.genAiFunction-meta.xml' : '.genAiPlugin-meta.xml';
  const dependencies = new Set<string>();
  const parsed = parseXml<MetadataXml>(content);

  if (type === 'GenAiFunction') {
    const target = firstValue(parsed, 'invocationTarget');
    const targetType = firstValue(parsed, 'invocationTargetType')?.toLowerCase();
    const metadataType =
      targetType === 'flow'
        ? 'Flow'
        : targetType === 'apex'
        ? 'ApexClass'
        : ['prompt', 'prompttemplate', 'genaiprompttemplate'].includes(targetType ?? '')
        ? 'GenAiPromptTemplate'
        : undefined;
    if (target && metadataType)
      dependencies.add(`${metadataType}:${metadataType === 'ApexClass' ? target.split('.')[0] : target}`);
  } else {
    for (const functionName of values(parsed, new Set(['functionName', 'genAiFunctionName']))) {
      dependencies.add(`GenAiFunction:${functionName}`);
    }
  }

  return { name: path.basename(filePath, suffix), dependencies };
}

function firstValue(value: unknown, key: string): string | undefined {
  return values(value, new Set([key]))[0];
}

function values(value: unknown, keys: ReadonlySet<string>): string[] {
  if (Array.isArray(value)) return value.flatMap((entry) => values(entry, keys));
  if (!value || typeof value !== 'object') return [];

  return Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => {
    const normalizedKey = key.includes(':') ? key.slice(key.lastIndexOf(':') + 1) : key;
    if (keys.has(normalizedKey) && typeof child === 'string' && child.trim()) return [child.trim()];
    return values(child, keys);
  });
}
