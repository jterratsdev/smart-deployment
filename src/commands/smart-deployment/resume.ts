/**
 * smart-deployment:resume command - US-049
 * @ac US-049-AC-1: Detects previous failed deployment
 * @ac US-049-AC-2: Loads deployment state
 * @ac US-049-AC-3: Resumes from failed wave
 * @ac US-049-AC-4: Supports retry strategies
 * @ac US-049-AC-5: Updates deployment report
 * @ac US-049-AC-6: Handles multiple failures
 * @issue #49
 */

import { Flags } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { Org } from '@salesforce/core';
import { getLogger } from '../../utils/logger.js';
import { StateManager } from '../../deployment/state-manager.js';
import { MetadataScannerService } from '../../services/metadata-scanner-service.js';
import { WaveBuilder } from '../../waves/wave-builder.js';
import { getWavesInExecutionOrder } from '../../waves/wave-executor.js';
import { SfCliIntegration } from '../../deployment/sf-cli-integration.js';
import { DeploymentTracker } from '../../deployment/deployment-tracker.js';
import { ManifestGenerator } from '../../deployment/manifest-generator.js';
import { ManifestValidator } from '../../deployment/manifest-validator.js';
import { AgentforceService } from '../../ai/agentforce-service.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';
import * as path from 'node:path';
import type { MetadataComponent } from '../../types/metadata.js';

const logger = getLogger('ResumeCommand');

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
    const sourcePath = flags['source-path'] as string | undefined;
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    const waveBuilder = new WaveBuilder();
    let waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);

    // Build component map (NodeId -> MetadataComponent)
    const componentMap = new Map<string, MetadataComponent>();
    for (const component of scanResult.components) {
      const nodeId = `${component.type}:${component.name}`;
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
      return { success: true, resumedFromWave: failedWaveNumber };
    }

    const targetOrg = flags['target-org'] as string;
    const deploymentId = state.deploymentId || `deployment-${Date.now()}`;

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
        const connection = await org.getConnection();
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

    // Initialize deployment services
    const tracker = new DeploymentTracker();
    const sfCli = new SfCliIntegration();

    // Execute remaining waves sequentially
    for (const wave of wavesToResume) {
      this.log(`\n🌊 Deploying Wave ${wave.number}/${orderedWaves.length} (${wave.components.length} components)...`);

      try {
        // Find manifest for this wave
        const manifest = manifestResult.manifests.find((m) => m.fileName.includes(`wave-${String(wave.number).padStart(3, '0')}`));
        if (!manifest) {
          throw new Error(`Manifest not found for wave ${wave.number}`);
        }

        const manifestPath = path.join(manifestDir, manifest.fileName);
        this.log(`📦 Using manifest: ${manifest.fileName}`);

        // Execute deployment
        const waveDeploymentId = `${deploymentId}-wave-${wave.number}`;
        tracker.startTracking(waveDeploymentId, wave.number, orderedWaves.length);

        // Use default test behavior (SF CLI will handle production requirements)
        const result = await sfCli.deploy({
          manifestPath,
          targetOrg,
          testLevel: undefined, // Let SF CLI use its standard behavior
          checkOnly: false,
        });

        if (!result.success) {
          throw new Error(`Deployment failed: ${result.status}\n${result.output}`);
        }

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
        });

        this.log(`✅ Wave ${wave.number} deployed successfully`);
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Wave deployment failed', { wave: wave.number, error: errorMessage });

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
        });

        this.error(`\n❌ Deployment failed at wave ${wave.number}`);
        this.log(`   Error: ${errorMessage}`);
        this.log(`   Use 'sf smart-deployment resume' to retry from this wave`);
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
    });

    this.log(`\n✅ Deployment resumed and completed successfully!`);
    this.log(`   Completed ${wavesToResume.length} waves (from wave ${failedWaveNumber})`);

    return { success: true, resumedFromWave: failedWaveNumber };
  }
}
