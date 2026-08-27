/**
 * Metadata Simplifier - Fallback Strategy
 * Simplifies metadata files by removing references to components not yet deployed
 *
 * This is used as a fallback when a wave fails due to missing references.
 * Instead of simplifying preventively, we simplify reactively after a failure.
 *
 * @ac US-XXX-AC-1: Detect missing reference errors
 * @ac US-XXX-AC-2: Simplify metadata files by removing problematic references
 * @ac US-XXX-AC-3: Regenerate manifests with simplified files
 * @ac US-XXX-AC-4: Retry deployment with simplified files
 * @ac US-XXX-AC-5: Update files in later waves with newly available references
 */

import { readFile, writeFile } from 'node:fs/promises';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { getLogger } from '../utils/logger.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import type { Wave } from '../waves/wave-builder.js';
import { isStandardComponentReference } from '../constants/standard-components.js';

const logger = getLogger('MetadataSimplifier');

export type SimplificationOptions = {
  /** Components available in current and previous waves */
  availableComponents: Set<NodeId>;
  /** All waves (for determining what's available) */
  allWaves: Wave[];
  /** Current wave number */
  currentWaveNumber: number;
  /** Component map for dependency lookup */
  componentMap: Map<NodeId, MetadataComponent>;
};

export type SimplificationResult = {
  /** Whether simplification was performed */
  simplified: boolean;
  /** Components that were simplified */
  simplifiedComponents: NodeId[];
  /** References that were removed */
  removedReferences: Map<NodeId, string[]>;
  /** Temporary file paths created */
  tempFiles: Map<NodeId, string>;
  /** Temporary project root directory with simplified files */
  tempProjectRoot?: string;
};

/**
 * Error patterns that indicate missing references
 */
const MISSING_REFERENCE_ERRORS = [
  'INVALID_CROSS_REFERENCE',
  'MISSING_REFERENCE',
  'DEPENDENCY_NOT_FOUND',
  'INVALID_TYPE_FOR_REFERENCE',
  'CANNOT_DEPLOY_COMPONENT',
  'INVALID_FIELD',
  'INVALID_OBJECT',
  'INVALID_CLASS',
  'INVALID_FLOW',
  'DOES NOT EXIST',
  'NOT FOUND',
  'CANNOT FIND',
  'CHECK SPELLING',
  'COMPONENT.*DOES NOT EXIST',
  'STATIC RESOURCE.*DOES NOT EXIST',
];

/**
 * Metadata Simplifier Service
 *
 * Simplifies metadata files by removing references to components
 * that are not yet available in the current wave.
 */
export class MetadataSimplifier {
  private parser: XMLParser;
  private builder: XMLBuilder;

  public constructor() {
    this.parser = new XMLParser({
      ignoreAttributes: false,
      parseAttributeValue: true,
      trimValues: true,
      preserveOrder: true,
    });
    this.builder = new XMLBuilder({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      format: true,
      indentBy: '  ',
      preserveOrder: true, // Must match parser preserveOrder
      suppressEmptyNode: true,
    });
  }

  /**
   * Check if an error indicates missing references
   */
  public isMissingReferenceError(error: string): boolean {
    // Check if error contains standard component references (these are safe)
    if (error.includes('SiteSamples') || error.includes('sitelogin')) {
      // These are standard Experience Cloud components - should exist in org
      // Don't treat as missing reference error
      return false;
    }

    return MISSING_REFERENCE_ERRORS.some((pattern) => error.toUpperCase().includes(pattern));
  }

