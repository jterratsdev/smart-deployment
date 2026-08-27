/**
 * smart-deployment:start command
 * Main deployment command that orchestrates the entire workflow
 *
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 * @ac US-046-AC-4: Supports --target-org flag
 * @ac US-046-AC-5: Supports --dry-run flag
 * @ac US-046-AC-6: Supports --validate-only flag
 * @ac US-046-AC-7: Supports --skip-tests flag
 * @ac US-046-AC-8: Shows progress bar
 * @ac US-046-AC-9: Generates deployment report
 * @ac US-046-AC-10: Handles failures gracefully
 *
 * @issue #46
 */

import * as path from 'node:path';
import * as fs from 'node:fs/promises';

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Messages } from '@salesforce/core';
import { Org } from '@salesforce/core';
import { getLogger } from '../../utils/logger.js';
import { DeploymentPlanManager } from '../../utils/deployment-plan-manager.js';
import { MetadataScannerService } from '../../services/metadata-scanner-service.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';
import { WaveBuilder } from '../../waves/wave-builder.js';
import { getWavesInExecutionOrder } from '../../waves/wave-executor.js';
import { SfCliIntegration } from '../../deployment/sf-cli-integration.js';
import { StateManager } from '../../deployment/state-manager.js';
import { DeploymentTracker } from '../../deployment/deployment-tracker.js';
import { ManifestGenerator } from '../../deployment/manifest-generator.js';
import { ManifestValidator } from '../../deployment/manifest-validator.js';
import { WaveValidationService } from '../../ai/wave-validation-service.js';
import { AgentforceService } from '../../ai/agentforce-service.js';
import { MetadataSimplifier } from '../../deployment/metadata-simplifier.js';
import { DependencyAvailabilityAnalyzer } from '../../dependencies/dependency-availability-analyzer.js';
import type { MetadataComponent } from '../../types/metadata.js';
import type { NodeId } from '../../types/dependency.js';
import { createNodeId, parseNodeId } from '../../utils/node-id.js';
import type { Wave } from '../../waves/wave-builder.js';
import type { ScanResult } from '../../services/metadata-scanner-service.js';
import { OutputFormatter } from '../../utils/output-formatter.js';
import { validateManifestCompleteness } from '../../utils/manifest-completeness-validator.js';
import { validateAgentforceTargets } from '../../validation/agentforce-target-validator.js';
import { DeploymentReporter, type DeploymentReport, type WaveReport } from '../../deployment/deployment-reporter.js';

Messages.importMessagesDirectoryFromMetaUrl(import.meta.url);
const messages = Messages.loadMessages('smart-deployment', 'start');
const logger = getLogger('StartCommand');

/**
 * @ac US-046-AC-1: Analyzes metadata automatically
 * @ac US-046-AC-2: Generates deployment waves
 * @ac US-046-AC-3: Executes deployment sequentially
 */
export default class Start extends SfCommand<{ success: boolean; waves: number }> {
  public static readonly summary = messages.getMessage('summary');
  public static readonly description = messages.getMessage('description');
  public static readonly examples = messages.getMessages('examples');

