import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  MetadataCapabilityRegistry,
  buildMetadataCapabilityCatalogKey,
  metadataCapabilityRegistry,
} from '../../../src/analysis/metadata-capability-registry.js';
import type {
  MetadataCapabilities,
  MetadataCapabilityDefinition,
  MetadataDeploymentChannel,
} from '../../../src/types/metadata-capability.js';

describe('MetadataCapabilityRegistry', () => {
  it('resolves vendor names and internal aliases to one canonical entry', () => {
    const vendorEntry = metadataCapabilityRegistry.resolve('ApexPage', '67.0');
    const aliasEntry = metadataCapabilityRegistry.resolve('VisualforcePage', '67.0');

    expect(vendorEntry).to.equal(aliasEntry);
    expect(vendorEntry).to.deep.include({
      catalogKey: '67.0|metadata-api|ApexPage',
      vendorType: 'ApexPage',
      canonicalType: 'VisualforcePage',
      canonicalOwner: 'C1',
      deploymentChannel: 'metadata-api',
    });
    expect(vendorEntry?.evidenceSources).to.deep.include({
      id: 'salesforce-metadata-coverage-67',
      kind: 'vendor-documentation',
      locator:
        'https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0',
      retrievedAt: '2026-07-23',
    });
  });

  it('keeps identical names isolated by deployment channel', () => {
    const registry = new MetadataCapabilityRegistry([
      definition('67.0', 'metadata-api', 'SharedName'),
      definition('n/a', 'external-provider', 'SharedName'),
    ]);

    expect(registry.resolve('SharedName', '67.0', 'metadata-api')?.catalogKey).to.equal('67.0|metadata-api|SharedName');
    expect(registry.resolve('SharedName', 'n/a', 'external-provider')?.catalogKey).to.equal(
      'n/a|external-provider|SharedName'
    );
    expect(registry.resolve('SharedName', '67.0', 'managed-package-data')).to.equal(undefined);
    expect(registry.resolve('SharedName', '67.0')).to.equal(undefined);
  });

  it('rejects duplicate catalog keys and aliases within a version and channel', () => {
    expect(
      () =>
        new MetadataCapabilityRegistry([
          definition('67.0', 'metadata-api', 'Flow'),
          definition('67.0', 'metadata-api', 'Flow'),
        ])
    ).to.throw('Duplicate metadata capability catalog key');

    expect(
      () =>
        new MetadataCapabilityRegistry([
          definition('67.0', 'metadata-api', 'ApexPage', ['VisualforcePage']),
          definition('67.0', 'metadata-api', 'OtherPage', ['VisualforcePage']),
        ])
    ).to.throw('Duplicate metadata capability name "VisualforcePage"');
  });

  it('returns entries in deterministic catalog-key order and leaves unknown types unresolved', () => {
    const registry = new MetadataCapabilityRegistry([
      definition('67.0', 'metadata-api', 'Zeta'),
      definition('67.0', 'metadata-api', 'Alpha'),
      definition('n/a', 'external-provider', 'Beta'),
    ]);

    expect(registry.list().map((entry) => entry.catalogKey)).to.deep.equal([
      '67.0|metadata-api|Alpha',
      '67.0|metadata-api|Zeta',
      'n/a|external-provider|Beta',
    ]);
    expect(registry.resolve('UnknownType', '67.0')).to.equal(undefined);
    expect(buildMetadataCapabilityCatalogKey('67.0', 'metadata-api', 'Flow')).to.equal('67.0|metadata-api|Flow');
  });

  it('selects the latest compatible API-versioned entry when no exact snapshot exists', () => {
    const registry = new MetadataCapabilityRegistry([
      definition('66.0', 'metadata-api', 'VersionedType', [], '61.0'),
      definition('67.0', 'metadata-api', 'VersionedType', [], '67.0'),
    ]);

    expect(registry.resolve('VersionedType', '66.5')?.apiVersion).to.equal('66.0');
    expect(registry.resolve('VersionedType', '61.0')?.apiVersion).to.equal('66.0');
    expect(registry.resolve('VersionedType', '60.0')).to.equal(undefined);
  });

  it('records fixture evidence and enforces canonical C1 ownership for shared platform types', () => {
    for (const metadataType of ['CustomObject', 'Flow', 'PermissionSet']) {
      const entry = metadataCapabilityRegistry.resolve(metadataType, '67.0');
      expect(entry?.canonicalOwner).to.equal('C1');
      expect(entry?.capabilities.fixtures.status).to.equal('proven');
    }

    expect(metadataCapabilityRegistry.resolve('OrderManagementSettings', '67.0')?.canonicalOwner).to.equal('C1');
    const operationalRecords = metadataCapabilityRegistry.resolve(
      'FieldServiceOperationalRecords',
      'n/a',
      'managed-package-data'
    );
    expect(operationalRecords?.capabilities.discovery.status).to.equal('not-applicable');
    expect(operationalRecords?.capabilities.lifecycle.status).to.equal('absent');
  });

  it('conforms actual AI rows to their source-format and provider lifecycle boundaries', () => {
    const authoringBundle = metadataCapabilityRegistry.resolve('AiAuthoringBundle', '67.0');
    expect(authoringBundle).to.deep.include({
      catalogKey: '67.0|source-format-composite|AiAuthoringBundle',
      canonicalOwner: 'C2',
      minimumApiVersion: '66.0',
    });
    expect(capabilityStatuses(authoringBundle)).to.deep.equal([
      'proven',
      'partial',
      'absent',
      'proven',
      'proven',
      'proven',
    ]);
    expect(metadataCapabilityRegistry.resolve('AiAuthoringBundle', '65.0')).to.equal(undefined);
    expect(metadataCapabilityRegistry.resolve('AiAuthoringBundle', '67.0', 'metadata-api')).to.equal(undefined);

    const botVersion = metadataCapabilityRegistry.resolve('BotVersion', '67.0');
    expect(botVersion?.catalogKey).to.equal('n/a|provider-lifecycle|BotVersion');
    expect(botVersion?.capabilities.discovery.status).to.equal('absent');
    expect(metadataCapabilityRegistry.resolve('BotVersion', '67.0', 'metadata-api')).to.equal(undefined);

    expect(metadataCapabilityRegistry.resolve('AiEvaluationDefinition', '67.0')).to.deep.include({
      catalogKey: '67.0|metadata-api|AiEvaluationDefinition',
      canonicalOwner: 'C2',
    });
  });

  it('matches the approved C1 and C2 P0 capability matrix', () => {
    const expected = [
      row('ApexComponent', 'metadata-api', 'C1', ['proven', 'proven', 'proven', 'proven', 'not-applicable', 'proven']),
      row('ApexPage', 'metadata-api', 'C1', ['proven', 'proven', 'proven', 'proven', 'not-applicable', 'proven']),
      row('CustomApplication', 'metadata-api', 'C1', [
        'partial',
        'absent',
        'partial',
        'absent',
        'not-applicable',
        'absent',
      ]),
      row('CustomMetadata', 'metadata-api', 'C1', ['proven', 'proven', 'proven', 'proven', 'not-applicable', 'proven']),
      row('CustomObject', 'metadata-api', 'C1', ['proven', 'proven', 'partial', 'proven', 'not-applicable', 'proven']),
      row('Flow', 'metadata-api', 'C1', ['proven', 'proven', 'partial', 'proven', 'not-applicable', 'proven']),
      row('MatchingRules', 'metadata-api', 'C1', ['partial', 'absent', 'absent', 'absent', 'not-applicable', 'absent']),
      row('PermissionSet', 'metadata-api', 'C1', ['proven', 'proven', 'partial', 'proven', 'not-applicable', 'proven']),
      row('OrderManagementSettings', 'metadata-api', 'C1', [
        'partial',
        'absent',
        'absent',
        'absent',
        'absent',
        'absent',
      ]),
      row('AiAuthoringBundle', 'source-format-composite', 'C2', [
        'proven',
        'partial',
        'absent',
        'proven',
        'proven',
        'proven',
      ]),
      row('GenAiPlannerBundle', 'metadata-api', 'C2', ['proven', 'partial', 'proven', 'proven', 'partial', 'proven']),
      row('GenAiPromptTemplate', 'metadata-api', 'C2', ['proven', 'proven', 'partial', 'proven', 'partial', 'proven']),
      row('AiEvaluationDefinition', 'metadata-api', 'C2', [
        'proven',
        'proven',
        'proven',
        'proven',
        'partial',
        'proven',
      ]),
      row('BotVersion', 'provider-lifecycle', 'C2', ['absent', 'absent', 'absent', 'absent', 'partial', 'absent']),
      row('SlackApp', 'metadata-api', 'C1', ['absent', 'absent', 'absent', 'absent', 'absent', 'absent']),
      row('SlackAppManifest', 'external-provider', 'C1', [
        'absent',
        'not-applicable',
        'not-applicable',
        'not-applicable',
        'absent',
        'absent',
      ]),
      row('FSLManagedConfiguration', 'managed-package-data', 'C1', [
        'absent',
        'not-applicable',
        'not-applicable',
        'not-applicable',
        'absent',
        'absent',
      ]),
      row('FieldServiceOperationalRecords', 'managed-package-data', 'C1', [
        'not-applicable',
        'not-applicable',
        'not-applicable',
        'not-applicable',
        'absent',
        'absent',
      ]),
    ] as const;

    for (const contract of expected) {
      const entry = metadataCapabilityRegistry.resolve(contract.vendorType, '67.0', contract.channel);
      expect(entry, contract.vendorType).not.to.equal(undefined);
      expect(entry?.canonicalOwner, contract.vendorType).to.equal(contract.owner);
      expect(capabilityStatuses(entry), contract.vendorType).to.deep.equal(contract.statuses);
      expect(entry?.evidenceSources.length, contract.vendorType).to.be.greaterThan(0);
      for (const capability of Object.values(entry?.capabilities ?? {})) {
        expect(capability.evidence.length, contract.vendorType).to.be.greaterThan(0);
      }
    }
  });

  it('rejects capability evidence that references an undeclared source', () => {
    const invalid = definition('67.0', 'metadata-api', 'Flow');
    invalid.capabilities.discovery = {
      status: 'proven',
      evidence: [{ sourceId: 'missing-source', detail: 'fixture' }],
    };

    expect(() => new MetadataCapabilityRegistry([invalid])).to.throw(
      'Unknown evidence source "missing-source" in metadata capability definition: Flow'
    );
  });
});

