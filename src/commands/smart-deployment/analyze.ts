/**
 * smart-deployment:analyze command - US-047
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
 * @issue #47
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Org } from '@salesforce/core';
import { getLogger } from '../../utils/logger.js';
import { DeploymentPlanManager } from '../../utils/deployment-plan-manager.js';
import { MetadataScannerService } from '../../services/metadata-scanner-service.js';
import { WaveBuilder } from '../../waves/wave-builder.js';
import { DependencyInferenceService } from '../../ai/dependency-inference-service.js';
import { AgentforcePriorityService } from '../../ai/agentforce-priority-service.js';
import { AIEnhancedPriorityWaveGenerator } from '../../waves/priority-wave-generator-ai.js';
import { DependencyMerger } from '../../dependencies/dependency-merger.js';
import type { PriorityOverride } from '../../types/deployment-plan.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';
import type { DependencyGraph, NodeId } from '../../types/dependency.js';
import type { MetadataComponent } from '../../types/metadata.js';
import type { Wave } from '../../waves/wave-builder.js';
import type { InferredDependency } from '../../types/dependency.js';
import { ManifestGenerator } from '../../deployment/manifest-generator.js';
import { AgentforceService } from '../../ai/agentforce-service.js';
import { validateManifestCompleteness } from '../../utils/manifest-completeness-validator.js';
import { validateAgentforceTargets } from '../../validation/agentforce-target-validator.js';
import { createNodeId } from '../../utils/node-id.js';

const logger = getLogger('AnalyzeCommand');

export default class Analyze extends SfCommand<{ components: number; dependencies: number; planSaved?: boolean }> {
  public static readonly summary = 'Analyze metadata without deploying';

  public static readonly flags = {
    'source-path': Flags.string({
      summary: 'Path to analyze (defaults to current directory)',
      char: 'p',
      default: '.',
    }),
    'target-org': Flags.string({
      summary: 'Target org (optional, used for AI authentication)',
      char: 'o',
    }),
    'save-plan': Flags.boolean({
      summary: 'Save deployment plan for CI/CD',
      description: 'Generates deployment-plan.json for use in CI/CD pipelines',
      default: false,
    }),
    'plan-path': Flags.string({
      summary: 'Custom path for deployment plan',
      description: 'Override default .smart-deployment/deployment-plan.json',
    }),
    'use-ai': Flags.boolean({
      summary: 'Use Agentforce AI for intelligent analysis',
      default: false,
    }),
    'org-type': Flags.string({
      summary: 'Organization type (Production, Sandbox, Developer)',
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: 'Industry context for AI analysis',
    }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
    output: Flags.string({
      summary: 'Output file path',
      required: false,
      // OCLIF will automatically validate that if --output is provided, it must have a value
    }),
    format: Flags.string({
      summary: 'Output format (json|html)',
      char: 'f',
      default: 'json',
      options: ['json', 'html'],
    }),
    'create-manifest': Flags.boolean({
      summary: 'Generate package.xml manifests for deployment waves',
      description:
        'Creates manifest files (.smart-deployment/manifests/wave-*-package.xml) that will be used during deployment',
      default: false,
    }),
  };

  public async run(): Promise<{ components: number; dependencies: number; planSaved?: boolean }> {
    const { flags } = await this.parse(Analyze);

    // Initialize i18n
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    try {
      logger.info('Analyzing metadata', {
        sourcePath: flags['source-path'],
        savePlan: flags['save-plan'],
        useAI: flags['use-ai'],
      });

      this.log('📊 Analyzing metadata...');

      // Scan project and build dependency graph
      const scanner = new MetadataScannerService();
      const scanResult = await scanner.scan({
        sourcePath: flags['source-path'],
      });

      const components = scanResult.components.length;
      let dependencies = scanResult.dependencyResult.stats.totalDependencies;
      let dependencyGraph = scanResult.dependencyResult.graph;
      let inferenceResult:
        | { dependencies: InferredDependency[]; highConfidenceCount: number; fallbackToStatic?: boolean }
        | undefined;

      // AI Dependency Inference (US-055)
      if (flags['use-ai']) {
        this.log('');
        this.log('🤖 Using Agentforce for dependency inference...');

        // Try to get access token from org if target-org is provided
        let accessToken: string | undefined;
        if (flags['target-org']) {
          try {
            const org = await Org.create({ aliasOrUsername: flags['target-org'] });
            const connection = org.getConnection();
            const authFields = connection.getAuthInfoFields();
            accessToken = authFields.accessToken;
            logger.info('Using access token from authenticated org', {
              hasToken: !!accessToken,
              tokenPrefix: accessToken ? accessToken.substring(0, 10) + '...' : 'none',
            });
          } catch (error) {
            logger.warn('Could not get access token from org, will use API key or mock', { error });
          }
        }

        const inferenceService = new DependencyInferenceService();
        if (accessToken) {
          // Set access token in the service's AgentforceService instance
          inferenceService.agentforceService.setApiKeyFromOrg(accessToken);
        }

        inferenceResult = await inferenceService.inferDependencies(scanResult.components, dependencyGraph);

        if (inferenceResult.dependencies.length > 0) {
          this.log(`   ✅ Inferred ${inferenceResult.dependencies.length} additional dependencies`);
          this.log(`   📊 High confidence: ${inferenceResult.highConfidenceCount}`);

          // Convert components to Map for DependencyMerger
          const componentsMap = new Map(scanResult.components.map((c) => [createNodeId(c.type, c.name), c]));

          // Merge inferred dependencies with static graph
          const merger = new DependencyMerger();
          const mergedResult = merger.merge(componentsMap, inferenceResult.dependencies);

          dependencyGraph = mergedResult.graph;
          dependencies = mergedResult.stats.totalDependencies;
        } else if (inferenceResult.fallbackToStatic) {
          this.log('   ⚠️  Agentforce unavailable, using static analysis only');
        }
      }

      const cycles = scanResult.dependencyResult.circularDependencies.length;
      this.log(`✅ Found ${components} components with ${dependencies} dependencies`);

      if (cycles > 0) {
        this.log(`⚠️  Warning: ${cycles} circular dependency cycle(s) detected`);
      }

      // Generate waves
      this.log('');
      this.log('🌊 Generating deployment waves...');
      const waveBuilder = new WaveBuilder({
        maxComponentsPerWave: 10_000,
        respectTypeOrder: true,
        handleCircularDeps: true,
      });

      let waveResult = waveBuilder.generateWaves(dependencyGraph);

      // Build component map for post-processing
      const componentMapForPostProcessing = new Map<string, MetadataComponent>();
      for (const component of scanResult.components) {
        const nodeId = createNodeId(component.type, component.name);
        componentMapForPostProcessing.set(nodeId, component);
      }

      // Apply post-processing to optimize waves
      const { WavePostProcessor } = await import('../../waves/wave-post-processor.js');
      const postProcessor = new WavePostProcessor(componentMapForPostProcessing, {
        syncPSG: true,
        syncFlows: true,
        syncFlexiPages: true,
        syncTestClasses: true,
        splitLargeWaves: true,
        maxComponentsPerWave: 300,
      });
      const postProcessResult = postProcessor.processWaves(waveResult.waves);
      waveResult = {
        ...waveResult,
        waves: postProcessResult.waves,
        stats: {
          ...waveResult.stats,
          totalWaves: postProcessResult.waves.length,
        },
      };
      // Store manifest adjustments for later use if --create-manifest is enabled
      const manifestAdjustments = postProcessResult.manifestAdjustments;

      let aiStats: { aiAdjustments: number; unknownTypesDetected: number; unknownTypes: string[] } | undefined;

      // AI Priority Weighting (US-057)
      if (flags['use-ai']) {
        this.log('');
        this.log('🤖 Using Agentforce for priority weighting...');

        // Try to get access token from org if target-org is provided
        let accessToken: string | undefined;
        if (flags['target-org']) {
          try {
            const org = await Org.create({ aliasOrUsername: flags['target-org'] });
            const connection = org.getConnection();
            const authFields = connection.getAuthInfoFields();
            accessToken = authFields.accessToken;
            logger.debug('Using access token from authenticated org for priority service');
          } catch (error) {
            logger.warn('Could not get access token from org, will use API key or mock', { error });
          }
        }

        const priorityService = new AgentforcePriorityService({
          enabled: true,
          autoApply: false, // Don't auto-apply in analyze command
          apiKey: accessToken, // Use org access token if available
        });

        const aiGenerator = new AIEnhancedPriorityWaveGenerator({
          agentforceService: priorityService,
          orgType: flags['org-type'],
          industry: flags.industry,
        });

        // Convert components to Map for AI generator
        const componentsMap = new Map(scanResult.components.map((c) => [createNodeId(c.type, c.name), c]));

        // Apply AI priorities
        const prioritizedWaves = await aiGenerator.applyPriorityWavesAsync(waveResult.waves, componentsMap);

        waveResult = {
          ...waveResult,
          waves: prioritizedWaves,
        };

        aiStats = aiGenerator.getAIStats();
        if (aiStats && aiStats.aiAdjustments > 0) {
          this.log(`   ✅ AI analyzed ${scanResult.components.length} components`);
          this.log(`   📊 AI adjustments applied: ${aiStats.aiAdjustments}`);
          if (aiStats.unknownTypesDetected > 0) {
            this.log(`   🔍 Unknown types detected: ${aiStats.unknownTypes.join(', ')}`);
          }
        }
      }

      this.log(`✅ Generated ${waveResult.waves.length} deployment wave(s)`);
      this.log(`   Total components: ${waveResult.totalComponents}`);
      if (waveResult.unplacedComponents.length > 0) {
        this.log(`   ⚠️  ${waveResult.unplacedComponents.length} component(s) couldn't be placed (circular deps)`);
      }

      // Generate manifests if requested
      if (flags['create-manifest']) {
        this.log('');
        this.log('📄 Generating manifests...');

        // Initialize AgentforceService if AI is enabled
        let agentforceService: AgentforceService | undefined;
        if (flags['use-ai']) {
          try {
            let accessToken: string | undefined;
            if (flags['target-org']) {
              try {
                const org = await Org.create({ aliasOrUsername: flags['target-org'] });
                const connection = org.getConnection();
                const authFields = connection.getAuthInfoFields();
                accessToken = authFields.accessToken;
                logger.debug('Using access token from authenticated org for manifest generation');
              } catch (error) {
                logger.warn('Could not get access token for manifest generation', { error });
              }
            }

            agentforceService = new AgentforceService({
              enabled: true,
              apiKey: accessToken,
            });

            if (accessToken) {
              agentforceService.setApiKeyFromOrg(accessToken);
            }

            const model = agentforceService.getConfig().model;
            this.log(`   🤖 Using Agentforce (model: ${model}) for metadata type mapping...`);
          } catch (error) {
            logger.warn('Could not initialize Agentforce for manifest generation', { error });
          }
        }

        const manifestGenerator = new ManifestGenerator(agentforceService);
        const manifestDir = path.join(scanResult.projectRoot, '.smart-deployment', 'manifests');

        // Build component map for manifest generation
        const componentMap = new Map<string, MetadataComponent>();
        for (const component of scanResult.components) {
          const nodeId = createNodeId(component.type, component.name);
          componentMap.set(nodeId, component);
        }

        // Get manifest adjustments from post-processing if available
        // Note: manifestAdjustments is already defined above from postProcessResult

        const manifestResult = await manifestGenerator.generateManifests(waveResult.waves, {
          projectRoot: scanResult.projectRoot,
          componentMap,
          outputDir: manifestDir,
          validateFiles: true,
          agentforceService,
          manifestAdjustments,
        });

        if (manifestResult.errors.length > 0) {
          logger.error('Manifest generation errors', { errors: manifestResult.errors });
          manifestResult.errors.forEach((err) => this.warn(`⚠️  ${err}`));
        }
        if (manifestResult.warnings.length > 0) {
          manifestResult.warnings.forEach((warn) => this.warn(`⚠️  ${warn}`));
        }

        if (manifestResult.manifests.length > 0) {
          this.log(`✅ Generated ${manifestResult.manifests.length} manifest(s) in ${manifestDir}`);

          const agentforceValidation = validateAgentforceTargets(
            waveResult.waves,
            manifestResult.manifests,
            componentMap
          );
          for (const issue of agentforceValidation.issues) {
            this.warn(`⚠️  Agentforce target ${issue.consumer} -> ${issue.target}: ${issue.message}`);
          }
          if (agentforceValidation.valid) {
            this.log('✅ Agentforce targets are ordered and included in manifests');
          }

          // Validate that all scanned components are included in manifests
          this.log('');
          this.log('🔍 Validating manifest completeness...');
          const validationResult = await validateManifestCompleteness(
            scanResult.components,
            manifestResult.manifests,
            componentMap
          );

          if (validationResult.missingComponents.length > 0) {
            this.warn(
              `⚠️  ${validationResult.missingComponents.length} component(s) from project are NOT in any manifest:`
            );
            const missingByType = new Map<string, number>();
            for (const comp of validationResult.missingComponents) {
              const count = missingByType.get(comp.type) || 0;
              missingByType.set(comp.type, count + 1);
            }
            for (const [type, count] of Array.from(missingByType.entries()).sort()) {
              this.warn(`   ${type}: ${count} component(s)`);
            }
            this.warn('');
            this.warn('   💡 These components may have circular dependencies or were filtered out.');
            this.warn('   💡 Check wave generation output for "couldn\'t be placed" messages.');
          } else {
            this.log(`✅ All ${scanResult.components.length} scanned component(s) are included in manifests`);
          }

          if (validationResult.totalInManifests !== scanResult.components.length) {
            const diff = validationResult.totalInManifests - scanResult.components.length;
            if (diff > 0) {
              this.warn(`⚠️  Warning: ${diff} more component(s) in manifests than scanned (possible duplicates)`);
            }
          }
        } else {
          this.warn('⚠️  No manifests were generated');
        }
      }

      // Generate and save plan if requested
      if (flags['save-plan']) {
        this.log('');
        this.log('📋 Generating deployment plan...');

        // Convert waves to plan format
        const planWaves = waveResult.waves.map((wave) => ({
          number: wave.number,
          components: wave.components,
          metadata: {
            componentCount: wave.metadata.componentCount,
            types: wave.metadata.types,
            maxDepth: wave.metadata.maxDepth,
            hasCircularDeps: wave.metadata.hasCircularDeps,
            estimatedTime: wave.metadata.estimatedTime,
          },
        }));

        // Extract priorities from components (if any)
        const priorities: Record<string, PriorityOverride> = {};
        for (const component of scanResult.components) {
          if (component.priorityBoost > 0) {
            const nodeId = createNodeId(component.type, component.name);
            priorities[nodeId] = {
              priority: component.priorityBoost,
              source: 'manual',
            };
          }
        }

        const plan = DeploymentPlanManager.createPlan(planWaves, priorities, {
          aiEnabled: flags['use-ai'],
          orgType: flags['org-type'],
          industry: flags.industry,
          generatedBy: 'smart-deployment CLI',
        });

        await DeploymentPlanManager.savePlan(plan, flags['plan-path']);

        const planPath = (flags['plan-path'] as string | undefined) || '.smart-deployment/deployment-plan.json';
        this.log(`✅ Deployment plan saved to: ${planPath}`);
        this.log('');
        this.log('💡 Next steps:');
        this.log('   1. Review the plan in your PR');
        this.log('   2. Commit the plan to your repo');
        this.log(`   3. Use it in CI/CD: sf smart-deployment start --use-plan ${planPath}`);

        return { components, dependencies, planSaved: true };
      }

      // Output report if requested
      // Validate that if --output is used, it must have a value
      if (flags.output !== undefined) {
        if (!flags.output || (typeof flags.output === 'string' && flags.output.trim() === '')) {
          this.error('Flag --output requires a value. Usage: --output <file-path>');
        }
        const reportFormat = (flags.format as 'json' | 'html') || 'json';
        await this.generateReport({
          outputPath: flags.output as string,
          format: reportFormat,
          components: scanResult.components,
          dependencyGraph,
          waveResult,
          circularDependencies: scanResult.dependencyResult.circularDependencies,
          stats: {
            totalComponents: components,
            totalDependencies: dependencies,
            circularDependencies: scanResult.dependencyResult.circularDependencies.length,
            totalWaves: waveResult.waves.length,
            aiInferenceUsed: flags['use-ai'] && (inferenceResult?.dependencies.length ?? 0) > 0,
            aiPriorityUsed: flags['use-ai'] && (aiStats?.aiAdjustments ?? 0) > 0,
          },
        });
        this.log(`📄 Report saved to: ${flags.output as string} (format: ${reportFormat})`);
      }

      return { components, dependencies };
    } catch (error) {
      logger.error('Analysis failed', { error });
      this.error(`Analysis failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async generateReport(options: {
    outputPath: string;
    format: 'json' | 'html';
    components: MetadataComponent[];
    dependencyGraph: DependencyGraph;
    waveResult: { waves: Wave[]; totalComponents: number; unplacedComponents: NodeId[] };
    stats: {
      totalComponents: number;
      totalDependencies: number;
      circularDependencies: number;
      totalWaves: number;
      aiInferenceUsed: boolean;
      aiPriorityUsed: boolean;
    };
    circularDependencies: Array<{ cycle: string[] }>;
  }): Promise<void> {
    const { outputPath, format, components, waveResult, stats, circularDependencies } = options;

    // Ensure output directory exists
    const outputDir = path.dirname(outputPath);
    if (outputDir !== '.') {
      await fs.mkdir(outputDir, { recursive: true });
    }

    let content: string;

    if (format === 'json') {
      content = JSON.stringify(
        {
          timestamp: new Date().toISOString(),
          statistics: stats,
          components: components.map((c: MetadataComponent) => ({
            name: c.name,
            type: c.type,
            filePath: c.filePath,
            dependencies: Array.from(c.dependencies),
            dependents: Array.from(c.dependents),
          })),
          waves: waveResult.waves.map((wave: Wave) => ({
            number: wave.number,
            componentCount: wave.components.length,
            components: wave.components,
            metadata: wave.metadata,
          })),
          circularDependencies: circularDependencies.map((cycle) => ({
            components: cycle.cycle,
          })),
          unplacedComponents: waveResult.unplacedComponents,
        },
        null,
        2
      );
    } else {
      // HTML format
      const wavesHtml = waveResult.waves
        .map(
          (wave: Wave) => `
        <div class="wave">
          <h3>Wave ${wave.number}</h3>
          <p><strong>Components:</strong> ${wave.components.length}</p>
          <p><strong>Types:</strong> ${Array.from(wave.metadata.types).join(', ')}</p>
          <ul>
            ${wave.components
              .slice(0, 10)
              .map((c: string) => `<li>${c}</li>`)
              .join('')}
            ${wave.components.length > 10 ? `<li><em>... and ${wave.components.length - 10} more</em></li>` : ''}
          </ul>
        </div>
      `
        )
        .join('');

      content = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Smart Deployment Analysis Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
    .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
    h1 { color: #0176d3; }
    h2 { color: #16325c; margin-top: 30px; }
    .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin: 20px 0; }
    .stat-card { background: #f8f9fa; padding: 15px; border-radius: 4px; border-left: 4px solid #0176d3; }
    .stat-card strong { display: block; font-size: 24px; color: #0176d3; }
    .wave { background: #f8f9fa; padding: 15px; margin: 10px 0; border-radius: 4px; }
    .wave h3 { margin-top: 0; color: #16325c; }
    ul { margin: 10px 0; padding-left: 20px; }
    .warning { background: #fff3cd; border-left: 4px solid #ffc107; padding: 10px; margin: 10px 0; }
  </style>
</head>
<body>
  <div class="container">
    <h1>📊 Smart Deployment Analysis Report</h1>
    <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>

    <h2>Statistics</h2>
    <div class="stats">
      <div class="stat-card">
        <strong>${stats.totalComponents}</strong>
        <span>Components</span>
      </div>
      <div class="stat-card">
        <strong>${stats.totalDependencies}</strong>
        <span>Dependencies</span>
      </div>
      <div class="stat-card">
        <strong>${stats.totalWaves}</strong>
        <span>Deployment Waves</span>
      </div>
      <div class="stat-card">
        <strong>${stats.circularDependencies}</strong>
        <span>Circular Dependencies</span>
      </div>
    </div>

    ${
      stats.circularDependencies > 0
        ? `
    <div class="warning">
      <strong>⚠️ Warning:</strong> ${stats.circularDependencies} circular dependency cycle(s) detected.
      These may cause deployment issues.
    </div>
    `
        : ''
    }

    ${
      stats.aiInferenceUsed || stats.aiPriorityUsed
        ? `
    <div class="stat-card">
      <strong>🤖 AI Enhanced</strong>
      <p>Dependency Inference: ${stats.aiInferenceUsed ? '✅' : '❌'}</p>
      <p>Priority Weighting: ${stats.aiPriorityUsed ? '✅' : '❌'}</p>
    </div>
    `
        : ''
    }

    <h2>Deployment Waves</h2>
    ${wavesHtml}
  </div>
</body>
</html>`;
    }

    await fs.writeFile(outputPath, content, 'utf-8');
    logger.info('Analysis report generated', { outputPath, format });
  }
}
