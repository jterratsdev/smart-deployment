/**
 * smart-deployment:resume command - US-049
 *
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 * @issue #49
 */

import * as path from 'node:path';

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { Org } from '@salesforce/core';
import { getLogger } from '../../utils/logger.js';
import { StateManager } from '../../deployment/state-manager.js';
import { MetadataScannerService } from '../../services/metadata-scanner-service.js';
import { WaveBuilder } from '../../waves/wave-builder.js';
import { getWavesInExecutionOrder } from '../../waves/wave-executor.js';
import { SfCliIntegration } from '../../deployment/sf-cli-integration.js';
import type { DeploymentResult } from '../../deployment/sf-cli-integration.js';
import { DeploymentTracker } from '../../deployment/deployment-tracker.js';
import { ManifestGenerator } from '../../deployment/manifest-generator.js';
import { ManifestValidator } from '../../deployment/manifest-validator.js';
import { AgentforceService } from '../../ai/agentforce-service.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';
import type { MetadataComponent } from '../../types/metadata.js';
import { createNodeId } from '../../utils/node-id.js';
import { validateAgentforceTargets } from '../../validation/agentforce-target-validator.js';
import { RetryHandler } from '../../deployment/retry-handler.js';
import fs from 'node:fs/promises';
import { DeploymentReporter, type DeploymentReport, type WaveReport } from '../../deployment/deployment-reporter.js';

const logger = getLogger('ResumeCommand');
const DEFAULT_MAX_ATTEMPTS = 3;

