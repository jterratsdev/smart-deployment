import type {
  MetadataCapabilities,
  MetadataCapabilityDefinition,
  MetadataCapabilityEntry,
  MetadataCapabilityEvidenceReference,
  MetadataCapabilityEvidenceSource,
  MetadataDeploymentChannel,
} from '../types/metadata-capability.js';
import { METADATA_CAPABILITY_DEFINITIONS } from './metadata-capability-definitions.js';

const CAPABILITY_NAMES = ['discovery', 'parsing', 'dependencies', 'ordering', 'lifecycle', 'fixtures'] as const;

export class MetadataCapabilityRegistry {
  private readonly entriesByKey: ReadonlyMap<string, MetadataCapabilityEntry>;
  private readonly sortedEntries: readonly MetadataCapabilityEntry[];

  public constructor(definitions: readonly MetadataCapabilityDefinition[]) {
    const entriesByKey = new Map<string, MetadataCapabilityEntry>();
    const aliasesByScope = new Map<string, MetadataCapabilityEntry>();
    const entries = definitions.map((definition) => normalizeDefinition(definition));

    for (const entry of entries) {
      if (entriesByKey.has(entry.catalogKey)) {
        throw new Error(`Duplicate metadata capability catalog key: ${entry.catalogKey}`);
      }

      entriesByKey.set(entry.catalogKey, entry);
      for (const name of [entry.vendorType, entry.canonicalType, ...entry.internalAliases]) {
        const aliasKey = buildAliasKey(entry.apiVersion, entry.deploymentChannel, name);
        const existing = aliasesByScope.get(aliasKey);
        if (existing && existing.catalogKey !== entry.catalogKey) {
          throw new Error(
            `Duplicate metadata capability name "${name}" for ${entry.apiVersion}|${entry.deploymentChannel}`
          );
        }
        aliasesByScope.set(aliasKey, entry);
      }
    }

    this.entriesByKey = entriesByKey;
    this.sortedEntries = Object.freeze(
      [...entries].sort((left, right) => compareText(left.catalogKey, right.catalogKey))
    );
  }

  public list(): readonly MetadataCapabilityEntry[] {
    return this.sortedEntries;
  }

  public getByCatalogKey(catalogKey: string): MetadataCapabilityEntry | undefined {
    return this.entriesByKey.get(catalogKey);
  }

  public resolve(
    metadataType: string,
    projectApiVersion: string,
    deploymentChannel?: MetadataDeploymentChannel
  ): MetadataCapabilityEntry | undefined {
    const candidates = this.sortedEntries.filter(
      (entry) =>
        (deploymentChannel === undefined || entry.deploymentChannel === deploymentChannel) &&
        [entry.vendorType, entry.canonicalType, ...entry.internalAliases].includes(metadataType) &&
        isCompatibleWithProject(entry.minimumApiVersion, projectApiVersion)
    );
    const channels = new Set(candidates.map((entry) => entry.deploymentChannel));
    if (channels.size !== 1) {
      return undefined;
    }

    return [...candidates].sort((left, right) => compareApiVersion(left.apiVersion, right.apiVersion)).at(-1);
  }
}

export function buildMetadataCapabilityCatalogKey(
  apiVersion: string,
  deploymentChannel: MetadataDeploymentChannel,
  vendorType: string
): string {
  return `${apiVersion}|${deploymentChannel}|${vendorType}`;
}

export const metadataCapabilityRegistry = new MetadataCapabilityRegistry(METADATA_CAPABILITY_DEFINITIONS);

function normalizeDefinition(definition: MetadataCapabilityDefinition): MetadataCapabilityEntry {
  validateApiVersion(definition.apiVersion, 'apiVersion');
  validateApiVersion(definition.minimumApiVersion, 'minimumApiVersion');
  validateText(definition.vendorType, 'vendorType');
  validateText(definition.canonicalType, 'canonicalType');

  const aliases = [...definition.internalAliases].sort(compareText);
  if (new Set(aliases).size !== aliases.length) {
    throw new Error(`Duplicate aliases in metadata capability definition: ${definition.vendorType}`);
  }

  const evidenceSources = normalizeEvidenceSources(definition.evidenceSources, definition.vendorType);
  const sourceIds = new Set(evidenceSources.map((source) => source.id));
  const capabilities = normalizeCapabilities(definition.capabilities, sourceIds, definition.vendorType);

  return Object.freeze({
    ...definition,
    internalAliases: Object.freeze(aliases),
    capabilities,
    evidenceSources,
    catalogKey: buildMetadataCapabilityCatalogKey(
      definition.apiVersion,
      definition.deploymentChannel,
      definition.vendorType
    ),
  });
}

