import { mkdtemp, readFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { WaveManifestService } from '../../../src/deployment/wave-manifest-service.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('WaveManifestService', () => {
  it('deploys the CustomLabels container without enumerating child labels', async () => {
    const baseDir = await mkdtemp(path.join(os.tmpdir(), 'wave-manifest-labels-'));
    const component: MetadataComponent = {
      name: 'CustomLabels',
      type: 'CustomLabels',
      filePath: 'force-app/main/default/labels/CustomLabels.labels-meta.xml',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };
    const manifestPath = await new WaveManifestService().generateManifest({
      baseDir,
      waveNumber: 1,
      components: ['CustomLabels:CustomLabels'],
      componentMap: new Map([['CustomLabels:CustomLabels', component]]),
    });
    const content = await readFile(manifestPath, 'utf8');

    expect(content).to.include('<name>CustomLabels</name>');
    expect(content).to.include('<members>*</members>');
    expect(content).to.not.include('<members>CustomLabels</members>');
  });

  it('rejects a destructive manifest for the CustomLabels container', async () => {
    const component: MetadataComponent = {
      name: 'CustomLabels',
      type: 'CustomLabels',
      filePath: 'force-app/main/default/labels/CustomLabels.labels-meta.xml',
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };

    try {
      await new WaveManifestService().generateDestructiveManifest({
        baseDir: 'unused',
        waveNumber: 1,
        components: ['CustomLabels:CustomLabels'],
        componentMap: new Map([['CustomLabels:CustomLabels', component]]),
      });
      expect.fail('Expected destructive CustomLabels manifest to be rejected');
    } catch (error) {
      expect((error as Error).message).to.equal('CustomLabels container cannot be used in a destructive manifest');
    }
  });

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
