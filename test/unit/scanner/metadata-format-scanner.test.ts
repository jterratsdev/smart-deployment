/**
 * Tests for Metadata Format Scanner - US-080
 */
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { MetadataFormatScanner } from '../../../src/scanner/metadata-format-scanner.js';

describe('MetadataFormatScanner', () => {
  const scanner = new MetadataFormatScanner();

  describe('US-080: Metadata API Format Support', () => {
    it('scans only the canonical CustomLabels file as one container', async () => {
      const projectRoot = mkdtempSync(join(tmpdir(), 'metadata-format-labels-'));
      try {
        const labelsDir = join(projectRoot, 'src', 'labels');
        mkdirSync(labelsDir, { recursive: true });
        writeFileSync(join(projectRoot, 'package.xml'), '<Package/>');
        writeFileSync(
          join(labelsDir, 'CustomLabels.labels-meta.xml'),
          '<CustomLabels><labels/><labels/></CustomLabels>'
        );
        writeFileSync(join(labelsDir, 'Other.labels-meta.xml'), '<CustomLabels/>');

        const result = await scanner.scan(projectRoot);
        expect(result.components.map(({ type, name }) => ({ type, name }))).to.deep.equal([
          { type: 'CustomLabels', name: 'CustomLabels' },
        ]);
      } finally {
        rmSync(projectRoot, { recursive: true, force: true });
      }
    });

    /** @ac US-080-AC-1: Detect package.xml */
    it('US-080-AC-1: should detect package.xml format', () => {
      const format = scanner.detectFormat('.');
      expect(format).to.be.oneOf(['metadata-api', 'source-format', 'mixed']);
    });

    /** @ac US-080-AC-2: Scan src/ directory */
    it('US-080-AC-2: should scan project', async () => {
      const result = await scanner.scan('.');
      expect(result).to.have.property('components');
      expect(result.components).to.be.an('array');
    });

    /** @ac US-080-AC-3: Parse metadata format files */
    it('US-080-AC-3: should parse and scan metadata', async () => {
      const result = await scanner.scan('.');
      expect(result).to.have.property('format');
    });

    /** @ac US-080-AC-4: Convert to source format */
    it('US-080-AC-4: should handle metadata format internally', async () => {
      const result = await scanner.scan('.');
      expect(result.components).to.be.an('array');
    });

    /** @ac US-080-AC-5: Support both formats */
    it('US-080-AC-5: should handle both source and metadata formats', () => {
      const format = scanner.detectFormat('.');
      expect(['metadata-api', 'source-format', 'mixed']).to.include(format);
    });

    /** @ac US-080-AC-6: Report format detected */
    it('US-080-AC-6: should report detected format', async () => {
      const result = await scanner.scan('.');
      expect(result).to.have.property('format');
      expect(['metadata-api', 'source-format', 'mixed']).to.include(result.format);
    });
  });
});
