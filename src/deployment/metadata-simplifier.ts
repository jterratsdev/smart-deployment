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
import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { getLogger } from '../utils/logger.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import type { Wave } from '../waves/wave-builder.js';

const logger = getLogger('MetadataSimplifier');

export interface SimplificationOptions {
  /** Components available in current and previous waves */
  availableComponents: Set<NodeId>;
  /** All waves (for determining what's available) */
  allWaves: Wave[];
  /** Current wave number */
  currentWaveNumber: number;
  /** Component map for dependency lookup */
  componentMap: Map<NodeId, MetadataComponent>;
}

export interface SimplificationResult {
  /** Whether simplification was performed */
  simplified: boolean;
  /** Components that were simplified */
  simplifiedComponents: NodeId[];
  /** References that were removed */
  removedReferences: Map<NodeId, string[]>;
  /** Temporary file paths created */
  tempFiles: Map<NodeId, string>;
}

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

    return MISSING_REFERENCE_ERRORS.some((pattern) =>
      error.toUpperCase().includes(pattern)
    );
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
   */
  public async simplifyWaveMetadata(
    wave: Wave,
    options: SimplificationOptions
  ): Promise<SimplificationResult> {
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
    const availableUpToWave = this.getAvailableComponents(
      options.allWaves,
      options.currentWaveNumber
    );

    for (const nodeId of wave.components) {
      const component = options.componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      // Check if component has dependencies not yet available
      const unavailableDeps = this.getUnavailableDependencies(
        component,
        availableUpToWave,
        options.componentMap
      );

      if (unavailableDeps.length > 0) {
        logger.debug('Simplifying component', {
          nodeId,
          unavailableDeps,
        });

        try {
          const simplified = await this.simplifyComponent(
            component,
            unavailableDeps,
            options.componentMap
          );

          if (simplified) {
            result.simplified = true;
            result.simplifiedComponents.push(nodeId);
            result.removedReferences.set(nodeId, unavailableDeps);
            result.tempFiles.set(nodeId, simplified.tempPath);
          }
        } catch (error) {
          logger.warn('Failed to simplify component', {
            nodeId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
    }

    logger.info('Simplification completed', {
      simplified: result.simplified,
      componentsSimplified: result.simplifiedComponents.length,
    });

    return result;
  }

  /**
   * Simplify a single component by removing unavailable references
   */
  private async simplifyComponent(
    component: MetadataComponent,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): Promise<{ tempPath: string } | null> {
    // Only simplify certain types that can have references removed
    const simplifiableTypes: MetadataType[] = [
      'PermissionSet',
      'FlexiPage',
      'Profile',
      'Layout',
    ];

    if (!simplifiableTypes.includes(component.type)) {
      return null;
    }

    try {
      // Read original file
      const originalContent = await readFile(component.filePath, 'utf-8');
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
        default:
          return null;
      }

      if (!simplified) {
        return null;
      }

      // Write simplified version to temp file
      const simplifiedXml = this.builder.build(simplified);
      const tempPath = `${component.filePath}.simplified-${Date.now()}`;
      await writeFile(tempPath, simplifiedXml, 'utf-8');

      logger.debug('Created simplified file', {
        nodeId: `${component.type}:${component.name}`,
        tempPath,
        removedDeps: unavailableDeps.length,
      });

      return { tempPath };
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
  ): any | null {
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
  private simplifyFlexiPage(
    parsed: any,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): any | null {
    const flexiPage = parsed.FlexiPage || parsed;
    if (!flexiPage) {
      return null;
    }

    const simplified = JSON.parse(JSON.stringify(parsed)); // Deep clone
    const fp = simplified.FlexiPage || simplified;

    // Remove unavailable LWC components
    if (fp.flexiPageRegions) {
      const regions = Array.isArray(fp.flexiPageRegions)
        ? fp.flexiPageRegions
        : [fp.flexiPageRegions];

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
  private simplifyProfile(
    parsed: any,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): any | null {
    // Similar logic to Permission Set
    return this.simplifyPermissionSet(parsed, unavailableDeps, componentMap);
  }

  /**
   * Simplify Layout (remove unavailable field references)
   */
  private simplifyLayout(
    parsed: any,
    unavailableDeps: NodeId[],
    componentMap: Map<NodeId, MetadataComponent>
  ): any | null {
    // Layout simplification is less critical, but can be implemented if needed
    return parsed; // For now, return as-is
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
      // Check if dependency is available
      if (!availableComponents.has(dep)) {
        unavailable.push(dep);
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