function normalizeEvidenceSources(
  sources: readonly MetadataCapabilityEvidenceSource[],
  vendorType: string
): readonly MetadataCapabilityEvidenceSource[] {
  const normalized = [...sources]
    .map((source) => {
      validateText(source.id, 'evidence source id');
      validateText(source.locator, 'evidence source locator');
      if (source.retrievedAt !== undefined && !/^\d{4}-\d{2}-\d{2}$/u.test(source.retrievedAt)) {
        throw new Error(`Invalid metadata capability evidence retrieval date: "${source.retrievedAt}"`);
      }
      return Object.freeze({ ...source });
    })
    .sort((left, right) => compareText(left.id, right.id));
  if (new Set(normalized.map((source) => source.id)).size !== normalized.length) {
    throw new Error(`Duplicate evidence sources in metadata capability definition: ${vendorType}`);
  }
  return Object.freeze(normalized);
}

function normalizeCapabilities(
  capabilities: MetadataCapabilities,
  sourceIds: ReadonlySet<string>,
  vendorType: string
): MetadataCapabilities {
  const actualNames = Object.keys(capabilities).sort(compareText);
  const expectedNames = [...CAPABILITY_NAMES].sort(compareText);
  if (actualNames.join('|') !== expectedNames.join('|')) {
    throw new Error(`Invalid capability dimensions in metadata capability definition: ${vendorType}`);
  }

  return Object.freeze(
    Object.fromEntries(
      CAPABILITY_NAMES.map((name) => {
        const capability = capabilities[name];
        return [
          name,
          Object.freeze({
            ...capability,
            evidence: Object.freeze(
              capability.evidence.map((reference) => normalizeEvidenceReference(reference, sourceIds, vendorType))
            ),
          }),
        ];
      })
    ) as MetadataCapabilities
  );
}

function normalizeEvidenceReference(
  reference: MetadataCapabilityEvidenceReference,
  sourceIds: ReadonlySet<string>,
  vendorType: string
): MetadataCapabilityEvidenceReference {
  validateText(reference.sourceId, 'evidence sourceId');
  validateText(reference.detail, 'evidence detail');
  if (!sourceIds.has(reference.sourceId)) {
    throw new Error(`Unknown evidence source "${reference.sourceId}" in metadata capability definition: ${vendorType}`);
  }
  return Object.freeze({ ...reference });
}

function buildAliasKey(apiVersion: string, deploymentChannel: MetadataDeploymentChannel, name: string): string {
  return `${apiVersion}|${deploymentChannel}|${name}`;
}

function validateApiVersion(value: string, field: string): void {
  validateText(value, field);
  if (value !== 'n/a' && !/^\d+\.\d+$/u.test(value)) {
    throw new Error(`Invalid metadata capability ${field}: "${value}"`);
  }
}

function validateText(value: string, field: string): void {
  if (value.trim().length === 0 || value !== value.trim() || value.includes('|')) {
    throw new Error(`Invalid metadata capability ${field}: "${value}"`);
  }
}

function isCompatibleWithProject(minimumApiVersion: string, projectApiVersion: string): boolean {
  if (minimumApiVersion === 'n/a') {
    return true;
  }
  const requestedVersion = Number.parseFloat(projectApiVersion);
  return Number.isFinite(requestedVersion) && Number.parseFloat(minimumApiVersion) <= requestedVersion;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareApiVersion(left: string, right: string): number {
  if (left === right) return 0;
  if (left === 'n/a') return -1;
  if (right === 'n/a') return 1;
  return Number.parseFloat(left) - Number.parseFloat(right);
}
