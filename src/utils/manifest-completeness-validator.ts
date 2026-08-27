/**
 * Manifest Completeness Validator
 * Validates that all scanned components are included in manifests
 */

import type { Manifest } from '../types/deployment.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';
import { parseXml } from './xml.js';
import { getLogger } from './logger.js';
import { createNodeId } from './node-id.js';

const logger = getLogger('ManifestCompletenessValidator');

export type ManifestCompletenessResult = {
  missingComponents: Array<{ name: string; type: string; nodeId: NodeId }>;
  totalInManifests: number;
  totalDeployableScanned: number;
};

/**
 * Validate that all scanned components are included in manifests
 */
export async function validateManifestCompleteness(
  scannedComponents: MetadataComponent[],
  manifests: Manifest[],
  componentMap: Map<NodeId, MetadataComponent>
): Promise<ManifestCompletenessResult> {
  // Parse all manifests to get all components
  const manifestComponents = new Set<string>(); // Set of "type:name"

  for (const manifest of manifests) {
    try {
      const parsed = parseXml<Record<string, any>>(manifest.content);
      const packageElement = parsed.Package;
      if (!packageElement?.types) {
        continue;
      }

      const types = Array.isArray(packageElement.types) ? packageElement.types : [packageElement.types];

      for (const typeElement of types) {
        const typeName = typeElement.name;
        if (!typeName) continue;

        const members = Array.isArray(typeElement.members)
          ? typeElement.members
          : typeElement.members
          ? [typeElement.members]
          : [];

        for (const member of members) {
          const name = typeof member === 'string' ? member : member['#text'] || member['_'] || '';
          if (name) {
            manifestComponents.add(`${typeName}:${name}`);
          }
        }
      }
    } catch (error) {
      logger.warn('Failed to parse manifest for completeness validation', {
        manifest: manifest.fileName,
        error,
      });
    }
  }

  // Find missing components
  const missingComponents: Array<{ name: string; type: string; nodeId: NodeId }> = [];
  const metadataTypeMapper = new Map<string, string>([
    ['ApexClass', 'ApexClass'],
    ['ApexTrigger', 'ApexTrigger'],
    ['VisualforcePage', 'ApexPage'],
    ['VisualforceComponent', 'ApexComponent'],
    ['CustomObject', 'CustomObject'],
    ['Flow', 'Flow'],
    ['Layout', 'Layout'],
    ['PermissionSet', 'PermissionSet'],
    ['FlexiPage', 'FlexiPage'],
    ['LightningComponentBundle', 'LightningComponentBundle'],
    ['AuraDefinitionBundle', 'AuraDefinitionBundle'],
    ['CustomMetadata', 'CustomMetadata'],
    ['CustomMetadataRecord', 'CustomMetadata'],
    ['StaticResource', 'StaticResource'],
    ['EmailTemplate', 'EmailTemplate'],
    ['GenAiPromptTemplate', 'GenAIPromptTemplate'],
    ['LightningApp', 'CustomApplication'],
    ['DigitalExperience', 'DigitalExperienceBundle'],
    ['ReportFolder', 'ReportFolder'],
    ['Report', 'Report'],
    ['EmailTemplateFolder', 'EmailTemplateFolder'],
    ['Network', 'Network'],
    ['Site', 'Site'],
  ]);

  // Components that are deployed as part of their parent and shouldn't be in manifests directly
  const childComponentTypes = new Set<string>([
    'CustomMetadataRecord', // Deployed as part of CustomMetadata
    'CustomField', // Deployed as part of CustomObject
  ]);

  // Count only deployable components (exclude child components)
  let deployableScannedCount = 0;

  for (const component of scannedComponents) {
    // Skip child components that are deployed as part of their parent
    if (childComponentTypes.has(component.type)) {
      continue;
    }

    deployableScannedCount++;
    const nodeId = createNodeId(component.type, component.name);
    const salesforceType = metadataTypeMapper.get(component.type) || component.type;
    const manifestKey = `${salesforceType}:${component.name}`;

    if (!manifestComponents.has(manifestKey)) {
      // Also check if component is in componentMap (might be filtered)
      if (componentMap.has(nodeId)) {
        missingComponents.push({
          name: component.name,
          type: component.type,
          nodeId,
        });
      }
    }
  }

  return {
    missingComponents,
    totalInManifests: manifestComponents.size,
    totalDeployableScanned: deployableScannedCount,
  };
}
