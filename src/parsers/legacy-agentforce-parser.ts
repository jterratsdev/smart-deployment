import { ParsingError } from '../errors/parsing-error.js';

export type LegacyAgentforceType = 'GenAiFunction' | 'GenAiPlugin' | 'GenAiPlannerBundle';

export type LegacyAgentforceParseResult = {
  name: string;
  dependencies: Array<{ type: 'flow' | 'apex' | 'prompt' | 'function' | 'plugin'; name: string }>;
};

/** Parses legacy Agentforce XML references into typed dependency edges. */
export function parseLegacyAgentforce(
  filePath: string,
  content: string,
  type: LegacyAgentforceType
): LegacyAgentforceParseResult {
  const name = extractName(filePath, type);
  const dependencies: LegacyAgentforceParseResult['dependencies'] = [];

  if (type === 'GenAiFunction') {
    const target = firstTag(content, 'invocationTarget');
    const targetType = firstTag(content, 'invocationTargetType')?.toLowerCase();
    if (target && targetType === 'flow') dependencies.push({ type: 'flow', name: target });
    if (target && targetType === 'apex') dependencies.push({ type: 'apex', name: target.split('.')[0] });
    if (
      target &&
      (targetType === 'prompt' || targetType === 'prompttemplate' || targetType === 'genaiprompttemplate')
    ) {
      dependencies.push({ type: 'prompt', name: target });
    }
  } else if (type === 'GenAiPlugin') {
    for (const functionName of [...allTags(content, 'functionName'), ...allTags(content, 'genAiFunctionName')]) {
      dependencies.push({ type: 'function', name: functionName });
    }
  } else {
    for (const functionName of [...allTags(content, 'genAiFunctionName'), ...allTags(content, 'functionName')]) {
      dependencies.push({ type: 'function', name: functionName });
    }
    for (const pluginName of allTags(content, 'genAiPluginName')) {
      dependencies.push({ type: 'plugin', name: pluginName });
    }
  }

  return { name, dependencies: dedupeDependencies(dependencies) };
}

function extractName(filePath: string, type: LegacyAgentforceType): string {
  const suffix =
    type === 'GenAiPlannerBundle'
      ? '\\.(?:genAiPlannerBundle|genAiPlannerBundle-meta\\.xml)'
      : `\\.genAi${type.slice(5)}(?:-meta)?\\.xml`;
  const name = filePath.match(new RegExp(`(?:^|[\\/])([^\\/]+)${suffix}$`, 'i'))?.[1];
  if (!name) throw new ParsingError(`Cannot extract ${type} name from: ${filePath}`, { filePath });
  return name;
}

function firstTag(content: string, tag: string): string | undefined {
  return allTags(content, tag)[0];
}

function allTags(content: string, tag: string): string[] {
  const pattern = new RegExp(
    `<(?:(?:[A-Za-z_][\\w.-]*):)?${tag}\\b[^>]*>([\\s\\S]*?)</(?:(?:[A-Za-z_][\\w.-]*):)?${tag}>`,
    'gi'
  );
  return Array.from(content.matchAll(pattern), (match) => match[1].trim()).filter(Boolean);
}

function dedupeDependencies(
  dependencies: LegacyAgentforceParseResult['dependencies']
): LegacyAgentforceParseResult['dependencies'] {
  return dependencies.filter(
    (dependency, index, all) =>
      all.findIndex((candidate) => candidate.type === dependency.type && candidate.name === dependency.name) === index
  );
}
