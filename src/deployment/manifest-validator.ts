/**
 * Manifest Validator
 * Validates that manifest contents match source project files
 *
 * @ac US-085-AC-2: Validate manifest matches source
 */

import { getLogger } from '../utils/logger.js';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { parseXml } from '../utils/xml.js';
import type { Manifest } from '../types/deployment.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';

const logger = getLogger('ManifestValidator');

export interface ManifestValidationResult {
  isValid: boolean;
  errors: ManifestValidationError[];
  warnings: ManifestValidationWarning[];
}

export interface ManifestValidationError {
  component: string;
  type: string;
  message: string;
  filePath?: string;
}

export interface ManifestValidationWarning {
  component: string;
  type: string;
  message: string;
}

/**
 * Validates that manifest contents match source project
 */
export class ManifestValidator {
  /**
   * Validate manifest against source project
   */
  public async validateManifest(
    manifest: Manifest,
    componentMap: Map<NodeId, MetadataComponent>,
    projectRoot: string
  ): Promise<ManifestValidationResult> {
    logger.info('Validating manifest', { fileName: manifest.fileName });

    const result: ManifestValidationResult = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Parse manifest XML to extract components
    const manifestComponents = await this.parseManifestXml(manifest.content);
    if (!manifestComponents) {
      result.isValid = false;
      result.errors.push({
        component: 'manifest',
        type: 'Manifest',
        message: 'Failed to parse manifest XML',
      });
      return result;
    }

    // Validate each component in manifest exists in source
    for (const [type, componentNames] of Object.entries(manifestComponents)) {
      for (const componentName of componentNames) {
        const validation = await this.validateComponent(componentName, type, componentMap, projectRoot);
        if (validation.error) {
          result.isValid = false;
          // Enhance error message with actionable information
          const enhancedError: ManifestValidationError = {
            ...validation.error,
            message: this.enhanceErrorMessage(validation.error, componentName, type),
          };
          result.errors.push(enhancedError);
        }
        if (validation.warning) {
          result.warnings.push(validation.warning);
        }
      }
    }

    // Check for components in source that are missing from manifest
    const missingComponents = this.findMissingComponents(manifestComponents, componentMap);
    for (const missing of missingComponents) {
      result.warnings.push({
        component: missing.name,
        type: missing.type,
        message: `Component "${missing.name}" (${missing.type}) exists in source but is not included in manifest. This may cause deployment issues.`,
      });
    }

    logger.info('Manifest validation completed', {
      isValid: result.isValid,
      errors: result.errors.length,
      warnings: result.warnings.length,
    });

    return result;
  }

  /**
   * Parse manifest XML to extract components
   */
  private async parseManifestXml(xmlContent: string): Promise<Record<string, string[]> | null> {
    try {
      const parsed = await parseXml(xmlContent) as { Package?: { types?: unknown } };
      const packageElement = parsed.Package;
      if (!packageElement || !packageElement.types) {
        return null;
      }

      const components: Record<string, string[]> = {};
      const types = Array.isArray(packageElement.types) ? packageElement.types : [packageElement.types];

      for (const typeElement of types) {
        const typeName = typeElement.name;
        const members = Array.isArray(typeElement.members) ? typeElement.members : [typeElement.members];
        const memberNames = members.map((m: string | { _?: string }) => (typeof m === 'string' ? m : m._ || '')).filter(Boolean);

        if (typeName && memberNames.length > 0) {
          components[typeName] = memberNames;
        }
      }

      return components;
    } catch (error) {
      logger.error('Failed to parse manifest XML', { error });
      return null;
    }
  }

  /**
   * Validate a single component
   */
  private async validateComponent(
    componentName: string,
    type: string,
    componentMap: Map<NodeId, MetadataComponent>,
    projectRoot: string
  ): Promise<{ error?: ManifestValidationError; warning?: ManifestValidationWarning }> {
    // Find component in map
    let foundComponent: MetadataComponent | undefined;
    for (const component of componentMap.values()) {
      if (component.name === componentName) {
        foundComponent = component;
        break;
      }
    }

    if (!foundComponent) {
      return {
        error: {
          component: componentName,
          type,
          message: `Component "${componentName}" (${type}) not found in scanned metadata`,
          filePath: undefined,
        },
      };
    }

    // Validate file exists
    const filePath = foundComponent.filePath;
    const fullPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);

