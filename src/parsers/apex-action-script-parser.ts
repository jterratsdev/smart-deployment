import { readdir, readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { MetadataType } from '../types/metadata.js';
import type { WaveActionRule, WaveActionSelector } from '../types/wave-action.js';

const ACTION_HEADER = /^\s*\/\/\s*smart-deployment-action:\s*(\{.*\})\s*$/gm;
const SCRIPT_ROOT = path.join('scripts', 'apex', 'actions');

/** Discovers and strictly validates self-describing Apex actions under scripts/apex/actions. */
export async function discoverApexActionRules(projectRoot: string): Promise<WaveActionRule[]> {
  const root = path.join(projectRoot, SCRIPT_ROOT);
  const files = await findApexFiles(root);
  return Promise.all(files.map((filePath) => parseApexActionScript(filePath, projectRoot)));
}

export async function parseApexActionScript(filePath: string, projectRoot: string): Promise<WaveActionRule> {
  const source = await readFile(filePath, 'utf8');
  const matches = [...source.matchAll(ACTION_HEADER)];
  const relativePath = path.relative(projectRoot, filePath).split(path.sep).join('/');
  if (matches.length === 0) {
    throw new Error(`Apex action script is missing a smart-deployment-action header: ${relativePath}`);
  }
  if (matches.length > 1) {
    throw new Error(`Apex action script contains multiple smart-deployment-action headers: ${relativePath}`);
  }

  let header: unknown;
  try {
    header = JSON.parse(matches[0][1]);
  } catch (error) {
    throw new Error(
      `Invalid smart-deployment-action JSON in ${relativePath}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }

  return toWaveActionRule(header, relativePath);
}

function toWaveActionRule(value: unknown, script: string): WaveActionRule {
  if (!isObject(value)) throw new Error(`smart-deployment-action header must be an object: ${script}`);
  const id = readRequiredString(value.id, 'id', script);
  const phase = readRequiredString(value.phase, 'phase', script);
  if (phase !== 'before' && phase !== 'after') {
    throw new Error(`smart-deployment-action ${id} has invalid phase: ${phase}`);
  }
  if (!isObject(value.when)) throw new Error(`smart-deployment-action ${id} requires a when object: ${script}`);
  const when = parseSelector(value.when, id, script);
  const description =
    value.description === undefined ? undefined : readRequiredString(value.description, 'description', script);

  return {
    id,
    phase,
    when,
    action: {
      kind: 'apex-anonymous',
      script,
      ...(description === undefined ? {} : { description }),
    },
  };
}

function parseSelector(value: Record<string, unknown>, id: string, script: string): WaveActionSelector {
  const components = readOptionalStringArray(value.components, 'components', id, script);
  const types = readOptionalStringArray(value.types, 'types', id, script) as MetadataType[] | undefined;
  if ((components?.length ?? 0) === 0 && (types?.length ?? 0) === 0) {
    throw new Error(`smart-deployment-action ${id} must select components or types: ${script}`);
  }
  return {
    ...(components === undefined ? {} : { components }),
    ...(types === undefined ? {} : { types }),
  };
}

function readRequiredString(value: unknown, field: string, script: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`smart-deployment-action requires a non-empty ${field}: ${script}`);
  }
  return value.trim();
}

function readOptionalStringArray(value: unknown, field: string, id: string, script: string): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== 'string' || entry.trim().length === 0)) {
    throw new Error(`smart-deployment-action ${id} ${field} must be a non-empty string array: ${script}`);
  }
  return value.map((entry) => (entry as string).trim());
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function findApexFiles(root: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }

  const files = await Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => {
        const entryPath = path.join(root, entry.name);
        if (entry.isDirectory()) return findApexFiles(entryPath);
        return entry.isFile() && entry.name.toLowerCase().endsWith('.apex') ? [entryPath] : [];
      })
  );
  return files.flat().sort();
}
