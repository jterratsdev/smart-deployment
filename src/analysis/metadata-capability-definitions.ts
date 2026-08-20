import { DEPLOYMENT_ORDER } from '../constants/deployment-order.js';
import type {
  MetadataCapabilities,
  MetadataCapabilityDefinition,
  MetadataCapabilityEvidence,
  MetadataCapabilityEvidenceSource,
  MetadataCanonicalOwner,
  MetadataDeploymentChannel,
} from '../types/metadata-capability.js';

const API_67 = '67.0';
const REPOSITORY_SOURCE_ID = 'smart-deployment-repository';
const RESEARCH_SOURCE_ID = 'metadata-catalog-research';
const REPOSITORY_SOURCE: MetadataCapabilityEvidenceSource = {
  id: REPOSITORY_SOURCE_ID,
  kind: 'repository',
  locator: 'smart-deployment source and focused tests',
};
const RESEARCH_SOURCE: MetadataCapabilityEvidenceSource = {
  id: RESEARCH_SOURCE_ID,
  kind: 'repository',
  locator: 'docs/research/metadata-catalog',
  retrievedAt: '2026-07-23',
};
const SALESFORCE_COVERAGE_SOURCE: MetadataCapabilityEvidenceSource = {
  id: 'salesforce-metadata-coverage-67',
  kind: 'vendor-documentation',
  locator: 'https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0',
  retrievedAt: '2026-07-23',
};

const LEGACY_SCANNER_TYPES = [
  'ApexClass',
  'ApexTrigger',
  'AuraDefinitionBundle',
  'Bot',
  'BrandingSet',
  'CustomSite',
  'DigitalExperienceBundle',
  'EmailTemplate',
  'EmbeddedServiceConfig',
  'FlexiPage',
  'Layout',
  'LightningComponentBundle',
  'Network',
  'Profile',
  'Queue',
  'StandardValueSet',
] as const;

