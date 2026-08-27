/**
 * smart-deployment:validate command - US-048
 *
 * @ac US-048-AC-1: Performs check-only deployment
 * @ac US-048-AC-2: Validates each wave
 * @ac US-048-AC-3: Reports validation errors
 * @ac US-048-AC-4: Supports --target-org flag
 * @ac US-048-AC-5: Shows estimated deployment time
 * @ac US-048-AC-6: No actual deployment
 * @issue #48
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../../utils/logger.js';
import { MetadataScannerService } from '../../services/metadata-scanner-service.js';
import { WaveBuilder } from '../../waves/wave-builder.js';
import { WaveValidator } from '../../waves/wave-validator.js';
import { getWavesInExecutionOrder } from '../../waves/wave-executor.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import { ManifestGenerator } from '../../deployment/manifest-generator.js';
import { ManifestValidator } from '../../deployment/manifest-validator.js';
import { SfCliIntegration } from '../../deployment/sf-cli-integration.js';
import { createNodeId } from '../../utils/node-id.js';
import type { MetadataComponent } from '../../types/metadata.js';
import * as path from 'node:path';
import type { SupportedLocale } from '../../i18n/locale-detector.js';

const logger = getLogger('ValidateCommand');

export default class Validate extends SfCommand<{ success: boolean; errors: string[] }> {
  public static readonly summary = 'Validate deployment without executing';
  public static readonly flags = {
    'target-org': Flags.string({ summary: 'Target org', char: 'o', required: true }),
    'source-path': Flags.string({ summary: 'Source path to validate', char: 'p' }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
  };

  public async run(): Promise<{ success: boolean; errors: string[] }> {
    const { flags } = await this.parse(Validate);
    const sourcePath = flags['source-path'];
    const targetOrg = flags['target-org'];

    // Initialize i18n
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    logger.info('Validating deployment', { flags });
    this.log('🔍 Scanning metadata...');

    // Scan metadata
    const scanner = new MetadataScannerService();
    const scanResult = await scanner.scan({ sourcePath });

    if (scanResult.errors.length > 0) {
      logger.error('Metadata scanning completed with errors', { errors: scanResult.errors });
      scanResult.errors.forEach((err) => this.warn(`⚠️  ${err}`));
    }
    if (scanResult.warnings.length > 0) {
      logger.warn('Metadata scanning completed with warnings', { warnings: scanResult.warnings });
      scanResult.warnings.forEach((warn) => this.warn(`⚠️  ${warn}`));
    }

    this.log(`📦 Found ${scanResult.components.length} components`);

    // Generate waves
    this.log('🌊 Generating deployment waves...');
    const waveBuilder = new WaveBuilder();
    const waveResult = waveBuilder.generateWaves(scanResult.dependencyResult.graph);
    const orderedWaves = getWavesInExecutionOrder(waveResult);

    this.log(`📊 Generated ${orderedWaves.length} waves`);

    // Validate waves
    this.log('✅ Validating waves...');
    const validator = new WaveValidator();
    const validationResult = validator.validateWaves(orderedWaves, scanResult.dependencyResult.graph);

    if (validationResult.errors.length > 0) {
      logger.error('Wave validation failed', { errors: validationResult.errors });
      validationResult.errors.forEach((err) => this.error(`❌ ${err}`));
      this.log('\n❌ Validation failed');
      return { success: false, errors: validationResult.errors };
    }

    // Generate and validate the manifests locally before contacting the target org.
    const componentMap = new Map<string, MetadataComponent>();
    for (const component of scanResult.components) {
      componentMap.set(createNodeId(component.type, component.name), component);
    }

    const manifestDir = path.join(scanResult.projectRoot, '.smart-deployment', 'manifests');
    const manifestResult = await new ManifestGenerator().generateManifests(orderedWaves, {
      projectRoot: scanResult.projectRoot,
      componentMap,
      outputDir: manifestDir,
      validateFiles: true,
    });

    const localErrors = [...manifestResult.errors];
    for (const warning of manifestResult.warnings) {
      this.warn(`⚠️  ${warning}`);
    }

    const manifestValidator = new ManifestValidator();
    for (const manifest of manifestResult.manifests) {
      const localValidation = await manifestValidator.validateManifest(manifest, componentMap, scanResult.projectRoot);
      if (!localValidation.isValid) {
        localErrors.push(...localValidation.errors.map((error) => `${manifest.fileName}: ${error.message}`));
      }
    }

    if (localErrors.length > 0) {
      logger.error('Local manifest validation failed', { errors: localErrors });
      localErrors.forEach((error) => this.error(`❌ ${error}`));
      this.log('\n❌ Validation failed');
      return { success: false, errors: localErrors };
    }

    if (manifestResult.manifests.length === 0) {
      const error = 'No manifests generated';
      this.error(`❌ ${error}`);
      return { success: false, errors: [error] };
    }

    this.log(`📦 Generated ${manifestResult.manifests.length} manifest(s)`);

    // Salesforce check-only validation never mutates the target org.
    const sfCli = new SfCliIntegration();
    const remoteErrors: string[] = [];
    for (const manifest of manifestResult.manifests) {
      const remoteResult = await sfCli.deploy({
        manifestPath: path.join(manifestDir, manifest.fileName),
        targetOrg,
        checkOnly: true,
      });

      if (!remoteResult.success) {
        const error = `${manifest.fileName}: ${remoteResult.status}\n${remoteResult.output}`;
        remoteErrors.push(error);
        logger.error('Remote validation failed', { manifest: manifest.fileName, output: remoteResult.output });
        this.warn(`❌ ${error}`);
      }
    }

    if (remoteErrors.length > 0) {
      this.log('\n❌ Remote validation failed');
      return { success: false, errors: remoteErrors };
    }

    // Calculate estimated deployment time (rough estimate: 1 second per component)
    const totalComponents = orderedWaves.reduce((sum, wave) => sum + wave.components.length, 0);
    const estimatedSeconds = Math.ceil(totalComponents / 10); // Rough estimate
    const estimatedMinutes = Math.floor(estimatedSeconds / 60);
    const estimatedSecondsRemainder = estimatedSeconds % 60;

    this.log('\n✅ Validation complete');
    this.log('📊 Summary:');
    this.log(`   - Components: ${totalComponents}`);
    this.log(`   - Waves: ${orderedWaves.length}`);
    this.log(`   - Estimated time: ${estimatedMinutes}m ${estimatedSecondsRemainder}s`);

    return { success: true, errors: [] };
  }
}
