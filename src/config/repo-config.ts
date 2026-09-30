import * as fs from 'node:fs/promises';
import * as syncFs from 'node:fs';
import * as path from 'node:path';
import type { LLMProviderName } from '../ai/llm-provider.js';
import type { ManualCheckpoint } from '../types/manual-checkpoint.js';
import { validatePostconditionPollingOptions } from '../deployment/postcondition-poller.js';

export type UserPriorities = {
  [metadataId: string]: number;
};

export type RepoLLMConfig = {
  provider?: LLMProviderName;
  model?: string;
  endpoint?: string;
  timeout?: number;
  rateLimit?: number;
};

export type RepoSourceConfig = {
  path?: string;
  packageDirectories?: string[];
  apiVersion?: string;
};

export type RepoCacheConfig = {
  enabled?: boolean;
  strategy?: 'file-hash' | 'none';
};

export type RepoCiPresetConfig = {
  validationMode?: 'strict' | 'warn-only' | 'local-only';
  skipTests?: boolean;
  reportDir?: string;
};

export type RepoCiConfig = {
  preset?: RepoCiPresetConfig;
};

export type RepoReportConfig = {
  planDir?: string;
  graphDir?: string;
};

export type DeploymentConfig = {
  priorities?: UserPriorities;
  testLevel?: string;
  timeout?: number;
  retryStrategy?: string;
  llm?: RepoLLMConfig;
  source?: RepoSourceConfig;
  cache?: RepoCacheConfig;
  ci?: RepoCiConfig;
  reports?: RepoReportConfig;
  checkpoints?: ManualCheckpoint[];
  owdBarrier?: {
    timeoutMs?: number;
    initialDelayMs?: number;
    maximumDelayMs?: number;
  };
};

export function getRepoConfigPath(baseDir?: string): string {
  return path.join(baseDir ?? process.cwd(), '.smart-deployment.json');
}

export async function loadRepoConfig(baseDir?: string): Promise<DeploymentConfig> {
  const configPath = getRepoConfigPath(baseDir);

  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content) as DeploymentConfig;
  } catch {
    return {};
  }
}

export async function loadRepoConfigStrict(baseDir?: string): Promise<DeploymentConfig> {
  const configPath = getRepoConfigPath(baseDir);
  try {
    const config = JSON.parse(await fs.readFile(configPath, 'utf-8')) as DeploymentConfig;
    validateRepoConfig(config);
    return config;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new Error(
      `Failed to load deployment config ${configPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function validateRepoConfig(config: DeploymentConfig): void {
  if (!config.owdBarrier) return;
  validatePostconditionPollingOptions({
    timeoutMs: config.owdBarrier.timeoutMs ?? 120_000,
    initialDelayMs: config.owdBarrier.initialDelayMs ?? 1000,
    maximumDelayMs: config.owdBarrier.maximumDelayMs ?? 10_000,
  });
}

export async function saveRepoConfig(config: DeploymentConfig, baseDir?: string): Promise<void> {
  const configPath = getRepoConfigPath(baseDir);
  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

export function loadRepoConfigSync(baseDir?: string): DeploymentConfig {
  const configPath = getRepoConfigPath(baseDir);

  try {
    const content = syncFs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content) as DeploymentConfig;
  } catch {
    return {};
  }
}
