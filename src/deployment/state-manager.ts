/**
 * Deployment State Persistence - US-089
 * Saves deployment state for resume capability
 *
 * @ac US-089-AC-1: Save state after each wave
 * @ac US-089-AC-2: Include completed waves
 * @ac US-089-AC-3: Include failed wave details
 * @ac US-089-AC-4: Support resume from failure
 * @ac US-089-AC-5: Clean up state on success
 * @ac US-089-AC-6: Include deployment metadata
 * @issue #89
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { getLogger } from '../utils/logger.js';

const logger = getLogger('StateManager');

export type DeploymentStatus =
  | 'idle'
  | 'initializing'
  | 'analyzing'
  | 'deploying'
  | 'provisioning'
  | 'paused'
  | 'failed'
  | 'completed'
  | 'cancelled';

export interface DeploymentState {
  status: DeploymentStatus;
  deploymentId: string;
  targetOrg: string;
  timestamp: string;
  totalWaves: number;
  completedWaves: number[];
  currentWave?: number;
  failedWave?: {
    waveNumber: number;
    error: string;
    timestamp: string;
  };
  metadata?: Record<string, unknown>;
}

/**
 * @ac US-089-AC-1: Save state after each wave
 * @ac US-089-AC-2: Include completed waves
 * @ac US-089-AC-3: Include failed wave details
 */
export class StateManager {
  private readonly stateDir = path.join(process.cwd(), '.smart-deployment');
  private readonly stateFile = path.join(this.stateDir, 'deployment-state.json');

  /**
   * Save deployment state
   */
  public async saveState(state: DeploymentState): Promise<void> {
    logger.info('Saving deployment state', { status: state.status });

    // Basic validation
    if (state.status === 'completed' && state.failedWave) {
      throw new Error('Cannot be completed with failed wave');
    }

    await fs.mkdir(this.stateDir, { recursive: true });
    await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2), 'utf-8');
  }

  /**
   * @ac US-089-AC-4: Support resume from failure
   */
  public async loadState(): Promise<DeploymentState | null> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content) as DeploymentState;
      logger.info('Loaded deployment state', { status: state.status });
      return state;
    } catch {
      logger.info('No previous deployment state found');
      return null;
    }
  }

  /**
   * @ac US-089-AC-5: Clean up state on success
   */
  public async clearState(): Promise<void> {
    try {
      await fs.unlink(this.stateFile);
      logger.info('Cleared deployment state');
    } catch {
      // File doesn't exist, nothing to clear
    }
  }

  /**
   * Check if there's a failed deployment
   */
  public async hasFailedDeployment(): Promise<boolean> {
    const state = await this.loadState();
    return state?.status === 'failed' || state?.failedWave !== undefined;
  }

  /**
   * Check if deployment can be resumed
   */
  public async canResume(): Promise<boolean> {
    const state = await this.loadState();
    if (!state) return false;
    return state.status === 'failed' || state.status === 'paused' || state.status === 'provisioning';
  }

  /**
   * Check if deployment requires manual intervention
   */
  public async requiresManualIntervention(): Promise<boolean> {
    const state = await this.loadState();
    return state?.status === 'paused';
  }

  /**
   * Check if deployment is in provisioning state
   */
  public async isProvisioning(): Promise<boolean> {
    const state = await this.loadState();
    return state?.status === 'provisioning';
  }

  /**
   * Check if deployment can continue (not blocked)
   */
  public async canContinue(): Promise<boolean> {
    const state = await this.loadState();
    if (!state) return true; // No state means can start
    return ['deploying', 'initializing', 'analyzing'].includes(state.status);
  }
}
