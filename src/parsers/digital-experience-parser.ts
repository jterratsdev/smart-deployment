/**
 * Digital Experience Bundle Parser
 * Parses JSON files within DigitalExperienceBundle directories to extract dependencies
 *
 * DigitalExperienceBundle contains multiple JSON files:
 * - sfdc_cms__site/{siteName}/content.json - Site configuration
 * - sfdc_cms__view/{viewName}/content.json - View definitions with component references
 * - sfdc_cms__appPage/{pageName}/content.json - App page definitions
 * - sfdc_cms__theme/{themeName}/content.json - Theme definitions
 * - etc.
 *
 * These JSON files can reference:
 * - Lightning Components (LWC/Aura) via "definition" field (e.g., "c:myComponent", "embeddedMessaging:container")
 * - Static Resources via URLs or references
 * - Apex Classes via component attributes
 * - Other Experience Cloud components
 */

import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('DigitalExperienceParser');

export type DigitalExperienceDependency = {
  type: 'lwc_component' | 'aura_component' | 'static_resource' | 'apex_class' | 'visualforce_page' | 'flow' | 'unknown';
  name: string;
  source: string; // Which JSON file/field this came from
};

export type DigitalExperienceParseResult = {
  bundleName: string;
  dependencies: DigitalExperienceDependency[];
  jsonFiles: string[]; // Paths to JSON files scanned
};

/**
 * Parse a DigitalExperienceBundle directory to extract dependencies from JSON files
 */
