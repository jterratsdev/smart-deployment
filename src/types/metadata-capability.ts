export type MetadataDeploymentChannel =
  | 'metadata-api'
  | 'source-format-composite'
  | 'managed-package-data'
  | 'provider-lifecycle'
  | 'external-provider'
  | 'unknown';

export type MetadataCanonicalOwner = 'C1' | 'C2' | 'C3' | 'C4' | 'C5' | 'C6' | 'C7' | 'legacy-repository';

export type MetadataCapabilityStatus = 'proven' | 'partial' | 'absent' | 'not-applicable';

export type MetadataCapabilityEvidenceSource = {
  id: string;
  kind: 'repository' | 'vendor-documentation' | 'org-validation';
  locator: string;
  retrievedAt?: string;
};

export type MetadataCapabilityEvidenceReference = {
  sourceId: string;
  detail: string;
};

export type MetadataCapabilityEvidence = {
  status: MetadataCapabilityStatus;
  evidence: readonly MetadataCapabilityEvidenceReference[];
};

export type MetadataCapabilities = {
  discovery: MetadataCapabilityEvidence;
  parsing: MetadataCapabilityEvidence;
  dependencies: MetadataCapabilityEvidence;
  ordering: MetadataCapabilityEvidence;
  lifecycle: MetadataCapabilityEvidence;
  fixtures: MetadataCapabilityEvidence;
};

export type MetadataCapabilityDefinition = {
  apiVersion: string;
  minimumApiVersion: string;
  deploymentChannel: MetadataDeploymentChannel;
  vendorType: string;
  canonicalType: string;
  internalAliases: readonly string[];
  canonicalOwner: MetadataCanonicalOwner;
  capabilities: MetadataCapabilities;
  evidenceSources: readonly MetadataCapabilityEvidenceSource[];
};

export type MetadataCapabilityEntry = MetadataCapabilityDefinition & {
  catalogKey: string;
};
