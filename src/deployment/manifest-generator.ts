/**
 * Manifest Generator - US-085
 * Generates package.xml manifests for each deployment wave
 *
 * @ac US-085-AC-2: Pass manifest file
 * @issue #85
 */

import { getLogger } from '../utils/logger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Wave } from '../waves/wave-builder.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import type { Manifest } from '../types/deployment.js';
import { MetadataTypeMapper } from './metadata-type-mapper.js';
import type { AgentforceService } from '../ai/agentforce-service.js';

const logger = getLogger('ManifestGenerator');

/**
 * Map file extensions to metadata types
 * This is used to validate/correct component types based on file extension
 */
const FILE_EXTENSION_TO_TYPE: Partial<Record<string, MetadataType>> = {
  '.cls-meta.xml': 'ApexClass',
  '.trigger-meta.xml': 'ApexTrigger',
  '.object-meta.xml': 'CustomObject',
  '.page-meta.xml': 'VisualforcePage',
  '.component-meta.xml': 'VisualforceComponent',
  '.flow-meta.xml': 'Flow',
  '.layout-meta.xml': 'Layout',
  '.profile-meta.xml': 'Profile',
  '.permissionset-meta.xml': 'PermissionSet',
  '.flexipage-meta.xml': 'FlexiPage',
  '.bot-meta.xml': 'Bot',
  '.genaiPromptTemplate-meta.xml': 'GenAiPromptTemplate',
  '.app-meta.xml': 'LightningApp',
  '.labels-meta.xml': 'CustomLabels',
  '.resource-meta.xml': 'StaticResource',
  '.email-meta.xml': 'EmailTemplate',
  '.emailFolder-meta.xml': 'EmailTemplateFolder',
  '.md-meta.xml': 'CustomMetadataRecord', // Default, but check path for context
  '.permissionsetgroup-meta.xml': 'PermissionSetGroup',
  '.mutingpermissionset-meta.xml': 'MutingPermissionSet',
  '.apextestsuite-meta.xml': 'ApexTestSuite',
  '.customnotificationtype-meta.xml': 'CustomNotificationType',
  '.searchcustomization-meta.xml': 'SearchCustomization',
  '.quickaction-meta.xml': 'QuickAction',
  '.compactlayout-meta.xml': 'CompactLayout',
  '.listview-meta.xml': 'ListView',
  '.weblink-meta.xml': 'WebLink',
};

/**
 * Infer metadata type from file path and extension
 */
function inferTypeFromFile(filePath: string): MetadataType | null {
  // Check for .md-meta.xml files - need context to determine if it's a record or type
  if (filePath.endsWith('.md-meta.xml')) {
    // If in customMetadata/ directory and has dot in name (TypeName.RecordName), it's a record
    if (filePath.includes('/customMetadata/')) {
      const fileName = path.basename(filePath, '.md-meta.xml');
      if (fileName.includes('.')) {
        return 'CustomMetadataRecord';
      }
    }
    // Otherwise, it might be a type definition (legacy structure)
    // But types should be .object-meta.xml, so this is likely a record
    return 'CustomMetadataRecord';
  }

  // Check all other extensions
  for (const [extension, type] of Object.entries(FILE_EXTENSION_TO_TYPE)) {
    if (filePath.endsWith(extension) && type) {
      return type;
    }
  }

  return null;
}

export interface ManifestAdjustment {
  componentId: NodeId;
  firstWave: number;
  lastWave: number;
  wavesNeeded?: number[]; // All waves where this component is needed
}

export interface ManifestGenerationOptions {
  /** API version for package.xml */
  apiVersion?: string;
  /** Output directory for manifests */
  outputDir?: string;
  /** Whether to validate file existence */
  validateFiles?: boolean;
  /** Project root path */
  projectRoot: string;
  /** Map of NodeId to MetadataComponent */
  componentMap: Map<NodeId, MetadataComponent>;
  /** Optional AgentforceService for type inference */
  agentforceService?: AgentforceService;
  /** Manifest adjustments: components to add to first wave and remove from last wave */
  manifestAdjustments?: ManifestAdjustment[];
}

