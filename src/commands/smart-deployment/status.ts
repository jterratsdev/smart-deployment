/**
 * smart-deployment:status command - US-050
 * @ac US-050-AC-1: Shows current wave number
 * @ac US-050-AC-2: Shows completed waves
 * @ac US-050-AC-3: Shows remaining waves
 * @ac US-050-AC-4: Shows estimated time remaining
 * @ac US-050-AC-5: Shows test execution status
 * @ac US-050-AC-6: Refreshes automatically
 * @issue #50
 */

import { Flags } from '@oclif/core';
import { SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../../utils/logger.js';
import { StateManager } from '../../deployment/state-manager.js';
import { DeploymentTracker } from '../../deployment/deployment-tracker.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';

const logger = getLogger('StatusCommand');

export default class Status extends SfCommand<{ currentWave: number; totalWaves: number; completedWaves: number[] }> {
  public static readonly summary = 'Show deployment status';
  public static readonly flags = {
    'target-org': Flags.string({ summary: 'Target org', char: 'o', required: true }),
    'watch': Flags.boolean({ summary: 'Watch for changes', char: 'w', default: false }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
  };

  public async run(): Promise<{ currentWave: number; totalWaves: number; completedWaves: number[] }> {
    const { flags } = await this.parse(Status);

    // Initialize i18n
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    logger.info('Getting status', { flags });

    // Load deployment state
    const stateManager = new StateManager();
    const state = await stateManager.loadState();

    if (!state) {
      this.log('ℹ️  No active deployment found');
      return { currentWave: 0, totalWaves: 0, completedWaves: [] };
    }

    // Get deployment progress from tracker
    const tracker = new DeploymentTracker();
    const progress = tracker.getProgress(state.deploymentId);

    // Display status
    this.log('📊 Deployment Status');
    this.log(`   Status: ${state.status.toUpperCase()}`);
    this.log(`   Target Org: ${state.targetOrg}`);
    this.log(`   Deployment ID: ${state.deploymentId}`);
    this.log(`   Started: ${state.timestamp}`);
    this.log(`   Current Wave: ${state.currentWave || progress?.waveNumber || 0}/${state.totalWaves}`);
    this.log(`   Completed Waves: ${state.completedWaves.length > 0 ? state.completedWaves.join(', ') : 'None'}`);
    this.log(`   Remaining Waves: ${state.totalWaves - state.completedWaves.length}`);

    if (state.status === 'paused') {
      this.log(`\n⏸️  Deployment paused - requires manual intervention`);
      this.log(`   Run 'sf smart deploy resume' to continue`);
    } else if (state.status === 'provisioning') {
      this.log(`\n📦 Data provisioning in progress`);
    }

    if (progress) {
      this.log(`   Progress: ${progress.percentage}%`);
      if (progress.currentComponent) {
        this.log(`   Current Component: ${progress.currentComponent}`);
      }
      if (progress.eta) {
        const minutes = Math.floor(progress.eta / 60);
        const seconds = progress.eta % 60;
        this.log(`   Estimated Time Remaining: ${minutes}m ${seconds}s`);
      }
      this.log(`   Status: ${progress.status}`);
    }

    if (state.failedWave) {
      this.log(`\n❌ Failed Wave: ${state.failedWave.waveNumber}`);
      this.log(`   Error: ${state.failedWave.error}`);
      this.log(`   Failed at: ${state.failedWave.timestamp}`);
      this.log(`\n💡 Run 'sf smart deploy resume' to retry`);
    }

    return {
      currentWave: state.currentWave || progress?.waveNumber || 0,
      totalWaves: state.totalWaves,
      completedWaves: state.completedWaves,
    };
  }
}
