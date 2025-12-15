/**
 * Unit tests for ManifestGenerator
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ManifestGenerator } from '../../../src/deployment/manifest-generator.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';
import type { Wave } from '../../../src/waves/wave-builder.js';

describe('ManifestGenerator', () => {
  let tempDir: string;
  let projectRoot: string;
  let componentMap: Map<string, MetadataComponent>;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-test-'));
    projectRoot = tempDir;

    // Create component map
    componentMap = new Map();

    // Add test components
    const apexClass: MetadataComponent = {
      name: 'TestClass',
      type: 'ApexClass',
      filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'TestClass.cls'),
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };

    const customObject: MetadataComponent = {
      name: 'TestObject__c',
      type: 'CustomObject',
      filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'TestObject__c', 'TestObject__c.object-meta.xml'),
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };

    componentMap.set('ApexClass:TestClass', apexClass);
    componentMap.set('CustomObject:TestObject__c', customObject);

    // Create actual files for validation
    await fs.mkdir(path.dirname(apexClass.filePath), { recursive: true });
    await fs.writeFile(apexClass.filePath, 'public class TestClass {}', 'utf-8');

    await fs.mkdir(path.dirname(customObject.filePath), { recursive: true });
    await fs.writeFile(customObject.filePath, '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"/>', 'utf-8');
  });

  afterEach(async () => {
    // Cleanup
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('generateManifests', () => {
    it('should generate manifests for waves', async () => {
      const generator = new ManifestGenerator();

      // Create test waves
      const waves: Wave[] = [
        {
          number: 1,
          components: ['CustomObject:TestObject__c'],
          metadata: {
            componentCount: 1,
            types: ['CustomObject'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
        {
          number: 2,
          components: ['ApexClass:TestClass'],
          metadata: {
            componentCount: 1,
            types: ['ApexClass'],
            maxDepth: 1,
            hasCircularDeps: false,
            estimatedTime: 5,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(2);
      expect(result.errors).to.have.length(0);

      // Verify manifest files exist
      const manifest1 = result.manifests.find((m) => m.fileName.includes('wave-001'));
      const manifest2 = result.manifests.find((m) => m.fileName.includes('wave-002'));

      expect(manifest1).to.exist;
      expect(manifest2).to.exist;

      // Verify manifest content
      expect(manifest1!.content).to.include('CustomObject');
      expect(manifest1!.content).to.include('TestObject__c');
      expect(manifest2!.content).to.include('ApexClass');
      expect(manifest2!.content).to.include('TestClass');
    });

    it('should skip components with missing files when validateFiles is true', async () => {
      const generator = new ManifestGenerator();

      // Add component with non-existent file
      const missingComponent: MetadataComponent = {
        name: 'MissingClass',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'MissingClass.cls'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      componentMap.set('ApexClass:MissingClass', missingComponent);

      const waves: Wave[] = [
        {
          number: 1,
          components: ['ApexClass:MissingClass'],
          metadata: {
            componentCount: 1,
            types: ['ApexClass'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 5,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      // Should generate no manifests (all components skipped due to missing files)
      // The component is skipped silently when file doesn't exist
      expect(result.manifests).to.have.length(0);
    });

    it('should handle unknown metadata types gracefully', async () => {
      const generator = new ManifestGenerator();

      const unknownComponent: MetadataComponent = {
        name: 'UnknownType',
        type: 'UnknownType' as any,
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'unknown', 'UnknownType.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      componentMap.set('UnknownType:UnknownType', unknownComponent);

      await fs.mkdir(path.dirname(unknownComponent.filePath), { recursive: true });
      await fs.writeFile(unknownComponent.filePath, '<?xml version="1.0"?><UnknownType/>', 'utf-8');

      const waves: Wave[] = [
        {
          number: 1,
          components: ['UnknownType:UnknownType'],
          metadata: {
            componentCount: 1,
            types: ['UnknownType' as any],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 5,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: false, // Don't validate to allow unknown types
      });

      // Should skip unknown types (no mapping available)
      // The MetadataTypeMapper will return null for unknown types
      expect(result.manifests).to.have.length(0);
    });

    it('should group components by Salesforce type correctly', async () => {
      const generator = new ManifestGenerator();

      // Add multiple components of same type
      const class1: MetadataComponent = {
        name: 'Class1',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'Class1.cls'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      const class2: MetadataComponent = {
        name: 'Class2',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'Class2.cls'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      componentMap.set('ApexClass:Class1', class1);
      componentMap.set('ApexClass:Class2', class2);

      await fs.mkdir(path.dirname(class1.filePath), { recursive: true });
      await fs.writeFile(class1.filePath, 'public class Class1 {}', 'utf-8');
      await fs.writeFile(class2.filePath, 'public class Class2 {}', 'utf-8');

      const waves: Wave[] = [
        {
          number: 1,
          components: ['ApexClass:Class1', 'ApexClass:Class2'],
          metadata: {
            componentCount: 2,
            types: ['ApexClass'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(1);
      const manifest = result.manifests[0];

      // Should have both classes in same types element
      expect(manifest.content).to.include('Class1');
      expect(manifest.content).to.include('Class2');
      expect(manifest.content.match(/<members>/g)).to.have.length(2); // Two members
    });

    it('should use correct API version', async () => {
      const generator = new ManifestGenerator();

      const waves: Wave[] = [
        {
          number: 1,
          components: ['ApexClass:TestClass'],
          metadata: {
            componentCount: 1,
            types: ['ApexClass'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 5,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        apiVersion: '60.0',
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(1);
      expect(result.manifests[0].content).to.include('<version>60.0</version>');
      expect(result.manifests[0].apiVersion).to.equal('60.0');
    });

    it('should place __mdt components in CustomObject section, not CustomMetadata', async () => {
      const generator = new ManifestGenerator();

      // Add Custom Metadata Type component (__mdt)
      const customMetadataType: MetadataComponent = {
        name: 'TestConfig__mdt',
        type: 'CustomObject', // Correctly typed as CustomObject
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'TestConfig__mdt', 'TestConfig__mdt.object-meta.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      componentMap.set('CustomObject:TestConfig__mdt', customMetadataType);

      await fs.mkdir(path.dirname(customMetadataType.filePath), { recursive: true });
      await fs.writeFile(customMetadataType.filePath, '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"/>', 'utf-8');

      const waves: Wave[] = [
        {
          number: 1,
          components: ['CustomObject:TestConfig__mdt'],
          metadata: {
            componentCount: 1,
            types: ['CustomObject'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(1);
      const manifest = result.manifests[0];

      // Should be in CustomObject section
      expect(manifest.content).to.include('<name>CustomObject</name>');
      expect(manifest.content).to.include('TestConfig__mdt');

      // Should NOT be in CustomMetadata section
      const customMetadataSection = manifest.content.match(/<types>[\s\S]*?<name>CustomMetadata<\/name>/);
      if (customMetadataSection) {
        expect(customMetadataSection[0]).to.not.include('TestConfig__mdt');
      }
    });

    it('should redirect __mdt components from CustomMetadata to CustomObject section', async () => {
      const generator = new ManifestGenerator();

      // Simulate a component incorrectly typed as CustomMetadata but with __mdt suffix
      // This could happen if there's a bug in type detection
      const incorrectlyTypedCMT: MetadataComponent = {
        name: 'MyConfig__mdt',
        type: 'CustomMetadata', // Incorrectly typed, but name ends with __mdt
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'MyConfig__mdt', 'MyConfig__mdt.object-meta.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      componentMap.set('CustomMetadata:MyConfig__mdt', incorrectlyTypedCMT);

      await fs.mkdir(path.dirname(incorrectlyTypedCMT.filePath), { recursive: true });
      await fs.writeFile(incorrectlyTypedCMT.filePath, '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"/>', 'utf-8');

      const waves: Wave[] = [
        {
          number: 1,
          components: ['CustomMetadata:MyConfig__mdt'],
          metadata: {
            componentCount: 1,
            types: ['CustomMetadata'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(1);
      const manifest = result.manifests[0];

      // Even though component was typed as CustomMetadata, it should be in CustomObject section
      // because name ends with __mdt
      expect(manifest.content).to.include('<name>CustomObject</name>');
      expect(manifest.content).to.include('MyConfig__mdt');

      // Should NOT be in CustomMetadata section
      const customMetadataSection = manifest.content.match(/<types>[\s\S]*?<name>CustomMetadata<\/name>/);
      if (customMetadataSection) {
        expect(customMetadataSection[0]).to.not.include('MyConfig__mdt');
      }
    });

    it('should handle both regular CustomObject and __mdt CustomObject in same manifest', async () => {
      const generator = new ManifestGenerator();

      const regularObject: MetadataComponent = {
        name: 'Account__c',
        type: 'CustomObject',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'Account__c', 'Account__c.object-meta.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      const customMetadataType: MetadataComponent = {
        name: 'Config__mdt',
        type: 'CustomObject',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'Config__mdt', 'Config__mdt.object-meta.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };

      componentMap.set('CustomObject:Account__c', regularObject);
      componentMap.set('CustomObject:Config__mdt', customMetadataType);

      await fs.mkdir(path.dirname(regularObject.filePath), { recursive: true });
      await fs.writeFile(regularObject.filePath, '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"/>', 'utf-8');

      await fs.mkdir(path.dirname(customMetadataType.filePath), { recursive: true });
      await fs.writeFile(customMetadataType.filePath, '<?xml version="1.0"?><CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"/>', 'utf-8');

      const waves: Wave[] = [
        {
          number: 1,
          components: ['CustomObject:Account__c', 'CustomObject:Config__mdt'],
          metadata: {
            componentCount: 2,
            types: ['CustomObject'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 10,
          },
        },
      ];

      const result = await generator.generateManifests(waves, {
        projectRoot,
        componentMap,
        outputDir: path.join(projectRoot, '.smart-deployment', 'manifests'),
        validateFiles: true,
      });

      expect(result.manifests).to.have.length(1);
      const manifest = result.manifests[0];

      // Both should be in CustomObject section
      expect(manifest.content).to.include('<name>CustomObject</name>');
      expect(manifest.content).to.include('Account__c');
      expect(manifest.content).to.include('Config__mdt');

      // Should have exactly one CustomObject types section
      const customObjectSections = manifest.content.match(/<name>CustomObject<\/name>/g);
      expect(customObjectSections).to.have.length(1);
    });
  });
});

