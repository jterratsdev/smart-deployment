import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { LWCMetadata } from '../types/salesforce/lwc.js';
import { analyzeComponentCode } from './lwc-code-analysis.js';
import { analyzeMetadataXml } from './lwc-metadata-analysis.js';
import { assembleParseResult } from './lwc-result-assembly.js';

const logger = getLogger('LWCParser');

export type LWCDependencyType = 'apex_import' | 'lwc_import' | 'wire_adapter' | 'api_property' | 'navigation';

export type LWCDependency = {
  type: LWCDependencyType;
  name: string;
  source?: string;
  isTypeScript?: boolean;
};

export type LWCParseResult = {
  componentName: string;
  isTypeScript: boolean;
  apexImports: string[];
  lwcImports: string[];
  wireAdapters: string[];
  apiProperties: string[];
  navigationRefs: string[];
  dependencies: LWCDependency[];
  hasMetadataXml: boolean;
  metadata?: LWCMetadata;
};

/**
 * Parse a Lightning Web Component and extract dependencies.
 *
 * The public parser contract stays here while source-specific analysis lives in
 * dedicated JS/TS code, metadata XML, and result assembly collaborators.
 */
export function parseLWC(componentName: string, jsCode: string, metadataXml?: string): LWCParseResult {
  try {
    logger.debug(`Parsing LWC: ${componentName}`);

    const codeAnalysis = analyzeComponentCode(jsCode);
    const metadataAnalysis = analyzeMetadataXml(componentName, metadataXml);
    const result = assembleParseResult(componentName, codeAnalysis, metadataAnalysis);

    logger.debug(`Parsed LWC: ${componentName}`, {
      isTypeScript: result.isTypeScript,
      apexImports: result.apexImports.length,
      lwcImports: result.lwcImports.length,
      wireAdapters: result.wireAdapters.length,
      dependencies: result.dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse LWC: ${componentName}`, {
      filePath: componentName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
