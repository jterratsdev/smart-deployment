/**
 * smart-deployment:config command - US-051
 *
 * @ac US-051-AC-1: Set Agentforce configuration
 * @ac US-051-AC-2: Set default test level
 * @ac US-051-AC-3: Set timeout values
 * @ac US-051-AC-4: Set retry strategies
 * @ac US-051-AC-5: Save configuration to file
 * @ac US-051-AC-6: Validate configuration
 * @issue #51
 */

import { Flags, SfCommand } from '@salesforce/sf-plugins-core';
import fs from 'node:fs/promises';
import path from 'node:path';
import { getLogger } from '../../utils/logger.js';
import { initializeI18n } from '../../i18n/i18n-service.js';
import type { SupportedLocale } from '../../i18n/locale-detector.js';

const logger = getLogger('ConfigCommand');

export const CONFIG_FILE = '.smart-deployment.json';

const TEST_LEVELS = ['NoTestRun', 'RunLocalTests', 'RunSpecifiedTests', 'RunAllTestsInOrg'];

// These entries are supported even when they are not present in older config files.
const COMPATIBLE_KEYS: Record<string, (value: string) => unknown> = {
  'ai.apiKey': (value) => value,
  'deployment.timeout': parseNonNegativeNumber,
  'deployment.retry.maxAttempts': parsePositiveInteger,
};

function parseNonNegativeNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('must be a non-negative number');
  return parsed;
}

function parsePositiveInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error('must be a positive integer');
  return parsed;
}

function parseValue(key: string, value: string, current: unknown): unknown {
  if (COMPATIBLE_KEYS[key]) return COMPATIBLE_KEYS[key](value);
  if (typeof current === 'boolean') {
    if (value !== 'true' && value !== 'false') throw new Error('must be true or false');
    return value === 'true';
  }
  if (typeof current === 'number') return parseNonNegativeNumber(value);
  if (key === 'deployment.testLevel') {
    if (!TEST_LEVELS.includes(value)) throw new Error(`must be one of ${TEST_LEVELS.join(', ')}`);
    return value;
  }
  if (typeof current === 'string') {
    if (!value.trim()) throw new Error('must not be empty');
    return value;
  }
  throw new Error('has no supported value type');
}

function getValue(config: Record<string, unknown>, key: string): unknown {
  return key.split('.').reduce<unknown>((value, segment) => {
    if (!value || typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, segment)) return undefined;
    return (value as Record<string, unknown>)[segment];
  }, config);
}

function setValue(config: Record<string, unknown>, key: string, value: unknown): void {
  const segments = key.split('.');
  let target = config;
  for (const segment of segments.slice(0, -1)) {
    const existing = target[segment];
    if (existing === undefined) target[segment] = {};
    else if (!existing || typeof existing !== 'object' || Array.isArray(existing))
      throw new Error(`Cannot set nested key '${key}'`);
    target = target[segment] as Record<string, unknown>;
  }
  target[segments[segments.length - 1]] = value;
}

async function readConfig(filePath: string): Promise<Record<string, unknown>> {
  try {
    const contents = await fs.readFile(filePath, 'utf8');
    const parsed: unknown = JSON.parse(contents);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      throw new Error('configuration root must be an object');
    return parsed as Record<string, unknown>;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') throw new Error(`Configuration file not found: ${filePath}`);
    if (error instanceof SyntaxError) throw new Error(`Invalid JSON in configuration file '${filePath}'`);
    throw new Error(
      `Failed to read configuration file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

async function writeConfig(filePath: string, config: Record<string, unknown>): Promise<void> {
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
  } catch (error) {
    throw new Error(
      `Failed to write configuration file '${filePath}': ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function parseSetExpression(expression: string): [string, string] {
  const separator = expression.indexOf('=');
  if (separator <= 0) throw new Error('--set must use the format key=value');
  const key = expression.slice(0, separator).trim();
  const value = expression.slice(separator + 1).trim();
  if (!key || !value) throw new Error('--set requires both a key and a value');
  if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(key))
    throw new Error(`Invalid configuration key '${key}'`);
  return [key, value];
}

export default class Config extends SfCommand<{ success: boolean }> {
  public static readonly summary = 'Manage deployment configuration';
  public static readonly flags = {
    set: Flags.string({ summary: 'Set config key=value', char: 's' }),
    get: Flags.string({ summary: 'Get config key', char: 'g' }),
    locale: Flags.string({
      summary: 'Language locale (en, es, fr, de, pt, ja)',
      description: 'Override locale detection. Default: auto-detect from environment',
      options: ['en', 'es', 'fr', 'de', 'pt', 'ja'],
    }),
  };

  public async run(): Promise<{ success: boolean }> {
    const { flags } = await this.parse(Config);

    // Initialize i18n
    initializeI18n({
      locale: flags.locale as SupportedLocale | undefined,
      autoTranslate: true,
    });

    if (flags.set && flags.get) throw new Error('Use either --set or --get, not both');
    if (!flags.set && !flags.get) throw new Error('One of --set or --get is required');

    const filePath = path.resolve(process.cwd(), CONFIG_FILE);
    let config: Record<string, unknown>;
    try {
      config = await readConfig(filePath);
    } catch (error) {
      // A first --set can bootstrap the project-level configuration file.
      if (!flags.set || !(error instanceof Error) || !error.message.startsWith('Configuration file not found:'))
        throw error;
      config = { $schema: './schemas/config.schema.json', version: '1.0' };
    }
    logger.info('Managing config', { flags, filePath });

    if (flags.get) {
      if (!/^[A-Za-z][A-Za-z0-9]*(?:\.[A-Za-z][A-Za-z0-9]*)*$/.test(flags.get))
        throw new Error(`Invalid configuration key '${flags.get}'`);
      const value = getValue(config, flags.get);
      if (value === undefined) throw new Error(`Configuration key not found: ${flags.get}`);
      this.log(typeof value === 'string' ? value : JSON.stringify(value));
      return { success: true };
    }

    const setExpression = flags.set;
    if (!setExpression) throw new Error('One of --set or --get is required');
    const [key, rawValue] = parseSetExpression(setExpression);
    const current = getValue(config, key);
    if (current === undefined && !COMPATIBLE_KEYS[key]) throw new Error(`Unknown configuration key: ${key}`);
    let value: unknown;
    try {
      value = parseValue(key, rawValue, current);
    } catch (error) {
      throw new Error(`Invalid value for '${key}': ${error instanceof Error ? error.message : String(error)}`);
    }
    setValue(config, key, value);
    await writeConfig(filePath, config);
    this.log(`Configuration updated: ${key}`);
    return { success: true };
  }
}
