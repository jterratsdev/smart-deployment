import { getLogger } from '../utils/logger.js';
import { ParsingError } from '../errors/parsing-error.js';
import type { ApexClassMetadata } from '../types/salesforce/apex.js';

const logger = getLogger('ApexClassParser');

/**
 * Apex class dependency types
 */
export type ApexDependencyType =
  | 'extends'
  | 'implements'
  | 'static_method'
  | 'static_property'
  | 'instantiation'
  | 'variable_declaration'
  | 'inner_class'
  | 'dynamic_instantiation'
  | 'visualforce_page'
  | 'custom_label'
  | 'prompt_template';

/**
 * Represents a dependency found in an Apex class
 */
export type ApexDependency = {
  type: ApexDependencyType;
  className: string;
  lineNumber?: number;
  isStandard: boolean;
  isManagedPackage: boolean;
  namespace?: string;
};

/**
 * Result of parsing an Apex class
 * Optionally includes metadata from .cls-meta.xml
 */
export type ApexParseResult = {
  className: string;
  namespace?: string;
  extends?: string;
  implements: string[];
  dependencies: ApexDependency[];
  innerClasses: string[];
  metadata?: ApexClassMetadata;
};

/**
 * Standard Apex classes that should be ignored
 */
const STANDARD_APEX_CLASSES = new Set([
  'System',
  'String',
  'Integer',
  'Boolean',
  'Date',
  'Datetime',
  'Time',
  'Decimal',
  'Double',
  'Long',
  'Id',
  'Blob',
  'Object',
  'List',
  'Set',
  'Map',
  'SObject',
  'Database',
  'Schema',
  'Test',
  'Limits',
  'ApexPages',
  'PageReference',
  'Trigger',
  'UserInfo',
  'Math',
  'Messaging',
  'Http',
  'HttpRequest',
  'HttpResponse',
  'JsonParser',
  'JsonGenerator',
  'JSON',
  'Pattern',
  'Matcher',
  'Exception',
  'DmlException',
  'QueryException',
  'NullPointerException',
  'TypeException',
  'CalloutException',
  'LimitException',
  'DateTime', // Alias for Datetime
  'Type', // Type.forName()
  'RestRequest',
  'RestResponse',
  'RestContext',
]);

/**
 * Common variable/parameter names that should not be treated as classes
 * These are typically camelCase and are variables, not class names
 */
const COMMON_VARIABLE_NAMES = new Set([
  'this',
  'response',
  'request',
  'headers',
  'body',
  'result',
  'results',
  'records',
  'record',
  'config',
  'configs',
  'context',
  'handler',
  'handlers',
  'processor',
  'processors',
  'batch',
  'orders',
  'orderStatus',
  'orderMap',
  'pedidos',
  'allPedidos',
  'responseWS',
  'pedidoRequest',
  'pedidoResponse',
  'apiConfigs',
  'loopCountMap',
  'bypassedHandlers',
  'selectorInstance',
  'mergedBindings',
  'allRecords',
  'mdt',
  'e',
  'te',
  'lc',
  'h',
]);

/**
 * Remove comments from Apex code
 *
 * @ac US-013-AC-9: Remove comments before parsing
 */