  /**
   * @ac US-046-AC-4: Supports --target-org flag
   * @ac US-046-AC-5: Supports --dry-run flag
   * @ac US-046-AC-6: Supports --validate-only flag
   * @ac US-046-AC-7: Supports --skip-tests flag
   * @ac US-057-AC-1: Send component list to Agentforce
   */
  public static readonly flags = {
    'target-org': Flags.string({
      summary: messages.getMessage('flags.target-org.summary'),
      char: 'o',
      required: true,
    }),
    'source-path': Flags.string({
      summary: 'Path to analyze and deploy (defaults to current directory)',
      char: 'p',
      default: '.',
    }),
    'dry-run': Flags.boolean({
      summary: messages.getMessage('flags.dry-run.summary'),
      char: 'd',
      default: false,
    }),
    'validate-only': Flags.boolean({
      summary: messages.getMessage('flags.validate-only.summary'),
      char: 'v',
      default: false,
    }),
    'skip-tests': Flags.boolean({
      summary: messages.getMessage('flags.skip-tests.summary'),
      char: 's',
      default: false,
      deprecated: {
        message: 'Use --no-test-run instead',
        version: '2.0.0',
      },
    }),
    'no-test-run': Flags.boolean({
      summary: 'Do not run any tests during deployment (sandbox only)',
      description:
        'Skips all test execution. IGNORED in production orgs (tests are required). Only works in sandboxes.',
      default: false,
    }),
    'run-wave-test': Flags.boolean({
      summary: 'Run only test classes included in each wave',
      description:
        'Executes only the test classes that are part of the wave being deployed. Uses RunSpecifiedTests. In production, this is the recommended approach for faster deployments.',
      default: false,
    }),
    'test-level': Flags.string({
      summary: 'Test level to use for deployment',
      options: ['NoTestRun', 'RunSpecifiedTests', 'RunLocalTests', 'RunAllTestsInOrg'],
    }),
    'use-ai': Flags.boolean({
      summary: 'Use Agentforce AI for intelligent priority weighting',
      description: 'Enables AI-powered analysis for deployment prioritization',
      default: false,
    }),
    'ai-auto': Flags.boolean({
      summary: 'Auto-apply AI recommendations with confidence > 80%',
      description: 'Automatically applies AI priorities without prompting (requires --use-ai)',
      default: false,
    }),
    'ai-confidence-threshold': Flags.string({
      summary: 'Minimum AI confidence to auto-apply (0-1)',
      description: 'Default: 0.8 (80%). Only used with --ai-auto',
      default: '0.8',
    }),
    'org-type': Flags.string({
      summary: 'Organization type (Production, Sandbox, Developer)',
      description: 'Helps AI provide context-aware recommendations',
      options: ['Production', 'Sandbox', 'Developer'],
    }),
    industry: Flags.string({
      summary: 'Industry context for AI analysis (e.g., Fintech, Healthcare)',
      description: 'Provides business context to AI for better prioritization',
    }),
    'use-plan': Flags.string({
      summary: 'Use pre-approved deployment plan',
    }),
    strict: Flags.boolean({
      summary: 'Strict mode for CI/CD',
      default: false,
    }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
    resume: Flags.boolean({
      summary: 'Resume from last failed wave (default: true if previous state exists)',
      description:
        'If a previous deployment failed, automatically resume from the last completed wave. Set to false to start fresh.',
    }),
    'ignore-conflicts': Flags.boolean({
      summary: 'Ignore conflicts and warnings during deployment',
      description:
        'Passes --ignore-conflicts and --ignore-warnings to Salesforce CLI. Useful when deploying to orgs with existing metadata differences.',
      default: false,
    }),
  };

  /**
   * @ac US-046-AC-8: Shows progress bar
   * @ac US-046-AC-9: Generates deployment report
   * @ac US-046-AC-10: Handles failures gracefully
   */
  public async run(): Promise<{ success: boolean; waves: number }> {
    const { flags } = await this.parse(Start);
    const output = new OutputFormatter(this);

    // Initialize i18n with locale from flag or auto-detect
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    try {
      logger.info('Starting smart deployment', { flags });

      // Check for strict mode (CI/CD safety)
      if (flags.strict && !flags['use-plan']) {
        this.error('❌ Strict mode requires --use-plan\n💡 Run: sf smart-deployment analyze --save-plan');
      }

      // Load deployment plan if specified
      if (flags['use-plan']) {
        output.section('Loading Deployment Plan', '📋');
        const plan = await DeploymentPlanManager.loadPlan(flags['use-plan']);
        output.success(`Using approved plan (version ${plan.metadata.version})`);
        output.table([
          { label: 'Generated', value: new Date(plan.metadata.generatedAt).toLocaleString() },
          { label: 'Components', value: plan.metadata.totalComponents },
          { label: 'Waves', value: plan.metadata.totalWaves },
          ...(plan.metadata.aiEnabled ? [{ label: 'AI-enhanced', value: 'Yes' }] : []),
        ]);
      }

      // AC-1: Analyze metadata
      output.section('Analyzing Metadata', '📊');
      const sourcePath = flags['source-path'] as string;
      const metadataCount = await this.analyzeMetadata(sourcePath);
      output.success(`Found ${metadataCount} metadata components`);

      // AC-2: Generate waves
      output.section('Generating Deployment Waves', '🌊');
      const waves = await this.generateWaves(flags, output, sourcePath);
      output.success(`Generated ${waves} waves`);

      // AC US-057-AC-6: Report AI decisions
      if (flags['use-ai']) {
        const threshold = parseFloat(flags['ai-confidence-threshold'] || '0.8');
        const mode = flags['ai-auto'] ? 'auto' : 'manual-review';
        output.subsection('AI-Enhanced Prioritization', '🤖');
        output.keyValue('Mode', mode);
        output.keyValue('Confidence Threshold', `${(threshold * 100).toFixed(0)}%`);
        if (!flags['ai-auto']) {
          output.tip('Use --ai-auto to automatically apply high-confidence recommendations');
        }
      }

      // AC-3: Execute deployment
      const deploymentId = `deployment-${Date.now()}`;
      let report: DeploymentReport;
      if (flags['dry-run']) {
        output.section('Dry-Run Mode', '🔍');
        const now = new Date().toISOString();
        report = {
          deploymentId,
          targetOrg: flags['target-org'] as string,
          startTime: now,
          endTime: now,
          totalDuration: 0,
          status: 'VALIDATED',
          mode: 'DRY_RUN',
          success: true,
          totalWaves: waves,
          completedWaves: 0,
          totalComponents: metadataCount,
          totalComponentFailures: 0,
          totalTests: 0,
          totalTestFailures: 0,
          waves: [],
          errors: [],
        };
      } else {
        output.section('Executing Deployment', '🚀');
        report = await this.executeDeployment(flags, output, sourcePath, deploymentId);
      }

      // AC-9: Generate report
      output.section('Generating Deployment Report', '📄');
      this.generateReport(report);

      return { success: report.success, waves };
    } catch (error) {
      // AC-10: Handle failures gracefully
      logger.error('Deployment failed', { error });
      this.error(`Deployment failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  private async analyzeMetadata(sourcePath?: string): Promise<number> {
    const scanner = new MetadataScannerService();
    const result = await scanner.scan({ sourcePath });

    if (result.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: result.errors });
      result.errors.forEach((err) => this.warn(err));
    }
    if (result.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: result.warnings });
      result.warnings.forEach((warn) => this.warn(warn));
    }

    return result.components.length;
  }

  private async generateWaves(
    flags: Record<string, unknown>,
    output: OutputFormatter,
    sourcePath?: string
  ): Promise<number> {
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    const waveBuilder = new WaveBuilder();
    let waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);

    // AI Priority Weighting (US-057) - if --use-ai is enabled
    if (flags['use-ai']) {
      output.subsection('Using Agentforce for Intelligent Prioritization', '🤖');

      try {
        // Try to get access token from org if target-org is provided
        let accessToken: string | undefined;
        const targetOrg = flags['target-org'] as string | undefined;
        if (targetOrg && !flags['dry-run']) {
          try {
            const org = await Org.create({ aliasOrUsername: targetOrg });
            const connection = org.getConnection();
            const authFields = connection.getAuthInfoFields();
            accessToken = authFields.accessToken;
            logger.debug('Using access token from authenticated org for priority service');
          } catch (error) {
            logger.warn('Could not get access token from org, will use API key or mock', { error });
          }
        }

        const { AgentforcePriorityService } = await import('../../ai/agentforce-priority-service.js');
        const { AIEnhancedPriorityWaveGenerator } = await import('../../waves/priority-wave-generator-ai.js');

        const priorityService = new AgentforcePriorityService({
          enabled: true,
          autoApply: false, // Don't auto-apply in start command (user controls via flags)
          apiKey: accessToken,
        });

        const aiGenerator = new AIEnhancedPriorityWaveGenerator({
          agentforceService: priorityService,
          orgType: flags['org-type'] as string | undefined,
          industry: flags.industry as string | undefined,
        });

        // Convert components to Map for AI generator
        const componentsMap = new Map<string, MetadataComponent>();
        for (const component of scanResult.components) {
          const nodeId = createNodeId(component.type, component.name);
          componentsMap.set(nodeId, component);
        }

        // Apply AI priorities
        const prioritizedWaves = await aiGenerator.applyPriorityWavesAsync(waveResult.waves, componentsMap);

        waveResult = {
          ...waveResult,
          waves: prioritizedWaves,
        };

        const aiStats = aiGenerator.getAIStats();
        if (aiStats && aiStats.aiAdjustments > 0) {
          this.log(`   ✅ AI adjusted ${aiStats.aiAdjustments} component priorities`);
        }
      } catch (error) {
        logger.warn('AI priority weighting failed, continuing with static priorities', { error });
        this.warn('   ⚠️  Could not apply AI priorities, using static prioritization');
      }
    }

    const orderedWaves = getWavesInExecutionOrder(waveResult);

    logger.info('Waves generated', {
      totalWaves: orderedWaves.length,
      totalComponents: waveResult.totalComponents,
      aiEnabled: !!flags['use-ai'],
    });

    return orderedWaves.length;
  }

  private async executeDeployment(
    flags: Record<string, unknown>,
    output: OutputFormatter,
    sourcePath?: string,
    deploymentId = `deployment-${Date.now()}`
  ): Promise<DeploymentReport> {
    const targetOrg = flags['target-org'] as string;
    const dryRun = flags['dry-run'] as boolean;
    const validateOnly = flags['validate-only'] as boolean;

    // Check for existing deployment state (resume capability)
    const stateManager = new StateManager();
    const existingState = await stateManager.loadState();
    let startFromWave = 1;
    let completedWaveNumbers: number[] = [];

    if (existingState && existingState.status === 'failed' && existingState.completedWaves.length > 0) {
      const lastCompletedWave = Math.max(...existingState.completedWaves);
      const failedWaveNumber = existingState.failedWave?.waveNumber || lastCompletedWave + 1;

      output.section('Previous Deployment State', '⚠️');
      output.table([
        { label: 'Status', value: existingState.status },
        { label: 'Completed waves', value: `${existingState.completedWaves.length}/${existingState.totalWaves}` },
        { label: 'Last completed', value: `Wave ${lastCompletedWave}` },
        { label: 'Failed at', value: `Wave ${failedWaveNumber}` },
      ]);
      if (existingState.failedWave?.error) {
        output.warning('Previous error', [existingState.failedWave.error.substring(0, 150) + '...']);
      }

      // Auto-resume if --resume flag is true (default) or not set
      const shouldResume = flags.resume !== false; // Default to true for auto-resume

      if (shouldResume) {
        output.info(`Resuming deployment from Wave ${failedWaveNumber}...`);
        startFromWave = failedWaveNumber;
        completedWaveNumbers = existingState.completedWaves;
      } else {
        output.info('Starting fresh deployment (ignoring previous state)...');
        if (!validateOnly) await stateManager.clearState();
      }
    }

    const reportStartTime = new Date().toISOString();
    const waveReports: WaveReport[] = [];
    const reportErrors: string[] = [];
    const mode: DeploymentReport['mode'] = dryRun ? 'DRY_RUN' : validateOnly ? 'VALIDATION' : 'DEPLOYMENT';
    const finishReport = (success: boolean): DeploymentReport => {
      const endTime = new Date().toISOString();
      return {
        deploymentId,
        targetOrg,
        startTime: reportStartTime,
        endTime,
        totalDuration: Math.max(0, (Date.parse(endTime) - Date.parse(reportStartTime)) / 1000),
        status: success ? (mode === 'VALIDATION' ? 'VALIDATED' : 'SUCCESS') : 'FAILED',
        mode,
        success,
        totalWaves: orderedWaves.length,
        completedWaves: mode === 'DEPLOYMENT' ? waveReports.filter((wave) => wave.success).length : 0,
        totalComponents: orderedWaves.reduce((total, wave) => total + wave.components.length, 0),
        totalComponentFailures: waveReports.reduce((total, wave) => total + (wave.componentFailures ?? 0), 0),
        totalTests: waveReports.reduce((total, wave) => total + (wave.testsRun ?? 0), 0),
        totalTestFailures: waveReports.reduce((total, wave) => total + (wave.testFailures ?? 0), 0),
        waves: waveReports,
        errors: reportErrors,
      };
    };

    // Scan and generate waves
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    if (scanResult.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: scanResult.errors });
      scanResult.errors.forEach((err) => this.warn(err));
    }
    if (scanResult.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: scanResult.warnings });
      scanResult.warnings.forEach((warn) => this.warn(warn));
    }

    const waveBuilder = new WaveBuilder();
    let waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);

    // Build component map (NodeId -> MetadataComponent)
    const componentMap = new Map<string, MetadataComponent>();
    for (const component of scanResult.components) {
      const nodeId = createNodeId(component.type, component.name);
      componentMap.set(nodeId, component);
    }

    // Apply post-processing to optimize waves and reduce need for simplification
    const { WavePostProcessor } = await import('../../waves/wave-post-processor.js');
    const postProcessor = new WavePostProcessor(componentMap, {
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
    const manifestAdjustments = postProcessResult.manifestAdjustments;
    const componentsToSimplify = postProcessResult.componentsToSimplify;

    // AI Priority Weighting (US-057) - if --use-ai is enabled
    if (flags['use-ai']) {
      output.subsection('Applying AI Priority Weighting', '🤖');

      try {
        // Try to get access token from org
        let accessToken: string | undefined;
        try {
          const org = await Org.create({ aliasOrUsername: targetOrg });
          const connection = org.getConnection();
          const authFields = connection.getAuthInfoFields();
          accessToken = authFields.accessToken;
          logger.debug('Using access token from authenticated org for priority service');
        } catch (error) {
          logger.warn('Could not get access token from org, will use API key or mock', { error });
        }

        const { AgentforcePriorityService } = await import('../../ai/agentforce-priority-service.js');
        const { AIEnhancedPriorityWaveGenerator } = await import('../../waves/priority-wave-generator-ai.js');

        const priorityService = new AgentforcePriorityService({
          enabled: true,
          autoApply: false,
          apiKey: accessToken,
        });

        const aiGenerator = new AIEnhancedPriorityWaveGenerator({
          agentforceService: priorityService,
          orgType: flags['org-type'] as string | undefined,
          industry: flags.industry as string | undefined,
        });

        // Apply AI priorities
        const prioritizedWaves = await aiGenerator.applyPriorityWavesAsync(waveResult.waves, componentMap);

        waveResult = {
          ...waveResult,
          waves: prioritizedWaves,
        };

        const aiStats = aiGenerator.getAIStats();
        if (aiStats && aiStats.aiAdjustments > 0) {
          this.log(`   ✅ AI adjusted ${aiStats.aiAdjustments} component priorities`);
        }
      } catch (error) {
        logger.warn('AI priority weighting failed, continuing with static priorities', { error });
        this.warn('   ⚠️  Could not apply AI priorities, using static prioritization');
      }
    }

    const orderedWaves = getWavesInExecutionOrder(waveResult);

    if (dryRun) {
      output.info('Skipping actual deployment; analyzing waves and components only');
      const now = new Date();
      for (const wave of orderedWaves) {
        waveReports.push({
          waveNumber: wave.number,
          components: wave.components.length,
          startTime: now.toISOString(),
          endTime: now.toISOString(),
          duration: 0,
          success: true,
        });
        output.info(`Wave ${wave.number}: analyzed ${wave.components.length} component(s)`);
      }
      return finishReport(true);
    }

    // Filter waves to deploy based on previous state (if resuming)
    let wavesToDeploy = orderedWaves;
    if (startFromWave > 1 && completedWaveNumbers.length > 0) {
      wavesToDeploy = orderedWaves.filter((wave) => !completedWaveNumbers.includes(wave.number));
      output.section('Deployment Plan', '📊');
      output.table([
        { label: 'Total waves', value: orderedWaves.length },
        { label: 'Already completed', value: `${completedWaveNumbers.length} (${completedWaveNumbers.join(', ')})` },
        { label: 'Remaining to deploy', value: `${wavesToDeploy.length} (starting from Wave ${startFromWave})` },
      ]);
    }

    // Generate manifests for all waves (needed for state tracking)
    output.section('Generating Manifests', '📄');

    // Initialize AgentforceService if --use-ai is enabled
    // Uses flexible model support - model can be configured via:
    // 1. .smart-deployment.json (ai.model)
    // 2. getRecommendedModel() for automatic selection based on org size
    // 3. Environment variables or CLI flags
    let agentforceService: AgentforceService | undefined;
    if (flags['use-ai']) {
      try {
        let accessToken: string | undefined;
        if (targetOrg && !flags['dry-run']) {
          try {
            const org = await Org.create({ aliasOrUsername: targetOrg });
            const connection = org.getConnection();
            const authFields = connection.getAuthInfoFields();
            accessToken = authFields.accessToken;
          } catch (error) {
            logger.warn('Could not get access token for manifest generation', { error });
          }
        }

        // AgentforceService already supports flexible models
        // Model selection is handled by the service based on config
        agentforceService = new AgentforceService({
          enabled: true,
          apiKey: accessToken,
          // Model comes from .smart-deployment.json or defaults to 'agentforce-1'
          // Can be overridden via getRecommendedModel() if needed
        });

        if (accessToken) {
          agentforceService.setApiKeyFromOrg(accessToken);
        }

        const model = agentforceService.getConfig().model;
        output.subsection('Using Agentforce for Metadata Type Mapping', '🤖');
        output.keyValue('Model', model);
      } catch (error) {
        logger.warn('Could not initialize Agentforce for manifest generation', { error });
      }
    }

    const manifestGenerator = new ManifestGenerator(agentforceService);
    const manifestDir = path.join(scanResult.projectRoot, '.smart-deployment', 'manifests');
    const manifestResult = await manifestGenerator.generateManifests(orderedWaves, {
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
      logger.warn('Manifest generation warnings', { warnings: manifestResult.warnings });
      manifestResult.warnings.forEach((warn) => this.warn(`⚠️  ${warn}`));
    }

    if (manifestResult.manifests.length === 0) {
      this.error('No manifests generated. Cannot proceed with deployment.');
      return finishReport(false);
    }

    output.success(`Generated ${manifestResult.manifests.length} manifests`);

    // Validate wave integrity before deployment
    output.section('Validating Wave Integrity', '🔍');
    const { WaveIntegrityValidator } = await import('../../waves/wave-integrity-validator.js');
    const integrityValidator = new WaveIntegrityValidator(componentMap, orderedWaves);
    const integrityResult = integrityValidator.validateWaves();

    if (!integrityResult.isValid) {
      const report = integrityValidator.generateReport(integrityResult);
      output.info(report);

      if (integrityResult.summary.errors > 0) {
        output.warning(`Found ${integrityResult.summary.errors} integrity error(s) that may cause deployment failures`);
        output.tip('Consider reviewing wave structure or using --dry-run to preview deployment');
      }
      if (integrityResult.summary.warnings > 0) {
        output.info(`Found ${integrityResult.summary.warnings} warning(s) - deployment may still succeed`);
      }
    } else {
      output.success('Wave integrity validation passed - all dependencies are satisfied');
    }

    // Validate manifests against source
    output.section('Validating Manifests Against Source', '🔍');
    const manifestValidator = new ManifestValidator();
    let allManifestsValid = true;

    for (const manifest of manifestResult.manifests) {
      const validation = await manifestValidator.validateManifest(manifest, componentMap, scanResult.projectRoot);
      if (!validation.isValid) {
        allManifestsValid = false;
        logger.error('Manifest validation failed', { fileName: manifest.fileName, errors: validation.errors });
        validation.errors.forEach((err) => output.error(`${manifest.fileName}: ${err.message}`));
      }
      if (validation.warnings.length > 0) {
        validation.warnings.forEach((warn) => output.warning(`${manifest.fileName}: ${warn.message}`));
      }
    }

    if (!allManifestsValid) {
      this.error('Manifest validation failed. Please fix errors before deploying.');
      return finishReport(false);
    }

    output.success('All manifests validated');

    const agentforceValidation = validateAgentforceTargets(orderedWaves, manifestResult.manifests, componentMap);
    for (const issue of agentforceValidation.issues) {
      output.warning(`Agentforce target ${issue.consumer} -> ${issue.target}: ${issue.message}`);
    }
    if (agentforceValidation.issues.some((issue) => issue.severity === 'error')) {
      this.error(
        'Agentforce target validation failed. Targets must be present in manifests and deployed before consumers.'
      );
      return finishReport(false);
    }
    if (agentforceValidation.valid) {
      output.success('Agentforce targets are ordered and included in manifests');
    }

    // Validate manifest completeness - ensure all project components are included
    output.subsection('Validating Manifest Completeness', '🔍');
    const completenessResult = await validateManifestCompleteness(
      scanResult.components,
      manifestResult.manifests,
      componentMap
    );

    if (completenessResult.missingComponents.length > 0) {
      output.warning(
        `${completenessResult.missingComponents.length} component(s) from project are NOT in any manifest:`
      );

      // Group missing components by type
      const missingByType = new Map<string, Array<{ name: string; type: string }>>();
      for (const comp of completenessResult.missingComponents) {
        if (!missingByType.has(comp.type)) {
          missingByType.set(comp.type, []);
        }
        missingByType.get(comp.type)!.push({ name: comp.name, type: comp.type });
      }

      // Display missing components grouped by type
      for (const [type, components] of Array.from(missingByType.entries()).sort()) {
        output.warning(`${type}: ${components.length} component(s)`);
        if (components.length <= 10) {
          // Show individual components if 10 or fewer
          components.forEach((comp) => {
            output.info(`   • ${comp.name}`, []);
          });
        } else {
          // Show first 5 and count if more
          components.slice(0, 5).forEach((comp) => {
            output.info(`   • ${comp.name}`, []);
          });
          output.info(`   ... and ${components.length - 5} more`, []);
        }
      }

      output.blank();
      output.tip('These components may have circular dependencies or were filtered out during wave generation.');
      output.tip('Check wave generation output for "couldn\'t be placed" messages.');
      output.blank();
    } else {
      const deployableCount = completenessResult.totalDeployableScanned;
      output.success(`All ${deployableCount} deployable component(s) are included in manifests`);
    }

    // Check for duplicates or missing components
    // Use deployableScannedCount instead of scanResult.components.length to exclude child components
    const deployableScannedCount = completenessResult.totalDeployableScanned;
    if (completenessResult.totalInManifests !== deployableScannedCount) {
      const diff = completenessResult.totalInManifests - deployableScannedCount;
      if (diff > 0) {
        output.warning(`Warning: ${diff} more component(s) in manifests than deployable scanned (possible duplicates)`);
      } else if (diff < 0) {
        const missingCount = Math.abs(diff);
        output.warning(`Warning: ${missingCount} fewer component(s) in manifests than deployable scanned`);
        output.tip(
          "This may indicate components with circular dependencies or components that couldn't be placed in any wave."
        );
      }
    } else {
      output.success(`All ${deployableScannedCount} deployable component(s) are accounted for in manifests`);
    }

    // AI Wave Validation (if --use-ai is enabled)
    if (flags['use-ai']) {
      output.blank();
      output.subsection('Using Agentforce for Wave Validation', '🤖');

      try {
        // Try to get access token from org if target-org is provided
        let accessToken: string | undefined;
        if (targetOrg && !flags['dry-run']) {
          try {
            const org = await Org.create({ aliasOrUsername: targetOrg });
            const connection = org.getConnection();
            const authFields = connection.getAuthInfoFields();
            accessToken = authFields.accessToken;
            logger.info('Using access token from authenticated org for wave validation');
          } catch (error) {
            logger.warn('Could not get access token from org, will use API key or mock', { error });
          }
        }

        const waveValidationAgentforceService = new AgentforceService({
          enabled: true,
          apiKey: accessToken,
        });

        if (accessToken) {
          waveValidationAgentforceService.setApiKeyFromOrg(accessToken);
        }

        const waveValidationService = new WaveValidationService(waveValidationAgentforceService);
        const validationResult = await waveValidationService.validateWaves(orderedWaves);

        if (validationResult.aiAnalyzed) {
          output.success(`Analyzed ${orderedWaves.length} waves`);
          output.keyValue('Overall risk', validationResult.overallRisk.toUpperCase(), '📊');

          if (validationResult.issues.length > 0) {
            this.log(`   ⚠️  Found ${validationResult.issues.length} potential issues:`);
            validationResult.issues.slice(0, 5).forEach((issue) => {
              const icon = issue.severity === 'critical' ? '❌' : '⚠️';
              this.log(`      ${icon} ${issue.message}`);
            });
            if (validationResult.issues.length > 5) {
              this.log(`      ... and ${validationResult.issues.length - 5} more`);
            }
          }

          if (validationResult.optimizations.length > 0) {
            this.log(`   💡 ${validationResult.optimizations.length} optimization suggestions:`);
            validationResult.optimizations.slice(0, 3).forEach((opt) => {
              this.log(`      • ${opt.description}`);
            });
          }

          if (
            validationResult.overallRisk === 'high' ||
            validationResult.issues.some((i) => i.severity === 'critical')
          ) {
            this.warn('\n⚠️  High-risk deployment detected. Consider reviewing waves before proceeding.');
          }
        } else {
          this.log('   ⚠️  Agentforce unavailable, skipping AI validation');
        }
      } catch (error) {
        logger.warn('Wave validation with Agentforce failed', { error });
        this.warn('   ⚠️  Could not validate waves with Agentforce, continuing with static validation only');
      }

      this.log('');
    }

    // Initialize deployment services (reuse stateManager from above)
    const tracker = new DeploymentTracker();
    const availabilityAnalyzer = new DependencyAvailabilityAnalyzer(componentMap);

    // Execute waves sequentially
    // Deploy only waves that haven't been completed yet
    for (const wave of wavesToDeploy) {
      const waveStartTime = new Date();
      let waveComponentFailures = 0;
      let waveTestFailures = 0;
      let deploymentResultForReport:
        | { componentFailures?: number; testsRun?: number; testFailures?: number }
        | undefined;
      output.waveHeader(wave.number, orderedWaves.length, wave.components.length);

      try {
        // Apply preventive simplification if needed
        let manifestPath: string;
        const simplifier = new MetadataSimplifier();
        let preventiveSimplification: Awaited<ReturnType<typeof simplifier.simplifyWaveMetadata>> | undefined;
        const componentsToSimplifyInWave = new Map<NodeId, { unavailableDeps: NodeId[]; targetWave: number }>();
        const protectedSharedComponents = new Set<NodeId>();

        // Only simplify references classified as genuinely unavailable. A
        // same-wave dependency is not automatically a missing dependency.
        for (const nodeId of wave.components) {
          const simplifyInfo = componentsToSimplify.get(nodeId);
          if (simplifyInfo && simplifyInfo.targetWave > wave.number) {
            if (availabilityAnalyzer.assessSharedComponent(nodeId).isShared) {
              protectedSharedComponents.add(nodeId);
              logger.warn('Skipping preventive simplification for shared component', {
                nodeId,
                consumers: availabilityAnalyzer.assessSharedComponent(nodeId).consumers,
                wave: wave.number,
              });
              continue;
            }
            const unavailableDeps = availabilityAnalyzer.unavailableDependencies(nodeId, wave, orderedWaves);
            if (unavailableDeps.length > 0) {
              componentsToSimplifyInWave.set(nodeId, {
                ...simplifyInfo,
                unavailableDeps,
              });
            }
          }
        }

        const availableComponents = new Set<NodeId>();
        for (let i = 0; i < wave.number - 1; i++) {
          orderedWaves[i]?.components.forEach((nodeId) => availableComponents.add(nodeId));
        }
        // The simplifier also receives this set. Include same-wave components
        // so it cannot remove references merely because they share a wave.
        wave.components.forEach((nodeId) => availableComponents.add(nodeId));

        for (const nodeId of wave.components) {
          const component = componentMap.get(nodeId);
          if (!component) continue;

          const unavailableDeps = availabilityAnalyzer.unavailableDependencies(nodeId, wave, orderedWaves);
          if (unavailableDeps.length > 0) {
            if (availabilityAnalyzer.assessSharedComponent(nodeId).isShared) {
              protectedSharedComponents.add(nodeId);
              logger.warn('Skipping preventive simplification for shared component', {
                nodeId,
                consumers: availabilityAnalyzer.assessSharedComponent(nodeId).consumers,
                wave: wave.number,
              });
              continue;
            }
            logger.debug('Detected component with unavailable dependencies', {
              component: component.name,
              componentType: component.type,
              nodeId,
              unavailableDeps,
              wave: wave.number,
            });
            componentsToSimplifyInWave.set(nodeId, {
              unavailableDeps,
              targetWave: wave.number + 1, // Will be deployed fully in next wave
            });
          }
        }

        if (componentsToSimplifyInWave.size > 0) {
          this.log(`   🔧 Applying preventive simplification to ${componentsToSimplifyInWave.size} component(s)...`);

          preventiveSimplification = await simplifier.simplifyWaveMetadata(wave, {
            availableComponents,
            allWaves: orderedWaves,
            currentWaveNumber: wave.number,
            componentMap,
            protectedComponents: protectedSharedComponents,
          });

          if (preventiveSimplification.simplified && preventiveSimplification.tempFiles.size > 0) {
            this.log(
              `   ✅ Simplified ${preventiveSimplification.simplifiedComponents.length} component(s) preventively`
            );

            // Regenerate manifest with simplified files
            const tempManifestDir = path.join(manifestDir, `simplified-wave-${wave.number}`);
            await fs.mkdir(tempManifestDir, { recursive: true });

            // Update component map with temp paths for simplified components
            const updatedComponentMap = new Map(componentMap);
            for (const [nodeId, tempPath] of preventiveSimplification.tempFiles.entries()) {
              const component = updatedComponentMap.get(nodeId);
              if (component) {
                updatedComponentMap.set(nodeId, {
                  ...component,
                  filePath: tempPath,
                });
              }
            }

            // Use temp project root if available
            const projectRootForManifest = preventiveSimplification.tempProjectRoot || scanResult.projectRoot;

            const manifestGen = new ManifestGenerator();
            const simplifiedManifestResult = await manifestGen.generateManifests([wave], {
              projectRoot: projectRootForManifest,
              componentMap: updatedComponentMap,
              outputDir: tempManifestDir,
              validateFiles: true,
            });

            if (simplifiedManifestResult.manifests.length > 0) {
              const simplifiedManifest = simplifiedManifestResult.manifests[0];
              manifestPath = path.join(tempManifestDir, simplifiedManifest.fileName);
              this.log(`   📦 Using simplified manifest: ${simplifiedManifest.fileName}`);
            } else {
              // Fallback to original manifest if simplified generation failed
              const manifest = manifestResult.manifests.find((m) =>
                m.fileName.includes(`wave-${String(wave.number).padStart(3, '0')}`)
              );
              if (!manifest) {
                throw new Error(`Manifest not found for wave ${wave.number}`);
              }
              manifestPath = path.join(manifestDir, manifest.fileName);
              this.log(`📦 Using manifest: ${manifest.fileName}`);
            }
          } else {
            // No simplification needed, use original manifest
            const manifest = manifestResult.manifests.find((m) =>
              m.fileName.includes(`wave-${String(wave.number).padStart(3, '0')}`)
            );
            if (!manifest) {
              throw new Error(`Manifest not found for wave ${wave.number}`);
            }
            manifestPath = path.join(manifestDir, manifest.fileName);
            this.log(`📦 Using manifest: ${manifest.fileName}`);
          }
        } else {
          // No preventive simplification needed, use original manifest
          const manifest = manifestResult.manifests.find((m) =>
            m.fileName.includes(`wave-${String(wave.number).padStart(3, '0')}`)
          );
          if (!manifest) {
            throw new Error(`Manifest not found for wave ${wave.number}`);
          }
          manifestPath = path.join(manifestDir, manifest.fileName);
          this.log(`📦 Using manifest: ${manifest.fileName}`);
        }

        logger.debug('Manifest path prepared', { manifestPath, wave: wave.number });

        // Execute deployment
        const waveDeploymentId = `${deploymentId}-wave-${wave.number}`;
        tracker.startTracking(waveDeploymentId, wave.number, orderedWaves.length);

        // Execute actual SF CLI deployment
        const sfCli = new SfCliIntegration();

        // Detect org type to enforce production test requirements
        const isProduction = await this.isProductionOrg(targetOrg);
        const noTestRun = (flags['no-test-run'] as boolean) || (flags['skip-tests'] as boolean);
        const runWaveTest = flags['run-wave-test'] as boolean;
        const requestedTestLevel = flags['test-level'] as
          | 'NoTestRun'
          | 'RunLocalTests'
          | 'RunSpecifiedTests'
          | 'RunAllTestsInOrg'
          | undefined;

        // Production orgs REQUIRE tests - ignore --no-test-run flag
        if (isProduction && noTestRun) {
          output.warning('Production org detected: --no-test-run is ignored (tests are required in production)');
        }

        let testLevel: 'NoTestRun' | 'RunLocalTests' | 'RunSpecifiedTests' | 'RunAllTestsInOrg' | undefined;
        let testClasses: string[] = [];

        if (requestedTestLevel) {
          // An explicit test level takes precedence over wave-specific test selection.
          testLevel = requestedTestLevel;
          if (testLevel === 'RunSpecifiedTests') {
            testClasses = this.extractTestClassesFromWave(wave, componentMap);
          }
          output.subsection('Test Execution', '🧪');
          output.info(`Using ${testLevel} (explicit --test-level)`);
        } else if (runWaveTest) {
          // User explicitly wants to run only tests from this wave
          testClasses = this.extractTestClassesFromWave(wave, componentMap);
          if (testClasses.length > 0) {
            // Use RunSpecifiedTests with only tests from this wave
            testLevel = 'RunSpecifiedTests';
            output.subsection('Test Execution', '🧪');
            output.keyValue('Test classes', `${testClasses.length} specified`);
            output.list(testClasses.slice(0, 5), '   •');
            if (testClasses.length > 5) {
              output.info(`... and ${testClasses.length - 5} more`);
            }
            if (isProduction) {
              output.info('Using RunSpecifiedTests in production - will test only components in this wave');
            }
          } else {
            // No test classes in wave - skip tests (user explicitly requested wave-specific tests only)
            output.subsection('Test Execution', '⏭️');
            output.info('No test classes found in wave - skipping tests (--run-wave-test with no tests in wave)');
            // Don't set testLevel - let SF CLI handle it (may fail in production, but that's expected)
          }
        } else if (noTestRun && !isProduction) {
          // User wants to skip tests (sandbox only)
          testLevel = 'NoTestRun';
          output.subsection('Test Execution', '⏭️');
          output.info('Skipping tests (--no-test-run, sandbox only)');
        } else {
          // Default behavior: Don't specify test level, let SF CLI decide
          // This allows SF CLI to use its default behavior which may be more lenient
          output.subsection('Test Execution', '📋');
          if (isProduction) {
            output.info('Using SF CLI default test behavior (may avoid strict 75% enforcement)');
          } else {
            output.info('Using SF CLI standard test behavior');
          }
        }

        try {
          // Use temp project root if simplification was applied
          const sourceDir = preventiveSimplification?.tempProjectRoot || sourcePath;

          const result = await sfCli.deploy({
            manifestPath,
            targetOrg,
            testLevel,
            tests: testLevel === 'RunSpecifiedTests' ? testClasses : undefined,
            checkOnly: validateOnly,
            sourceDir,
            ignoreConflicts: Boolean(flags['ignore-conflicts']),
            ignoreWarnings: Boolean(flags['ignore-conflicts']), // Also ignore warnings when ignoring conflicts
          });
          waveComponentFailures = result.componentFailures ?? 0;
          waveTestFailures = result.testFailures ?? 0;
          deploymentResultForReport = result;

          // NO PARTIAL FAILURES: Verify that deployment was truly successful
          // Check both success flag AND component failures count
          const hasComponentFailures = (result.componentFailures ?? 0) > 0;
          const hasTestFailures = result.testFailures && result.testFailures > 0;
          const isTrulySuccessful = result.success && !hasComponentFailures && !hasTestFailures;

          if (!isTrulySuccessful) {
            // If result.success is true but there are failures, override it
            if (result.success && (hasComponentFailures || hasTestFailures)) {
              logger.warn('Deployment marked as success but has component/test failures', {
                wave: wave.number,
                componentFailures: result.componentFailures,
                testFailures: result.testFailures,
              });
            }
            const errorMessage = `Deployment failed: ${result.status}\n${result.output}`;

            // Check if errors are from Experience Bundle auto-generated components
            // These components reference standard components that should exist in org
            // If they fail only due to missing standard components, we can continue
            const { isSafeToIgnoreExperienceBundleErrors } = await import('../../constants/standard-components.js');

            // Parse component failures to check if Experience Bundle errors can be ignored
            const experienceBundleErrors: string[] = [];
            const otherErrors: string[] = [];

            try {
              // Try to parse JSON output to get component failures
              const jsonMatch = result.output.match(/\{[\s\S]*\}/);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]) as {
                  result?: {
                    details?: {
                      componentFailures?: Array<{
                        componentType?: string;
                        fullName?: string;
                        problem?: string;
                      }>;
                    };
                  };
                };

                const failures = parsed.result?.details?.componentFailures || [];

                // Separate Experience Bundle errors from other errors
                // Note: Salesforce propagates compilation errors to all classes in a wave
                // So we need to check if the error is about auto-generated components
                // and if ALL classes with that error actually reference those components

                // Group failures by error message to detect propagated errors
                const errorsByMessage = new Map<
                  string,
                  Array<{ componentId: string; failure: (typeof failures)[0] }>
                >();

                for (const failure of failures) {
                  if (!failure.fullName || !failure.problem) continue;

                  const componentId = createNodeId(failure.componentType ?? 'Unknown', failure.fullName);
                  const errorKey = failure.problem.trim();

                  if (!errorsByMessage.has(errorKey)) {
                    errorsByMessage.set(errorKey, []);
                  }
                  errorsByMessage.get(errorKey)!.push({ componentId, failure });
                }

                // Process each unique error message
                for (const [msg, componentsWithError] of errorsByMessage.entries()) {
                  // Check if this error is about auto-generated Visualforce Pages
                  const isAutoGeneratedPageError =
                    /Page\s+(ForgotPasswordConfirm|ForgotPassword|ChangePassword|SiteLogin|SiteRegister|CommunitiesLogin|CommunitiesLanding|CommunitiesSelfReg|MyProfilePage|MicrobatchSelfReg|BandwidthExceeded|Exception|FileNotFound|InMaintenance|StdExceptionTemplate|Unauthorized|UnderConstruction|AnswersHome|IdeasHome|SiteTemplate|CommunitiesTemplate)\s+does not exist/i.test(
                      msg
                    );

                  if (isAutoGeneratedPageError) {
                    // Check if ALL components with this error are Experience Bundle components
                    // or if they actually reference the missing page
                    let allAreExperienceBundle = true;
                    let allReferenceThePage = true;

                    for (const { componentId } of componentsWithError) {
                      const isExperienceBundle = isSafeToIgnoreExperienceBundleErrors(componentId, msg);
                      if (!isExperienceBundle) {
                        allAreExperienceBundle = false;

                        // Check if this component actually references the page
                        // Extract page name from error message
                        const pageMatch = msg.match(/Page\s+([A-Za-z0-9_]+)\s+does not exist/i);
                        if (pageMatch) {
                          const pageName = pageMatch[1];
                          // Check if component is in the wave and references this page
                          const component = componentMap.get(componentId);
                          if (component) {
                            const referencesPage = Array.from(component.dependencies).some(
                              (dep) => dep === `VisualforcePage:${pageName}` || dep.includes(pageName)
                            );
                            if (!referencesPage) {
                              allReferenceThePage = false;
                            }
                          } else {
                            // Component not found in map - assume it doesn't reference
                            allReferenceThePage = false;
                          }
                        }
                      }
                    }

                    // If all are Experience Bundle OR all actually reference the page, it's safe to ignore
                    if (allAreExperienceBundle || allReferenceThePage) {
                      componentsWithError.forEach(({ componentId }) => {
                        experienceBundleErrors.push(`${componentId} - ${msg}`);
                      });
                    } else {
                      // Some components have this error but shouldn't - it's a propagated error
                      // Find the first Experience Bundle component as the real source
                      const realSource = componentsWithError.find(({ componentId }) =>
                        isSafeToIgnoreExperienceBundleErrors(componentId, msg)
                      );

                      if (realSource) {
                        // Mark the real source as Experience Bundle error
                        experienceBundleErrors.push(`${realSource.componentId} - ${msg}`);
                        // Mark others as propagated (but still safe to ignore if they're in the same wave)
                        componentsWithError.forEach(({ componentId }) => {
                          if (componentId !== realSource.componentId) {
                            // Check if component is in current wave
                            const isInWave = wave.components.some((nodeId) => nodeId === componentId);
                            if (isInWave) {
                              // It's a propagated error - safe to ignore
                              experienceBundleErrors.push(`${componentId} - ${msg} (propagated)`);
                            } else {
                              otherErrors.push(`${componentId} - ${msg}`);
                            }
                          }
                        });
                      } else {
                        // No Experience Bundle component found - all are real errors
                        componentsWithError.forEach(({ componentId }) => {
                          otherErrors.push(`${componentId} - ${msg}`);
                        });
                      }
                    }
                  } else {
                    // Not an auto-generated page error - check normally
                    for (const { componentId, failure } of componentsWithError) {
                      const isExperienceBundleError = isSafeToIgnoreExperienceBundleErrors(
                        componentId,
                        failure.problem || msg
                      );

                      if (isExperienceBundleError) {
                        experienceBundleErrors.push(`${componentId} - ${failure.problem}`);
                      } else {
                        otherErrors.push(`${componentId} - ${failure.problem}`);
                      }
                    }
                  }
                }
              }
            } catch (parseError) {
              // If we can't parse, fall back to string matching
              logger.debug('Could not parse deployment errors', { error: parseError });
            }

            // NO PARTIAL FAILURES ALLOWED: Any component failure marks the wave as failed
            // Even Experience Bundle errors must be resolved before continuing
            if (experienceBundleErrors.length > 0 || otherErrors.length > 0) {
              output.blank();
              if (experienceBundleErrors.length > 0) {
                output.warning(`${experienceBundleErrors.length} Experience Bundle component(s) failed`);
                output.componentFailures(
                  experienceBundleErrors.map((err) => {
                    const [componentId, ...errorParts] = err.split(' - ');
                    return { componentId, error: errorParts.join(' - ') };
                  }),
                  'warning'
                );
              }
              if (otherErrors.length > 0) {
                output.error(`${otherErrors.length} component(s) failed`);
                output.componentFailures(
                  otherErrors.map((err) => {
                    const [componentId, ...errorParts] = err.split(' - ');
                    return { componentId, error: errorParts.join(' - ') };
                  }),
                  'error'
                );
              }

              // Check for missing metadata suggestions before throwing
              const missingMetadataSuggestions = this.detectMissingMetadata(
                [...experienceBundleErrors, ...otherErrors],
                componentMap,
                scanResult
              );
              if (missingMetadataSuggestions.length > 0) {
                output.blank();
                output.subsection('Missing Metadata Detected', '💡');
                output.info('The following components are referenced but may not exist in the project:');
                missingMetadataSuggestions.forEach((suggestion) => {
                  output.list([`${suggestion.componentId} (referenced by: ${suggestion.referencedBy.join(', ')})`]);
                  if (suggestion.suggestion) {
                    output.tip(suggestion.suggestion);
                  }
                });
              }

              // Throw error to mark wave as failed
              throw new Error(`${experienceBundleErrors.length + otherErrors.length} component(s) failed`);
            }

            // Fallback: Check if error is about standard Experience Cloud components (string matching)
            if (
              result.output.includes('SiteSamples') ||
              result.output.includes('sitelogin') ||
              result.output.includes('SiteLogin') ||
              result.output.includes('SiteHeader') ||
              result.output.includes('SiteFooter') ||
              result.output.includes('SitePoweredBy')
            ) {
              this.warn('   ⚠️  Deployment failed due to standard Experience Cloud components.');
              this.warn('   These components should exist in the org (auto-generated with Experience Cloud sites).');
              this.warn(
                '   Please verify these components exist in the target org: SiteSamples (StaticResource), c:sitelogin (LWC)'
              );
              this.warn(
                "   If they don't exist, create an Experience Cloud site first or retrieve them from another org."
              );
              throw new Error(errorMessage);
            }

            // Check if this is a missing reference error and try simplification fallback
            const simplifierFallback = new MetadataSimplifier();
            if (simplifierFallback.isMissingReferenceError(result.output)) {
              output.blank();
              output.subsection('Simplification Fallback', '🔄');
              output.warning('Deployment failed due to missing references. Attempting simplification fallback...');

              try {
                // Get available components from previous waves
                const availableComponentsFallback = new Set<string>();
                for (let i = 0; i < wave.number - 1; i++) {
                  orderedWaves[i]?.components.forEach((nodeId) => availableComponentsFallback.add(nodeId));
                }

                // Simplify metadata files
                const simplificationResult = await simplifierFallback.simplifyWaveMetadata(wave, {
                  availableComponents: availableComponentsFallback,
                  allWaves: orderedWaves,
                  currentWaveNumber: wave.number,
                  componentMap,
                  protectedComponents: new Set(
                    wave.components.filter((nodeId) => availabilityAnalyzer.assessSharedComponent(nodeId).isShared)
                  ),
                });

                if (simplificationResult.simplified && simplificationResult.tempFiles.size > 0) {
                  this.log(`   🔧 Simplified ${simplificationResult.simplifiedComponents.length} component(s)`);

                  // Regenerate manifest with simplified files
                  const tempManifestDir = path.join(manifestDir, `simplified-wave-${wave.number}`);
                  await fs.mkdir(tempManifestDir, { recursive: true });

                  // Create simplified wave with temp file paths
                  const simplifiedWave: Wave = {
                    ...wave,
                    components: wave.components.map((nodeId) => {
                      const tempPath = simplificationResult.tempFiles.get(nodeId);
                      return tempPath ? nodeId : nodeId; // Keep same nodeId, manifest generator will use tempPath
                    }),
                  };

                  // Update component map with temp paths for simplified components
                  const updatedComponentMap = new Map(componentMap);
                  for (const [nodeId, tempPath] of simplificationResult.tempFiles.entries()) {
                    const component = updatedComponentMap.get(nodeId);
                    if (component) {
                      updatedComponentMap.set(nodeId, {
                        ...component,
                        filePath: tempPath, // Use temp path for simplified file
                      });
                    }
                  }

                  const manifestGen = new ManifestGenerator();
                  const simplifiedManifestResult = await manifestGen.generateManifests([simplifiedWave], {
                    projectRoot: scanResult.projectRoot,
                    componentMap: updatedComponentMap,
                    outputDir: tempManifestDir,
                    validateFiles: true,
                  });

                  if (simplifiedManifestResult.manifests.length > 0) {
                    const simplifiedManifest = simplifiedManifestResult.manifests[0];
                    const simplifiedManifestPath = path.join(tempManifestDir, simplifiedManifest.fileName);

                    this.log('   🔄 Retrying deployment with simplified metadata...');

                    // Retry deployment with simplified manifest
                    const retryResult = await sfCli.deploy({
                      manifestPath: simplifiedManifestPath,
                      targetOrg,
                      testLevel,
                      tests: testLevel === 'RunSpecifiedTests' ? testClasses : undefined,
                      checkOnly: validateOnly,
                      sourceDir: simplificationResult.tempProjectRoot || sourcePath,
                      ignoreConflicts: Boolean(flags['ignore-conflicts']),
                      ignoreWarnings: Boolean(flags['ignore-conflicts']), // Also ignore warnings when ignoring conflicts
                    });

                    const retryHasFailures =
                      (retryResult.componentFailures ?? 0) > 0 || (retryResult.testFailures ?? 0) > 0;
                    if (retryResult.success && !retryHasFailures) {
                      this.log(`   ✅ Deployed ${retryResult.componentSuccesses} components (with simplification)`);
                      if (retryResult.testsRun) {
                        this.log(`   ✅ Ran ${retryResult.testsRun} tests`);
                      }

                      const waveEndTime = new Date();
                      waveReports.push({
                        waveNumber: wave.number,
                        components: wave.components.length,
                        startTime: waveStartTime.toISOString(),
                        endTime: waveEndTime.toISOString(),
                        duration: (waveEndTime.getTime() - waveStartTime.getTime()) / 1000,
                        success: true,
                        testsRun: retryResult.testsRun,
                        testFailures: retryResult.testFailures,
                        componentFailures: retryResult.componentFailures,
                      });
                      if (!validateOnly) {
                        await stateManager.saveState({
                          status: 'deploying',
                          deploymentId,
                          targetOrg,
                          timestamp: new Date().toISOString(),
                          totalWaves: orderedWaves.length,
                          completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
                          currentWave: wave.number,
                        });
                      }
                      output.success(
                        `Wave ${wave.number} ${
                          validateOnly ? 'validated' : 'deployed'
                        } successfully with simplification`
                      );
                      continue;
                    } else {
                      this.warn('   ⚠️  Retry with simplified metadata also failed');
                      reportErrors.push(
                        `Simplification fallback failed: ${retryResult.status} (${
                          retryResult.componentFailures ?? 0
                        } component failure(s), ${retryResult.testFailures ?? 0} test failure(s))`
                      );
                      // Fall through to throw error
                    }
                  } else {
                    this.warn('   ⚠️  Could not generate simplified manifest');
                  }
                } else {
                  this.warn('   ⚠️  Simplification did not produce any changes');
                }
              } catch (simplifyError) {
                logger.warn('Simplification fallback failed', { wave: wave.number, error: simplifyError });
                this.warn(
                  `   ⚠️  Simplification fallback failed: ${
                    simplifyError instanceof Error ? simplifyError.message : String(simplifyError)
                  }`
                );
                // Fall through to throw original error
              }
            }

            throw new Error(errorMessage);
          }

          // NO PARTIAL FAILURES: Double-check that deployment was truly successful
          // Verify no component or test failures before marking wave as completed
          if (result.componentFailures > 0) {
            throw new Error(
              `Wave ${wave.number} has ${result.componentFailures} component failure(s) - cannot mark as completed`
            );
          }
          if (result.testFailures && result.testFailures > 0) {
            throw new Error(
              `Wave ${wave.number} has ${result.testFailures} test failure(s) - cannot mark as completed`
            );
          }

          output.deploymentResult({
            success: true,
            componentSuccesses: result.componentSuccesses,
            componentFailures: 0,
            testsRun: result.testsRun,
            testFailures: result.testFailures,
          });

          const waveEndTime = new Date();
          waveReports.push({
            waveNumber: wave.number,
            components: wave.components.length,
            startTime: waveStartTime.toISOString(),
            endTime: waveEndTime.toISOString(),
            duration: (waveEndTime.getTime() - waveStartTime.getTime()) / 1000,
            success: true,
            componentFailures: waveComponentFailures,
            testsRun: result.testsRun,
            testFailures: waveTestFailures,
          });

          // Check if this wave contains Experience Bundle components
          const hasExperienceBundle = wave.components.some(
            (nodeId) =>
              nodeId.startsWith('DigitalExperience:') ||
              nodeId.includes('site/') ||
              wave.metadata.types.includes('DigitalExperience')
          );

          if (hasExperienceBundle) {
            output.blank();
            output.subsection('Experience Bundle Detected', '📦');
            output.warning('Experience Bundles require activation after deployment');
            output.blank();
            output.subsection('Option A - Salesforce Setup', '');
            output.list(['Go to Setup → Digital Experiences → All Sites', 'Find your site and click "Activate"']);
            output.blank();
            output.subsection('Option B - Salesforce CLI', '');
            output.info(`sf community publish --name <SiteName> --target-org ${targetOrg}`);
            output.blank();
          }
        } catch (deployError) {
          logger.error('Deployment failed', { wave: wave.number, error: deployError });
          throw deployError;
        }

        // Validation is not deployment: do not advance or clear resumable state.
        if (!validateOnly) {
          await stateManager.saveState({
            status: 'deploying',
            deploymentId,
            targetOrg,
            timestamp: new Date().toISOString(),
            totalWaves: orderedWaves.length,
            completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
            currentWave: wave.number,
          });
        }

        output.success(`Wave ${wave.number} ${validateOnly ? 'validated successfully' : 'deployed successfully'}`);
      } catch (error) {
        logger.error('Wave deployment failed', { wave: wave.number, error });
        const errorMessage = error instanceof Error ? error.message : String(error);
        reportErrors.push(errorMessage);
        if (!waveReports.some((report) => report.waveNumber === wave.number)) {
          const waveEndTime = new Date();
          waveReports.push({
            waveNumber: wave.number,
            components: wave.components.length,
            startTime: waveStartTime.toISOString(),
            endTime: waveEndTime.toISOString(),
            duration: (waveEndTime.getTime() - waveStartTime.getTime()) / 1000,
            success: false,
            componentFailures: deploymentResultForReport?.componentFailures,
            testsRun: deploymentResultForReport?.testsRun,
            testFailures: deploymentResultForReport?.testFailures,
            error: errorMessage,
          });
        }

        // Save failed state
        if (!validateOnly) {
          await stateManager.saveState({
            status: 'failed',
            deploymentId,
            targetOrg,
            timestamp: new Date().toISOString(),
            totalWaves: orderedWaves.length,
            completedWaves: Array.from({ length: wave.number - 1 }, (_, i) => i + 1),
            currentWave: wave.number,
            failedWave: {
              waveNumber: wave.number,
              error: error instanceof Error ? error.message : String(error),
              timestamp: new Date().toISOString(),
            },
          });
        }

        this.generateReport(finishReport(false));
        this.error(`Wave ${wave.number} failed: ${error instanceof Error ? error.message : String(error)}`);
        return finishReport(false); // Exit on failure
      }
    }

    if (!validateOnly) {
      await stateManager.saveState({
        status: 'completed',
        deploymentId,
        targetOrg,
        timestamp: new Date().toISOString(),
        totalWaves: orderedWaves.length,
        completedWaves: Array.from({ length: orderedWaves.length }, (_, i) => i + 1),
        currentWave: orderedWaves.length,
      });
      await stateManager.clearState();
      this.log('\n✅ All waves deployed successfully!');
    } else {
      this.log('\n✅ All waves validated successfully (no deployment state changed).');
    }

    // Check if any wave contained Experience Bundle components
    const hasExperienceBundle = orderedWaves.some(
      (wave) =>
        wave.components.some((nodeId) => nodeId.startsWith('DigitalExperience:') || nodeId.includes('site/')) ||
        wave.metadata.types.includes('DigitalExperience')
    );

    if (hasExperienceBundle) {
      this.log('');
      this.log('📦 Experience Bundle(s) were deployed');
      this.log('⚠️  Remember: Experience Bundles require activation after deployment');
      this.log('');
      this.log('Option A - Salesforce Setup:');
      this.log('  1. Go to Setup → Digital Experiences → All Sites');
      this.log('  2. Find your site and click "Activate"');
      this.log('');
      this.log('Option B - Salesforce CLI:');
      this.log(`  sf community publish --name <SiteName> --target-org ${targetOrg}`);
      this.log('  (Replace <SiteName> with your actual site name)');
      this.log('');
    }

    return finishReport(true);
  }

  /**
   * Extract test classes from a wave
   */
  private extractTestClassesFromWave(wave: Wave, componentMap: Map<string, MetadataComponent>): string[] {
    const testClasses: string[] = [];

    for (const nodeId of wave.components) {
      if (!nodeId.startsWith('ApexClass:')) {
        continue;
      }

      const component = componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      // Check if it's a test class
      const className = component.name;
      const isTest = this.isTestClass(className);

      if (isTest) {
        testClasses.push(className);
      }
    }

    return testClasses;
  }

  /**
   * Check if a class name indicates it's a test class
   */
  private isTestClass(className: string): boolean {
    const lowerName = className.toLowerCase();
    return (
      lowerName.includes('test') ||
      lowerName.endsWith('_test') ||
      lowerName.endsWith('test') ||
      className.endsWith('Test')
    );
  }

  /**
   * Detect if org is production
   * Production orgs require tests - cannot use NoTestRun
   */
  private async isProductionOrg(targetOrg: string): Promise<boolean> {
    try {
      const org = await Org.create({ aliasOrUsername: targetOrg });
      const connection = org.getConnection();

      // Query org metadata to determine if it's production
      const query = 'SELECT Id, IsSandbox FROM Organization LIMIT 1';
      const result = await connection.query<{ IsSandbox: boolean }>(query);

      if (result.records && result.records.length > 0) {
        const orgRecord = result.records[0];
        return !orgRecord.IsSandbox;
      }

      // Fallback: Check org username/alias patterns
      const orgUsername = org.getUsername();
      if (orgUsername) {
        // Production orgs typically don't have .sandbox. in the username
        // Sandbox orgs have patterns like: username.sandbox@example.com or username--sandbox@example.com
        const lowerUsername = orgUsername.toLowerCase();
        return (
          !lowerUsername.includes('.sandbox.') && !lowerUsername.includes('sandbox') && !lowerUsername.includes('--')
        );
      }

      return false; // Default to false (assume sandbox if uncertain)
    } catch (error) {
      logger.warn('Could not determine org type, assuming sandbox', { error });
      return false; // Default to sandbox (safer - allows NoTestRun)
    }
  }

  /**
   * Detect missing metadata components that are referenced but don't exist in the project
   *
   * @param errors - List of error messages from deployment
   * @param componentMap - Map of all components in the project
   * @param scanResult - Full scan result with dependency graph
   * @returns Array of suggestions for missing metadata
   */
  private detectMissingMetadata(
    errors: string[],
    componentMap: Map<string, MetadataComponent>,
    scanResult: ScanResult
  ): Array<{ componentId: string; referencedBy: string[]; suggestion?: string }> {
    const suggestions: Array<{ componentId: string; referencedBy: string[]; suggestion?: string }> = [];
    const missingComponents = new Map<string, Set<string>>(); // componentId -> set of components that reference it

    // Extract component names from error messages
    const missingPatterns = [
      /(?:does not exist|not found|missing|invalid).*?:\s*([A-Za-z0-9_]+)/gi,
      /(?:Page|Component|Class|Object|Flow|Label)\s+([A-Za-z0-9_]+)\s+(?:does not exist|not found)/gi,
      /External string does not exist:\s*([A-Za-z0-9_]+)/gi,
    ];

    for (const error of errors) {
      for (const pattern of missingPatterns) {
        const matches = error.matchAll(pattern);
        for (const match of matches) {
          const componentName = match[1];

          // Try to identify the component type from the error
          let componentType: string | undefined;
          if (error.includes('Page') && error.includes('does not exist')) {
            componentType = 'VisualforcePage';
          } else if (error.includes('Component') && error.includes('does not exist')) {
            componentType = 'LightningComponentBundle'; // Could be LWC or Aura
          } else if (error.includes('Class') && error.includes('does not exist')) {
            componentType = 'ApexClass';
          } else if (error.includes('External string') || error.includes('Label')) {
            componentType = 'CustomLabels';
          } else if (error.includes('Flow') && error.includes('does not exist')) {
            componentType = 'Flow';
          }

          if (componentType) {
            const componentId = createNodeId(componentType, componentName);

            // Check if this component exists in the project
            if (!componentMap.has(componentId)) {
              // Find which components reference this missing component
              const referencedBy: string[] = [];

              // Check all components in the project for dependencies
              for (const [nodeId, component] of componentMap.entries()) {
                if (component.dependencies.has(componentId)) {
                  referencedBy.push(nodeId);
                }
              }

              if (referencedBy.length > 0) {
                if (!missingComponents.has(componentId)) {
                  missingComponents.set(componentId, new Set());
                }
                referencedBy.forEach((ref) => missingComponents.get(componentId)!.add(ref));
              }
            }
          }
        }
      }
    }

    // Build suggestions
    for (const [componentId, referencedBySet] of missingComponents.entries()) {
      const referencedBy = Array.from(referencedBySet);
      let suggestion: string | undefined;

      // Generate specific suggestions based on component type
      const parts = parseNodeId(componentId);
      if (!parts) continue;
      const { type, name } = parts;
      if (
        type === 'VisualforcePage' &&
        (name.includes('Site') ||
          name.includes('Communities') ||
          name.includes('ForgotPassword') ||
          name.includes('ChangePassword'))
      ) {
        suggestion =
          'This appears to be an auto-generated Experience Cloud page. Ensure Experience Cloud site metadata is included in the project.';
      } else if (type === 'CustomLabels') {
        suggestion =
          'Custom Label may need to be retrieved from the org or created. Check if the label exists in the target org.';
      } else if (type === 'ApexClass' && (name.includes('Controller') || name.includes('Test'))) {
        suggestion =
          'This may be an auto-generated Experience Cloud controller. Ensure Experience Bundle metadata is included.';
      }

      suggestions.push({
        componentId,
        referencedBy,
        suggestion,
      });
    }

    return suggestions;
  }

  private generateReport(report: DeploymentReport): void {
    this.log(`\n${new DeploymentReporter().generateReport(report)}`);
  }
}