const P0_DEFINITIONS: readonly MetadataCapabilityDefinition[] = [
  metadataDefinition('ApexComponent', 'VisualforceComponent', 'C1', '61.0', {
    discovery: proven('code-metadata-scanner.ts CODE_FILE_SCANNERS discovers Visualforce components.'),
    parsing: proven('experience-metadata-scanner.ts parses Visualforce components.'),
    dependencies: proven('Visualforce component dependency extraction is implemented.'),
    ordering: proven('VisualforceComponent is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused Visualforce scanner fixtures exist.'),
  }),
  metadataDefinition('ApexPage', 'VisualforcePage', 'C1', '61.0', {
    discovery: proven('code-metadata-scanner.ts CODE_FILE_SCANNERS discovers Visualforce pages.'),
    parsing: proven('experience-metadata-scanner.ts parses Visualforce pages.'),
    dependencies: proven('Visualforce page dependency extraction is implemented.'),
    ordering: proven('VisualforcePage is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused Visualforce scanner fixtures exist.'),
  }),
  metadataDefinition('CustomApplication', 'LightningApp', 'C1', '61.0', {
    discovery: partial('Source-path and manifest discovery exist without a component scanner.'),
    parsing: absent('No CustomApplication parser is registered.'),
    dependencies: partial('Security parsers can emit LightningApp references.'),
    ordering: absent('Vendor CustomApplication has no proven ordering contract.'),
    lifecycle: notApplicable(),
    fixtures: absent('No focused end-to-end CustomApplication fixture exists.'),
  }),
  metadataDefinition('CustomMetadata', 'CustomMetadataRecord', 'C1', '61.0', {
    discovery: proven('data-metadata-scanner.ts discovers custom metadata records.'),
    parsing: proven('parseCustomMetadataComponents parses custom metadata records.'),
    dependencies: proven('Custom metadata dependency extraction is implemented.'),
    ordering: proven('CustomMetadataRecord is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused custom metadata fixtures exist.'),
  }),
  metadataDefinition('CustomObject', 'CustomObject', 'C1', '61.0', {
    discovery: proven('data-metadata-scanner.ts discovers CustomObject components.'),
    parsing: proven('custom-object-parser.ts parses CustomObject metadata.'),
    dependencies: partial('Only a subset of parsed object references reaches typed graph edges.'),
    ordering: proven('CustomObject is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused CustomObject parser and scanner fixtures exist.'),
  }),
  metadataDefinition('Flow', 'Flow', 'C1', '61.0', {
    discovery: proven('automation-ai-metadata-scanner.ts discovers Flow components.'),
    parsing: proven('flow-parser.ts parses Flow metadata.'),
    dependencies: partial('Scanner assembly retains only part of the parsed Flow dependency set.'),
    ordering: proven('Flow is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused Flow parser and scanner fixtures exist.'),
  }),
  metadataDefinition('MatchingRules', 'MatchingRules', 'C1', '61.0', {
    discovery: partial('Manifest and matchingRule source suffix detection exist.'),
    parsing: absent('No MatchingRules parser is registered.'),
    dependencies: absent('No MatchingRules dependency extraction is registered.'),
    ordering: absent('MatchingRules is absent from DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: absent('Only metadata-gap detection coverage exists.'),
  }),
  metadataDefinition('PermissionSet', 'PermissionSet', 'C1', '61.0', {
    discovery: proven('security-metadata-scanner.ts discovers PermissionSet components.'),
    parsing: proven('permission-set-parser.ts parses PermissionSet metadata.'),
    dependencies: partial('Several security references are not consistently normalized to typed node IDs.'),
    ordering: proven('PermissionSet is present in DEPLOYMENT_ORDER.'),
    lifecycle: notApplicable(),
    fixtures: proven('Focused PermissionSet parser and scanner fixtures exist.'),
  }),
  metadataDefinition('OrderManagementSettings', 'OrderManagementSettings', 'C1', '67.0', {
    discovery: partial('Manifest discovery preserves the vendor type; source inference remains generic.'),
    parsing: absent('No OrderManagementSettings parser is registered.'),
    dependencies: absent('No dependency extraction is registered.'),
    ordering: absent('No validated deployment order exists.'),
    lifecycle: absent('Enablement and rollback behavior require licensed-org evidence.'),
    fixtures: absent('No licensed-org fixture or CLI contract exists.'),
  }),
  metadataDefinition(
    'AiAuthoringBundle',
    'AiAuthoringBundle',
    'C2',
    '66.0',
    {
      discovery: proven('automation-ai-metadata-scanner.ts discovers AiAuthoringBundle source.'),
      parsing: partial('Bundle descriptor and Agent Script references are not fully parsed.'),
      dependencies: absent('No complete AiAuthoringBundle dependency graph is emitted.'),
      ordering: proven('AiAuthoringBundle has explicit special deployment ordering.'),
      lifecycle: proven('special-deployment executor publishes and optionally activates authoring bundles.'),
      fixtures: proven('API 66 authoring bundle and special deployment fixtures exist.'),
    },
    'source-format-composite'
  ),
  metadataDefinition('GenAiPlannerBundle', 'GenAiPlannerBundle', 'C2', '66.0', {
    discovery: proven('automation-ai-metadata-scanner.ts discovers planner bundles.'),
    parsing: partial('Planner parsing covers actions and references but not all provenance.'),
    dependencies: proven('Flow, Apex, and prompt references are extracted.'),
    ordering: proven('GenAiPlannerBundle is present in DEPLOYMENT_ORDER.'),
    lifecycle: partial('Generated-versus-owned publish provenance is not persisted.'),
    fixtures: proven('API 66 planner bundle dependency fixtures exist.'),
  }),
  metadataDefinition('GenAiPromptTemplate', 'GenAiPromptTemplate', 'C2', '66.0', {
    discovery: proven('automation-ai-metadata-scanner.ts discovers prompt templates.'),
    parsing: proven('genai-prompt-parser.ts parses prompt metadata.'),
    dependencies: partial('Model, field, and provider facts are not fully projected into graph edges.'),
    ordering: proven('GenAiPromptTemplate is present in DEPLOYMENT_ORDER.'),
    lifecycle: partial('Activation is separate and not fully modeled.'),
    fixtures: proven('Focused prompt-template parser fixtures exist.'),
  }),
  metadataDefinition('AiEvaluationDefinition', 'AiEvaluationDefinition', 'C2', '67.0', {
    discovery: proven('Canonical AiEvaluationDefinition source files are scanned deterministically.'),
    parsing: proven('Required agent subject fields are parsed and validated.'),
    dependencies: proven('The schema-proven Bot subject reference is emitted as a hard parser dependency.'),
    ordering: proven('Evaluations are excluded from core deployment and owned by the ordered special phase.'),
    lifecycle: partial('Connect API execution is separate from metadata deployment.'),
    fixtures: proven('Evaluation definition validation fixtures exist.'),
  }),
  metadataDefinition('DataSourceObject', 'DataSourceObject', 'C2', '50.0', {
    discovery: proven('additional-metadata-scanner.ts discovers dataSourceObjects source files.'),
    parsing: partial('The component identity is parsed; Data Source lifecycle fields are not yet projected.'),
    dependencies: absent('No schema-proven DataSource dependency is emitted yet.'),
    ordering: proven('DataSourceObject is present in DEPLOYMENT_ORDER and wave priority uses that registry.'),
    lifecycle: partial('Target connections and authorization can require post-deployment operations.'),
    fixtures: proven('Focused API 66 source-format DataSourceObject fixtures exist.'),
  }),
  metadataDefinition('DataPackageKitDefinition', 'DataPackageKitDefinition', 'C2', '53.0', {
    discovery: proven('additional-metadata-scanner.ts discovers dataPackageKitDefinitions source files.'),
    parsing: partial('Definition identity is parsed; publishing sequence and lifecycle fields are not yet projected.'),
    dependencies: absent('No external Data Kit definition dependency is emitted.'),
    ordering: proven('DataPackageKitDefinition is present in DEPLOYMENT_ORDER and wave priority uses that registry.'),
    lifecycle: partial('Data Kit deployment can require post-install deployment and activation operations.'),
    fixtures: proven('Focused source-format DataPackageKitDefinition fixtures exist.'),
  }),
  metadataDefinition('DataPackageKitObject', 'DataPackageKitObject', 'C2', '53.0', {
    discovery: proven('additional-metadata-scanner.ts discovers DataPackageKitObjects source files.'),
    parsing: proven('The parent Data Kit relationship is parsed from source metadata.'),
    dependencies: proven('parentDataPackageKitDefinitionName is emitted as a hard parser dependency.'),
    ordering: proven('The parent dependency places the Data Kit definition in an earlier wave.'),
    lifecycle: partial('Contained Data Cloud component activation remains an explicit post-deployment concern.'),
    fixtures: proven('Focused source-format DataPackageKitObject dependency fixtures exist.'),
  }),
  externalDefinition('BotVersion', 'BotVersion', 'C2', 'provider-lifecycle', {
    discovery: absent('No independent BotVersion scanner exists.'),
    parsing: absent('No independent BotVersion parser exists.'),
    dependencies: absent('No independent BotVersion dependency extraction exists.'),
    ordering: absent('A generic order entry does not prove provider lifecycle ordering.'),
    lifecycle: partial('Bot version lifecycle is provider-managed and only partially represented.'),
    fixtures: absent('No independent BotVersion lifecycle fixture exists.'),
  }),
  metadataDefinition('SlackApp', 'SlackApp', 'C1', '67.0', absentCapabilities()),
  externalDefinition('SlackAppManifest', 'SlackAppManifest', 'C1', 'external-provider', {
    discovery: absent('No Slack provider adapter is registered.'),
    parsing: notApplicable(),
    dependencies: notApplicable(),
    ordering: notApplicable(),
    lifecycle: absent('No Slack install or reinstall lifecycle is registered.'),
    fixtures: absent('No secret-safe Slack manifest fixture exists.'),
  }),
  externalDefinition('FSLManagedConfiguration', 'FSLManagedConfiguration', 'C1', 'managed-package-data', {
    discovery: absent('No package-aware FSL configuration data adapter is registered.'),
    parsing: notApplicable(),
    dependencies: notApplicable(),
    ordering: notApplicable(),
    lifecycle: absent('No package-version-aware data lifecycle is registered.'),
    fixtures: absent('No licensed FSL configuration fixture exists.'),
  }),
  externalDefinition('FieldServiceOperationalRecords', 'FieldServiceOperationalRecords', 'C1', 'managed-package-data', {
    discovery: notApplicable('Operational records are deliberately excluded from metadata discovery.'),
    parsing: notApplicable(),
    dependencies: notApplicable(),
    ordering: notApplicable(),
    lifecycle: absent('Operational data migration is outside smart-deployment.'),
    fixtures: absent('No operational data fixture belongs in this plugin.'),
  }),
];

export const METADATA_CAPABILITY_DEFINITIONS: readonly MetadataCapabilityDefinition[] = [
  ...Object.keys(DEPLOYMENT_ORDER)
    .filter((metadataType) => !isExplicitlyDefined(metadataType) && !isLegacyScannerType(metadataType))
    .map((metadataType) => orderedDefinition(metadataType)),
  ...LEGACY_SCANNER_TYPES.filter((metadataType) => !isExplicitlyDefined(metadataType)).map((metadataType) =>
    scannerDefinition(metadataType)
  ),
  ...P0_DEFINITIONS,
];

function metadataDefinition(
  vendorType: string,
  canonicalType: string,
  canonicalOwner: MetadataCanonicalOwner,
  minimumApiVersion: string,
  capabilities: MetadataCapabilities,
  deploymentChannel: MetadataDeploymentChannel = 'metadata-api'
): MetadataCapabilityDefinition {
  return definition(
    vendorType,
    canonicalType,
    canonicalOwner,
    API_67,
    minimumApiVersion,
    deploymentChannel,
    capabilities
  );
}

function externalDefinition(
  vendorType: string,
  canonicalType: string,
  canonicalOwner: MetadataCanonicalOwner,
  deploymentChannel: MetadataDeploymentChannel,
  capabilities: MetadataCapabilities
): MetadataCapabilityDefinition {
  return definition(vendorType, canonicalType, canonicalOwner, 'n/a', 'n/a', deploymentChannel, capabilities);
}

function scannerDefinition(metadataType: string): MetadataCapabilityDefinition {
  return metadataDefinition(metadataType, metadataType, 'legacy-repository', '61.0', {
    discovery: proven('Existing metadata scanner coverage.'),
    parsing: partial('Parser depth varies by metadata family.'),
    dependencies: partial('Dependency evidence varies by metadata family.'),
    ordering: Object.hasOwn(DEPLOYMENT_ORDER, metadataType)
      ? proven(`${metadataType} is present in DEPLOYMENT_ORDER.`)
      : absent(`${metadataType} is absent from DEPLOYMENT_ORDER.`),
    lifecycle: notApplicable(),
    fixtures: partial('Focused fixture coverage varies by metadata family.'),
  });
}

function orderedDefinition(metadataType: string): MetadataCapabilityDefinition {
  return metadataDefinition(metadataType, metadataType, 'legacy-repository', '61.0', {
    discovery: absent(`No scanner is registered for ordered type ${metadataType}.`),
    parsing: absent(`No parser is registered for ordered type ${metadataType}.`),
    dependencies: absent(`No dependency extractor is registered for ordered type ${metadataType}.`),
    ordering: proven(`${metadataType} is present in DEPLOYMENT_ORDER.`),
    lifecycle: notApplicable(),
    fixtures: absent(`No focused fixture proves support for ordered-only type ${metadataType}.`),
  });
}

function definition(
  vendorType: string,
  canonicalType: string,
  canonicalOwner: MetadataCanonicalOwner,
  apiVersion: string,
  minimumApiVersion: string,
  deploymentChannel: MetadataDeploymentChannel,
  capabilities: MetadataCapabilities
): MetadataCapabilityDefinition {
  return {
    apiVersion,
    minimumApiVersion,
    deploymentChannel,
    vendorType,
    canonicalType,
    internalAliases: [],
    canonicalOwner,
    capabilities,
    evidenceSources:
      apiVersion === 'n/a'
        ? [REPOSITORY_SOURCE, RESEARCH_SOURCE]
        : [REPOSITORY_SOURCE, RESEARCH_SOURCE, SALESFORCE_COVERAGE_SOURCE],
  };
}

function isExplicitlyDefined(metadataType: string): boolean {
  return P0_DEFINITIONS.some((entry) => entry.vendorType === metadataType || entry.canonicalType === metadataType);
}

function isLegacyScannerType(metadataType: string): boolean {
  return LEGACY_SCANNER_TYPES.includes(metadataType as (typeof LEGACY_SCANNER_TYPES)[number]);
}

function absentCapabilities(): MetadataCapabilities {
  return {
    discovery: absent('No deterministic discovery is registered.'),
    parsing: absent('No semantic parser is registered.'),
    dependencies: absent('No dependency extraction is registered.'),
    ordering: absent('No deployment ordering is registered.'),
    lifecycle: absent('No deployment or provider lifecycle is registered.'),
    fixtures: absent('No deterministic fixture or CLI evidence is registered.'),
  };
}

function proven(detail: string): MetadataCapabilityEvidence {
  return evidence('proven', REPOSITORY_SOURCE_ID, detail);
}

function partial(detail: string): MetadataCapabilityEvidence {
  return evidence('partial', REPOSITORY_SOURCE_ID, detail);
}

function absent(detail: string): MetadataCapabilityEvidence {
  return evidence('absent', RESEARCH_SOURCE_ID, detail);
}

function notApplicable(detail = 'Capability does not apply to this deployment channel.'): MetadataCapabilityEvidence {
  return evidence('not-applicable', RESEARCH_SOURCE_ID, detail);
}

function evidence(
  status: MetadataCapabilityEvidence['status'],
  sourceId: string,
  detail: string
): MetadataCapabilityEvidence {
  return { status, evidence: [{ sourceId, detail }] };
}