export interface ManifestGenerationResult {
  manifests: Manifest[];
  errors: string[];
  warnings: string[];
}

/**
 * Generate package.xml manifests for waves
 */
export class ManifestGenerator {
  private typeMapper: MetadataTypeMapper;
  public constructor(agentforceService?: AgentforceService) {
    this.typeMapper = new MetadataTypeMapper(agentforceService);
  }

  /**
   * Generate manifests for all waves
   */
  public async generateManifests(
    waves: Wave[],
    options: ManifestGenerationOptions
  ): Promise<ManifestGenerationResult> {
    logger.info('Generating manifests', { waves: waves.length, outputDir: options.outputDir });

    // Update type mapper with provided agentforce service if available
    if (options.agentforceService) {
      this.typeMapper = new MetadataTypeMapper(options.agentforceService);
    }

    const result: ManifestGenerationResult = {
      manifests: [],
      errors: [],
      warnings: [],
    };

    const apiVersion = options.apiVersion || '65.0';
    const outputDir = options.outputDir || path.join(options.projectRoot, '.smart-deployment', 'manifests');

    // Ensure output directory exists
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
      result.errors.push(`Failed to create output directory: ${error instanceof Error ? error.message : String(error)}`);
      return result;
    }

    // Generate manifest for each wave
    for (const wave of waves) {
      try {
        const manifest = await this.generateWaveManifest(wave, options, apiVersion, outputDir, result);
        if (manifest) {
          result.manifests.push(manifest);
        }
      } catch (error) {
        const errorMsg = `Failed to generate manifest for wave ${wave.number}: ${error instanceof Error ? error.message : String(error)}`;
        logger.error(errorMsg, { error, wave: wave.number });
        result.errors.push(errorMsg);
      }
    }

    // Apply manifest adjustments: add components to first wave, remove from last wave
    if (options.manifestAdjustments && options.manifestAdjustments.length > 0) {
      await this.applyManifestAdjustments(result, options, apiVersion, outputDir);
    }

    logger.info('Manifest generation completed', {
      manifests: result.manifests.length,
      errors: result.errors.length,
      warnings: result.warnings.length,
      adjustments: options.manifestAdjustments?.length || 0,
    });

