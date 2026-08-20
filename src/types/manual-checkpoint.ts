import { createHash } from 'node:crypto';
import { readFile, readdir, stat } from 'node:fs/promises';
import * as path from 'node:path';
import type { Wave } from '../waves/wave-builder.js';
import type { NodeId } from './dependency.js';
import type { MetadataComponent } from './metadata.js';

export type ManualCheckpointPhase = 'before' | 'after';

export type ManualCheckpoint = {
  id: string;
  phase: ManualCheckpointPhase;
  waveNumber: number;
  message?: string;
};

export type ReachedManualCheckpoint = ManualCheckpoint & {
  deploymentId: string;
  executionIndex: number;
  totalExecutionWaves: number;
  reachedAt: string;
  planFingerprint: string;
};

export function validateManualCheckpoints(checkpoints: readonly ManualCheckpoint[], waves: readonly Wave[]): void {
  const waveNumbers = new Set(waves.map((wave) => wave.number));
  const ids = new Set<string>();
  const positions = new Set<string>();

  for (const checkpoint of checkpoints) {
    if (!checkpoint.id.trim()) {
      throw new Error('Manual checkpoint id must not be empty.');
    }
    if (checkpoint.phase !== 'before' && checkpoint.phase !== 'after') {
      throw new Error(`Manual checkpoint ${checkpoint.id} has invalid phase: ${String(checkpoint.phase)}`);
    }
    if (ids.has(checkpoint.id)) {
      throw new Error(`Duplicate manual checkpoint id: ${checkpoint.id}`);
    }
    if (!waveNumbers.has(checkpoint.waveNumber)) {
      throw new Error(`Manual checkpoint ${checkpoint.id} references missing wave ${checkpoint.waveNumber}.`);
    }

    const position = `${checkpoint.phase}:${checkpoint.waveNumber}`;
    if (positions.has(position)) {
      throw new Error(`Multiple manual checkpoints target ${position}.`);
    }
    ids.add(checkpoint.id);
    positions.add(position);
  }
}

export function createDeploymentPlanFingerprint(options: {
  waves: readonly Wave[];
  checkpoints: readonly ManualCheckpoint[];
  destructive: boolean;
  skipTests: boolean;
  apiVersion?: string;
  sourceFingerprint?: string;
}): string {
  const value = JSON.stringify({
    waves: options.waves.map((wave) => ({ number: wave.number, components: [...wave.components].sort() })),
    checkpoints: [...options.checkpoints].sort((left, right) => left.id.localeCompare(right.id)),
    destructive: options.destructive,
    skipTests: options.skipTests,
    apiVersion: options.apiVersion,
    sourceFingerprint: options.sourceFingerprint,
  });
  return `sha256:${createHash('sha256').update(value).digest('hex')}`;
}

export async function createSourceFingerprint(components: ReadonlyMap<NodeId, MetadataComponent>): Promise<string> {
  const entries = await Promise.all(
    [...components.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(async ([nodeId, component]) => {
        try {
          return [nodeId, await hashComponentSource(component.filePath)];
        } catch {
          return [nodeId, 'unreadable'];
        }
      })
  );
  return `sha256:${createHash('sha256').update(JSON.stringify(entries)).digest('hex')}`;
}

async function hashComponentSource(componentPath: string): Promise<string> {
  const componentStats = await stat(componentPath);
  if (componentStats.isDirectory()) {
    return hashSourcePath(componentPath);
  }

  const directoryPath = path.dirname(componentPath);
  const basename = path.basename(componentPath);
  const stem = basename.split('.')[0];
  const siblingPaths = (await readdir(directoryPath, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && (entry.name === basename || entry.name.startsWith(`${stem}.`)))
    .map((entry) => path.join(directoryPath, entry.name))
    .sort();
  const contents = await Promise.all(
    siblingPaths.map(async (filePath) => [path.basename(filePath), await readFile(filePath, 'base64')])
  );
  return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
}

async function hashSourcePath(sourcePath: string): Promise<string> {
  const sourceStats = await stat(sourcePath);
  if (sourceStats.isFile()) {
    return createHash('sha256')
      .update(await readFile(sourcePath))
      .digest('hex');
  }

  const files = await collectFiles(sourcePath);
  const contents = await Promise.all(
    files.map(async (filePath) => [path.relative(sourcePath, filePath), await readFile(filePath, 'base64')])
  );
  return createHash('sha256').update(JSON.stringify(contents)).digest('hex');
}

async function collectFiles(directoryPath: string): Promise<string[]> {
  const entries = await readdir(directoryPath, { withFileTypes: true });
  const nested = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = path.join(directoryPath, entry.name);
        return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
      })
  );
  return nested.flat();
}
