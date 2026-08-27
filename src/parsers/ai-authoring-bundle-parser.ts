import { ParsingError } from '../errors/parsing-error.js';

export type AiAuthoringBundleParseResult = {
  bundleName: string;
  flowTargets: string[];
  apexTargets: string[];
  promptTemplates: string[];
  agentTargets: string[];
};

/** Extracts deployable action targets from Agent Script without interpreting prose. */
export function parseAiAuthoringBundle(filePath: string, content: string): AiAuthoringBundleParseResult {
  const bundleName = filePath.match(/(?:^|[\\/])([^\\/]+)\.agent$/)?.[1];
  if (!bundleName) {
    throw new ParsingError(`Cannot extract AiAuthoringBundle name from: ${filePath}`, { filePath });
  }

  const targets = extractActionTargets(content);
  const flowTargets = targets.flow;
  const apexTargets = targets.apex;
  const agentTargets = targets.agent;
  const promptTemplates = unique([
    ...targets.prompt,
    ...extractNamedValues(
      content,
      /(?:promptTemplate|prompt_template|prompt-template)\s*:\s*["']?([A-Za-z][A-Za-z0-9_]*)/gi
    ),
  ]);

  return {
    bundleName,
    flowTargets,
    apexTargets,
    promptTemplates,
    agentTargets,
  };
}

function extractActionTargets(content: string): Record<string, string[]> {
  const result: Record<string, string[]> = { flow: [], apex: [], agent: [], prompt: [] };
  const lines = content.split(/\r?\n/);
  let inAction = false;
  let actionIndent = -1;

  for (const line of lines) {
    const indent = line.search(/\S|$/);
    const trimmed = line.trim();
    const inlineAction = /^action\s+[A-Za-z][A-Za-z0-9_-]*\s*\{/.test(trimmed);
    const namedAction = /^[A-Za-z][A-Za-z0-9_-]*\s*:\s*@actions\.[A-Za-z][A-Za-z0-9_-]*\s*$/.test(trimmed);
    const explicitTarget = /^target\s*:/i.test(trimmed);

    if (inlineAction) {
      inAction = true;
      actionIndent = indent;
      const inlineTarget = trimmed.match(/target\s*:\s*["']?([a-z]+):\/\/([A-Za-z][A-Za-z0-9_]*)["']?/i);
      if (inlineTarget) addTarget(result, inlineTarget[1], inlineTarget[2]);
    } else if (namedAction) {
      inAction = true;
      actionIndent = indent;
    } else if (explicitTarget) {
      inAction = true;
      actionIndent = indent;
    } else if (inAction && trimmed && indent <= actionIndent) {
      inAction = false;
    }

    if (!inAction) continue;
    const match = trimmed.match(/^target\s*:\s*["']?([a-z]+):\/\/([A-Za-z][A-Za-z0-9_]*)["']?\s*[,}]?$/i);
    if (!match) continue;
    const type = match[1].toLowerCase() === 'prompttemplate' ? 'prompt' : match[1].toLowerCase();
    if (type in result) addTarget(result, type, match[2]);
  }

  return Object.fromEntries(Object.entries(result).map(([key, values]) => [key, unique(values)]));
}

function addTarget(result: Record<string, string[]>, rawType: string, name: string): void {
  const type = rawType.toLowerCase() === 'prompttemplate' ? 'prompt' : rawType.toLowerCase();
  if (type in result) result[type].push(name);
}

function extractNamedValues(content: string, pattern: RegExp): string[] {
  return unique(Array.from(content.matchAll(pattern), (match) => match[1]).filter(Boolean));
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