function definition(
  apiVersion: string,
  deploymentChannel: MetadataDeploymentChannel,
  vendorType: string,
  internalAliases: readonly string[] = [],
  minimumApiVersion = apiVersion
): MetadataCapabilityDefinition {
  return {
    apiVersion,
    minimumApiVersion,
    deploymentChannel,
    vendorType,
    canonicalType: vendorType,
    internalAliases,
    canonicalOwner: 'C1',
    capabilities: capabilities(),
    evidenceSources: [
      {
        id: 'fixture',
        kind: 'repository',
        locator: 'test fixture',
      },
    ],
  };
}

function capabilityStatuses(
  entry: ReturnType<MetadataCapabilityRegistry['resolve']>
): Array<MetadataCapabilities[keyof MetadataCapabilities]['status']> {
  if (!entry) return [];
  return [
    entry.capabilities.discovery.status,
    entry.capabilities.parsing.status,
    entry.capabilities.dependencies.status,
    entry.capabilities.ordering.status,
    entry.capabilities.lifecycle.status,
    entry.capabilities.fixtures.status,
  ];
}

function row(
  vendorType: string,
  channel: MetadataDeploymentChannel,
  owner: MetadataCapabilityDefinition['canonicalOwner'],
  statuses: ReturnType<typeof capabilityStatuses>
) {
  return { vendorType, channel, owner, statuses };
}

function capabilities(): MetadataCapabilities {
  return {
    discovery: { status: 'proven', evidence: [{ sourceId: 'fixture', detail: 'fixture' }] },
    parsing: { status: 'partial', evidence: [{ sourceId: 'fixture', detail: 'fixture' }] },
    dependencies: { status: 'absent', evidence: [] },
    ordering: { status: 'proven', evidence: [{ sourceId: 'fixture', detail: 'fixture' }] },
    lifecycle: { status: 'not-applicable', evidence: [] },
    fixtures: { status: 'proven', evidence: [{ sourceId: 'fixture', detail: 'fixture' }] },
  };
}