    return result;
  }

  /**
   * Generate package.xml for a single wave
   */
  private async generateWaveManifest(
    wave: Wave,
    options: ManifestGenerationOptions,
    apiVersion: string,
    outputDir: string,
    resultRef?: ManifestGenerationResult
  ): Promise<Manifest | null> {
    // Group components by metadata type
    const componentsByType = new Map<MetadataType, Set<string>>();

    for (const nodeId of wave.components) {
      let component = options.componentMap.get(nodeId);
      if (!component) {
        // Component might be ignored by .forceignore but still in the wave
        // Try to scan it directly for dependency analysis
        logger.debug('Component not found in map, may be ignored', { nodeId });

        // Component might be ignored by .forceignore but still in the wave
        // For now, we'll skip it and log a warning
        logger.debug('Component not found in map, may be ignored', { nodeId });

        if (!component) {
          logger.warn('Component not found in map and could not be scanned', { nodeId });
          continue;
        }
      }

      // Ensure component type matches file extension
      // Use file extension as source of truth to validate/correct component type
      const inferredType = inferTypeFromFile(component.filePath);
      if (inferredType && component.type !== inferredType) {
        logger.warn('Correcting component type based on file extension', {
          nodeId,
          componentName: component.name,
          incorrectType: component.type,
          correctType: inferredType,
          filePath: component.filePath,
        });
        // Create a corrected component
        component = {
          ...component,
          type: inferredType,
        };
      }

      // Always validate file exists (required for deployment)
      // Exception: EmailTemplateFolder may have virtual paths for folders without metadata files (e.g., unfiled$public)
      const isVirtualEmailFolder = component.type === 'EmailTemplateFolder' &&
        component.filePath.includes('.emailFolder-meta.xml') &&
        !component.filePath.includes('/email/') &&
        !(await this.validateFileExists(component.filePath, options.projectRoot));

      if (!isVirtualEmailFolder) {
        const fileExists = await this.validateFileExists(component.filePath, options.projectRoot);
        if (!fileExists) {
          logger.warn('Component file not found, skipping from manifest', { nodeId, filePath: component.filePath, componentName: component.name });
          if (resultRef) {
            resultRef.warnings.push(`Component "${component.name}" (${component.type}) file not found: ${component.filePath}`);
          }
          continue;
        }
      }

      // Use type mapper (with Agentforce fallback)
      const salesforceType = await this.typeMapper.mapToSalesforceType(component.type);
      if (!salesforceType) {
        logger.warn('Unknown metadata type (could not map to Salesforce type)', { type: component.type, nodeId });
        continue;
      }

      // Prevent components ending in __mdt from being added as CustomMetadata
      // They should always be CustomObject
      if (component.name.endsWith('__mdt') && component.type === 'CustomMetadata') {
        logger.debug('Skipping __mdt component with incorrect type CustomMetadata', {
          nodeId,
          componentName: component.name,
          filePath: component.filePath,
        });
        continue;
      }

      // Check for duplicate components with same name but different types
      // Use a Set to track all component names we've seen
      const seenComponentNames = new Set<string>();
      for (const [, names] of componentsByType.entries()) {
        for (const name of names) {
          seenComponentNames.add(name);
        }
      }

      // If we've already seen this component name, check which type is correct
      if (seenComponentNames.has(component.name)) {
        // Find the existing component(s) with this name - iterate directly to avoid creating array
        const existingComponents: MetadataComponent[] = [];
        for (const c of options.componentMap.values()) {
          if (c.name === component.name) {
            existingComponents.push(c);
          }
        }

        // Determine correct type based on file extension
        const currentInferredType = inferTypeFromFile(component.filePath);

        // If current component has correct type, remove incorrect ones
        if (currentInferredType === component.type) {
          for (const existingComp of existingComponents) {
            if (existingComp.type !== component.type) {
              const existingInferredType = inferTypeFromFile(existingComp.filePath);
              if (existingInferredType !== existingComp.type) {
                // Remove incorrect type from componentsByType
                const incorrectTypeSet = componentsByType.get(existingComp.type);
                if (incorrectTypeSet) {
                  incorrectTypeSet.delete(component.name);
                  logger.debug('Removed duplicate component with incorrect type', {
                    componentName: component.name,
                    incorrectType: existingComp.type,
                    correctType: component.type,
                  });
                }
              }
            }
          }
        } else {
          // Current component has incorrect type, skip it
          logger.debug('Skipping component with incorrect type', {
            nodeId,
            componentName: component.name,
            incorrectType: component.type,
            correctType: currentInferredType,
            filePath: component.filePath,
          });
          continue;
        }
      }

      if (!componentsByType.has(component.type)) {
        componentsByType.set(component.type, new Set());
      }
      componentsByType.get(component.type)!.add(component.name);
    }

    if (componentsByType.size === 0) {
      logger.warn('No valid components for wave', { wave: wave.number });
      return null;
    }

    // Generate XML content
    const xmlContent = await this.generatePackageXml(componentsByType, apiVersion);

    // Write manifest file
    const fileName = `wave-${String(wave.number).padStart(3, '0')}-package.xml`;
    const filePath = path.join(outputDir, fileName);

    await fs.writeFile(filePath, xmlContent, 'utf-8');

    logger.info('Generated manifest', { wave: wave.number, fileName, components: wave.components.length });

    return {
      fileName,
      content: xmlContent,
      components: this.convertToRecord(componentsByType),
      apiVersion,
    };
  }

  /**
   * Generate package.xml XML content
   */
  private async generatePackageXml(componentsByType: Map<MetadataType, Set<string>>, apiVersion: string): Promise<string> {
    const lines: string[] = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
    ];

    // Group by Salesforce metadata type (some MetadataType map to same Salesforce type)
    const salesforceTypeMap = new Map<string, Set<string>>();

    // Map all types to Salesforce types (using type mapper)
    // Use iterator directly to avoid creating intermediate array
    const typeMappingPromises: Array<Promise<{ metadataType: MetadataType; salesforceType: string | null; componentNames: Set<string> }>> = [];
    for (const [metadataType, componentNames] of componentsByType.entries()) {
      typeMappingPromises.push(
        (async () => {
          const salesforceType = await this.typeMapper.mapToSalesforceType(metadataType);
          return { metadataType, salesforceType, componentNames };
        })()
      );
    }

    const typeMappings = await Promise.all(typeMappingPromises);

    for (const { metadataType, salesforceType, componentNames } of typeMappings) {
      if (!salesforceType) continue;

      if (!salesforceTypeMap.has(salesforceType)) {
        salesforceTypeMap.set(salesforceType, new Set());
      }

      for (const name of componentNames) {
        // Components ending in __mdt should have been filtered out earlier if they were CustomMetadata
        // This is a safety check in case something slipped through
        if (name.endsWith('__mdt') && salesforceType === 'CustomMetadata') {
          logger.warn('Skipping __mdt component from CustomMetadata section (should be CustomObject)', { name, metadataType, salesforceType });
          continue;
        }

        salesforceTypeMap.get(salesforceType)!.add(name);
      }
    }

    // Generate types elements
    // Track which components we've already added to avoid duplicates
    const addedComponents = new Set<string>();

    // Process CustomObject first to ensure __mdt types are there
    const customObjectSet = salesforceTypeMap.get('CustomObject');
    if (customObjectSet) {
      lines.push('  <types>');
      for (const name of Array.from(customObjectSet).sort()) {
        lines.push(`    <members>${this.escapeXml(name)}</members>`);
        addedComponents.add(name);
      }
      lines.push(`    <name>CustomObject</name>`);
      lines.push('  </types>');
    }

    // Process other types, excluding duplicates
    for (const [salesforceType, componentNames] of salesforceTypeMap.entries()) {
      if (salesforceType === 'CustomObject') continue; // Already processed

      // Filter out duplicates: if a component ending in __mdt is already in CustomObject, skip it
      const filteredNames = Array.from(componentNames).filter(name => {
        if (name.endsWith('__mdt') && salesforceType === 'CustomMetadata') {
          // Check if this component is already in CustomObject section
          if (customObjectSet && customObjectSet.has(name)) {
            logger.debug('Skipping duplicate __mdt component from CustomMetadata (already in CustomObject)', { name });
            return false;
          }
        }
        // Also check if we've already added this component
        if (addedComponents.has(name)) {
          logger.debug('Skipping duplicate component', { name, salesforceType });
          return false;
        }
        addedComponents.add(name);
        return true;
      });

      if (filteredNames.length === 0) continue;

      lines.push('  <types>');
      for (const name of filteredNames.sort()) {
        lines.push(`    <members>${this.escapeXml(name)}</members>`);
      }
      lines.push(`    <name>${salesforceType}</name>`);
      lines.push('  </types>');
    }

    lines.push(`  <version>${apiVersion}</version>`);
    lines.push('</Package>');

    return lines.join('\n');
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Validate that file exists in project
   */
  private async validateFileExists(filePath: string, projectRoot: string): Promise<boolean> {
    try {
      const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
      await fs.access(fullPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Convert Map to Record for Manifest interface
   */
  private convertToRecord(componentsByType: Map<MetadataType, Set<string>>): Record<string, string[]> {
    const record: Record<string, string[]> = {};
    for (const [type, names] of componentsByType.entries()) {
      record[type] = Array.from(names).sort();
    }
    return record;
  }

  /**
   * Apply manifest adjustments: add components to first wave XML, remove from last wave XML
   */
  private async applyManifestAdjustments(
    result: ManifestGenerationResult,
    options: ManifestGenerationOptions,
    apiVersion: string,
    outputDir: string
  ): Promise<void> {
    if (!options.manifestAdjustments || options.manifestAdjustments.length === 0) {
      return;
    }

    logger.info('Applying manifest adjustments', { count: options.manifestAdjustments.length });

    for (const adjustment of options.manifestAdjustments) {
      const component = options.componentMap.get(adjustment.componentId);
      if (!component) {
        logger.warn('Component not found for adjustment', { componentId: adjustment.componentId });
        continue;
      }

      const componentName = component.name;
      const componentType = component.type;

      // Determine which waves need this component
      const wavesToAdd = adjustment.wavesNeeded || [adjustment.firstWave];

      // Find manifests for all waves where this component is needed
      const manifestsToUpdate: Array<{ manifest: Manifest; waveNum: number }> = [];

      for (const waveIdx of wavesToAdd) {
        const manifest = result.manifests.find(m => {
          const waveNum = parseInt(m.fileName.match(/wave-(\d+)-package\.xml/)?.[1] || '0');
          return waveNum === waveIdx + 1; // Wave numbers are 1-based in filenames
        });

        if (manifest) {
          manifestsToUpdate.push({ manifest, waveNum: waveIdx + 1 });
        } else {
          logger.warn('Wave manifest not found for adjustment', {
            componentId: adjustment.componentId,
            wave: waveIdx + 1,
          });
        }
      }

      // Find manifest for last wave (to remove from there)
      const lastWaveManifest = result.manifests.find(m => {
        const waveNum = parseInt(m.fileName.match(/wave-(\d+)-package\.xml/)?.[1] || '0');
        return waveNum === adjustment.lastWave + 1;
      });

      if (manifestsToUpdate.length === 0) {
        logger.warn('No wave manifests found for adjustment', {
          componentId: adjustment.componentId,
          wavesNeeded: wavesToAdd.map(w => w + 1),
        });
        continue;
      }

      if (!lastWaveManifest) {
        logger.warn('Last wave manifest not found for adjustment', {
          componentId: adjustment.componentId,
          lastWave: adjustment.lastWave + 1,
        });
      }

      // Map component type to Salesforce type
      const salesforceType = await this.typeMapper.mapToSalesforceType(componentType);
      if (!salesforceType) {
        logger.warn('Could not map component type for adjustment', {
          componentId: adjustment.componentId,
          componentType,
        });
        continue;
      }

      // Add to all waves where it's needed
      for (const { manifest, waveNum: _unused } of manifestsToUpdate) {
        const updatedXml = await this.addComponentToManifestXml(
          manifest.content,
          salesforceType,
          componentName
        );

        // Update manifest object
        manifest.content = updatedXml;
        if (!manifest.components[componentType]) {
          manifest.components[componentType] = [];
        }
        if (!manifest.components[componentType].includes(componentName)) {
          manifest.components[componentType].push(componentName);
          manifest.components[componentType].sort();
        }

        // Rewrite manifest file
        await fs.writeFile(
          path.join(outputDir, manifest.fileName),
          updatedXml,
          'utf-8'
        );
      }

      // Remove from last wave XML (if it exists and is different from waves where it's needed)
      if (lastWaveManifest && !wavesToAdd.includes(adjustment.lastWave)) {
        const lastWaveXml = await this.removeComponentFromManifestXml(
          lastWaveManifest.content,
          salesforceType,
          componentName
        );

        lastWaveManifest.content = lastWaveXml;
        if (lastWaveManifest.components[componentType]) {
          const index = lastWaveManifest.components[componentType].indexOf(componentName);
          if (index > -1) {
            lastWaveManifest.components[componentType].splice(index, 1);
          }
        }

        // Rewrite last wave manifest file
        await fs.writeFile(
          path.join(outputDir, lastWaveManifest.fileName),
          lastWaveXml,
          'utf-8'
        );
      }

      logger.debug('Applied manifest adjustment', {
        component: componentName,
        wavesAdded: manifestsToUpdate.map(m => m.waveNum),
        lastWave: adjustment.lastWave + 1,
      });
    }
  }

  /**
   * Add a component to a manifest XML
   */
  private async addComponentToManifestXml(
    xmlContent: string,
    salesforceType: string,
    componentName: string
  ): Promise<string> {
    const escapedName = this.escapeXml(componentName);

    // If component name ends with __mdt, it must be in CustomObject section, not CustomMetadata
    // This handles cases where the component might have been incorrectly typed as CustomMetadata
    if (componentName.endsWith('__mdt') && salesforceType === 'CustomMetadata') {
      logger.warn('Redirecting __mdt component from CustomMetadata to CustomObject section', { componentName, salesforceType });
      salesforceType = 'CustomObject';
    }

    // Check if component already exists in the correct salesforceType section
    // This prevents adding __mdt types to CustomMetadata when they should be in CustomObject
    // Pattern: <types>...members...</types><name>salesforceType</name>
    const typesBlockRegex = new RegExp(
      `(<types>\\s*(?:<members>[^<]+</members>\\s*)*)(</types>\\s*<name>${this.escapeRegex(salesforceType)}</name>)`,
      's'
    );
    const match = typesBlockRegex.exec(xmlContent);
    if (match) {
      // Check if component already exists in this specific types block
      const memberRegex = new RegExp(`<members>${this.escapeRegex(escapedName)}</members>`);
      if (memberRegex.test(match[1])) {
        return xmlContent; // Already present in correct section
      }
    } else {
      // Check if component exists anywhere (for safety)
      const memberRegex = new RegExp(`<members>${this.escapeRegex(escapedName)}</members>`);
      if (memberRegex.test(xmlContent)) {
        // Component exists but in wrong section - don't add it again
        return xmlContent;
      }
    }

    if (typesBlockRegex.test(xmlContent)) {
      // Component type already exists, add member before </types>
      return xmlContent.replace(
        typesBlockRegex,
        (match, beforeTypes, afterTypes) => {
          return `${beforeTypes}    <members>${escapedName}</members>\n${afterTypes}`;
        }
      );
    } else {
      // Component type doesn't exist, add new types block before </Package>
      const newTypesBlock = `  <types>\n    <members>${escapedName}</members>\n    <name>${salesforceType}</name>\n  </types>\n`;
      return xmlContent.replace('  <version>', `${newTypesBlock}  <version>`);
    }
  }

  /**
   * Remove a component from a manifest XML
   */
  private async removeComponentFromManifestXml(
    xmlContent: string,
    salesforceType: string,
    componentName: string
  ): Promise<string> {
    const escapedName = this.escapeXml(componentName);

    // Find the types block for this salesforceType and remove the member
    const typesBlockRegex = new RegExp(
      `(<types>\\s*(?:<members>[^<]+</members>\\s*)*)(</types>\\s*<name>${this.escapeRegex(salesforceType)}</name>)`,
      's'
    );

    if (typesBlockRegex.test(xmlContent)) {
      return xmlContent.replace(
        typesBlockRegex,
        (match, beforeTypes, afterTypes) => {
          // Remove the specific member line
          const memberLineRegex = new RegExp(`\\s*<members>${this.escapeRegex(escapedName)}</members>\\n?`, 'g');
          const cleanedBeforeTypes = beforeTypes.replace(memberLineRegex, '');

          // Check if there are any members left
          const hasMembers = /<members>/.test(cleanedBeforeTypes);

          if (!hasMembers) {
            // No members left, remove entire types block
            return '';
          }

          return `${cleanedBeforeTypes}${afterTypes}`;
        }
      );
    }

    return xmlContent; // Type not found, return as-is
  }

  /**
   * Escape regex special characters
   */
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

