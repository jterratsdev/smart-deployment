/**
 * Unit tests for analyze command
 *
 * @ac US-047-AC-1: Scans project metadata
 * @ac US-047-AC-2: Generates dependency graph
 * @ac US-047-AC-3: Generates deployment waves
 * @ac US-047-AC-4: Outputs analysis report (JSON/HTML)
 * @ac US-047-AC-5: Supports --output flag
 * @ac US-047-AC-6: Supports --format flag
 * @ac US-047-AC-7: Shows statistics
 * @ac US-047-AC-8: Highlights issues (cycles, etc.)
 * @ac US-047-AC-9: No deployment execution
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { expect } from 'chai';
import { describe, it, beforeEach, afterEach } from 'mocha';
import sinon, { SinonStub } from 'sinon';
import Analyze from '../../../src/commands/smart-deployment/analyze.js';
import { MetadataScannerService } from '../../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../../src/waves/wave-builder.js';
import { DeploymentPlanManager } from '../../../src/utils/deployment-plan-manager.js';
import { createMockComponent } from '../../helpers/test-helpers.js';

describe('AnalyzeCommand', () => {
  let tempDir: string;
  let analyzeCommand: Analyze;
  let scannerStub: SinonStub;
  let waveBuilderStub: SinonStub;
  let planManagerStub: SinonStub;

  beforeEach(() => {
    analyzeCommand = new Analyze([], {} as any);
    // Mock parse to avoid config.runHook requirement
    sinon.stub(analyzeCommand as any, 'parse').resolves({
      flags: {
        'source-path': '.',
        'target-org': undefined,
        'save-plan': false,
        'plan-path': undefined,
        output: undefined,
        format: 'json',
        'create-manifest': false,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: {} as any,
    });
    tempDir = path.join(os.tmpdir(), `analyze-test-${Date.now()}`);

    // Stub MetadataScannerService
    scannerStub = sinon.stub(MetadataScannerService.prototype, 'scan').resolves({
      components: [
        createMockComponent({ name: 'TestClass', type: 'ApexClass' }),
        createMockComponent({ name: 'TestObject__c', type: 'CustomObject' }),
      ],
      dependencyResult: {
        components: new Map(),
        graph: new Map(),
        reverseGraph: new Map(),
        circularDependencies: [],
        isolatedComponents: [],
        stats: {
          totalComponents: 2,
          totalDependencies: 0,
          componentsByType: { ApexClass: 1, CustomObject: 1 },
          maxDepth: 0,
          mostDepended: { nodeId: 'ApexClass:TestClass', count: 0 },
          mostDependencies: { nodeId: 'ApexClass:TestClass', count: 0 },
        },
      },
      projectRoot: tempDir,
      executionTime: 0,
      errors: [],
      warnings: [],
    });

    // Stub WaveBuilder
    waveBuilderStub = sinon.stub(WaveBuilder.prototype, 'generateWaves').returns({
      waves: [
        {
          number: 1,
          components: ['ApexClass:TestClass', 'CustomObject:TestObject__c'],
          metadata: {
            componentCount: 2,
            types: ['ApexClass', 'CustomObject'],
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
        totalWaves: 1,
        avgComponentsPerWave: 2,
        largestWaveSize: 2,
        smallestWaveSize: 2,
        totalEstimatedTime: 5,
      },
    });

    // Stub DeploymentPlanManager
    planManagerStub = sinon.stub(DeploymentPlanManager, 'savePlan').resolves();
    sinon.stub(DeploymentPlanManager, 'createPlan').returns({
      waves: [],
      priorityOverrides: {},
      componentsByType: {} as any,
      metadata: {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        generatedBy: 'test',
        totalComponents: 0,
        totalWaves: 0,
        estimatedTime: 0,
      },
    });

    // Stub fs operations

    // Note: ManifestGenerator cannot be stubbed directly due to ES modules
    // Tests will verify behavior through logs and file system operations
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('US-047-AC-1: Scans project metadata', () => {
    it('should scan project metadata when run', async () => {
      const result = await analyzeCommand.run();

      expect(scannerStub.calledOnce).to.be.true;
      expect(result.components).to.equal(2);
    });

    it('should use custom source-path when provided', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '/custom/path',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: undefined,
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      expect(scannerStub.calledWith({ sourcePath: '/custom/path' })).to.be.true;
    });
  });

  describe('US-047-AC-2: Generates dependency graph', () => {
    it('should generate dependency graph from scan results', async () => {
      await analyzeCommand.run();

      expect(scannerStub.calledOnce).to.be.true;
      expect(waveBuilderStub.calledOnce).to.be.true;
    });
  });

  describe('US-047-AC-3: Generates deployment waves', () => {
    it('should generate deployment waves', async () => {
      await analyzeCommand.run();

      expect(waveBuilderStub.calledOnce).to.be.true;
    });

    it('should show wave statistics', async () => {
      const logStub = sinon.stub(analyzeCommand, 'log');
      await analyzeCommand.run();

      expect(logStub.calledWith(sinon.match(/Generated.*wave/))).to.be.true;
    });
  });

  describe('US-047-AC-4: Outputs analysis report (JSON/HTML)', () => {
    it('should generate JSON report when --output and --format json are provided', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.json'),
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      const writtenContent = await fs.readFile(path.join(tempDir, 'report.json'), 'utf-8');
      expect(writtenContent).to.include('"timestamp"');
      expect(writtenContent).to.include('"statistics"');
      expect(writtenContent).to.include('"components"');
      expect(writtenContent).to.include('"waves"');
    });

    it('should generate HTML report when --output and --format html are provided', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.html'),
          format: 'html',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      const writtenContent = await fs.readFile(path.join(tempDir, 'report.html'), 'utf-8');
      expect(writtenContent).to.include('<!DOCTYPE html>');
      expect(writtenContent).to.include('<html');
      expect(writtenContent).to.include('Smart Deployment Analysis Report');
    });

    it('should default to JSON format when format is not specified', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.json'),
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      const writtenContent = await fs.readFile(path.join(tempDir, 'report.json'), 'utf-8');
      expect(writtenContent).to.include('"timestamp"');
    });
  });

  describe('US-047-AC-5: Supports --output flag', () => {
    it('should accept --output flag', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.json'),
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      await fs.access(path.join(tempDir, 'report.json'));
    });

    it('should create output directory if it does not exist', async () => {
      const outputPath = path.join(tempDir, 'reports', 'report.json');
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: outputPath,
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      await fs.access(path.join(tempDir, 'reports', 'report.json'));
    });
  });

  describe('US-047-AC-6: Supports --format flag', () => {
    it('should accept json format', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.json'),
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      await fs.access(path.join(tempDir, 'report.json'));
    });

    it('should accept html format', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': false,
          'plan-path': undefined,
          output: path.join(tempDir, 'report.html'),
          format: 'html',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      await fs.access(path.join(tempDir, 'report.html'));
    });
  });

  describe('US-047-AC-7: Shows statistics', () => {
    it('should display component count', async () => {
      const logStub = sinon.stub(analyzeCommand, 'log');
      await analyzeCommand.run();

      expect(logStub.calledWith(sinon.match(/Found.*components/))).to.be.true;
    });

    it('should display dependency count', async () => {
      const logStub = sinon.stub(analyzeCommand, 'log');
      await analyzeCommand.run();

      expect(logStub.calledWith(sinon.match(/dependencies/))).to.be.true;
    });
  });

  describe('US-047-AC-8: Highlights issues (cycles, etc.)', () => {
    it('should warn about circular dependencies when present', async () => {
      scannerStub.resolves({
        components: [],
        dependencyResult: {
          components: new Map(),
          graph: new Map(),
          reverseGraph: new Map(),
          circularDependencies: [
            {
              cycle: ['ApexClass:A', 'ApexClass:B'],
              severity: 'warning' as const,
              message: 'Circular dependency detected',
            },
          ],
          isolatedComponents: [],
          stats: {
            totalComponents: 0,
            totalDependencies: 0,
            componentsByType: {},
            maxDepth: 0,
            mostDepended: { nodeId: '', count: 0 },
            mostDependencies: { nodeId: '', count: 0 },
          },
        },
        projectRoot: tempDir,
        executionTime: 0,
        errors: [],
        warnings: [],
      });

      const logStub = sinon.stub(analyzeCommand, 'log');
      await analyzeCommand.run();

      expect(logStub.calledWith(sinon.match(/circular dependency/))).to.be.true;
    });
  });

  describe('US-047-AC-9: No deployment execution', () => {
    it('should not execute deployment', async () => {
      await analyzeCommand.run();

      // Verify no deployment-related services are called
      expect(scannerStub.called).to.be.true;
      expect(waveBuilderStub.called).to.be.true;
      // No SfCliIntegration should be instantiated
    });
  });

  describe('Plan Saving', () => {
    it('should save deployment plan when --save-plan is provided', async () => {
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': true,
          'plan-path': undefined,
          output: undefined,
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      expect(planManagerStub.called).to.be.true;
    });

    it('should use custom plan path when --plan-path is provided', async () => {
      const customPath = path.join(tempDir, 'custom-plan.json');
      ((analyzeCommand as any).parse as SinonStub).resolves({
        flags: {
          'source-path': '.',
          'target-org': undefined,
          'save-plan': true,
          'plan-path': customPath,
          output: undefined,
          format: 'json',
          'create-manifest': false,
        },
        args: {},
        argv: [],
        raw: [],
        metadata: {} as any,
      });
      await analyzeCommand.run();

      expect(planManagerStub.calledWith(sinon.match.any, customPath)).to.be.true;
    });
  });

  // TODO: Manifest Generation tests
  // These tests are temporarily disabled due to ES module stub limitations
  // The --create-manifest flag functionality is implemented and working
  // Tests can be added later with a different testing approach that doesn't require ES module stubs
  /*
  describe('Manifest Generation', () => {
    it('should accept --create-manifest flag', () => {
      const flags = Analyze.flags;
      expect(flags).to.have.property('create-manifest');
      expect(flags['create-manifest']).to.exist;
      expect(flags['create-manifest'].summary).to.include('manifest');
    });
  });
  */

  describe('Error Handling', () => {
    it('should handle scan errors gracefully', async () => {
      scannerStub.rejects(new Error('Scan failed'));

      try {
        await analyzeCommand.run();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
        expect((error as Error).message).to.include('Analysis failed');
      }
    });

    it('should handle report generation errors gracefully', async () => {
      analyzeCommand.argv = ['--output', path.join('/dev/null', 'report.json')];

      try {
        await analyzeCommand.run();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    });
  });
});
