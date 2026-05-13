import { getLogger } from '../utils/logger.js';
import { parseXml } from '../utils/xml.js';
import type {
  LWCMetadata,
  LWCCapability,
  LWCFormFactor,
  LWCProperty,
  LWCPropertyRole,
  LWCPropertyType,
  LWCSupportedFormFactor,
  LWCTarget,
} from '../types/salesforce/lwc.js';
import { normalizeArray } from './parser-utils.js';

const logger = getLogger('LWCMetadataAnalysis');

export type LwcMetadataAnalysis = {
  hasMetadataXml: boolean;
  metadata?: LWCMetadata;
};

type InterpretedLwcTargetConfig = NonNullable<LWCMetadata['targetConfigs']>[number];

type ParsedLwcMetadataXml = {
  LightningComponentBundle?: {
    apiVersion?: string | number;
    description?: string;
    isExposed?: boolean | string;
    masterLabel?: string;
    targets?: {
      target?: string | string[];
    };
    targetConfigs?: {
      targetConfig?: ParsedLwcTargetConfig | ParsedLwcTargetConfig[];
    };
    capabilities?: {
      capability?: string | string[];
    };
  };
};

type ParsedLwcTargetConfig = {
  '@_targets'?: string;
  configurationEditor?: string;
  objects?: {
    object?: string | string[];
  };
  property?: ParsedLwcProperty | ParsedLwcProperty[];
  supportedFormFactors?: {
    supportedFormFactor?: ParsedLwcSupportedFormFactor | ParsedLwcSupportedFormFactor[];
  };
};

type ParsedLwcProperty = {
  '@_name'?: string;
  '@_type'?: string;
  '@_default'?: string;
  '@_required'?: boolean | string;
  '@_label'?: string;
  '@_description'?: string;
  '@_placeholder'?: string;
  '@_role'?: string;
  '@_datasource'?: string;
  '@_min'?: string | number;
  '@_max'?: string | number;
};

type ParsedLwcSupportedFormFactor = {
  '@_type'?: string;
};

export function analyzeMetadataXml(componentName: string, metadataXml?: string): LwcMetadataAnalysis {
  if (!metadataXml) {
    return {
      hasMetadataXml: false,
      metadata: undefined,
    };
  }

  try {
    return {
      hasMetadataXml: true,
      metadata: parseMetadataXml(metadataXml),
    };
  } catch (error) {
    logger.warn(`Failed to parse js-meta.xml for ${componentName}`, {
      componentName,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      hasMetadataXml: true,
      metadata: undefined,
    };
  }
}

function parseMetadataXml(metadataContent: string): LWCMetadata | undefined {
  const parsed = parseXml<ParsedLwcMetadataXml>(metadataContent);
  const metadata = parsed.LightningComponentBundle;

  if (!metadata) {
    return undefined;
  }

  return interpretMetadataBundle(metadata);
}

function interpretMetadataBundle(metadata: NonNullable<ParsedLwcMetadataXml['LightningComponentBundle']>): LWCMetadata {
  const targets = normalizeArray(metadata.targets?.target);
  const targetConfigs = normalizeArray(metadata.targetConfigs?.targetConfig).map(interpretTargetConfig);
  const capabilities = normalizeArray(metadata.capabilities?.capability) as LWCCapability[];

  return {
    apiVersion: metadata.apiVersion !== undefined ? String(metadata.apiVersion) : '',
    description: metadata.description,
    isExposed: parseBoolean(metadata.isExposed) ?? false,
    masterLabel: metadata.masterLabel,
    targets: targets.length > 0 ? { target: targets as LWCTarget[] } : undefined,
    targetConfigs: targetConfigs.length > 0 ? targetConfigs : undefined,
    capabilities: capabilities.length > 0 ? capabilities : undefined,
  };
}

function interpretTargetConfig(targetConfig: ParsedLwcTargetConfig): InterpretedLwcTargetConfig {
  const properties = normalizeArray(targetConfig.property)
    .map(interpretProperty)
    .filter((property): property is LWCProperty => property !== undefined);

  return {
    targets: targetConfig['@_targets'] ?? '',
    configurationEditor: targetConfig.configurationEditor,
    objects:
      targetConfig.objects === undefined
        ? undefined
        : normalizeArray(targetConfig.objects.object).map((object) => ({ object })),
    property: properties,
    supportedFormFactors: interpretSupportedFormFactors(targetConfig),
  };
}

function interpretProperty(property: ParsedLwcProperty): LWCProperty | undefined {
  if (property['@_name'] === undefined || property['@_type'] === undefined) {
    return undefined;
  }

  return {
    name: property['@_name'],
    type: property['@_type'] as LWCPropertyType,
    default: property['@_default'],
    required: parseBoolean(property['@_required']),
    label: property['@_label'],
    description: property['@_description'],
    placeholder: property['@_placeholder'],
    role: property['@_role'] as LWCPropertyRole,
    datasource: property['@_datasource'],
    min: parseOptionalNumber(property['@_min']),
    max: parseOptionalNumber(property['@_max']),
  };
}

function interpretSupportedFormFactors(targetConfig: ParsedLwcTargetConfig): LWCSupportedFormFactor[] | undefined {
  if (targetConfig.supportedFormFactors === undefined) {
    return undefined;
  }

  return normalizeArray(targetConfig.supportedFormFactors.supportedFormFactor)
    .filter((formFactor) => formFactor['@_type'] !== undefined)
    .map((formFactor) => ({
      type: formFactor['@_type']! as LWCFormFactor,
    }));
}

function parseBoolean(value: boolean | string | undefined): boolean | undefined {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'string') {
    return value.trim().toLowerCase() === 'true';
  }

  return undefined;
}

function parseOptionalNumber(value: string | number | undefined): number | undefined {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }

  return undefined;
}
