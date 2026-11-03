import { ParsingError } from '../errors/parsing-error.js';

export type AiAuthoringBundleParseResult = {
  bundleName: string;
  dependencies: Set<string>;
};

const TARGET_TYPE_BY_SCHEME: Readonly<Record<string, string>> = {
  agent: 'AiAuthoringBundle',
  apex: 'ApexClass',
  flow: 'Flow',
  prompt: 'GenAiPromptTemplate',
  prompttemplate: 'GenAiPromptTemplate',
};

/** Extracts deployable action targets from Agent Script without interpreting instruction prose. */
export function parseAiAuthoringBundle(filePath: string, content: string): AiAuthoringBundleParseResult {
  const bundleName = filePath.match(/(?:^|[\\/])([^\\/]+)\.agent$/u)?.[1];
  if (!bundleName) {
    throw new ParsingError(`Cannot extract AiAuthoringBundle name from: ${filePath}`, { filePath });
  }

  const dependencies = new Set<string>();
  for (const line of content.split(/\r?\n/u)) {
    const target = line
      .trim()
      .match(/^(?:action\s+[A-Za-z][\w-]*\s*\{\s*)?target\s*:\s*["']?([a-z]+):\/\/([A-Za-z][\w:]*)["']?/iu);
    if (!target) continue;

    const metadataType = TARGET_TYPE_BY_SCHEME[target[1].toLowerCase()];
    if (metadataType) dependencies.add(`${metadataType}:${target[2]}`);
  }

  return { bundleName, dependencies };
}