  /**
   * Extract missing references from error message
   */
  public extractMissingReferences(error: string): string[] {
    const references: string[] = [];

    // Try to extract component names from error messages
    // Pattern: "INVALID_CROSS_REFERENCE: Account__c" or "MISSING_REFERENCE: AccountService"
    const patterns = [
      /(?:INVALID_CROSS_REFERENCE|MISSING_REFERENCE|DEPENDENCY_NOT_FOUND)[:\s]+([A-Za-z0-9_]+)/gi,
      /(?:Cannot find|Missing|Invalid)\s+(?:component|reference|class|object|flow)[:\s]+([A-Za-z0-9_]+)/gi,
    ];

    for (const pattern of patterns) {
      const matches = error.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          references.push(match[1]);
        }
      }
    }

    return [...new Set(references)];
  }

  /**
   * Simplify metadata files for a wave
   * Removes references to components not yet available
   * Creates a temporary project directory with copies of all wave files, then modifies them in place
   */
  public async simplifyWaveMetadata(wave: Wave, options: SimplificationOptions): Promise<SimplificationResult> {
    logger.info('Simplifying metadata for wave', {
      wave: wave.number,
      components: wave.components.length,
    });

    const result: SimplificationResult = {
      simplified: false,
      simplifiedComponents: [],
      removedReferences: new Map(),
      tempFiles: new Map(),
    };

    // Get components available up to this wave
    const availableUpToWave = this.getAvailableComponents(options.allWaves, options.currentWaveNumber);

    // Create temporary project root directory
    // Get project root from first component's filePath
    const firstComponent = Array.from(options.componentMap.values())[0];
    if (!firstComponent) {
      return result;
    }

    // Extract project root (assume force-app structure)
    const projectRoot = firstComponent.filePath.startsWith('force-app')
      ? 'force-app'
      : path.dirname(firstComponent.filePath.split('/')[0]);
    const tempProjectRoot = path.join(projectRoot, '.simplified-temp', `wave-${wave.number}`);
    await fs.mkdir(tempProjectRoot, { recursive: true });

    // Copy all wave components to temp directory first
    const componentsToSimplify: Array<{ nodeId: NodeId; component: MetadataComponent }> = [];
    for (const nodeId of wave.components) {
      const component = options.componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      // Check if this is a bundle type that needs directory copying (DigitalExperience, etc.)
      const isBundleType = component.type === 'DigitalExperience' || component.type === 'Document';

      // Check if filePath is actually a directory (for bundles)
      // DigitalExperience bundles are directories containing JSON files
      let isDirectory = false;
      if (isBundleType) {
        try {
          const stat = await fs.stat(component.filePath);
          isDirectory = stat.isDirectory();
        } catch {
          // If stat fails, assume it's a file
          isDirectory = false;
        }
      }

      // Declare temp path variable in outer scope
      let tempFilePath: string;

      if (isDirectory) {
        // Copy entire directory recursively for bundle types
        const sourceDir = component.filePath;
        const relativePath = sourceDir;
        tempFilePath = path.join(tempProjectRoot, relativePath);

        // Copy directory recursively
        await this.copyDirectoryRecursive(sourceDir, tempFilePath);

        // Track the directory path
        result.tempFiles.set(nodeId, tempFilePath);
      } else {
        // Copy single file
        const relativePath = component.filePath;
        tempFilePath = path.join(tempProjectRoot, relativePath);
        const tempFileDir = path.dirname(tempFilePath);
        await fs.mkdir(tempFileDir, { recursive: true });

        // Handle virtual ReportFolders and EmailTemplateFolders
        // These don't have physical files, so create empty metadata files for deployment
        let isVirtualReportFolder = false;
        let isVirtualEmailFolder = false;

        try {
          await fs.access(component.filePath);
          // File exists, not virtual
        } catch {
          // File doesn't exist, check if it's a virtual folder
          isVirtualReportFolder =
            component.type === 'ReportFolder' && component.filePath.includes('.reportFolder-meta.xml');
          isVirtualEmailFolder =
            component.type === 'EmailTemplateFolder' &&
            component.filePath.includes('.emailFolder-meta.xml') &&
            !component.filePath.includes('/email/');
        }

        if (isVirtualReportFolder || isVirtualEmailFolder) {
          // Create empty metadata file for virtual folders
          // Salesforce CLI needs a file to deploy, even if it's empty
          const folderName = path.basename(
            tempFilePath,
            isVirtualReportFolder ? '.reportFolder-meta.xml' : '.emailFolder-meta.xml'
          );
          const metadataContent = isVirtualReportFolder
            ? `<?xml version="1.0" encoding="UTF-8"?>\n<ReportFolder xmlns="http://soap.sforce.com/2006/04/metadata">\n    <name>${folderName}</name>\n</ReportFolder>`
            : `<?xml version="1.0" encoding="UTF-8"?>\n<EmailFolder xmlns="http://soap.sforce.com/2006/04/metadata">\n    <name>${folderName}</name>\n</EmailFolder>`;
          await writeFile(tempFilePath, metadataContent, 'utf-8');
          logger.debug('Created virtual folder metadata file', { nodeId, tempFilePath, componentType: component.type });
        } else {
          // Read original and write to temp (preserves file structure)
          const originalContent = await readFile(relativePath, 'utf-8');
          await writeFile(tempFilePath, originalContent, 'utf-8');
        }

        // Track all files in temp directory
        result.tempFiles.set(nodeId, tempFilePath);
      }

      // Check if component has dependencies not yet available
      const unavailableDeps = this.getUnavailableDependencies(component, availableUpToWave, options.componentMap);

      if (unavailableDeps.length > 0) {
        componentsToSimplify.push({
          nodeId,
          component: { ...component, filePath: tempFilePath },
        });
      }
    }

    // Simplify components in temp directory
    for (const { nodeId, component } of componentsToSimplify) {
      const unavailableDeps = this.getUnavailableDependencies(component, availableUpToWave, options.componentMap);

      logger.debug('Simplifying component', {
        nodeId,
        unavailableDeps,
      });

      try {
        const simplified = await this.simplifyComponent(component, unavailableDeps, options.componentMap);

        if (simplified) {
          result.simplified = true;
          result.simplifiedComponents.push(nodeId);
          result.removedReferences.set(nodeId, unavailableDeps);
        }
      } catch (error) {
        logger.warn('Failed to simplify component', {
          nodeId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (result.simplified || result.tempFiles.size > 0) {
      result.tempProjectRoot = tempProjectRoot;
    } else {
      // Clean up temp directory if no simplification was needed
      await fs.rm(tempProjectRoot, { recursive: true, force: true });
    }

    logger.info('Simplification completed', {
      simplified: result.simplified,
      componentsSimplified: result.simplifiedComponents.length,
      tempProjectRoot: result.tempProjectRoot,
    });

    return result;
  }

  /**
   * Copy directory recursively (for bundle types like DigitalExperienceBundle)
   */
  private async copyDirectoryRecursive(sourceDir: string, destDir: string): Promise<void> {
    try {
      await fs.mkdir(destDir, { recursive: true });

      const entries = await fs.readdir(sourceDir, { withFileTypes: true });

      for (const entry of entries) {
        const sourcePath = path.join(sourceDir, entry.name);
        const destPath = path.join(destDir, entry.name);

        if (entry.isDirectory()) {
          await this.copyDirectoryRecursive(sourcePath, destPath);
        } else {
          const content = await readFile(sourcePath, 'utf-8');
          await writeFile(destPath, content, 'utf-8');
        }
      }
    } catch (error) {
      logger.warn('Failed to copy directory recursively', {
        sourceDir,
        destDir,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Simplify a single component by removing unavailable references
   */
  private async simplifyComponent(
    component: MetadataComponent,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): Promise<{ tempPath: string } | null> {
    try {
      const originalContent = await readFile(component.filePath, 'utf-8');

      const commentedXml = this.commentOutProblematicReferences(
        originalContent,
        component,
        unavailableDeps,
        componentMap
      );

      if (commentedXml) {
        await writeFile(component.filePath, commentedXml, 'utf-8');
        logger.debug('Simplified file with commented references', {
          nodeId: `${component.type}:${component.name}`,
          filePath: component.filePath,
          removedDeps: unavailableDeps.length,
        });
        return { tempPath: component.filePath };
      }

      const isXmlMetadata =
        component.filePath.endsWith('.xml') ||
        component.filePath.endsWith('-meta.xml') ||
        component.filePath.endsWith('.flow-meta.xml') ||
        component.filePath.endsWith('.cls-meta.xml');

      if (!isXmlMetadata) {
        logger.warn('Cannot simplify non-XML metadata component', {
          nodeId: `${component.type}:${component.name}`,
          filePath: component.filePath,
          unavailableDeps,
        });
        return null;
      }

      const parsed = this.parser.parse(originalContent);

      // Simplify based on type
      let simplified: any;
      switch (component.type) {
        case 'PermissionSet':
          simplified = this.simplifyPermissionSet(parsed, unavailableDeps, componentMap);
          break;
        case 'FlexiPage':
          simplified = this.simplifyFlexiPage(parsed, unavailableDeps, componentMap);
          break;
        case 'Profile':
          simplified = this.simplifyProfile(parsed, unavailableDeps, componentMap);
          break;
        case 'Layout':
          simplified = this.simplifyLayout(parsed, unavailableDeps, componentMap);
          break;
        case 'CustomObject':
          simplified = this.simplifyCustomObject(parsed, unavailableDeps, componentMap);
          break;
        case 'VisualforcePage':
          return null;
        default:
          logger.debug('No specific simplification handler for type, skipping', {
            type: component.type,
            nodeId: `${component.type}:${component.name}`,
          });
          return null;
      }

      if (!simplified) {
        return null;
      }

      // Fallback to XMLBuilder
      let simplifiedXml = this.builder.build(simplified);
      // Fix XML version declaration if needed (XMLBuilder sometimes generates version="1" instead of "1.0")
      if (simplifiedXml.includes('<?xml version="1"')) {
        simplifiedXml = simplifiedXml.replace('<?xml version="1"', '<?xml version="1.0"');
      }
      await writeFile(component.filePath, simplifiedXml, 'utf-8');

      logger.debug('Created simplified file', {
        nodeId: `${component.type}:${component.name}`,
        tempPath: component.filePath,
        removedDeps: unavailableDeps.length,
      });

      return { tempPath: component.filePath };
    } catch (error) {
      logger.error('Failed to simplify component', {
        component: component.name,
        type: component.type,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Simplify Permission Set by removing unavailable references
   */
  private simplifyPermissionSet(
    parsed: any,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): any {
    const permissionSet = parsed.PermissionSet || parsed;
    if (!permissionSet) {
      return null;
    }

    const simplified = JSON.parse(JSON.stringify(parsed)); // Deep clone
    const ps = simplified.PermissionSet || simplified;

    // Remove unavailable Apex class accesses
    if (ps.classAccesses) {
      const classAccesses = Array.isArray(ps.classAccesses) ? ps.classAccesses : [ps.classAccesses];
      ps.classAccesses = classAccesses.filter((access: any) => {
        const className = access.apexClass || access.apexClass?.['#text'];
        if (!className) return true;
        const nodeId = `ApexClass:${className}`;
        return !unavailableDeps.includes(nodeId);
      });
      if (ps.classAccesses.length === 0) {
        delete ps.classAccesses;
      } else if (ps.classAccesses.length === 1) {
        ps.classAccesses = ps.classAccesses[0];
      }
    }

    // Remove unavailable Flow accesses
    if (ps.flowAccesses) {
      const flowAccesses = Array.isArray(ps.flowAccesses) ? ps.flowAccesses : [ps.flowAccesses];
      ps.flowAccesses = flowAccesses.filter((access: any) => {
        const flowName = access.flow || access.flow?.['#text'];
        if (!flowName) return true;
        const nodeId = `Flow:${flowName}`;
        return !unavailableDeps.includes(nodeId);
      });
      if (ps.flowAccesses.length === 0) {
        delete ps.flowAccesses;
      } else if (ps.flowAccesses.length === 1) {
        ps.flowAccesses = ps.flowAccesses[0];
      }
    }

    return simplified;
  }

  /**
   * Simplify FlexiPage by removing unavailable references
   */
  private simplifyFlexiPage(parsed: any, unavailableDeps: NodeId[], componentMap: Map<NodeId, MetadataComponent>): any {
    // Handle preserveOrder format: {tagName: 'FlexiPage', children: [...]}
    let flexiPage: any;
    if (parsed.tagName === 'FlexiPage') {
      flexiPage = parsed;
    } else if (parsed.FlexiPage) {
      flexiPage = parsed.FlexiPage;
    } else {
      flexiPage = parsed;
    }

    if (!flexiPage) {
      return null;
    }

    // Deep clone preserving structure
    const simplified = JSON.parse(JSON.stringify(parsed));
    let fp: any;
    if (simplified.tagName === 'FlexiPage') {
      fp = simplified;
    } else if (simplified.FlexiPage) {
      fp = simplified.FlexiPage;
    } else {
      fp = simplified;
    }

    // Remove unavailable LWC components
    if (fp.flexiPageRegions) {
      const regions = Array.isArray(fp.flexiPageRegions) ? fp.flexiPageRegions : [fp.flexiPageRegions];

      for (const region of regions) {
        if (region.componentInstances) {
          const instances = Array.isArray(region.componentInstances)
            ? region.componentInstances
            : [region.componentInstances];

          region.componentInstances = instances.filter((instance: any) => {
            const compName = instance.componentName || instance.componentName?.['#text'];
            if (!compName) return true;

            // Check if it's an LWC component
            if (compName.startsWith('c:')) {
              const lwcName = compName.substring(2);
              const nodeId = `LightningComponentBundle:${lwcName}`;
              return !unavailableDeps.includes(nodeId);
            }

            // Check if it's a Flow
            if (compName === 'flowruntime:interview') {
              // Extract flow name from properties
              const props = instance.componentInstanceProperties;
              if (props) {
                const propsArray = Array.isArray(props) ? props : [props];
                for (const prop of propsArray) {
                  if (prop.name === 'flowName' || prop.name?.['#text'] === 'flowName') {
                    const flowName = prop.value || prop.value?.['#text'];
                    if (flowName) {
                      const nodeId = `Flow:${flowName}`;
                      return !unavailableDeps.includes(nodeId);
                    }
                  }
                }
              }
            }

            return true;
          });

          if (region.componentInstances.length === 0) {
            delete region.componentInstances;
          } else if (region.componentInstances.length === 1) {
            region.componentInstances = region.componentInstances[0];
          }
        }
      }
    }

    return simplified;
  }

  /**
   * Simplify Profile (similar to Permission Set)
   */
  private simplifyProfile(parsed: any, unavailableDeps: NodeId[], componentMap: Map<NodeId, MetadataComponent>): any {
    // Similar logic to Permission Set
    return this.simplifyPermissionSet(parsed, unavailableDeps, componentMap);
  }

  /**
   * Simplify Layout (remove unavailable field references)
   */
  private simplifyLayout(parsed: any, unavailableDeps: NodeId[], componentMap: Map<NodeId, MetadataComponent>): any {
    // Layout simplification is less critical, but can be implemented if needed
    return parsed; // For now, return as-is
  }

  /**
   * Simplify Custom Object by removing actionOverrides that reference unavailable FlexiPages
   */
  private simplifyCustomObject(
    parsed: any,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): any {
    // Handle preserveOrder format: [{tagName: 'CustomObject', ...}]
    let customObject: any;
    let rootKey = 'CustomObject';

    if (Array.isArray(parsed) && parsed[0]?.tagName === 'CustomObject') {
      customObject = parsed[0];
    } else if (parsed.CustomObject) {
      customObject = parsed.CustomObject;
    } else if (typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      rootKey = Object.keys(parsed)[0];
      customObject = parsed[rootKey];
    } else {
      return null;
    }

    if (!customObject) {
      return null;
    }
    const unavailableFlexiPages = new Set<string>();

    // Extract FlexiPage names from unavailable dependencies
    for (const dep of unavailableDeps) {
      if (dep.startsWith('FlexiPage:')) {
        const flexiPageName = dep.substring('FlexiPage:'.length);
        unavailableFlexiPages.add(flexiPageName);
      }
    }

    if (unavailableFlexiPages.size === 0) {
      return null; // No FlexiPage dependencies to remove
    }

    // Remove actionOverrides that reference unavailable FlexiPages
    // Handle preserveOrder format: actionOverrides can be in children array
    let actionOverrides: any[] = [];

    if (customObject.tagName === 'CustomObject' && Array.isArray(customObject.children)) {
      // preserveOrder format: find actionOverrides in children
      const actionOverridesNodes = customObject.children.filter((child: any) => child.tagName === 'actionOverrides');
      for (const node of actionOverridesNodes) {
        if (Array.isArray(node.children)) {
          actionOverrides.push(node);
        } else {
          actionOverrides.push(node);
        }
      }
    } else if (customObject.actionOverrides) {
      // Normal format
      actionOverrides = Array.isArray(customObject.actionOverrides)
        ? customObject.actionOverrides
        : [customObject.actionOverrides];
    }

    if (actionOverrides.length === 0) {
      return null; // No actionOverrides to process
    }

    const filteredOverrides = actionOverrides.filter((override: any) => {
      // Handle preserveOrder format: {tagName: 'actionOverrides', children: [...]}
      let overrideType = '';
      let overrideContent = '';

      if (override.tagName === 'actionOverrides' && Array.isArray(override.children)) {
        // preserveOrder format - extract type and content from children
        for (const child of override.children) {
          if (child.tagName === 'type' || child.tagName === 'Type') {
            overrideType = child['#text'] || child['#cdata-section'] || '';
          }
          if (child.tagName === 'content' || child.tagName === 'Content') {
            overrideContent = child['#text'] || child['#cdata-section'] || '';
          }
        }
      } else {
        // Normal format
        overrideType = override.type || override['@_type'] || '';
        overrideContent = override.content || override['#text'] || '';
      }

      // Handle both 'Flexipage' and 'FlexiPage' (case variations)
      if ((overrideType === 'Flexipage' || overrideType === 'FlexiPage') && overrideContent) {
        const shouldKeep = !unavailableFlexiPages.has(overrideContent);
        logger.debug('Filtering actionOverride', {
          type: overrideType,
          content: overrideContent,
          shouldKeep,
          unavailableFlexiPages: Array.from(unavailableFlexiPages),
        });
        return shouldKeep;
      }
      return true; // Keep non-FlexiPage overrides
    });

    if (filteredOverrides.length === actionOverrides.length) {
      logger.debug('No actionOverrides removed', {
        totalOverrides: actionOverrides.length,
        unavailableFlexiPages: Array.from(unavailableFlexiPages),
      });
      return null; // No changes needed
    }

    // Create simplified version preserving structure
    let simplified: any;
    if (Array.isArray(parsed) && parsed[0]?.tagName === 'CustomObject') {
      // preserveOrder format - clone and update children
      simplified = JSON.parse(JSON.stringify(parsed));
      const simplifiedObj = simplified[0];
      if (Array.isArray(simplifiedObj.children)) {
        // Remove actionOverrides nodes that reference unavailable FlexiPages
        simplifiedObj.children = simplifiedObj.children.filter((child: any) => {
          if (child.tagName === 'actionOverrides') {
            // Check if this override should be kept
            let overrideType = '';
            let overrideContent = '';
            if (Array.isArray(child.children)) {
              for (const c of child.children) {
                if (c.tagName === 'type' || c.tagName === 'Type') {
                  overrideType = c['#text'] || c['#cdata-section'] || '';
                }
                if (c.tagName === 'content' || c.tagName === 'Content') {
                  overrideContent = c['#text'] || c['#cdata-section'] || '';
                }
              }
            }
            if ((overrideType === 'Flexipage' || overrideType === 'FlexiPage') && overrideContent) {
              return !unavailableFlexiPages.has(overrideContent);
            }
          }
          return true; // Keep all other children
        });
      }
    } else {
      // Normal format
      const normalRootKey = Object.keys(parsed)[0] || 'CustomObject';
      simplified = {
        ...parsed,
        [normalRootKey]: {
          ...customObject,
          actionOverrides: filteredOverrides.length > 0 ? filteredOverrides : undefined,
        },
      };
    }

    logger.debug('Simplified CustomObject', {
      removedOverrides: actionOverrides.length - filteredOverrides.length,
      unavailableFlexiPages: Array.from(unavailableFlexiPages),
    });

    return simplified;
  }

  /**
   * Comment out problematic references in XML content
   */
  private commentOutProblematicReferences(
    originalContent: string,
    component: MetadataComponent,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): string | null {
    // Handle VisualforcePage - comment out references to unavailable Experience Cloud components
    if (component.type === 'VisualforcePage') {
      // Extract component names from unavailable dependencies
      const unavailableComponentNames = new Set<string>();
      for (const dep of unavailableDeps) {
        // Extract component name from NodeId
        if (dep.startsWith('LightningComponentBundle:')) {
          const compName = dep.substring('LightningComponentBundle:'.length);
          unavailableComponentNames.add(compName.toLowerCase());
          unavailableComponentNames.add(`c:${compName.toLowerCase()}`);
        } else if (dep.startsWith('StaticResource:')) {
          const resName = dep.substring('StaticResource:'.length);
          unavailableComponentNames.add(resName);
        } else if (dep.startsWith('VisualforceComponent:')) {
          const vfCompName = dep.substring('VisualforceComponent:'.length);
          unavailableComponentNames.add(vfCompName);
        }
      }

      if (unavailableComponentNames.size === 0) {
        return null;
      }

      let modifiedContent = originalContent;
      let modified = false;

      const includePattern = /(<apex:include[^>]*componentName\s*=\s*["']([^"']+)["'][^>]*\/?>)/gi;
      const includeMatches = Array.from(modifiedContent.matchAll(includePattern));

      for (const match of includeMatches.reverse()) {
        const componentName = match[2];
        if (unavailableComponentNames.has(componentName)) {
          const fullMatch = match[0];
          const commented = `<!-- ${fullMatch} -->`;
          modifiedContent =
            modifiedContent.substring(0, match.index) +
            commented +
            modifiedContent.substring(match.index + fullMatch.length);
          modified = true;
        }
      }

      const imagePattern =
        /(<apex:image[^>]*url\s*=\s*["']\{!URLFOR\(\$Resource\.([^,]+)[^)]*\)\}[^"']*["'][^>]*\/?>)/gi;
      const imageMatches = Array.from(modifiedContent.matchAll(imagePattern));

      for (const match of imageMatches.reverse()) {
        const resourceName = match[2];
        if (unavailableComponentNames.has(resourceName)) {
          const fullMatch = match[0];
          const commented = `<!-- ${fullMatch} -->`;
          modifiedContent =
            modifiedContent.substring(0, match.index) +
            commented +
            modifiedContent.substring(match.index + fullMatch.length);
          modified = true;
        }
      }

      const lightningPattern = /(<lightning:component[^>]*componentName\s*=\s*["']([^"']+)["'][^>]*\/?>)/gi;
      const lightningMatches = Array.from(modifiedContent.matchAll(lightningPattern));

      for (const match of lightningMatches.reverse()) {
        const componentName = match[2].toLowerCase();
        if (unavailableComponentNames.has(componentName)) {
          const fullMatch = match[0];
          const commented = `<!-- ${fullMatch} -->`;
          modifiedContent =
            modifiedContent.substring(0, match.index) +
            commented +
            modifiedContent.substring(match.index + fullMatch.length);
          modified = true;
        }
      }

      return modified ? modifiedContent : null;
    }

    if (component.type === 'CustomObject') {
      // Extract FlexiPage names from unavailable dependencies
      const unavailableFlexiPages = new Set<string>();
      for (const dep of unavailableDeps) {
        if (dep.startsWith('FlexiPage:')) {
          const flexiPageName = dep.substring('FlexiPage:'.length);
          unavailableFlexiPages.add(flexiPageName);
        }
      }

      if (unavailableFlexiPages.size === 0) {
        return null;
      }

      let modifiedContent = originalContent;
      let modified = false;
      const actionOverridePattern = /(<actionOverrides>[\s\S]*?<\/actionOverrides>)/g;
      for (const flexiPageName of unavailableFlexiPages) {
        // Re-match each time since indices change after each replacement
        const allMatches = Array.from(modifiedContent.matchAll(actionOverridePattern));
        const matchingOverrides: Array<{ match: RegExpMatchArray; block: string }> = [];

        // Find all actionOverrides that reference this FlexiPage
        for (const match of allMatches) {
          const overrideBlock = match[0];
          if (overrideBlock.includes(`<content>${flexiPageName}</content>`)) {
            // Check if it's a Flexipage type
            if (overrideBlock.includes('<type>Flexipage</type>') || overrideBlock.includes('<type>FlexiPage</type>')) {
              matchingOverrides.push({ match, block: overrideBlock });
            }
          }
        }

        if (matchingOverrides.length > 0) {
          // Find the first and last match indices
          const firstMatch = matchingOverrides[0].match;
          const lastMatch = matchingOverrides[matchingOverrides.length - 1].match;
          const firstIndex = firstMatch.index!;
          const lastIndex = lastMatch.index! + lastMatch[0].length;

          // Extract the entire block from first to last (including everything in between)
          const blockToComment = modifiedContent.substring(firstIndex, lastIndex);

          const commentedBlock = `<!-- Simplified: FlexiPage ${flexiPageName} not available in this wave -->\n<!--\n${blockToComment}\n-->\n`;

          // Replace the entire block
          const beforeBlock = modifiedContent.substring(0, firstIndex);
          const afterBlock = modifiedContent.substring(lastIndex);
          modifiedContent = beforeBlock + commentedBlock + afterBlock;
          modified = true;

          logger.debug('Commented out actionOverrides block', {
            component: component.name,
            flexiPage: flexiPageName,
            count: matchingOverrides.length,
            firstIndex,
            lastIndex,
          });
        }
      }

      return modified ? modifiedContent : null;
    } else if (component.type === 'FlexiPage') {
      let modifiedContent = originalContent;
      let modified = false;
      const unavailableComponents = new Set<string>();
      for (const dep of unavailableDeps) {
        if (dep.startsWith('LightningComponentBundle:')) {
          unavailableComponents.add(`c:${dep.substring('LightningComponentBundle:'.length)}`);
        } else if (dep.startsWith('Flow:')) {
          unavailableComponents.add(dep.substring('Flow:'.length));
        }
      }

      if (unavailableComponents.size === 0) {
        return null;
      }

      const componentInstancePattern = /(<componentInstance>[\s\S]*?<\/componentInstance>)/g;
      const matches = originalContent.matchAll(componentInstancePattern);

      for (const match of matches) {
        const instanceBlock = match[0];
        for (const compName of unavailableComponents) {
          if (
            instanceBlock.includes(`<componentName>${compName}</componentName>`) ||
            new RegExp(`flowName.*${compName}`).test(instanceBlock)
          ) {
            const commentedBlock = `<!-- Simplified: Component ${compName} not available in this wave -->\n<!--\n${instanceBlock}\n-->\n`;
            modifiedContent = modifiedContent.replace(instanceBlock, commentedBlock);
            modified = true;
            logger.debug('Commented out componentInstance', {
              component: component.name,
              unavailableComponent: compName,
            });
            break;
          }
        }
      }

      return modified ? modifiedContent : null;
    }

    if (component.type === 'PermissionSetGroup') {
      const unavailablePermissionSets = new Set<string>();
      for (const dep of unavailableDeps) {
        if (dep.startsWith('PermissionSet:')) {
          unavailablePermissionSets.add(dep.substring('PermissionSet:'.length));
        }
      }

      if (unavailablePermissionSets.size === 0) {
        return null;
      }

      let modifiedContent = originalContent;
      let modified = false;

      const permissionSetPattern = /(<permissionSets>[\s\S]*?<\/permissionSets>)/g;
      const matches = Array.from(modifiedContent.matchAll(permissionSetPattern));

      for (const match of matches.reverse()) {
        const block = match[0];
        for (const psName of unavailablePermissionSets) {
          if (
            block.includes(`<permissionSet>${psName}</permissionSet>`) ||
            block.includes(`<permissionSet>${psName}</permissionSet>`)
          ) {
            const commented = `<!-- Simplified: PermissionSet ${psName} not available in this wave -->\n<!--\n${block}\n-->\n`;
            modifiedContent =
              modifiedContent.substring(0, match.index) +
              commented +
              modifiedContent.substring(match.index + block.length);
            modified = true;
            break;
          }
        }
      }

      return modified ? modifiedContent : null;
    }

    if (component.type === 'Flow') {
      const unavailableApexClasses = new Set<string>();
      const unavailableFlows = new Set<string>();
      const unavailablePrompts = new Set<string>();

      for (const dep of unavailableDeps) {
        if (dep.startsWith('ApexClass:')) {
          unavailableApexClasses.add(dep.substring('ApexClass:'.length));
        } else if (dep.startsWith('Flow:')) {
          unavailableFlows.add(dep.substring('Flow:'.length));
        } else if (dep.startsWith('GenAiPromptTemplate:') || dep.startsWith('GenAIPromptTemplate:')) {
          unavailablePrompts.add(dep.substring(dep.indexOf(':') + 1));
        }
      }

      if (unavailableApexClasses.size === 0 && unavailableFlows.size === 0 && unavailablePrompts.size === 0) {
        return null;
      }

      let modifiedContent = originalContent;
      let modified = false;

      if (unavailableApexClasses.size > 0) {
        const apexActionPattern = /(<apexActionCalls>[\s\S]*?<\/apexActionCalls>)/g;
        const matches = Array.from(modifiedContent.matchAll(apexActionPattern));

        for (const match of matches.reverse()) {
          const block = match[0];
          for (const className of unavailableApexClasses) {
            if (
              block.includes(`<apexClassName>${className}</apexClassName>`) ||
              block.includes(`<apexClassName>${className}</apexClassName>`)
            ) {
              const commented = `<!-- Simplified: ApexClass ${className} not available in this wave -->\n<!--\n${block}\n-->\n`;
              modifiedContent =
                modifiedContent.substring(0, match.index) +
                commented +
                modifiedContent.substring(match.index + block.length);
              modified = true;
              break;
            }
          }
        }
      }

      if (unavailableFlows.size > 0) {
        const flowCallPattern = /(<flowCalls>[\s\S]*?<\/flowCalls>)/g;
        const matches = Array.from(modifiedContent.matchAll(flowCallPattern));

        for (const match of matches.reverse()) {
          const block = match[0];
          for (const flowName of unavailableFlows) {
            if (
              block.includes(`<flowName>${flowName}</flowName>`) ||
              block.includes(`<flowName>${flowName}</flowName>`)
            ) {
              const commented = `<!-- Simplified: Flow ${flowName} not available in this wave -->\n<!--\n${block}\n-->\n`;
              modifiedContent =
                modifiedContent.substring(0, match.index) +
                commented +
                modifiedContent.substring(match.index + block.length);
              modified = true;
              break;
            }
          }
        }
      }

      if (unavailablePrompts.size > 0) {
        const promptCallPattern = /(<promptCalls>[\s\S]*?<\/promptCalls>)/g;
        const matches = Array.from(modifiedContent.matchAll(promptCallPattern));

        for (const match of matches.reverse()) {
          const block = match[0];
          for (const promptName of unavailablePrompts) {
            if (
              block.includes(`<promptTemplate>${promptName}</promptTemplate>`) ||
              block.includes(`<promptTemplate>${promptName}</promptTemplate>`)
            ) {
              const commented = `<!-- Simplified: GenAiPromptTemplate ${promptName} not available in this wave -->\n<!--\n${block}\n-->\n`;
              modifiedContent =
                modifiedContent.substring(0, match.index) +
                commented +
                modifiedContent.substring(match.index + block.length);
              modified = true;
              break;
            }
          }
        }
      }

      return modified ? modifiedContent : null;
    }

    if (component.type === 'ApexClass') {
      logger.debug('ApexClass simplification not yet implemented', {
        nodeId: `${component.type}:${component.name}`,
        unavailableDeps,
      });
      return null;
    }

    if (component.type === 'LightningComponentBundle') {
      logger.debug('LightningComponentBundle simplification not yet implemented', {
        nodeId: `${component.type}:${component.name}`,
        unavailableDeps,
      });
      return null;
    }

    return null;
  }

  /**
   * Get components available up to a specific wave
   */
  private getAvailableComponents(waves: Wave[], upToWave: number): Set<NodeId> {
    const available = new Set<NodeId>();

    for (const wave of waves) {
      if (wave.number <= upToWave) {
        for (const nodeId of wave.components) {
          available.add(nodeId);
        }
      }
    }

    return available;
  }

  /**
   * Get dependencies that are not yet available
   */
  private getUnavailableDependencies(
    component: MetadataComponent,
    availableComponents: Set<NodeId>,
    componentMap: Map<NodeId, MetadataComponent>
  ): NodeId[] {
    const unavailable: NodeId[] = [];

    for (const dep of component.dependencies) {
      if (!availableComponents.has(dep)) {
        const isStandardRef = isStandardComponentReference(dep);
        const isInProject = componentMap.has(dep);

        if (isStandardRef && !isInProject) {
          unavailable.push(dep);
        } else if (!isStandardRef) {
          unavailable.push(dep);
        }
      }
    }

    return unavailable;
  }

  /**
   * Clean up temporary files
   */
  public async cleanupTempFiles(tempFiles: Map<NodeId, string>): Promise<void> {
    const { unlink } = await import('node:fs/promises');

    for (const [nodeId, tempPath] of tempFiles.entries()) {
      try {
        await unlink(tempPath);
        logger.debug('Cleaned up temp file', { nodeId, tempPath });
      } catch (error) {
        logger.warn('Failed to cleanup temp file', {
          nodeId,
          tempPath,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
  }
}
