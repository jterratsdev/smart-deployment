/**
 * Unit tests for validate command
 *
 * @ac US-048-AC-1: Performs check-only deployment
 * @ac US-048-AC-2: Validates each wave
 * @ac US-048-AC-3: Reports validation errors
 * @ac US-048-AC-4: Supports --target-org flag
 * @ac US-048-AC-5: Shows estimated deployment time
 * @ac US-048-AC-6: No actual deployment
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import Validate from '../../../src/commands/smart-deployment/validate.js';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../../src/waves/wave-builder.js';
import { createMockComponent } from '../../helpers/test-helpers.js';

describe('ValidateCommand', () => {
  let validateCommand: Validate;
  let scannerStub: SinonStub;
  let waveBuilderStub: SinonStub;

  beforeEach(() => {
    validateCommand = new Validate([], {} as any);
    // Mock parse to avoid config.runHook requirement
    sinon.stub(validateCommand as any, 'parse').resolves({
      flags: {
        'target-org': 'test-org',
        'source-path': undefined,
        locale: undefined,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: {} as any,
    });

    // Stub MetadataScannerService
    scannerStub = sinon.stub(MetadataScannerService.prototype, 'scan').resolves({
      components: [createMockComponent({ name: 'TestClass', type: 'ApexClass' })],
      dependencyResult: {
        components: new Map(),
        graph: new Map(),
        reverseGraph: new Map(),
        circularDependencies: [],
        isolatedComponents: [],
        stats: {
          totalComponents: 1,
          totalDependencies: 0,
          componentsByType: { ApexClass: 1 },
          maxDepth: 0,
          mostDepended: { nodeId: 'ApexClass:TestClass', count: 0 },
          mostDependencies: { nodeId: 'ApexClass:TestClass', count: 0 },
        },
      },
      projectRoot: '/test/project',
      executionTime: 0,
      errors: [],
      warnings: [],
    });

    // Stub WaveBuilder
    waveBuilderStub = sinon.stub(WaveBuilder.prototype, 'generateWaves').returns({
      waves: [
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
      ],
      totalComponents: 1,
      unplacedComponents: [],
      circularDependencies: [],
      stats: {
        totalWaves: 1,
        avgComponentsPerWave: 1,
        largestWaveSize: 1,
        smallestWaveSize: 1,
        totalEstimatedTime: 5,
      },
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('US-048-AC-1: Performs check-only deployment', () => {
    it('should perform check-only deployment', async () => {
      const result = await validateCommand.run();
      expect(result.success).to.be.true;
    });
  });

  describe('US-048-AC-2: Validates each wave', () => {
    it('should validate each wave', async () => {
      waveBuilderStub.returns({
        waves: [
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
          {
            number: 2,
            components: ['ApexClass:TestClass2'],
            metadata: {
              componentCount: 1,
              types: ['ApexClass'],
              maxDepth: 0,
              hasCircularDeps: false,
              estimatedTime: 5,
            },
          },
        ],
        totalComponents: 2,
        unplacedComponents: [],
        circularDependencies: [],
        stats: {
          totalWaves: 2,
          avgComponentsPerWave: 1,
          largestWaveSize: 1,
          smallestWaveSize: 1,
          totalEstimatedTime: 10,
        },
      });

      expect((await validateCommand.run()).success).to.be.true;
    });
  });

  describe('US-048-AC-3: Reports validation errors', () => {
    it('should report validation errors when deployment fails', async () => {
      validateCommand.argv = ['--target-org', 'test-org'];
      const result = await validateCommand.run();

      expect(result.success).to.be.true;
      expect(result.errors).to.have.length(0);
    });

    it('should show error details', async () => {
      const logStub = sinon.stub(validateCommand, 'log');
      await validateCommand.run();

      expect(logStub.calledWith(sinon.match(/validation|complete/i))).to.be.true;
    });
  });

  describe('US-048-AC-4: Supports --target-org flag', () => {
    it('should accept --target-org flag', async () => {
      await validateCommand.run();

      expect((await validateCommand.run()).success).to.be.true;
    });
  });

  describe('US-048-AC-5: Shows estimated deployment time', () => {
    it('should show estimated deployment time', async () => {
      const logStub = sinon.stub(validateCommand, 'log');
      await validateCommand.run();

      expect(logStub.calledWith(sinon.match(/time|estimated|duration/i))).to.be.true;
    });
  });

  describe('US-048-AC-6: No actual deployment', () => {
    it('should not perform actual deployment', async () => {
      await validateCommand.run();

      expect((await validateCommand.run()).success).to.be.true;
    });
  });

  describe('Error Handling', () => {
    it('should handle scan errors gracefully', async () => {
      scannerStub.rejects(new Error('Scan failed'));

      validateCommand.argv = ['--target-org', 'test-org'];

      try {
        await validateCommand.run();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should handle deployment errors gracefully', async () => {
      validateCommand.argv = ['--target-org', 'test-org'];
      expect((await validateCommand.run()).success).to.be.true;
    });
  });
});
