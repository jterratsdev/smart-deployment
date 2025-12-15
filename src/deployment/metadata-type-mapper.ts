/**
 * Metadata Type Mapper
 * Maps internal MetadataType to Salesforce package.xml types
 * Uses Agentforce (with flexible model support) as fallback for unknown types
 *
 * Model Selection (handled by AgentforceService):
 * - Config file: .smart-deployment.json → ai.model
 * - Automatic: getRecommendedModel(orgSize, budget) from agentforce-limits.ts
 * - Environment: AGENTFORCE_MODEL variable
 * - Default: 'agentforce-1'
 *
 * Supported models (from agentforce-limits.ts):
 * - claude-3-5-sonnet (200K tokens) - Best quality
 * - gpt-4o (128K tokens) - Balanced
 * - gemini-1.5-pro (2M tokens) - Best for large orgs
 * - gemini-1.5-flash (1M tokens) - Cost-effective
 * - einstein-gpt (32K tokens) - Salesforce native
 */

import { getLogger } from '../utils/logger.js';
import { AgentforceService } from '../ai/agentforce-service.js';
import type { MetadataType } from '../types/metadata.js';

const logger = getLogger('MetadataTypeMapper');

/**
 * Base mapping of common metadata types
 * Agentforce will be used as fallback for unknown types
 */
const BASE_METADATA_TYPE_MAP: Partial<Record<MetadataType, string>> = {
  ApexClass: 'ApexClass',
  ApexTrigger: 'ApexTrigger',
  VisualforcePage: 'ApexPage',
  VisualforceComponent: 'ApexComponent',
  CustomObject: 'CustomObject',
  CustomField: 'CustomField',
  CustomMetadata: 'CustomMetadata',
  CustomMetadataRecord: 'CustomMetadata',
  CustomSetting: 'CustomObject',
  Flow: 'Flow',
  WorkflowRule: 'Workflow',
  ValidationRule: 'ValidationRule',
  RecordType: 'RecordType',
  BusinessProcess: 'BusinessProcess',
  Layout: 'Layout',
  Profile: 'Profile',
  PermissionSet: 'PermissionSet',
  CustomLabels: 'CustomLabels',
  StaticResource: 'StaticResource',
  Document: 'Document',
  EmailTemplate: 'EmailTemplate',
  EmailTemplateFolder: 'EmailTemplateFolder',
  LightningComponentBundle: 'LightningComponentBundle',
  AuraDefinitionBundle: 'AuraDefinitionBundle',
  FlexiPage: 'FlexiPage',
  Bot: 'Bot',
  GenAiPromptTemplate: 'GenAIPromptTemplate',
  LightningApp: 'CustomApplication',
  DigitalExperience: 'DigitalExperienceBundle',
  DigitalExperienceConfig: 'DigitalExperienceConfig',
  Site: 'Site',
  BrandingSet: 'BrandingSet',
  Network: 'Network',
  NetworkBranding: 'NetworkBranding',
  EmbeddedServiceConfig: 'EmbeddedServiceConfig',
  MessagingChannel: 'MessagingChannel',
  PermissionSetGroup: 'PermissionSetGroup',
  MutingPermissionSet: 'MutingPermissionSet',
  ApexTestSuite: 'ApexTestSuite',
  CustomNotificationType: 'CustomNotificationType',
  SearchCustomization: 'SearchCustomization',
  QuickAction: 'QuickAction',
  CompactLayout: 'CompactLayout',
  ListView: 'ListView',
  WebLink: 'WebLink',
};

/**
 * Cache for Agentforce-inferred mappings
 */
const inferredMappingCache = new Map<MetadataType, string>();

/**
 * Maps MetadataType to Salesforce package.xml type
 * Uses Agentforce (with flexible model support) as fallback for unknown types
 *
 * The AgentforceService passed here already supports:
 * - Multiple models (claude-sonnet, gpt-4o, gemini-1.5-pro, etc.)
 * - Model selection based on org size and budget
 * - Configuration via .smart-deployment.json
 */
export class MetadataTypeMapper {
  private readonly agentforceService?: AgentforceService;
  private readonly cache: Map<MetadataType, string>;

  public constructor(agentforceService?: AgentforceService) {
    // Use existing AgentforceService which already has flexible model support
    // The model is configured via:
    // 1. .smart-deployment.json (ai.model)
    // 2. AgentforceService constructor config
    // 3. getRecommendedModel() for automatic selection
    this.agentforceService = agentforceService;
    this.cache = new Map(Object.entries(BASE_METADATA_TYPE_MAP) as Array<[MetadataType, string]>);

    // Load cached inferred mappings
    for (const [type, salesforceType] of inferredMappingCache.entries()) {
      this.cache.set(type, salesforceType);
    }
  }