    try {
      await fs.access(fullPath);
    } catch {
      return {
        error: {
          component: componentName,
          type,
          message: `Component file does not exist: ${filePath}`,
          filePath,
        },
      };
    }

    // Validate type matches
    const expectedType = this.mapSalesforceTypeToMetadataType(type);
    if (expectedType && foundComponent.type !== expectedType) {
      return {
        warning: {
          component: componentName,
          type,
          message: `Type mismatch: manifest has ${type}, source has ${foundComponent.type}`,
        },
      };
    }

    return {};
  }

  /**
   * Find components in source that are missing from manifest
   */
  private findMissingComponents(
    manifestComponents: Record<string, string[]>,
    componentMap: Map<NodeId, MetadataComponent>
  ): Array<{ name: string; type: string }> {
    const manifestSet = new Set<string>();
    for (const componentNames of Object.values(manifestComponents)) {
      for (const name of componentNames) {
        manifestSet.add(name);
      }
    }

    const missing: Array<{ name: string; type: string }> = [];
    for (const component of componentMap.values()) {
      if (!manifestSet.has(component.name)) {
        missing.push({ name: component.name, type: component.type });
      }
    }

    return missing;
  }

  /**
   * Enhance error message with actionable information
   */
  private enhanceErrorMessage(
    error: ManifestValidationError,
    componentName: string,
    salesforceType: string
  ): string {
    let message = error.message;

    // Add suggestions based on error type
    if (error.message.includes('not found in scanned metadata')) {
      message += `\n   💡 Suggestion: Run "sf smart-deployment analyze" to scan your project and ensure all components are detected.`;
      message += `\n   💡 Check if "${componentName}" is excluded in .forceignore or if the file path is correct.`;
    } else if (error.message.includes('does not exist')) {
      message += `\n   💡 Suggestion: Verify the file exists at: ${error.filePath || 'unknown path'}`;
      message += `\n   💡 The component may have been deleted or moved. Update your source or regenerate manifests.`;
    } else if (error.message.includes('Type mismatch')) {
      message += `\n   💡 Suggestion: The metadata type mapping may be incorrect. Check if "${salesforceType}" is the correct Salesforce type.`;
    }

    return message;
  }

  /**
   * Map Salesforce package.xml type to MetadataType
   */
  private mapSalesforceTypeToMetadataType(salesforceType: string): string | null {
    // Reverse mapping of METADATA_TYPE_MAP
    const reverseMap: Record<string, string> = {
      ApexClass: 'ApexClass',
      ApexTrigger: 'ApexTrigger',
      ApexPage: 'ApexPage',
      ApexComponent: 'ApexComponent',
      CustomObject: 'CustomObject',
      CustomField: 'CustomField',
      CustomMetadata: 'CustomMetadataType',
      Flow: 'Flow',
      Workflow: 'Workflow',
      ValidationRule: 'ValidationRule',
      RecordType: 'RecordType',
      BusinessProcess: 'BusinessProcess',
      Layout: 'Layout',
      Profile: 'Profile',
      PermissionSet: 'PermissionSet',
      CustomTab: 'CustomTab',
      CustomApplication: 'CustomApplication',
      CustomLabel: 'CustomLabel',
      StaticResource: 'StaticResource',
      Document: 'Document',
      EmailTemplate: 'EmailTemplate',
      Report: 'Report',
      Dashboard: 'Dashboard',
      Folder: 'Folder',
      LightningComponentBundle: 'LWC',
      AuraDefinitionBundle: 'Aura',
      FlexiPage: 'FlexiPage',
      Bot: 'Bot',
      GenAIPromptTemplate: 'GenAiPrompt',
    };

    return reverseMap[salesforceType] || null;
  }
}

