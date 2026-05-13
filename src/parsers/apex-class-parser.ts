import { ParsingError } from '../errors/parsing-error.js';
import { getLogger } from '../utils/logger.js';
import {
  collectDependencies,
  collectDependencyBuckets,
  flattenReferenceDependencies,
} from './apex-class-dependencies.js';
import { extractDynamicQueryReferences } from './apex-dynamic-query-analysis.js';
import { createLexicalContext, detectTestMetadata } from './apex-class-lexical.js';
import type { ApexDependency, ApexParseResult, ApexSymbolExtraction } from './apex-class-parser-model.js';
import { extractSymbols } from './apex-class-symbols.js';
import type { DynamicQueryReference } from './dynamic-query-reference.js';
export type { DynamicQueryReference } from './dynamic-query-reference.js';

export type { ApexDependency, ApexDependencyType, ApexParseResult } from './apex-class-parser-model.js';

const logger = getLogger('ApexClassParser');

function buildParseResult(
  className: string,
  symbols: ApexSymbolExtraction,
  dependencies: ApexDependency[],
  dynamicQueryReferences: DynamicQueryReference[] = []
): ApexParseResult {
  return {
    className,
    namespace: symbols.namespace,
    extends: symbols.extendsClass,
    implements: symbols.implementsList,
    dependencies,
    dynamicQueryReferences,
    innerClasses: symbols.innerClasses,
  };
}

/**
 * Parse an Apex class file and extract dependencies
 *
 * @param filePath - Path to the Apex class file
 * @param content - Content of the Apex class file
 * @returns ApexParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed
 *
 * @example
 * ```typescript
 * const result = parseApexClass('MyController.cls', apexCode);
 * console.log(result.extends); // 'BaseController'
 * console.log(result.implements); // ['IController', 'ICallable']
 * console.log(result.dependencies.length); // 5
 * ```
 */
export function parseApexClass(filePath: string, content: string): ApexParseResult {
  try {
    logger.debug(`Parsing Apex class: ${filePath}`);

    const lexicalContext = createLexicalContext(filePath, content);
    const symbols = extractSymbols(lexicalContext);
    const testMetadata = detectTestMetadata(lexicalContext);
    const dependencyBuckets = collectDependencyBuckets(lexicalContext, symbols);
    const dependencies = collectDependencies(dependencyBuckets);
    const dynamicQueryReferences = extractDynamicQueryReferences(lexicalContext.cleanCode);
    const result = buildParseResult(lexicalContext.className, symbols, dependencies, dynamicQueryReferences);

    logger.debug(`Parsed Apex class: ${lexicalContext.className}`, {
      dependencies: dependencies.length,
      innerClasses: symbols.innerClasses.length,
      isTestClass: testMetadata.isTestClass,
      referenceDependencies: flattenReferenceDependencies(dependencyBuckets.referenceDependencies).length,
      dynamicQueryReferences: dynamicQueryReferences.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Apex class: ${filePath}`, {
      filePath,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