  /**
   * Map MetadataType to Salesforce package.xml type
   *
   * Strategy (in order):
   * 1. Check cache (base mapping + previously inferred)
   * 2. Use flexible parser system (parseUnknownMetadata) to extract type info
   * 3. Use Agentforce as last resort (if enabled)
   *
   * This leverages the existing flexible metadata type system that parsers use
   * for handling unknown metadata types gracefully.
   */
  public async mapToSalesforceType(metadataType: MetadataType): Promise<string | null> {
    // 1. Check cache first
    if (this.cache.has(metadataType)) {
      return this.cache.get(metadataType)!;
    }

    // 2. Try to infer from metadata type name using flexible parser system
    // This uses the same system that parsers use for unknown metadata
    try {
      const inferredType = this.inferFromTypeName(metadataType);
      if (inferredType) {
        this.cache.set(metadataType, inferredType);
        inferredMappingCache.set(metadataType, inferredType);
        logger.debug('Inferred metadata type from name pattern', {
          metadataType,
          salesforceType: inferredType,
        });
        return inferredType;
      }
    } catch (error) {
      logger.debug('Could not infer from type name pattern', {
        metadataType,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // 3. Try Agentforce if available (last resort)
    if (this.agentforceService?.isEnabled()) {
      try {
        const salesforceType = await this.inferSalesforceType(metadataType);
        if (salesforceType) {
          // Cache the result
          this.cache.set(metadataType, salesforceType);
          inferredMappingCache.set(metadataType, salesforceType);
          logger.info('Inferred metadata type mapping via Agentforce', {
            metadataType,
            salesforceType,
          });
          return salesforceType;
        }
      } catch (error) {
        logger.warn('Failed to infer metadata type via Agentforce', {
          metadataType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // No mapping found - use flexible parser system to handle gracefully
    logger.warn('Unknown metadata type (not mapped)', { metadataType });
    // Return null - the flexible parser system will handle this gracefully
    return null;
  }

  /**
   * Batch map multiple types (more efficient with Agentforce)
   */
  public async mapMultipleTypes(metadataTypes: MetadataType[]): Promise<Map<MetadataType, string>> {
    const result = new Map<MetadataType, string>();
    const unknownTypes: MetadataType[] = [];

    // First pass: check cache
    for (const type of metadataTypes) {
      if (this.cache.has(type)) {
        result.set(type, this.cache.get(type)!);
      } else {
        unknownTypes.push(type);
      }
    }

    // Second pass: infer unknown types via Agentforce
    if (unknownTypes.length > 0 && this.agentforceService?.isEnabled()) {
      try {
        const inferred = await this.inferMultipleSalesforceTypes(unknownTypes);
        for (const [type, salesforceType] of inferred.entries()) {
          result.set(type, salesforceType);
          this.cache.set(type, salesforceType);
          inferredMappingCache.set(type, salesforceType);
        }
      } catch (error) {
        logger.warn('Failed to infer metadata types via Agentforce', {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return result;
  }

  /**
   * Infer Salesforce type for a single metadata type using Agentforce
   * Uses the model configured in AgentforceService (flexible model support)
   */
  private async inferSalesforceType(metadataType: MetadataType): Promise<string | null> {
    if (!this.agentforceService) {
      return null;
    }

    const prompt = `You are a Salesforce metadata expert. Map the following internal metadata type to its corresponding Salesforce package.xml type name.

Internal Type: ${metadataType}

Return ONLY the Salesforce package.xml type name (e.g., "ApexClass", "CustomObject", "Flow", etc.).
If you're not certain, return "null".

Examples:
- "ApexClass" -> "ApexClass"
- "CustomObject" -> "CustomObject"
- "LightningComponentBundle" -> "LightningComponentBundle"
- "GenAiPromptTemplate" -> "GenAIPromptTemplate"

Response (type name only):`;

    try {
      // Use the model already configured in AgentforceService
      // This model can be:
      // - Set via .smart-deployment.json (ai.model)
      // - Selected automatically via getRecommendedModel()
      // - Configured per use case (dependency inference, priority weighting, etc.)
      const response = await this.agentforceService.sendRequest({
        model: this.agentforceService.getConfig().model, // Uses flexible model from config
        prompt,
        temperature: 0.1, // Very low for consistent mapping
        maxTokens: 50,
      });

      const salesforceType = response.content.trim();

      // Validate response
      if (salesforceType === 'null' || salesforceType.toLowerCase() === 'unknown') {
        return null;
      }

      // Basic validation: should be alphanumeric with possible underscores
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(salesforceType)) {
        logger.warn('Invalid Salesforce type inferred', { metadataType, salesforceType });
        return null;
      }

      return salesforceType;
    } catch (error) {
      logger.error('Agentforce inference failed', {
        metadataType,
        error: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  /**
   * Infer multiple Salesforce types in a single Agentforce call (more efficient)
   * Uses batch processing - benefits from models with larger context windows (e.g., gemini-1.5-pro)
   */
  private async inferMultipleSalesforceTypes(metadataTypes: MetadataType[]): Promise<Map<MetadataType, string>> {
    if (!this.agentforceService || metadataTypes.length === 0) {
      return new Map();
    }

    const prompt = `You are a Salesforce metadata expert. Map the following internal metadata types to their corresponding Salesforce package.xml type names.

Internal Types:
${metadataTypes.map((t, i) => `${i + 1}. ${t}`).join('\n')}

Return ONLY a JSON object mapping internal types to Salesforce types:
{
  "${metadataTypes[0]}": "SalesforceTypeName",
  ...
}

If a type cannot be mapped, use null for that value.
Return ONLY the JSON object, no other text.`;

    try {
      // Uses the configured model from AgentforceService
      // For large batches, models like gemini-1.5-pro (2M tokens) are ideal
      // The model selection is handled by getRecommendedModel() or config
      const response = await this.agentforceService.sendRequest({
        model: this.agentforceService.getConfig().model, // Flexible model support
        prompt,
        temperature: 0.1,
        maxTokens: 500,
      });

      // Parse JSON response
      const jsonMatch = response.content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        logger.warn('No JSON found in Agentforce response', { response: response.content });
        return new Map();
      }

      const mapping = JSON.parse(jsonMatch[0]) as Record<string, string | null>;
      const result = new Map<MetadataType, string>();

      for (const [internalType, salesforceType] of Object.entries(mapping)) {
        if (salesforceType && salesforceType !== 'null' && /^[A-Za-z][A-Za-z0-9_]*$/.test(salesforceType)) {
          result.set(internalType as MetadataType, salesforceType);
        }
      }

      return result;
    } catch (error) {
      logger.error('Agentforce batch inference failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      return new Map();
    }
  }

  /**
   * Infer Salesforce type from metadata type name using pattern matching
   * Uses the same flexible approach as parseUnknownMetadata
   *
   * This leverages naming conventions and patterns that parsers use
   * to handle unknown metadata types without requiring Agentforce.
   */
  private inferFromTypeName(metadataType: MetadataType): string | null {
    // Common patterns that match Salesforce package.xml naming
    const typeName = metadataType;

    // Direct matches (case-insensitive)
    const directMatches: Record<string, string> = {
      // Common mappings
      'ApexClass': 'ApexClass',
      'ApexTrigger': 'ApexTrigger',
      'CustomObject': 'CustomObject',
      'CustomField': 'CustomField',
      'Flow': 'Flow',
      'Profile': 'Profile',
      'PermissionSet': 'PermissionSet',
      'Layout': 'Layout',
      'FlexiPage': 'FlexiPage',
      'LightningComponentBundle': 'LightningComponentBundle',
      'AuraDefinitionBundle': 'AuraDefinitionBundle',
      'EmailTemplate': 'EmailTemplate',
      'StaticResource': 'StaticResource',
      'CustomMetadata': 'CustomMetadata',
      'CustomMetadataRecord': 'CustomMetadata',
      'Bot': 'Bot',
      'GenAiPromptTemplate': 'GenAIPromptTemplate',
    };

    if (directMatches[typeName]) {
      return directMatches[typeName];
    }

    // Pattern-based inference (similar to how parsers handle unknown types)
    // These patterns are based on Salesforce naming conventions

    // Visualforce components/pages
    if (typeName.startsWith('Visualforce')) {
      if (typeName.includes('Page')) return 'ApexPage';
      if (typeName.includes('Component')) return 'ApexComponent';
    }

    // Workflow-related
    if (typeName.includes('Workflow')) {
      return 'Workflow';
    }

    // Validation rules
    if (typeName.includes('Validation')) {
      return 'ValidationRule';
    }

    // Record types
    if (typeName.includes('RecordType')) {
      return 'RecordType';
    }

    // Business processes
    if (typeName.includes('BusinessProcess')) {
      return 'BusinessProcess';
    }

    // Custom labels
    if (typeName.includes('CustomLabel')) {
      return 'CustomLabels';
    }

    // Custom tabs
    if (typeName.includes('CustomTab')) {
      return 'CustomTab';
    }

    // Custom applications
    if (typeName.includes('CustomApplication')) {
      return 'CustomApplication';
    }

    // Documents
    if (typeName === 'Document') {
      return 'Document';
    }

    // If no pattern matches, return null
    // The flexible parser system (parseUnknownMetadata) will handle this
    return null;
  }

  /**
   * Get all cached mappings (for debugging/reporting)
   */
  public getCachedMappings(): Map<MetadataType, string> {
    return new Map(this.cache);
  }
}

