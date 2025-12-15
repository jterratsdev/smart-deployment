import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';

const logger = getLogger('VisualforceParser');

/**
 * Visualforce dependency types
 */
export type VisualforceDependencyType =
  | 'apex_controller'
  | 'apex_extension'
  | 'vf_component'
  | 'standard_controller'
  | 'custom_component'
  | 'lwc_component'
  | 'aura_component'
  | 'vf_page_template'
  | 'static_resource'
  | 'vf_page_reference';

/**
 * Represents a dependency found in a Visualforce page/component
 */
export type VisualforceDependency = {
  type: VisualforceDependencyType;
  name: string;
  namespace?: string;
};

/**
 * Result of parsing a Visualforce page/component
 */
export type VisualforceParseResult = {
  name: string;
  type: 'page' | 'component';
  apexController?: string;
  apexExtensions: string[];
  standardController?: string;
  recordSetVar?: string;
  components: string[];
  lwcComponents: string[];
  auraComponents: string[];
  pageTemplates: string[]; // Visualforce Pages used as templates
  staticResources: string[]; // Static Resources referenced
  pageReferences: string[]; // Visualforce Pages referenced via $Page.PageName
  dependencies: VisualforceDependency[];
};

/**
 * Extract Apex controller from Visualforce markup
 *
 * @ac US-018-AC-1: Extract controller Apex class
 */
