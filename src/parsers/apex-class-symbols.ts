import type { ApexLexicalContext, ApexSymbolExtraction } from './apex-class-parser-model.js';
import { extractNamespace } from './apex-class-names.js';

/**
 * Extract extends relationship
 *
 * @ac US-013-AC-1: Extract extends relationships
 */
function extractExtends(code: string): string | undefined {
  const extendsPattern = /class\s+\w+\s+extends\s+([a-zA-Z][a-zA-Z0-9_<>.,\s]*?)(?:\s+implements|\s*\{)/i;
  const match = code.match(extendsPattern);

  if (match) {
    return match[1].replace(/<.*?>/g, '').trim();
  }

  return undefined;
}

/**
 * Extract implements relationships
 *
 * @ac US-013-AC-2: Extract implements relationships
 */
function extractImplements(code: string): string[] {
  const implementsPattern = /implements\s+([a-zA-Z][a-zA-Z0-9_<>.,\s]+?)(?:\s*\{)/gi;
  const matches = code.matchAll(implementsPattern);
  const interfaces: string[] = [];

  for (const match of matches) {
    const interfaceList = match[1].split(',');
    for (const iface of interfaceList) {
      const cleanInterface = iface.replace(/<.*?>/g, '').trim();
      if (cleanInterface && !interfaces.includes(cleanInterface)) {
        interfaces.push(cleanInterface);
      }
    }
  }

  return interfaces;
}

/**
 * Extract inner classes
 *
 * @ac US-013-AC-6: Handle inner classes
 */
function extractInnerClasses(code: string, outerClassName: string): string[] {
  const innerClassPattern = /\bclass\s+([a-zA-Z][a-zA-Z0-9_]*)\s*(?:extends|implements|\{)/g;
  const matches = code.matchAll(innerClassPattern);
  const innerClasses: string[] = [];

  for (const match of matches) {
    const className = match[1];

    if (className !== outerClassName && !innerClasses.includes(className)) {
      innerClasses.push(className);
    }
  }

  return innerClasses;
}

export function extractSymbols(context: ApexLexicalContext): ApexSymbolExtraction {
  const { namespace } = extractNamespace(context.className);

  return {
    namespace,
    extendsClass: extractExtends(context.cleanCode),
    implementsList: extractImplements(context.cleanCode),
    innerClasses: extractInnerClasses(context.cleanCode, context.className),
  };
}
