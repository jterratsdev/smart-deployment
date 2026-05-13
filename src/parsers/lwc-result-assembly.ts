import type { LWCDependency, LWCParseResult } from './lwc-parser.js';
import type { LwcCodeAnalysis } from './lwc-code-analysis.js';
import type { LwcMetadataAnalysis } from './lwc-metadata-analysis.js';

export function assembleParseResult(
  componentName: string,
  codeAnalysis: LwcCodeAnalysis,
  metadataAnalysis: LwcMetadataAnalysis
): LWCParseResult {
  const dependencies = buildDependencies(codeAnalysis);

  return {
    componentName,
    isTypeScript: codeAnalysis.isTypeScript,
    apexImports: codeAnalysis.apexImports,
    lwcImports: codeAnalysis.lwcImports,
    wireAdapters: codeAnalysis.wireAdapters,
    apiProperties: codeAnalysis.apiProperties,
    navigationRefs: codeAnalysis.navigationRefs,
    dependencies,
    hasMetadataXml: metadataAnalysis.hasMetadataXml,
    metadata: metadataAnalysis.metadata,
  };
}

function buildDependencies(analysis: LwcCodeAnalysis): LWCDependency[] {
  return [
    ...analysis.apexImports.map((name) => ({
      type: 'apex_import' as const,
      name,
      source: '@salesforce/apex',
      isTypeScript: analysis.isTypeScript,
    })),
    ...analysis.lwcImports.map((name) => ({
      type: 'lwc_import' as const,
      name,
      source: 'c',
      isTypeScript: analysis.isTypeScript,
    })),
    ...analysis.wireAdapters.map((name) => ({
      type: 'wire_adapter' as const,
      name,
      isTypeScript: analysis.isTypeScript,
    })),
    ...analysis.apiProperties.map((name) => ({
      type: 'api_property' as const,
      name,
      isTypeScript: analysis.isTypeScript,
    })),
    ...analysis.navigationRefs.map((name) => ({
      type: 'navigation' as const,
      name,
      isTypeScript: analysis.isTypeScript,
    })),
  ];
}
