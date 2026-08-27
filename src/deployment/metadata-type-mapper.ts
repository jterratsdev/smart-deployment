/** Maps internal metadata types to Salesforce package.xml types deterministically. */
import { getLogger } from '../utils/logger.js';
import type { MetadataType } from '../types/metadata.js';

const logger = getLogger('MetadataTypeMapper');
const METADATA_TYPE_MAP: Partial<Record<MetadataType, string>> = {
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
  Report: 'Report',
  ReportFolder: 'ReportFolder',
  LightningComponentBundle: 'LightningComponentBundle',
  AuraDefinitionBundle: 'AuraDefinitionBundle',
  FlexiPage: 'FlexiPage',
  Bot: 'Bot',
  GenAiPromptTemplate: 'GenAIPromptTemplate',
  GenAiFunction: 'GenAiFunction',
  GenAiPlugin: 'GenAiPlugin',
  GenAiPlannerBundle: 'GenAiPlannerBundle',
  AiAuthoringBundle: 'AiAuthoringBundle',
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

export class MetadataTypeMapper {
  public async mapToSalesforceType(metadataType: MetadataType): Promise<string | null> {
    const mapped = METADATA_TYPE_MAP[metadataType] ?? null;
    if (!mapped) logger.warn('Unknown metadata type (not mapped)', { metadataType });
    return mapped;
  }

  public async mapMultipleTypes(metadataTypes: MetadataType[]): Promise<Map<MetadataType, string>> {
    const result = new Map<MetadataType, string>();
    for (const type of metadataTypes) {
      const mapped = METADATA_TYPE_MAP[type];
      if (mapped) result.set(type, mapped);
      else logger.warn('Unknown metadata type (not mapped)', { metadataType: type });
    }
    return result;
  }

  public getCachedMappings(): Map<MetadataType, string> {
    return new Map(Object.entries(METADATA_TYPE_MAP) as Array<[MetadataType, string]>);
  }
}
