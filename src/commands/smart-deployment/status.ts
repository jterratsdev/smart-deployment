/**
 * smart-deployment:status command - US-050
 *
 * @ac US-050-AC-1: Shows current wave number
 * @ac US-050-AC-2: Shows completed waves
 * @ac US-050-AC-3: Shows remaining waves
 * @ac US-050-AC-4: Shows estimated time remaining
 * @ac US-050-AC-5: Shows test execution status
 * @ac US-050-AC-6: Refreshes automatically
 * @issue #50
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import { getLogger } from '../../utils/logger.js';
import { StateManager } from '../../deployment/state-manager.js';
import { DeploymentTracker } from '../../deployment/deployment-tracker.js';
import type { DeploymentProgress } from '../../deployment/deployment-tracker.js';
import { SfCliIntegration } from '../../deployment/sf-cli-integration.js';
import type { DeploymentResult } from '../../deployment/sf-cli-integration.js';
import type { DeploymentState } from '../../deployment/state-manager.js';

const logger = getLogger('StatusCommand');
const WATCH_INTERVAL_MS = 5_000;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled', 'succeeded', 'success']);

export type StatusWatchOptions = {
  loadState: () => Promise<DeploymentState | null>;
  getProgress: (deploymentId: string) => DeploymentProgress | undefined;
  checkDeploymentStatus: (deploymentId: string, targetOrg: string) => Promise<DeploymentResult>;
  onUpdate: (state: DeploymentState, progress?: DeploymentProgress, result?: DeploymentResult) => void;
  intervalMs?: number;
  signal?: AbortSignal;
  sleep?: (milliseconds: number, signal?: AbortSignal) => Promise<void>;
};

const sleep = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('Watch interrupted'));
      return;
    }

    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    const abort = (): void => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      reject(new Error('Watch interrupted'));
    };
    signal?.addEventListener('abort', abort, { once: true });
  });

/** Polls the active Salesforce deployment until it reaches a terminal state. */
export async function watchDeployment(options: StatusWatchOptions): Promise<DeploymentState | null> {
  const wait = options.sleep ?? sleep;
  const intervalMs = options.intervalMs ?? WATCH_INTERVAL_MS;
  let lastState: DeploymentState | null = null;

  try {
    while (!options.signal?.aborted) {
      const state = await options.loadState();
      if (!state) return null;
      lastState = state;

      const currentWave = state.currentWave ?? options.getProgress(state.deploymentId)?.waveNumber ?? 0;
      const waveDeploymentId = currentWave > 0 ? `${state.deploymentId}-wave-${currentWave}` : state.deploymentId;
      let result: DeploymentResult | undefined;

      if (!TERMINAL_STATUSES.has(state.status.toLowerCase()) && currentWave > 0) {
        result = await options.checkDeploymentStatus(waveDeploymentId, state.targetOrg);
      }

      const progress = options.getProgress(waveDeploymentId) ?? options.getProgress(state.deploymentId);
      options.onUpdate(state, progress, result);

      if (TERMINAL_STATUSES.has(state.status.toLowerCase())) {
        return state;
      }
      if (result && TERMINAL_STATUSES.has(result.status.toLowerCase())) {
        return {
          ...state,
          status: result.success ? 'completed' : 'failed',
          completedWaves: result.success
            ? Array.from({ length: state.totalWaves }, (_, index) => index + 1)
            : state.completedWaves,
        };
      }

      await wait(intervalMs, options.signal);
    }
  } catch (error) {
    if (!options.signal?.aborted) throw error;
  }

  return lastState;
}

export default class Status extends SfCommand<{ currentWave: number; totalWaves: number; completedWaves: number[] }> {
  public static readonly summary = 'Show deployment status';
  public static readonly flags = {
    'target-org': Flags.string({ summary: 'Target org', char: 'o', required: true }),
    watch: Flags.boolean({ summary: 'Watch for changes', char: 'w', default: false }),
  };

  public async run(): Promise<{ currentWave: number; totalWaves: number; completedWaves: number[] }> {
    const { flags } = await this.parse(Status);

    logger.info('Getting status', { flags });

    const stateManager = new StateManager();
    const tracker = new DeploymentTracker();
    const sfCli = new SfCliIntegration();
    const state = await stateManager.loadState();

    if (!state) {
      this.log('ℹ️  No active deployment found');
      return { currentWave: 0, totalWaves: 0, completedWaves: [] };
    }

    if (flags.watch) {
      const controller = new AbortController();
      const onInterrupt = (): void => controller.abort();
      process.once('SIGINT', onInterrupt);
      try {
        const finalState = await watchDeployment({
          loadState: () => stateManager.loadState(),
          getProgress: (deploymentId) => tracker.getProgress(deploymentId),
          checkDeploymentStatus: (deploymentId, targetOrg) => sfCli.checkDeploymentStatus(deploymentId, targetOrg),
          signal: controller.signal,
          onUpdate: (updatedState, updatedProgress, result) => {
            this.displayStatus(updatedState, updatedProgress, result, true);
          },
        });
        if (controller.signal.aborted) this.log('\n⏹️  Status watch interrupted');
        return this.result(finalState ?? state, tracker.getProgress(state.deploymentId));
      } finally {
        process.removeListener('SIGINT', onInterrupt);
      }
    }

    const progress = tracker.getProgress(state.deploymentId);
    this.displayStatus(state, progress);
    return this.result(state, progress);
  }

  private displayStatus(
    state: DeploymentState,
    progress?: DeploymentProgress,
    result?: DeploymentResult,
    watching = false
  ): void {
    if (watching) this.log(`\n${new Date().toISOString()} - Deployment Status`);

    this.log('📊 Deployment Status');
    this.log(`   Status: ${(result?.status ?? state.status).toUpperCase()}`);
    this.log(`   Target Org: ${state.targetOrg}`);
    this.log(`   Deployment ID: ${state.deploymentId}`);
    this.log(`   Started: ${state.timestamp}`);
    this.log(`   Current Wave: ${state.currentWave || progress?.waveNumber || 0}/${state.totalWaves}`);
    this.log(`   Completed Waves: ${state.completedWaves.length > 0 ? state.completedWaves.join(', ') : 'None'}`);
    this.log(`   Remaining Waves: ${state.totalWaves - state.completedWaves.length}`);

    if (state.status === 'paused') {
      this.log('\n⏸️  Deployment paused - requires manual intervention');
      this.log("   Run 'sf smart deploy resume' to continue");
    } else if (state.status === 'provisioning') {
      this.log('\n📦 Data provisioning in progress');
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

    if (result?.testsRun !== undefined || result?.testFailures !== undefined) {
      this.log(`   Tests: ${result.testsRun ?? 0} run, ${result.testFailures ?? 0} failures`);
    }

    if (state.failedWave) {
      this.log(`\n❌ Failed Wave: ${state.failedWave.waveNumber}`);
      this.log(`   Error: ${state.failedWave.error}`);
      this.log(`   Failed at: ${state.failedWave.timestamp}`);
      this.log("\n💡 Run 'sf smart deploy resume' to retry");
    }
  }

  private result(
    state: DeploymentState,
    progress?: DeploymentProgress
  ): { currentWave: number; totalWaves: number; completedWaves: number[] } {
    return {
      currentWave: state.currentWave || progress?.waveNumber || 0,
      totalWaves: state.totalWaves,
      completedWaves: state.completedWaves,
    };
  }
}