export async function parseDigitalExperienceBundle(
  bundleDir: string,
  bundleName: string
): Promise<DigitalExperienceParseResult> {
  const result: DigitalExperienceParseResult = {
    bundleName,
    dependencies: [],
    jsonFiles: [],
  };

  try {
    // Recursively find all content.json files in the bundle
    const jsonFiles = await findJsonFiles(bundleDir);
    result.jsonFiles = jsonFiles;

    // Parse each JSON file to extract dependencies
    for (const jsonFile of jsonFiles) {
      try {
        const content = await readFile(jsonFile, 'utf-8');
        const parsed = JSON.parse(content);
        const deps = extractDependenciesFromJson(parsed, jsonFile);
        result.dependencies.push(...deps);
      } catch (error) {
        logger.warn('Failed to parse JSON file', {
          jsonFile,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.debug('Parsed DigitalExperienceBundle', {
      bundleName,
      jsonFiles: jsonFiles.length,
      dependencies: result.dependencies.length,
    });

    return result;
  } catch (error) {
    logger.error('Failed to parse DigitalExperienceBundle', {
      bundleDir,
      bundleName,
      error: error instanceof Error ? error.message : String(error),
    });
    return result;
  }
}

/**
 * Recursively find all content.json files in a directory
 */
async function findJsonFiles(dir: string): Promise<string[]> {
  const jsonFiles: string[] = [];
  const { readdir } = await import('node:fs/promises');

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        // Recursively search subdirectories
        const subFiles = await findJsonFiles(fullPath);
        jsonFiles.push(...subFiles);
      } else if (entry.isFile() && entry.name === 'content.json') {
        // Found a content.json file
        jsonFiles.push(fullPath);
      }
    }
  } catch (error) {
    logger.debug('Error reading directory', {
      dir,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return jsonFiles;
}

/**
 * Extract dependencies from a parsed JSON object
 */
function extractDependenciesFromJson(json: any, sourceFile: string): DigitalExperienceDependency[] {
  const dependencies: DigitalExperienceDependency[] = [];

  // Recursively traverse the JSON object
  function traverse(obj: any, jsonPath: string = ''): void {
    if (obj === null || obj === undefined) {
      return;
    }

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        traverse(obj[i], `${jsonPath}[${i}]`);
      }
      return;
    }

    if (typeof obj === 'object') {
      // Check for component definitions (common in Experience Cloud JSON)
      if (obj.definition && typeof obj.definition === 'string') {
        const definition = obj.definition;
        const dep = parseComponentDefinition(definition, sourceFile, jsonPath);
        if (dep) {
          dependencies.push(dep);
        }
      }

      // Check for component references in attributes
      if (obj.attributes && typeof obj.attributes === 'object') {
        traverse(obj.attributes, `${jsonPath}.attributes`);
      }

      // Check for component references in contentBody
      if (obj.contentBody && typeof obj.contentBody === 'object') {
        traverse(obj.contentBody, `${jsonPath}.contentBody`);
      }

      // Check for component references in children arrays
      if (obj.children && Array.isArray(obj.children)) {
        traverse(obj.children, `${jsonPath}.children`);
      }

      // Traverse all object properties
      for (const [key, value] of Object.entries(obj)) {
        traverse(value, jsonPath ? `${jsonPath}.${key}` : key);
      }
    }

    // Check string values for component references
    if (typeof obj === 'string') {
      const stringDeps = extractDependenciesFromString(obj, sourceFile, jsonPath);
      dependencies.push(...stringDeps);
    }
  }

  traverse(json);
  return dependencies;
}

/**
 * Parse a component definition string to extract component type and name
 * Examples:
 * - "c:myComponent" -> LWC component
 * - "aura:myComponent" -> Aura component
 * - "embeddedMessaging:container" -> Standard component
 * - "community_builder:seoAssistant" -> Standard component
 */
function parseComponentDefinition(
  definition: string,
  sourceFile: string,
  jsonPath: string
): DigitalExperienceDependency | null {
  // LWC component: c:ComponentName
  if (definition.startsWith('c:')) {
    const componentName = definition.substring(2);
    return {
      type: 'lwc_component',
      name: componentName,
      source: `${sourceFile}:${jsonPath}.definition`,
    };
  }

  // Aura component: aura:ComponentName
  if (definition.startsWith('aura:')) {
    const componentName = definition.substring(5);
    return {
      type: 'aura_component',
      name: componentName,
      source: `${sourceFile}:${jsonPath}.definition`,
    };
  }

  // Standard components (embeddedMessaging, community_builder, etc.) - skip for now
  // These are typically standard Salesforce components that don't need to be deployed
  if (definition.includes(':')) {
    return null; // Standard component, not a dependency
  }

  // If no namespace prefix, might be a component name directly
  // This is less common but possible
  return {
    type: 'unknown',
    name: definition,
    source: `${sourceFile}:${jsonPath}.definition`,
  };
}

/**
 * Extract dependencies from string values (e.g., URLs, references in attributes)
 */
function extractDependenciesFromString(
  str: string,
  sourceFile: string,
  jsonPath: string
): DigitalExperienceDependency[] {
  const dependencies: DigitalExperienceDependency[] = [];

  // Check for Static Resource references: /resource/ResourceName or {!URLFOR($Resource.ResourceName, ...)}
  const staticResourcePattern = /\/resource\/([a-zA-Z0-9_]+)|URLFOR\(\$Resource\.([a-zA-Z0-9_]+)/gi;
  let match;
  while ((match = staticResourcePattern.exec(str)) !== null) {
    const resourceName = match[1] || match[2];
    if (resourceName) {
      dependencies.push({
        type: 'static_resource',
        name: resourceName,
        source: `${sourceFile}:${jsonPath}`,
      });
    }
  }

  // Check for Apex Class references in attributes (e.g., controller="MyController")
  const apexClassPattern = /(?:controller|apexClass|className)\s*=\s*["']([a-zA-Z0-9_]+)["']/gi;
  while ((match = apexClassPattern.exec(str)) !== null) {
    const className = match[1];
    if (className) {
      dependencies.push({
        type: 'apex_class',
        name: className,
        source: `${sourceFile}:${jsonPath}`,
      });
    }
  }

  // Check for Visualforce Page references: $Page.PageName or /apex/PageName
  const vfPagePattern = /\$Page\.([a-zA-Z0-9_]+)|\/apex\/([a-zA-Z0-9_]+)/gi;
  while ((match = vfPagePattern.exec(str)) !== null) {
    const pageName = match[1] || match[2];
    if (pageName) {
      dependencies.push({
        type: 'visualforce_page',
        name: pageName,
        source: `${sourceFile}:${jsonPath}`,
      });
    }
  }

  // Check for Flow references: flow:FlowName
  const flowPattern = /flow:([a-zA-Z0-9_]+)/gi;
  while ((match = flowPattern.exec(str)) !== null) {
    const flowName = match[1];
    if (flowName) {
      dependencies.push({
        type: 'flow',
        name: flowName,
        source: `${sourceFile}:${jsonPath}`,
      });
    }
  }

  return dependencies;
}