function extractApexController(vfContent: string): string | undefined {
  // Pattern: <apex:page controller="MyController">
  const controllerMatch = vfContent.match(
    /<apex:(?:page|component)[^>]*\scontroller\s*=\s*["']([a-zA-Z][a-zA-Z0-9_.]*?)["']/i
  );
  return controllerMatch ? controllerMatch[1] : undefined;
}

/**
 * Extract standard controller from Visualforce markup
 *
 * @ac US-018-AC-2: Extract standardController (SObject reference)
 */
function extractStandardController(vfContent: string): string | undefined {
  // Pattern: <apex:page standardController="Account">
  const stdControllerMatch = vfContent.match(
    /<apex:(?:page|component)[^>]*\sstandardController\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*?)["']/i
  );
  return stdControllerMatch ? stdControllerMatch[1] : undefined;
}

/**
 * Extract controller extensions from Visualforce markup
 *
 * @ac US-018-AC-3: Extract extensions (controller extensions)
 */
function extractExtensions(vfContent: string): string[] {
  // Pattern: extensions="Extension1,Extension2,Extension3"
  const extensionsMatch = vfContent.match(/<apex:(?:page|component)[^>]*\sextensions\s*=\s*["']([^"']+)["']/i);

  if (!extensionsMatch) {
    return [];
  }

  return extensionsMatch[1]
    .split(',')
    .map((ext) => ext.trim())
    .filter((ext) => ext.length > 0);
}

/**
 * Extract recordSetVar from Visualforce markup
 */
function extractRecordSetVar(vfContent: string): string | undefined {
  // Pattern: recordSetVar="accounts"
  const recordSetVarMatch = vfContent.match(/<apex:page[^>]*\srecordSetVar\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*?)["']/i);
  return recordSetVarMatch ? recordSetVarMatch[1] : undefined;
}

/**
 * Extract Visualforce component references
 *
 * @ac US-018-AC-4: Extract VF component references
 */
function extractComponents(vfContent: string): string[] {
  const components: string[] = [];

  // Pattern: <c:MyComponent /> or <namespace:ComponentName />
  const componentPattern = /<([a-zA-Z][a-zA-Z0-9_]*):([a-zA-Z][a-zA-Z0-9_]*)[^>]*\/?>/gi;
  const matches = vfContent.matchAll(componentPattern);

  for (const match of matches) {
    const namespace = match[1];
    const componentName = match[2];

    // Exclude apex: namespace (standard components)
    if (namespace.toLowerCase() !== 'apex' && namespace.toLowerCase() !== 'chatter') {
      const fullName = `${namespace}:${componentName}`;
      if (!components.includes(fullName)) {
        components.push(fullName);
      }
    }
  }

  return components;
}

/**
 * Extract Lightning Web Component (LWC) references from Visualforce
 * Pattern: <lightning:component /> or <lightning:* /> tags
 */
function extractLWCComponents(vfContent: string): string[] {
  const lwcComponents: string[] = [];

  // Pattern 1: <lightning:component componentName="MyComponent" />
  const lightningComponentPattern = /<lightning:component[^>]*\s+componentName\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*)["']/gi;
  const lightningMatches = vfContent.matchAll(lightningComponentPattern);
  for (const match of lightningMatches) {
    const componentName = match[1];
    if (!lwcComponents.includes(componentName)) {
      lwcComponents.push(componentName);
    }
  }

  // Pattern 2: <lightning:* /> tags (lightning:button, lightning:card, etc.)
  // These are standard LWC components, but we can extract custom ones
  // Note: Most lightning:* tags are standard, but custom LWC can be referenced via <c:>
  // We'll handle <c:> references separately to avoid duplicates

  return lwcComponents;
}

/**
 * Extract Aura Component references from Visualforce
 * Pattern: <aura:component /> or <aura:* /> tags
 */
function extractAuraComponents(vfContent: string): string[] {
  const auraComponents: string[] = [];

  // Pattern 1: <aura:component componentName="MyComponent" />
  const auraComponentPattern = /<aura:component[^>]*\s+componentName\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*)["']/gi;
  const auraMatches = vfContent.matchAll(auraComponentPattern);
  for (const match of auraMatches) {
    const componentName = match[1];
    if (!auraComponents.includes(componentName)) {
      auraComponents.push(componentName);
    }
  }

  // Pattern 2: <aura:* /> tags (aura:application, aura:dependency, etc.)
  // Most are standard, but we can extract custom component references

  return auraComponents;
}

/**
 * Extract custom component references from <c:> namespace
 * These could be Visualforce Components, LWC, or Aura Components
 * The scanner service will determine the actual type based on what exists in the project
 */
function extractCustomComponents(vfContent: string): string[] {
  const customComponents: string[] = [];

  // Pattern: <c:ComponentName /> - could be VF Component, LWC, or Aura
  const cNamespacePattern = /<c:([a-zA-Z][a-zA-Z0-9_]*)[^>]*\/?>/gi;
  const cMatches = vfContent.matchAll(cNamespacePattern);
  for (const match of cMatches) {
    const componentName = match[1];
    if (!customComponents.includes(componentName)) {
      customComponents.push(componentName);
    }
  }

  return customComponents;
}

/**
 * Extract Visualforce Page template dependencies
 * Pattern: <apex:composition template="TemplatePageName">
 *
 * @ac US-018-AC-7: Extract VF page template dependencies
 */
function extractPageTemplates(vfContent: string): string[] {
  const templates: string[] = [];

  // Pattern: <apex:composition template="TemplatePageName">
  const templatePattern = /<apex:composition[^>]*\stemplate\s*=\s*["']([a-zA-Z][a-zA-Z0-9_]*)["']/gi;
  const matches = vfContent.matchAll(templatePattern);

  for (const match of matches) {
    const templateName = match[1];
    if (!templates.includes(templateName)) {
      templates.push(templateName);
    }
  }

  return templates;
}

/**
 * Extract Static Resource references from Visualforce
 * Patterns:
 * - $Resource.ResourceName
 * - {!$Resource.ResourceName}
 * - {!URLFOR($Resource.ResourceName, 'path/to/file')}
 *
 * @ac US-018-AC-8: Extract Static Resource dependencies
 */
function extractStaticResources(vfContent: string): string[] {
  const resources: string[] = [];

  // Pattern 1: $Resource.ResourceName (direct reference)
  // Pattern 2: {!$Resource.ResourceName} (expression)
  // Pattern 3: {!URLFOR($Resource.ResourceName, 'path')} (URLFOR function)
  const resourcePatterns = [
    /\$Resource\.([a-zA-Z][a-zA-Z0-9_]*)/g, // Direct: $Resource.SiteSamples
    /\{!\s*\$Resource\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}/g, // Expression: {!$Resource.SiteSamples}
    /\{!\s*URLFOR\s*\(\s*\$Resource\.([a-zA-Z][a-zA-Z0-9_]*)\s*,/gi, // URLFOR: {!URLFOR($Resource.SiteSamples, 'path')}
  ];

  for (const pattern of resourcePatterns) {
    const matches = vfContent.matchAll(pattern);
    for (const match of matches) {
      const resourceName = match[1];
      if (resourceName && !resources.includes(resourceName)) {
        resources.push(resourceName);
      }
    }
  }

  return resources;
}

/**
 * Extract Visualforce Page references from Visualforce
 * Patterns:
 * - $Page.PageName
 * - {!$Page.PageName}
 * - value="{!$Page.PageName}"
 *
 * @ac US-018-AC-9: Extract Visualforce Page dependencies ($Page.PageName)
 */
function extractPageReferences(vfContent: string): string[] {
  const pages: string[] = [];

  // Pattern 1: $Page.PageName (direct reference)
  // Pattern 2: {!$Page.PageName} (expression)
  // Pattern 3: value="{!$Page.PageName}" (attribute value)
  const pagePatterns = [
    /\$Page\.([a-zA-Z][a-zA-Z0-9_]*)/g, // Direct: $Page.ForgotPassword
    /\{!\s*\$Page\.([a-zA-Z][a-zA-Z0-9_]*)\s*\}/g, // Expression: {!$Page.ForgotPassword}
  ];

  for (const pattern of pagePatterns) {
    const matches = vfContent.matchAll(pattern);
    for (const match of matches) {
      const pageName = match[1];
      if (pageName && !pages.includes(pageName)) {
        pages.push(pageName);
      }
    }
  }

  return pages;
}

/**
 * Determine if the file is a page or component based on extension
 *
 * @ac US-018-AC-6: Validate file extension (.page or .component)
 */
function getVisualforceType(fileName: string): 'page' | 'component' {
  if (fileName.endsWith('.page')) {
    return 'page';
  }
  if (fileName.endsWith('.component')) {
    return 'component';
  }

  throw new ParsingError(`Invalid Visualforce file extension: ${fileName}`, {
    filePath: fileName,
    expectedExtensions: ['.page', '.component'],
  });
}

/**
 * Parse a Visualforce page or component and extract dependencies
 *
 * @param fileName - Name of the Visualforce file (with extension)
 * @param vfContent - Content of the Visualforce file
 * @returns VisualforceParseResult with all extracted dependencies
 *
 * @throws {ParsingError} If the file cannot be parsed or has invalid extension
 *
 * @ac US-018-AC-5: Parse both pages and components
 * @ac US-018-AC-6: Validate file extension (.page or .component)
 * @ac US-018-AC-7: Handle namespace prefixes in controllers and components
 *
 * @example
 * ```typescript
 * const result = parseVisualforce('MyPage.page', vfContent);
 * console.log(result.apexController); // 'MyController'
 * console.log(result.components); // ['c:MyComponent']
 * console.log(result.standardController); // 'Account'
 * ```
 */
export function parseVisualforce(fileName: string, vfContent: string): VisualforceParseResult {
  try {
    logger.debug(`Parsing Visualforce: ${fileName}`);

    // Validate and determine type
    const type = getVisualforceType(fileName);
    const name = fileName.replace(/\.(page|component)$/, '');

    // Extract dependencies
    const apexController = extractApexController(vfContent);
    const standardController = extractStandardController(vfContent);
    const apexExtensions = extractExtensions(vfContent);
    const recordSetVar = extractRecordSetVar(vfContent);
    const components = extractComponents(vfContent);
    const lwcComponents = extractLWCComponents(vfContent);
    const auraComponents = extractAuraComponents(vfContent);
    const customComponents = extractCustomComponents(vfContent);
    const pageTemplates = extractPageTemplates(vfContent); // <apex:composition template="...">
    const staticResources = extractStaticResources(vfContent); // $Resource.ResourceName
    const pageReferences = extractPageReferences(vfContent); // $Page.PageName

    // Build dependencies array
    const dependencies: VisualforceDependency[] = [];

    if (apexController) {
      dependencies.push({
        type: 'apex_controller',
        name: apexController,
        namespace: apexController.includes('__') ? apexController.split('__')[0] : undefined,
      });
    }

    if (standardController) {
      dependencies.push({
        type: 'standard_controller',
        name: standardController,
      });
    }

    for (const extension of apexExtensions) {
      dependencies.push({
        type: 'apex_extension',
        name: extension,
        namespace: extension.includes('__') ? extension.split('__')[0] : undefined,
      });
    }

    for (const component of components) {
      dependencies.push({
        type: 'vf_component',
        name: component,
        namespace: component.includes(':') ? component.split(':')[0] : undefined,
      });
    }

    for (const lwc of lwcComponents) {
      dependencies.push({
        type: 'lwc_component',
        name: lwc,
      });
    }

    for (const aura of auraComponents) {
      dependencies.push({
        type: 'aura_component',
        name: aura,
      });
    }

    // Add custom components (<c:>) as potential dependencies
    // The scanner will determine if they're VF Components, LWC, or Aura
    for (const custom of customComponents) {
      // Only add if not already in components list (to avoid duplicates)
      if (!components.some(c => c.includes(`:${custom}`))) {
        // We'll add them as potential LWC first (most common)
        // The scanner can check what actually exists
        dependencies.push({
          type: 'lwc_component',
          name: custom,
        });
      }
    }

    // Add page template dependencies
    for (const template of pageTemplates) {
      dependencies.push({ type: 'vf_page_template', name: template });
    }

    // Add static resource dependencies
    for (const resource of staticResources) {
      dependencies.push({ type: 'static_resource', name: resource });
    }

    // Add Visualforce Page reference dependencies ($Page.PageName)
    for (const pageRef of pageReferences) {
      dependencies.push({ type: 'vf_page_reference', name: pageRef });
    }

    const result: VisualforceParseResult = {
      name,
      type,
      apexController,
      apexExtensions,
      standardController,
      recordSetVar,
      components,
      lwcComponents,
      auraComponents,
      pageTemplates,
      staticResources,
      pageReferences,
      dependencies,
    };

    logger.debug(`Parsed Visualforce: ${fileName}`, {
      type,
      apexController: !!apexController,
      standardController: !!standardController,
      extensionsCount: apexExtensions.length,
      componentsCount: components.length,
      lwcComponentsCount: lwcComponents.length,
      auraComponentsCount: auraComponents.length,
      dependenciesCount: dependencies.length,
    });

    return result;
  } catch (error) {
    if (error instanceof ParsingError) {
      throw error;
    }

    throw new ParsingError(`Failed to parse Visualforce file: ${fileName}`, {
      filePath: fileName,
      originalError: error instanceof Error ? error.message : String(error),
    });
  }
}