export default class Resume extends SfCommand<{ success: boolean; resumedFromWave?: number }> {
  public static readonly summary = 'Resume failed deployment';
  public static readonly flags = {
    'target-org': Flags.string({ summary: 'Target org', char: 'o', required: true }),
    'source-path': Flags.string({ summary: 'Source path', char: 'p' }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
  };

  public async run(): Promise<{ success: boolean; resumedFromWave?: number }> {
    const { flags } = await this.parse(Resume);

    // Initialize i18n
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    logger.info('Resuming deployment', { flags });

    // Check for failed deployment
    const stateManager = new StateManager();
    const hasFailed = await stateManager.hasFailedDeployment();

    if (!hasFailed) {
      this.log('ℹ️  No failed deployment found');
      return { success: false };
    }

    // Load deployment state
    const state = await stateManager.loadState();
    if (!state?.failedWave) {
      this.log('ℹ️  No deployment state found');
      return { success: false };
    }

    this.log(`🔄 Resuming from wave ${state.failedWave.waveNumber}`);
    this.log(`   Previous error: ${state.failedWave.error}`);
    this.log(`   Failed at: ${state.failedWave.timestamp}`);

    // Re-scan metadata to regenerate waves
    const sourcePath = flags['source-path'];
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    const waveBuilder = new WaveBuilder();
    let waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);

    // Build component map (NodeId -> MetadataComponent)
    const componentMap = new Map<string, MetadataComponent>();
    for (const component of scanResult.components) {
      const nodeId = createNodeId(component.type, component.name);
      componentMap.set(nodeId, component);
    }

    // Apply post-processing to optimize waves (same as start command)
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

    const orderedWaves = getWavesInExecutionOrder(waveResult);

    // Find waves to resume from
    const failedWaveNumber = state.failedWave.waveNumber;
    const wavesToResume = orderedWaves.filter((wave) => wave.number >= failedWaveNumber);

    this.log(`📊 Resuming ${wavesToResume.length} waves (from wave ${failedWaveNumber})`);

    if (wavesToResume.length === 0) {
      this.log('ℹ️  No waves to resume (all waves already completed)');
      const now = new Date().toISOString();
      await stateManager.clearState();
      this.log(
        new DeploymentReporter().generateReport({
          deploymentId: state.deploymentId,
          targetOrg: flags['target-org'],
          startTime: state.timestamp,
          endTime: now,
          totalDuration: Math.max(0, (Date.parse(now) - Date.parse(state.timestamp)) / 1000),
          status: 'SUCCESS',
          success: true,
          totalWaves: orderedWaves.length,
          completedWaves: orderedWaves.length,
          totalComponents: orderedWaves.reduce((total, wave) => total + wave.components.length, 0),
          totalComponentFailures: 0,
          totalTests: 0,
          totalTestFailures: 0,
          waves: [],
          errors: [],
        })
      );
      return { success: true, resumedFromWave: failedWaveNumber };
    }

    const targetOrg = flags['target-org'];
    const deploymentId = state.deploymentId || `deployment-${Date.now()}`;
    const retryAttempts = this.getRetryAttempts(state.metadata?.retryAttempts);
    const maxAttempts = await this.getMaxAttempts();

    // Generate manifests for ALL waves (including completed ones)
    // This ensures that any post-processing changes (like Custom Metadata Records moved to earlier waves)
    // are reflected in the manifests, even for waves that were already deployed
    this.log('\n📄 Generating manifests for all waves...');

    let agentforceService: AgentforceService | undefined;
    try {
      // Try to get access token from org
      let accessToken: string | undefined;
      try {
        const org = await Org.create({ aliasOrUsername: targetOrg });
        const connection = org.getConnection();
        const authFields = connection.getAuthInfoFields();
        accessToken = authFields.accessToken;
      } catch (error) {
        logger.warn('Could not get access token for manifest generation', { error });
      }

      agentforceService = new AgentforceService({
        enabled: true,
        apiKey: accessToken,
      });

      if (accessToken) {
        agentforceService.setApiKeyFromOrg(accessToken);
      }
    } catch (error) {
      logger.warn('Could not initialize Agentforce for manifest generation', { error });
    }

    const manifestGenerator = new ManifestGenerator(agentforceService);
    const manifestDir = path.join(scanResult.projectRoot, '.smart-deployment', 'manifests');
    // Generate manifests for ALL waves, not just remaining ones
    // This ensures Custom Metadata Records and other post-processed components
    // are included in the correct waves, even if those waves were already deployed
    const manifestResult = await manifestGenerator.generateManifests(orderedWaves, {
      projectRoot: scanResult.projectRoot,
      componentMap,
      outputDir: manifestDir,
      validateFiles: true,
      agentforceService,
      manifestAdjustments, // Pass manifest adjustments from post-processing
    });

    if (manifestResult.errors.length > 0) {
      logger.error('Manifest generation errors', { errors: manifestResult.errors });
      manifestResult.errors.forEach((err) => this.warn(`⚠️  ${err}`));
    }

    if (manifestResult.manifests.length === 0) {
      this.error('No manifests generated. Cannot proceed with deployment.');
      return { success: false };
    }

    this.log(`✅ Generated ${manifestResult.manifests.length} manifests`);

    // Validate manifests
    this.log('\n🔍 Validating manifests against source...');
    const manifestValidator = new ManifestValidator();
    let allManifestsValid = true;

    for (const manifest of manifestResult.manifests) {
      const validation = await manifestValidator.validateManifest(manifest, componentMap, scanResult.projectRoot);
      if (!validation.isValid) {
        allManifestsValid = false;
        logger.error('Manifest validation failed', { fileName: manifest.fileName, errors: validation.errors });
        validation.errors.forEach((err) => this.warn(`❌ ${manifest.fileName}: ${err.message}`));
      }
    }

    if (!allManifestsValid) {
      this.error('Manifest validation failed. Please fix errors before resuming.');
      return { success: false };
    }

    this.log('✅ All manifests validated');

    // Re-scanning can change the dependency plan, so validate Agentforce
    // targets again before deploying any resumed wave.
    const agentforceValidation = validateAgentforceTargets(orderedWaves, manifestResult.manifests, componentMap);
    for (const issue of agentforceValidation.issues) {
      const prefix = issue.severity === 'error' ? '❌' : '⚠️';
      this.warn(`${prefix} Agentforce target ${issue.consumer} -> ${issue.target}: ${issue.message}`);
    }
    if (!agentforceValidation.valid) {
      this.error('Agentforce target validation failed. Cannot resume deployment with an invalid dependency plan.');
      return { success: false };
    }
    this.log('✅ Agentforce targets are ordered and included in manifests');

    // Initialize deployment services
    const tracker = new DeploymentTracker();
    const sfCli = new SfCliIntegration();
    const reportStartTime = state.timestamp;
    const waveReports: WaveReport[] = [];
    const reportErrors: string[] = [];
    let lastDeploymentResult: DeploymentResult | undefined;
    const finishReport = (success: boolean): DeploymentReport => {
      const endTime = new Date().toISOString();
      return {
        deploymentId,
        targetOrg,
        startTime: reportStartTime,
        endTime,
        totalDuration: Math.max(0, (Date.parse(endTime) - Date.parse(reportStartTime)) / 1000),
        status: success ? 'SUCCESS' : 'FAILED',
        success,
        totalWaves: orderedWaves.length,
        completedWaves: state.completedWaves.length + waveReports.filter((wave) => wave.success).length,
        totalComponents: orderedWaves.reduce((total, item) => total + item.components.length, 0),
        totalComponentFailures: waveReports.reduce((total, wave) => total + (wave.componentFailures ?? 0), 0),
        totalTests: waveReports.reduce((total, wave) => total + (wave.testsRun ?? 0), 0),
        totalTestFailures: waveReports.reduce((total, wave) => total + (wave.testFailures ?? 0), 0),
        waves: waveReports,
        errors: reportErrors,
      };
    };

    // Execute remaining waves sequentially
    for (const wave of wavesToResume) {
      const waveStartTime = new Date();
      lastDeploymentResult = undefined;
      this.log(`\n🌊 Deploying Wave ${wave.number}/${orderedWaves.length} (${wave.components.length} components)...`);

      try {
        // Find manifest for this wave
        const manifest = manifestResult.manifests.find((m) =>
          m.fileName.includes(`wave-${String(wave.number).padStart(3, '0')}`)
        );
        if (!manifest) {
          throw new Error(`Manifest not found for wave ${wave.number}`);
        }

        const manifestPath = path.join(manifestDir, manifest.fileName);
        this.log(`📦 Using manifest: ${manifest.fileName}`);

        // Execute deployment. RetryHandler only retries its existing transient errors.
        const waveDeploymentId = `${deploymentId}-wave-${wave.number}`;
        tracker.startTracking(waveDeploymentId, wave.number, orderedWaves.length);
        const previousAttempts = retryAttempts[String(wave.number)] ?? 0;
        const remainingAttempts = maxAttempts - previousAttempts;
        if (remainingAttempts <= 0) {
          throw new Error(`Max attempts (${maxAttempts}) already reached for wave ${wave.number}`);
        }
        const retryHandler = new RetryHandler({
          maxRetries: remainingAttempts - 1,
          initialDelay: 0,
          maxDelay: 0,
        });
        const result = await retryHandler.executeWithRetry(
          async () => {
            const deployment = await sfCli.deploy({
              manifestPath,
              targetOrg,
              testLevel: undefined, // Let SF CLI use its standard behavior
              checkOnly: false,
            });
            lastDeploymentResult = deployment;
            const hasComponentFailures = (deployment.componentFailures ?? 0) > 0;
            const hasTestFailures = (deployment.testFailures ?? 0) > 0;
            if (!deployment.success || hasComponentFailures || hasTestFailures) {
              throw new Error(`Deployment failed: ${deployment.status}\n${deployment.output}`);
            }
            return deployment;
          },
          `deployment-wave-${wave.number}`,
          async ({ attempt, error, willRetry }) => {
            retryAttempts[String(wave.number)] = previousAttempts + attempt;
            if (!willRetry) return;
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
                error: error.message,
                timestamp: new Date().toISOString(),
              },
              metadata: { ...state.metadata, retryAttempts },
            });
          }
        );

