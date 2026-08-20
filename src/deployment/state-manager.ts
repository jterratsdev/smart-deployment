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
import type { ManualCheckpoint, ReachedManualCheckpoint } from '../types/manual-checkpoint.js';
import type { CommitScopeOptions } from './commit-scope-service.js';
import type { CycleSourceEditRecord } from './cycle-source-editor.js';

const logger = getLogger('StateManager');

export type CycleRemediationState = {
  cycleId: string;
  strategy: 'comment-reference' | 'manual';
  activePhase: 1 | 2;
  startedAt: string;
  completedPhases: Array<1 | 2>;
  editRecords: CycleSourceEditRecord[];
};

export type DeploymentState = {
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
  status?: 'running' | 'paused' | 'failed' | 'completed';
  pausedCheckpoint?: ReachedManualCheckpoint;
  approvedCheckpointIds?: string[];
  execution?: {
    sourcePath: string;
    orderedWaveNumbers: number[];
    nextExecutionIndex: number;
    destructive: boolean;
    skipTests: boolean;
    apiVersion?: string;
    planFingerprint: string;
    checkpoints: ManualCheckpoint[];
    contextOptions?: {
      useAI?: boolean;
      orgType?: string;
      industry?: string;
      commitScope?: CommitScopeOptions;
    };
  };
  cycleRemediation?: CycleRemediationState;
  metadata?: Record<string, unknown>;
};

export type StateManagerOptions = {
  baseDir?: string;
};

/**
 * @ac US-089-AC-1: Save state after each wave
 * @ac US-089-AC-2: Include completed waves
 * @ac US-089-AC-3: Include failed wave details
 */
export class StateManager {
  private readonly stateDir: string;
  private readonly stateFile: string;

  public constructor(options: StateManagerOptions = {}) {
    const baseDir = options.baseDir ?? process.cwd();
    this.stateDir = path.join(baseDir, '.smart-deployment');
    this.stateFile = path.join(this.stateDir, 'deployment-state.json');
  }

  public async saveState(state: DeploymentState): Promise<void> {
    logger.info('Saving deployment state', { state });

    await fs.mkdir(this.stateDir, { recursive: true });
    const temporaryFile = `${this.stateFile}.${process.pid}.tmp`;
    await fs.writeFile(temporaryFile, JSON.stringify(state, null, 2), 'utf-8');
    await fs.rename(temporaryFile, this.stateFile);
  }

  /**
   * @ac US-089-AC-4: Support resume from failure
   */
  public async loadState(): Promise<DeploymentState | null> {
    try {
      const content = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(content) as DeploymentState;
      logger.info('Loaded deployment state', { state });
      return this.normalizeState(state);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        logger.info('No previous deployment state found');
        return null;
      }
      throw new Error(`Failed to load deployment state: ${error instanceof Error ? error.message : String(error)}`);
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

  public async hasFailedDeployment(): Promise<boolean> {
    const state = await this.loadState();
    return state?.failedWave !== undefined;
  }

  public async hasResumableDeployment(): Promise<boolean> {
    const state = await this.loadState();
    return state?.failedWave !== undefined || state?.pausedCheckpoint !== undefined;
  }

  public getStateFilePath(): string {
    return this.stateFile;
  }

  private normalizeState(state: DeploymentState): DeploymentState {
    if (state.cycleRemediation === undefined) {
      return {
        ...state,
        completedWaves: [...state.completedWaves],
        ...(state.approvedCheckpointIds === undefined
          ? {}
          : { approvedCheckpointIds: [...state.approvedCheckpointIds] }),
        ...(state.execution === undefined
          ? {}
          : {
              execution: {
                ...state.execution,
                orderedWaveNumbers: [...state.execution.orderedWaveNumbers],
                checkpoints: state.execution.checkpoints.map((checkpoint) => ({ ...checkpoint })),
              },
            }),
      };
    }

    return {
      ...state,
      completedWaves: [...state.completedWaves],
      ...(state.approvedCheckpointIds === undefined ? {} : { approvedCheckpointIds: [...state.approvedCheckpointIds] }),
      ...(state.execution === undefined
        ? {}
        : {
            execution: {
              ...state.execution,
              orderedWaveNumbers: [...state.execution.orderedWaveNumbers],
              checkpoints: state.execution.checkpoints.map((checkpoint) => ({ ...checkpoint })),
            },
          }),
      cycleRemediation: {
        ...state.cycleRemediation,
        completedPhases: [...state.cycleRemediation.completedPhases],
        editRecords: [...state.cycleRemediation.editRecords],
      },
    };
  }
}
