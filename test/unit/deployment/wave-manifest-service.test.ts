import { mkdtemp, readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveManifestService } from '../../../src/deployment/wave-manifest-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('WaveManifestService', () => {
  it('uses the recommended API version when no version is provided', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-default-version-'));
    const manifestPath = await new WaveManifestService().generateManifest({
      baseDir,
      waveNumber: 1,
      components: [],
      componentMap: new Map(),
    });

    expect(await readFile(manifestPath, 'utf8')).to.include('<version>67.0</version>');
  });

  it('generates a sorted package.xml manifest for a wave', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-'));
    const service = new WaveManifestService();
    const components = new Map<string, MetadataComponent>([
      [
        'ApexClass:BetaService',
        {
          name: 'BetaService',
          type: 'ApexClass',
          filePath: 'force-app/main/default/classes/BetaService.cls',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
      [
        'CustomObject:Invoice__c',
        {
          name: 'Invoice__c',
          type: 'CustomObject',
          filePath: 'force-app/main/default/objects/Invoice__c/Invoice__c.object-meta.xml',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
      [
        'ApexClass:AlphaService',
        {
          name: 'AlphaService',
          type: 'ApexClass',
          filePath: 'force-app/main/default/classes/AlphaService.cls',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
    ]);

    const manifestPath = await service.generateManifest({
      baseDir,
      waveNumber: 7,
      components: ['ApexClass:BetaService', 'CustomObject:Invoice__c', 'ApexClass:AlphaService'],
      componentMap: components,
      apiVersion: '66.0',
    });

    const content = await readFile(manifestPath, 'utf8');

    expect(manifestPath).to.match(/wave-007\.xml$/);
    expect(content).to.include('<name>ApexClass</name>');
    expect(content).to.include('<name>CustomObject</name>');
    expect(content.indexOf('<members>AlphaService</members>')).to.be.lessThan(
      content.indexOf('<members>BetaService</members>')
    );
    expect(content.indexOf('<name>ApexClass</name>')).to.be.lessThan(content.indexOf('<name>CustomObject</name>'));
    expect(content).to.include('<version>66.0</version>');
  });

  it('includes expanded Salesforce metadata types in generated manifests', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-expanded-'));
    const service = new WaveManifestService();
    const components = new Map<string, MetadataComponent>(
      [
        ['StandardValueSet', 'Lead.Status'],
        ['EmbeddedServiceConfig', 'Pacific_Haven'],
        ['Queue', 'Case_Support'],
        ['BrandingSet', 'Pacific_Haven'],
        ['DigitalExperienceBundle', 'Pacific_Haven'],
        ['Network', 'Pacific_Haven'],
        ['CustomSite', 'Pacific_Haven'],
      ].map(([type, name]) => [
        `${type}:${name}`,
        {
          name,
          type: type as MetadataComponent['type'],
          filePath: `force-app/main/default/${name}`,
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ])
    );

    const manifestPath = await service.generateManifest({
      baseDir,
      waveNumber: 8,
      components: [...components.keys()],
      componentMap: components,
      apiVersion: '66.0',
    });

    const content = await readFile(manifestPath, 'utf8');

    expect(content).to.include('<name>StandardValueSet</name>');
    expect(content).to.include('<name>EmbeddedServiceConfig</name>');
    expect(content).to.include('<name>Queue</name>');
    expect(content).to.include('<name>BrandingSet</name>');
    expect(content).to.include('<name>DigitalExperienceBundle</name>');
    expect(content).to.include('<name>Network</name>');
    expect(content).to.include('<name>CustomSite</name>');
  });

  it('renders Retail Execution settings through the Settings transport member', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-retail-settings-'));
    const components = new Map<string, MetadataComponent>([
      [
        'RetailExecutionSettings:RetailExecution',
        {
          name: 'RetailExecution',
          type: 'RetailExecutionSettings',
          filePath: 'force-app/main/default/settings/RetailExecution.settings-meta.xml',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]);

    const manifestPath = await new WaveManifestService().generateManifest({
      baseDir,
      waveNumber: 1,
      components: [...components.keys()],
      componentMap: components,
      apiVersion: '67.0',
    });
    const content = await readFile(manifestPath, 'utf8');

    expect(content).to.include('<members>RetailExecution</members>');
    expect(content).to.include('<name>Settings</name>');
    expect(content).not.to.include('<name>RetailExecutionSettings</name>');
  });

  it('blocks destructive deletion of Retail Execution settings', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-retail-settings-delete-'));
    const components = new Map<string, MetadataComponent>([
      [
        'RetailExecutionSettings:RetailExecution',
        {
          name: 'RetailExecution',
          type: 'RetailExecutionSettings',
          filePath: 'force-app/main/default/settings/RetailExecution.settings-meta.xml',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]);

    let thrownError: Error | undefined;
    try {
      await new WaveManifestService().generateDestructiveManifest({
        baseDir,
        waveNumber: 1,
        components: [...components.keys()],
        componentMap: components,
        apiVersion: '67.0',
      });
    } catch (error) {
      thrownError = error as Error;
    }

    expect(thrownError?.message).to.equal(
      'Retail Execution settings cannot be deleted through destructiveChanges: RetailExecutionSettings:RetailExecution'
    );
  });

  it('renders MatchingRules and DuplicateRule with exact transport identities', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-data-quality-rules-'));
    const components = new Map<string, MetadataComponent>([
      [
        'MatchingRules:Account',
        {
          name: 'Account',
          type: 'MatchingRules',
          filePath: 'matching',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
      [
        'DuplicateRule:Account.Email_Duplicate',
        {
          name: 'Account.Email_Duplicate',
          type: 'DuplicateRule',
          filePath: 'duplicate',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]);
    const manifestPath = await new WaveManifestService().generateManifest({
      baseDir,
      waveNumber: 1,
      components: [...components.keys()],
      componentMap: components,
      apiVersion: '67.0',
    });
    const content = await readFile(manifestPath, 'utf8');
    expect(content).to.include('<members>Account</members>');
    expect(content).to.include('<name>MatchingRules</name>');
    expect(content).to.include('<members>Account.Email_Duplicate</members>');
    expect(content).to.include('<name>DuplicateRule</name>');
  });

  it('blocks destructive deletion of matching and duplicate rules regardless of source state', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-data-quality-delete-'));
    const matching: MetadataComponent = {
      name: 'Account',
      type: 'MatchingRules',
      filePath: 'matching',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
      facts: { kind: 'matching-rules', objectName: 'Account', rules: [{ name: 'Rule', fields: [], isActive: true }] },
    };
    const duplicate: MetadataComponent = {
      name: 'Account.Rule',
      type: 'DuplicateRule',
      filePath: 'duplicate',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
      facts: {
        kind: 'duplicate-rule',
        objectName: 'Account',
        matchingRules: [{ objectName: 'Account', matchingRuleName: 'Rule' }],
        filterFields: [],
        isActive: true,
      },
    };
    const components = new Map([
      ['MatchingRules:Account', matching],
      ['DuplicateRule:Account.Rule', duplicate],
    ]);
    let error: Error | undefined;
    try {
      await new WaveManifestService().generateDestructiveManifest({
        baseDir,
        waveNumber: 1,
        components: [...components.keys()],
        componentMap: components,
        apiVersion: '67.0',
      });
    } catch (caught) {
      error = caught as Error;
    }
    expect(error?.message).to.include('Matching and duplicate rules cannot be deleted automatically');
  });

  it('generates a destructiveChanges manifest with an empty package manifest', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-destructive-'));
    const service = new WaveManifestService();
    const components = new Map<string, MetadataComponent>([
      [
        'ApexClass:DeletedService',
        {
          name: 'DeletedService',
          type: 'ApexClass',
          filePath: 'force-app/main/default/classes/DeletedService.cls',
          dependencies: new Set<string>(),
          dependents: new Set<string>(),
          priorityBoost: 0,
        },
      ],
    ]);

    const result = await service.generateDestructiveManifest({
      baseDir,
      waveNumber: 3,
      components: ['ApexClass:DeletedService'],
      componentMap: components,
      apiVersion: '66.0',
    });

    const emptyPackage = await readFile(result.packagePath, 'utf8');
    const destructiveChanges = await readFile(result.destructiveChangesPath, 'utf8');

    expect(result.packagePath).to.match(/wave-003-package.xml$/);
    expect(result.destructiveChangesPath).to.match(/wave-003-destructiveChanges.xml$/);
    expect(emptyPackage).to.not.include('<types>');
    expect(emptyPackage).to.include('<version>66.0</version>');
    expect(destructiveChanges).to.include('<members>DeletedService</members>');
    expect(destructiveChanges).to.include('<name>ApexClass</name>');
  });
});