        const waveEndTime = new Date();
        waveReports.push({
          waveNumber: wave.number,
          components: wave.components.length,
          startTime: waveStartTime.toISOString(),
          endTime: waveEndTime.toISOString(),
          duration: (waveEndTime.getTime() - waveStartTime.getTime()) / 1000,
          success: true,
          componentFailures: result.componentFailures,
          testsRun: result.testsRun,
          testFailures: result.testFailures,
        });

        this.log(`   ✅ Deployed ${result.componentSuccesses} components`);
        if (result.testsRun) {
          this.log(`   ✅ Ran ${result.testsRun} tests`);
        }

        // Save state after each wave
        await stateManager.saveState({
          status: 'deploying',
          deploymentId,
          targetOrg,
          timestamp: new Date().toISOString(),
          totalWaves: orderedWaves.length,
          completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
          currentWave: wave.number,
          metadata: { ...state.metadata, retryAttempts },
        });

        this.log(`✅ Wave ${wave.number} deployed successfully`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Wave deployment failed', { wave: wave.number, error: errorMessage });
        reportErrors.push(errorMessage);
        const waveEndTime = new Date();
        waveReports.push({
          waveNumber: wave.number,
          components: wave.components.length,
          startTime: waveStartTime.toISOString(),
          endTime: waveEndTime.toISOString(),
          duration: (waveEndTime.getTime() - waveStartTime.getTime()) / 1000,
          success: false,
          componentFailures: (lastDeploymentResult as DeploymentResult | undefined)?.componentFailures,
          testsRun: (lastDeploymentResult as DeploymentResult | undefined)?.testsRun,
          testFailures: (lastDeploymentResult as DeploymentResult | undefined)?.testFailures,
          error: errorMessage,
        });

        // Save failed state
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
            error: errorMessage,
            timestamp: new Date().toISOString(),
          },
          metadata: { ...state.metadata, retryAttempts },
        });

        this.error(`\n❌ Deployment failed at wave ${wave.number}`);
        this.log(new DeploymentReporter().generateReport(finishReport(false)));
        this.log(`   Error: ${errorMessage}`);
        this.log("   Use 'sf smart-deployment resume' to retry from this wave");
        return { success: false, resumedFromWave: failedWaveNumber };
      }
    }

    // All waves completed successfully
    await stateManager.saveState({
      status: 'completed',
      deploymentId,
      targetOrg,
      timestamp: new Date().toISOString(),
      totalWaves: orderedWaves.length,
      completedWaves: Array.from({ length: orderedWaves.length }, (_, i) => i + 1),
      currentWave: orderedWaves.length,
      metadata: { ...state.metadata, retryAttempts },
    });
    await stateManager.clearState();

    this.log('\n✅ Deployment resumed and completed successfully!');
    this.log(`   Completed ${wavesToResume.length} waves (from wave ${failedWaveNumber})`);
    this.log(new DeploymentReporter().generateReport(finishReport(true)));

    return { success: true, resumedFromWave: failedWaveNumber };
  }

  private async getMaxAttempts(): Promise<number> {
    try {
      const config = JSON.parse(await fs.readFile(path.resolve(process.cwd(), '.smart-deployment.json'), 'utf8')) as {
        deployment?: { retry?: { maxAttempts?: unknown } };
      };
      const configured = config.deployment?.retry?.maxAttempts;
      return typeof configured === 'number' && Number.isInteger(configured) && configured > 0
        ? configured
        : DEFAULT_MAX_ATTEMPTS;
    } catch {
      return DEFAULT_MAX_ATTEMPTS;
    }
  }

  private getRetryAttempts(value: unknown): Record<string, number> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        (entry): entry is [string, number] =>
          typeof entry[1] === 'number' && Number.isInteger(entry[1]) && entry[1] >= 0
      )
    );
  }
}