function removeComments(code: string): string {
  // Remove single-line comments (//)
  let cleaned = code.replace(/\/\/.*$/gm, '');

  // Remove multi-line comments (/* ... */)
  cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');

  // Remove JavaDoc comments (/** ... */)
  cleaned = cleaned.replace(/\/\*\*[\s\S]*?\*\//g, '');

  return cleaned;
}

/**
 * Check if a class is a standard Apex class
 *
 * @ac US-013-AC-7: Ignore standard classes (System.*, etc.)
 */
function isStandardClass(className: string): boolean {
  // Remove namespace if present
  const cleanName = className.includes('.') ? className.split('.').pop()! : className;

  // Check if it's in the standard classes set
  if (STANDARD_APEX_CLASSES.has(cleanName)) {
    return true;
  }

  // Check if it's a common variable name (should not be treated as a class)
  if (COMMON_VARIABLE_NAMES.has(cleanName)) {
    return true;
  }

  // Check if it starts with a standard prefix
  if (
    cleanName.startsWith('System.') ||
    cleanName.startsWith('Database.') ||
    cleanName.startsWith('Schema.') ||
    cleanName.startsWith('Test.') ||
    cleanName.startsWith('ApexPages.')
  ) {
    return true;
  }

  // Skip single-letter or very short names that are likely variables
  if (cleanName.length <= 2 && /^[a-z]$/i.test(cleanName)) {
    return true;
  }

  return false;
}

/**
 * Extract namespace from a fully qualified class name
 *
 * @ac US-013-AC-8: Handle managed packages
 */
function extractNamespace(className: string): { namespace?: string; cleanName: string; isManagedPackage: boolean } {
  // Pattern: Namespace__ClassName or Namespace.ClassName
  const namespacePattern = /^([a-zA-Z][a-zA-Z0-9_]*(?:__|\.))(.+)$/;
  const match = className.match(namespacePattern);

  if (match) {
    const namespace = match[1].replace(/__|\.$/g, '');
    const cleanName = match[2];
    const isManagedPackage = match[1].includes('__');

    return { namespace, cleanName, isManagedPackage };
  }

  return { cleanName: className, isManagedPackage: false };
}

/**
 * Extract extends relationship
 *
 * @ac US-013-AC-1: Extract extends relationships
 */
function extractExtends(code: string): string | undefined {
  const extendsPattern = /class\s+\w+\s+extends\s+([a-zA-Z][a-zA-Z0-9_<>.,\s]*?)(?:\s+implements|\s*\{)/i;
  const match = code.match(extendsPattern);

  if (match) {
    // Clean up generic types and whitespace
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
    // Split by comma to handle multiple interfaces
    const interfaceList = match[1].split(',');
    for (const iface of interfaceList) {
      // Clean up generic types and whitespace
      const cleanInterface = iface.replace(/<.*?>/g, '').trim();
      if (cleanInterface && !interfaces.includes(cleanInterface)) {
        interfaces.push(cleanInterface);
      }
    }
  }

  return interfaces;
}

/**
 * Extract static method calls and static property references
 *
 * @ac US-013-AC-3: Extract static method calls
 */
function extractStaticMethodCalls(code: string): ApexDependency[] {
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  // Pattern 1: ClassName.methodName() - static method calls
  const staticCallPattern =
    /(?:^|[^a-zA-Z0-9_])([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s*\.\s*[a-zA-Z][a-zA-Z0-9_]*\s*\(/g;
  const methodMatches = code.matchAll(staticCallPattern);

  for (const match of methodMatches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    // Skip if it looks like a variable name (camelCase starting with lowercase)
    const firstPart = className.split('.')[0];
    if (COMMON_VARIABLE_NAMES.has(firstPart) || /^[a-z]/.test(firstPart)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'static_method',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  // Pattern 2: ClassName.propertyName (without parentheses) - static property references
  // This handles cases like SC_DataFactory.customerFirstName (property access)
  // Exclude if followed by ( to avoid duplicate detection with method calls
  const staticPropertyPattern =
    /(?:^|[^a-zA-Z0-9_])([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s*\.\s*[a-zA-Z][a-zA-Z0-9_]*(?!\s*\()/g;
  const propertyMatches = code.matchAll(staticPropertyPattern);

  for (const match of propertyMatches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    // Skip if it looks like a variable name (camelCase starting with lowercase)
    const firstPart = className.split('.')[0];
    if (COMMON_VARIABLE_NAMES.has(firstPart) || /^[a-z]/.test(firstPart)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'static_property',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract object instantiations (new ClassName())
 *
 * @ac US-013-AC-4: Extract object instantiations
 */
function extractInstantiations(code: string): ApexDependency[] {
  // Pattern: new ClassName() or new ClassName<GenericType>()
  // Extract the class name, ignoring generic types
  const newPattern = /new\s+([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s*(?:<[^>]+>)?\s*\(/g;
  const matches = code.matchAll(newPattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    // Skip if it looks like a variable name
    const firstPart = className.split('.')[0];
    if (COMMON_VARIABLE_NAMES.has(firstPart) || /^[a-z]/.test(firstPart)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'instantiation',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract variable declarations
 *
 * @ac US-013-AC-5: Extract variable declarations
 * Only extracts actual class types used in variable declarations, not variable names
 */
function extractVariableDeclarations(code: string): ApexDependency[] {
  // Pattern: ClassName variableName = ... or ClassName<Generic> variableName = ...
  // More precise: looks for type declarations followed by variable names (camelCase)
  // Excludes: Map<String, Type> (handled separately), List<Type>, Set<Type>
  const varPattern =
    /(?:^|[;\s{(])\s*([A-Z][a-zA-Z0-9_]*(?:\.[A-Z][a-zA-Z0-9_]*)*)\s*(?:<[^>]+>)?\s+[a-z][a-zA-Z0-9_]*\s*[=;]/gm;
  const matches = code.matchAll(varPattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    let className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    // Handle generic types: Map<String, ValueType> -> extract ValueType
    // But skip List, Set, Map themselves as they're standard
    if (className === 'List' || className === 'Set' || className === 'Map') {
      // Try to extract the generic type from the full match
      const fullMatch = match[0];
      const genericMatch = fullMatch.match(/<(?:[^,<]+,\s*)?([A-Z][a-zA-Z0-9_]*)>/);
      if (genericMatch?.[1]) {
        className = genericMatch[1];
        // Skip if the generic type is standard
        if (isStandardClass(className) || seen.has(className)) {
          continue;
        }
      } else {
        continue; // Skip List/Set/Map without generics
      }
    }

    // Skip if it looks like a variable name (shouldn't happen but double-check)
    const firstPart = className.split('.')[0];
    if (COMMON_VARIABLE_NAMES.has(firstPart) || /^[a-z]/.test(firstPart)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'variable_declaration',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract inner classes
 *
 * @ac US-013-AC-6: Handle inner classes
 */
function extractInnerClasses(code: string, outerClassName: string): string[] {
  // Pattern: class InnerClassName { ... }
  // More permissive: allows any combination of modifiers and keywords
  const innerClassPattern = /\bclass\s+([a-zA-Z][a-zA-Z0-9_]*)\s*(?:extends|implements|\{)/g;
  const matches = code.matchAll(innerClassPattern);
  const innerClasses: string[] = [];

  for (const match of matches) {
    const className = match[1];

    // Skip the outer class itself
    if (className !== outerClassName && !innerClasses.includes(className)) {
      innerClasses.push(className);
    }
  }

  return innerClasses;
}

/**
 * Extract Type.forName() dynamic instantiation
 *
 * @ac US-013-AC-10: Handle Type.forName() dynamic instantiation
 */
function extractDynamicInstantiations(code: string): ApexDependency[] {
  // Pattern: Type.forName('ClassName') or Type.forName("ClassName")
  const typeForNamePattern = /Type\.forName\s*\(\s*['"]([a-zA-Z][a-zA-Z0-9_.]*)['"][\s)]/g;
  const matches = code.matchAll(typeForNamePattern);
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  for (const match of matches) {
    const className = match[1];

    // Skip if already seen or is a standard class
    if (seen.has(className) || isStandardClass(className)) {
      continue;
    }

    const { namespace, cleanName, isManagedPackage } = extractNamespace(className);

    seen.add(className);
    dependencies.push({
      type: 'dynamic_instantiation',
      className: cleanName,
      namespace,
      isStandard: false,
      isManagedPackage,
    });
  }

  return dependencies;
}

/**
 * Extract Custom Label references from Apex code
 * Pattern: Label.LabelName
 *
 * @ac US-013-AC-12: Extract Custom Label references
 */
function extractCustomLabelReferences(code: string): ApexDependency[] {
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  // Pattern: Label.LabelName
  // Examples: Label.KnowledgeRelatedArticlesSummary, Label.MyLabel
  const labelPattern = /Label\.([a-zA-Z][a-zA-Z0-9_]*)(?!\s*\.)/g;
  const labelMatches = code.matchAll(labelPattern);

  for (const match of labelMatches) {
    const labelName = match[1];

    // Skip if already seen
    if (seen.has(labelName)) {
      continue;
    }

    seen.add(labelName);
    dependencies.push({
      type: 'custom_label',
      className: labelName,
      namespace: undefined,
      isStandard: false,
      isManagedPackage: false,
    });
  }

  return dependencies;
}

/**
 * Extract Visualforce Page references from Apex code
 * Pattern: Page.PageName or PageReference('/apex/PageName')
 *
 * @ac US-013-AC-11: Extract Visualforce Page references
 */
function extractVisualforcePageReferences(code: string, currentClassName: string): ApexDependency[] {
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();

  // Pattern 1: Page.PageName or System.Page.PageName (most common)
  // Examples: Page.MyPage, System.Page.CommunitiesSelfRegConfirm
  // Exclude PageReference class itself and Page.currentPage() calls
  const pagePattern = /(?:System\.)?Page\.([a-zA-Z][a-zA-Z0-9_]*)(?!\s*\.)/g;
  const pageMatches = code.matchAll(pagePattern);

  for (const match of pageMatches) {
    const pageName = match[1];

    // Skip if already seen or if it's the current class name (self-reference)
    if (seen.has(pageName) || pageName === currentClassName) {
      continue;
    }

    // Skip standard Page methods like Page.currentPage()
    if (['currentPage', 'getParameters', 'setRedirect'].includes(pageName)) {
      continue;
    }

    seen.add(pageName);
    dependencies.push({
      type: 'visualforce_page',
      className: pageName,
      namespace: undefined,
      isStandard: false,
      isManagedPackage: false,
    });
  }

  // Pattern 2: PageReference('/apex/PageName') or PageReference('/PageName')
  // Examples: new PageReference('/apex/MyPage'), new PageReference('/CommunitiesSelfRegConfirm')
  const pageRefPattern =
    /(?:new\s+)?PageReference\s*\(\s*['"]\/apex\/([a-zA-Z][a-zA-Z0-9_]*)['"]|(?:new\s+)?PageReference\s*\(\s*['"]\/([a-zA-Z][a-zA-Z0-9_]*)['"]/gi;
  const pageRefMatches = code.matchAll(pageRefPattern);

  for (const match of pageRefMatches) {
    const pageName = match[1] || match[2]; // Could be from /apex/ or just /

    if (!pageName || seen.has(pageName) || pageName === currentClassName) {
      continue;
    }

    seen.add(pageName);
    dependencies.push({
      type: 'visualforce_page',
      className: pageName,
      namespace: undefined,
      isStandard: false,
      isManagedPackage: false,
    });
  }

  return dependencies;
}

/** Extract prompt template names only from the static Apex invocation form. */
function extractPromptTemplateReferences(code: string): ApexDependency[] {
  const dependencies: ApexDependency[] = [];
  const seen = new Set<string>();
  const staticStrings = new Map<string, string>();

  // Resolve the common constant/variable form without attempting general data-flow analysis.
  for (const match of code.matchAll(
    /\b(?:static\s+final\s+)?String\s+([a-zA-Z][a-zA-Z0-9_]*)\s*=\s*(['"])([a-zA-Z][a-zA-Z0-9_]*)\2\s*;/g
  )) {
    staticStrings.set(match[1], match[3]);
  }

  const callPattern =
    /\b(?:Templates|ConnectApi\.(?:EinsteinPromptTemplateGenerations|PromptTemplate))\s*\.\s*generatePromptTemplate\s*\(\s*((['"])([a-zA-Z][a-zA-Z0-9_]*)\2|([a-zA-Z][a-zA-Z0-9_]*))/g;
  for (const match of code.matchAll(callPattern)) {
    const name = match[3] ?? staticStrings.get(match[4]);
    if (!name || seen.has(name)) continue;
    seen.add(name);
    dependencies.push({
      type: 'prompt_template',
      className: name,
      isStandard: false,
      isManagedPackage: false,
    });
  }

  return dependencies;
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

    // Extract class name from file path
    const classNameMatch = filePath.match(/([a-zA-Z][a-zA-Z0-9_]*)\.cls$/);
    if (!classNameMatch) {
      throw new ParsingError(`Invalid Apex class file name: ${filePath}`, {
        filePath,
        suggestion: 'Apex class files must end with .cls',
      });
    }

    const className = classNameMatch[1];

    // Remove comments
    const cleanCode = removeComments(content);

    // Extract namespace from class definition
    const { namespace } = extractNamespace(className);

    // Extract extends relationship
    const extendsClass = extractExtends(cleanCode);

    // Extract implements relationships
    const implementsList = extractImplements(cleanCode);

    // Extract all dependencies
    const dependencies: ApexDependency[] = [];

    // Add extends as a dependency
    if (extendsClass && !isStandardClass(extendsClass)) {
      const { namespace: extNamespace, cleanName, isManagedPackage } = extractNamespace(extendsClass);
      dependencies.push({
        type: 'extends',
        className: cleanName,
        namespace: extNamespace,
        isStandard: false,
        isManagedPackage,
      });
    }

    // Add implements as dependencies
    for (const iface of implementsList) {
      if (!isStandardClass(iface)) {
        const { namespace: ifaceNamespace, cleanName, isManagedPackage } = extractNamespace(iface);
        dependencies.push({
          type: 'implements',
          className: cleanName,
          namespace: ifaceNamespace,
          isStandard: false,
          isManagedPackage,
        });
      }
    }

    // Extract and add other dependencies
    dependencies.push(...extractStaticMethodCalls(cleanCode));
    dependencies.push(...extractInstantiations(cleanCode));
    dependencies.push(...extractVariableDeclarations(cleanCode));
    dependencies.push(...extractDynamicInstantiations(cleanCode));
    dependencies.push(...extractVisualforcePageReferences(cleanCode, className));
    dependencies.push(...extractCustomLabelReferences(cleanCode));
    dependencies.push(...extractPromptTemplateReferences(cleanCode));

    // Extract inner classes
    const innerClasses = extractInnerClasses(cleanCode, className);

    const result: ApexParseResult = {
      className,
      namespace,
      extends: extendsClass,
      implements: implementsList,
      dependencies,
      innerClasses,
    };

    logger.debug(`Parsed Apex class: ${className}`, {
      dependencies: dependencies.length,
      innerClasses: innerClasses.length,
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
