/**
 * Unit tests for ManifestValidator
 */

import { expect } from 'chai';
import { describe, it, beforeEach } from 'mocha';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { ManifestValidator } from '../../../src/deployment/manifest-validator.js';
import type { Manifest } from '../../../src/types/deployment.js';
import type { MetadataComponent } from '../../../src/types/metadata.js';

describe('ManifestValidator', () => {
  let tempDir: string;
  let projectRoot: string;
  let componentMap: Map<string, MetadataComponent>;
  let validator: ManifestValidator;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'manifest-validator-test-'));
    projectRoot = tempDir;
    validator = new ManifestValidator();

    // Create component map
    componentMap = new Map();

    const apexClass: MetadataComponent = {
      name: 'TestClass',
      type: 'ApexClass',
      filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'TestClass.cls'),
      dependencies: new Set(),
      dependents: new Set(),
      priorityBoost: 0,
    };

    componentMap.set('ApexClass:TestClass', apexClass);

    // Create actual file
    await fs.mkdir(path.dirname(apexClass.filePath), { recursive: true });
    await fs.writeFile(apexClass.filePath, 'public class TestClass {}', 'utf-8');
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('validateManifest', () => {
    it('should validate manifest with matching components', async () => {
      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>TestClass</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`,
        components: {
          ApexClass: ['TestClass'],
        },
        apiVersion: '65.0',
      };

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('should detect components missing from source', async () => {
      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>MissingClass</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`,
        components: {
          ApexClass: ['MissingClass'],
        },
        apiVersion: '65.0',
      };

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
      expect(result.errors[0].message).to.include('not found in scanned metadata');
    });

    it('should detect missing files', async () => {
      // Add component to map but don't create file
      const missingFileComponent: MetadataComponent = {
        name: 'MissingFileClass',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'MissingFileClass.cls'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      componentMap.set('ApexClass:MissingFileClass', missingFileComponent);

      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>MissingFileClass</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`,
        components: {
          ApexClass: ['MissingFileClass'],
        },
        apiVersion: '65.0',
      };

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
      expect(result.errors[0].message).to.include('does not exist');
    });

    it('should warn about components in source missing from manifest', async () => {
      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>TestClass</members>
    <name>ApexClass</name>
  </types>
  <version>65.0</version>
</Package>`,
        components: {
          ApexClass: ['TestClass'],
        },
        apiVersion: '65.0',
      };

      // Add another component to source that's not in manifest
      const extraComponent: MetadataComponent = {
        name: 'ExtraClass',
        type: 'ApexClass',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'classes', 'ExtraClass.cls'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      componentMap.set('ApexClass:ExtraClass', extraComponent);
      await fs.mkdir(path.dirname(extraComponent.filePath), { recursive: true });
      await fs.writeFile(extraComponent.filePath, 'public class ExtraClass {}', 'utf-8');

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.true; // Still valid, just warnings
      expect(result.warnings).to.have.length.greaterThan(0);
      expect(result.warnings[0].message).to.include('exists in source but is not included in manifest');
    });

    it('should handle invalid XML gracefully', async () => {
      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: 'Invalid XML content',
        components: {},
        apiVersion: '65.0',
      };

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.false;
      expect(result.errors).to.have.length.greaterThan(0);
      expect(result.errors[0].message).to.include('Failed to parse manifest XML');
    });

    it('should validate multiple component types', async () => {
      // Add CustomObject component
      const customObject: MetadataComponent = {
        name: 'TestObject__c',
        type: 'CustomObject',
        filePath: path.join(projectRoot, 'force-app', 'main', 'default', 'objects', 'TestObject__c', 'TestObject__c.object-meta.xml'),
        dependencies: new Set(),
        dependents: new Set(),
        priorityBoost: 0,
      };
      componentMap.set('CustomObject:TestObject__c', customObject);
      await fs.mkdir(path.dirname(customObject.filePath), { recursive: true });
      await fs.writeFile(customObject.filePath, '<?xml version="1.0"?><CustomObject/>', 'utf-8');

      const manifest: Manifest = {
        fileName: 'wave-001-package.xml',
        content: `<?xml version="1.0" encoding="UTF-8"?>
<Package xmlns="http://soap.sforce.com/2006/04/metadata">
  <types>
    <members>TestClass</members>
    <name>ApexClass</name>
  </types>
  <types>
    <members>TestObject__c</members>
    <name>CustomObject</name>
  </types>
  <version>65.0</version>
</Package>`,
        components: {
          ApexClass: ['TestClass'],
          CustomObject: ['TestObject__c'],
        },
        apiVersion: '65.0',
      };

      const result = await validator.validateManifest(manifest, componentMap, projectRoot);

      expect(result.isValid).to.be.true;
      expect(result.errors).to.have.length(0);
    });
  });
});

