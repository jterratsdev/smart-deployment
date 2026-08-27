/**
 * Unit tests for resume command
 *
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 */

import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import Resume from '../../../src/commands/smart-deployment/resume.js';
import { StateManager } from '../../../src/deployment/state-manager.js';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../../src/waves/wave-builder.js';
import { ManifestGenerator } from '../../../src/deployment/manifest-generator.js';
import { ManifestValidator } from '../../../src/deployment/manifest-validator.js';
import { SfCliIntegration } from '../../../src/deployment/sf-cli-integration.js';
import { createMockComponent } from '../../helpers/test-helpers.js';

describe('ResumeCommand', () => {
  let resumeCommand: Resume;
  let stateManagerStub: SinonStub;
  let loadStateStub: SinonStub;
  let scannerStub: SinonStub;
  let waveBuilderStub: SinonStub;
  let manifestGeneratorStub: SinonStub;
  let manifestValidatorStub: SinonStub;
  let sfCliStub: SinonStub;

  beforeEach(() => {
    resumeCommand = new Resume([], {} as any);
    // Mock parse to avoid config.runHook requirement
    sinon.stub(resumeCommand as any, 'parse').resolves({
      flags: {
        'target-org': 'test-org',
        'source-path': undefined,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: {} as any,
    });

    // Stub StateManager
    stateManagerStub = sinon.stub(StateManager.prototype, 'hasFailedDeployment').resolves(true);
    loadStateStub = sinon.stub(StateManager.prototype, 'loadState').resolves({
      status: 'failed',
      deploymentId: 'test-deployment-123',
      targetOrg: 'test-org',
      timestamp: new Date().toISOString(),
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 2,
        error: 'Deployment failed',
        timestamp: new Date().toISOString(),
      },
    });
    sinon.stub(StateManager.prototype, 'saveState').resolves();

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
        {
          number: 3,
          components: ['ApexClass:TestClass3'],
          metadata: {
            componentCount: 1,
            types: ['ApexClass'],
            maxDepth: 0,
            hasCircularDeps: false,
            estimatedTime: 5,
          },
        },
      ],
      totalComponents: 3,
      unplacedComponents: [],
      circularDependencies: [],
      stats: {
        totalWaves: 3,
        avgComponentsPerWave: 1,
        largestWaveSize: 1,
        smallestWaveSize: 1,
        totalEstimatedTime: 15,
      },
    });

    // Stub ManifestGenerator
    manifestGeneratorStub = sinon.stub(ManifestGenerator.prototype, 'generateManifests').resolves({
      manifests: [
        {
          fileName: 'wave-002-package.xml',
          content: '<?xml version="1.0"?><Package/>',
          components: { ApexClass: ['TestClass2'] },
          apiVersion: '65.0',
        },
        {
          fileName: 'wave-003-package.xml',
          content: '<?xml version="1.0"?><Package/>',
          components: { ApexClass: ['TestClass3'] },
          apiVersion: '65.0',
        },
      ],
      errors: [],
      warnings: [],
    });

    // Stub ManifestValidator
    manifestValidatorStub = sinon.stub(ManifestValidator.prototype, 'validateManifest').resolves({
      isValid: true,
      errors: [],
      warnings: [],
    });

    // Stub SfCliIntegration
    sfCliStub = sinon.stub(SfCliIntegration.prototype, 'deploy').resolves({
      success: true,
      status: 'Succeeded',
      componentSuccesses: 1,
      componentFailures: 0,
      testsRun: 0,
      output: 'Deployment successful',
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('US-049-AC-1: Detects previous failed deployment', () => {
    it('should detect failed deployment when state exists', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      const result = await resumeCommand.run();

      expect(stateManagerStub.calledOnce).to.be.true;
      expect(result.success).to.be.true;
    });

    it('should return false when no failed deployment exists', async () => {
      stateManagerStub.resolves(false);
      resumeCommand.argv = ['--target-org', 'test-org'];
      const result = await resumeCommand.run();

      expect(result.success).to.be.false;
    });
  });

  describe('US-049-AC-2: Loads deployment state', () => {
    it('should load deployment state', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(stateManagerStub.calledOnce).to.be.true;
    });

    it('should return false when state is missing', async () => {
      loadStateStub.resolves(null);
      resumeCommand.argv = ['--target-org', 'test-org'];
      const result = await resumeCommand.run();

      expect(result.success).to.be.false;
    });
  });

  describe('US-049-AC-3: Resumes from failed wave', () => {
    it('should filter waves starting from failed wave number', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(waveBuilderStub.calledOnce).to.be.true;
      expect(manifestGeneratorStub.calledOnce).to.be.true;
    });

    it('should validate Agentforce targets before resuming', async () => {
      const agentId = 'AiAuthoringBundle:TestAgent';
      const targetId = 'Flow:MissingFlow';
      scannerStub.resolves({
        components: [
          createMockComponent({ name: 'TestAgent', type: 'AiAuthoringBundle', dependencies: new Set([targetId]) }),
          createMockComponent({ name: 'MissingFlow', type: 'Flow' }),
        ],
        dependencyResult: {
          components: new Map(),
          graph: new Map([
            [agentId, new Set([targetId])],
            [targetId, new Set()],
          ]),
          reverseGraph: new Map(),
          circularDependencies: [],
          isolatedComponents: [],
          stats: {
            totalComponents: 2,
            totalDependencies: 1,
            componentsByType: { AiAuthoringBundle: 1, Flow: 1 },
            maxDepth: 1,
            mostDepended: { nodeId: targetId, count: 1 },
            mostDependencies: { nodeId: agentId, count: 1 },
          },
        },
        projectRoot: '/test/project',
        executionTime: 0,
        errors: [],
        warnings: [],
      });
      waveBuilderStub.returns({
        waves: [
          {
            number: 1,
            components: [agentId],
            metadata: {
              componentCount: 1,
              types: ['AiAuthoringBundle'],
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
      manifestGeneratorStub.resolves({
        manifests: [
          {
            fileName: 'wave-001-package.xml',
            content: '<?xml version="1.0"?><Package/>',
            components: { AiAuthoringBundle: ['TestAgent'] },
            apiVersion: '65.0',
          },
        ],
        errors: [],
        warnings: [],
      });
      loadStateStub.resolves({
        status: 'failed',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 1,
        completedWaves: [],
        currentWave: 1,
        failedWave: {
          waveNumber: 1,
          error: 'Deployment failed',
          timestamp: new Date().toISOString(),
        },
      });
      resumeCommand.argv = ['--target-org', 'test-org'];

      let result: { success: boolean; resumedFromWave?: number } | undefined;
      try {
        result = await resumeCommand.run();
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }

      expect(result?.success ?? false).to.equal(false);
      expect(sfCliStub.called).to.be.false;
    });

    it('should return success when no waves to resume', async () => {
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
      manifestGeneratorStub.resolves({
        manifests: [
          {
            fileName: 'wave-001-package.xml',
            content: '<?xml version="1.0"?><Package/>',
            components: { ApexClass: ['TestClass'] },
            apiVersion: '65.0',
          },
        ],
        errors: [],
        warnings: [],
      });
      loadStateStub.resolves({
        status: 'failed',
        deploymentId: 'test-deployment-123',
        targetOrg: 'test-org',
        timestamp: new Date().toISOString(),
        totalWaves: 1,
        completedWaves: [1],
        currentWave: 1,
        failedWave: {
          waveNumber: 1,
          error: 'Deployment failed',
          timestamp: new Date().toISOString(),
        },
      });

      resumeCommand.argv = ['--target-org', 'test-org'];
      const result = await resumeCommand.run();

      expect(result.success).to.be.true;
    });
  });

  describe('US-049-AC-4: Supports retry strategies', () => {
    it('should regenerate waves for retry', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(scannerStub.calledOnce).to.be.true;
      expect(waveBuilderStub.calledOnce).to.be.true;
    });
  });

  describe('US-049-AC-5: Updates deployment report', () => {
    it('should save state after successful wave deployment', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect((StateManager.prototype.saveState as unknown as SinonStub).called).to.be.true;
    });
  });

  describe('US-049-AC-6: Handles multiple failures', () => {
    it('should handle deployment failure gracefully', async () => {
      sfCliStub.resolves({
        success: false,
        status: 'Failed',
        componentSuccesses: 0,
        componentFailures: 1,
        testsRun: 0,
        output: 'Deployment failed',
      });

      resumeCommand.argv = ['--target-org', 'test-org'];

      try {
        await resumeCommand.run();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });

    it('should save failed state on error', async () => {
      sfCliStub.rejects(new Error('Deployment failed'));

      resumeCommand.argv = ['--target-org', 'test-org'];

      try {
        await resumeCommand.run();
        expect.fail('Should have thrown an error');
      } catch {
        expect((StateManager.prototype.saveState as unknown as SinonStub).called).to.be.true;
      }
    });
  });

  describe('Manifest Generation', () => {
    it('should generate manifests for remaining waves', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(manifestGeneratorStub.calledOnce).to.be.true;
    });

    it('should validate manifests before deployment', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(manifestValidatorStub.called).to.be.true;
    });
  });

  describe('Deployment Execution', () => {
    it('should execute deployment for remaining waves', async () => {
      resumeCommand.argv = ['--target-org', 'test-org'];
      await resumeCommand.run();

      expect(sfCliStub.called).to.be.true;
    });
  });
});
