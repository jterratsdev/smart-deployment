import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { SharingModelQueryResult } from './deployment-postcondition.js';

const execFileAsync = promisify(execFile);

type QueryExecutor = (file: string, args: string[]) => Promise<{ stdout: string; stderr?: string }>;

type SfQueryOutput = {
  status?: number;
  message?: string;
  name?: string;
  result?: { records?: Array<{ InternalSharingModel?: unknown; ExternalSharingModel?: unknown }> };
};

type SfExecFailure = Error & { stdout?: string; stderr?: string; code?: string | number };

export class SfCliOrgQuery {
  public constructor(private readonly execute: QueryExecutor = execFileAsync) {}

  public async getEntitySharingModels(targetOrg: string, objectName: string): Promise<SharingModelQueryResult> {
    if (!isQualifiedApiName(objectName)) {
      return unavailable({ category: 'query', message: 'EntityDefinition QualifiedApiName is invalid' });
    }
    const query = [
      'SELECT InternalSharingModel, ExternalSharingModel',
      'FROM EntityDefinition',
      `WHERE QualifiedApiName = '${escapeSoqlLiteral(objectName)}'`,
      'LIMIT 2',
    ].join(' ');

    try {
      const { stdout } = await this.execute('sf', [
        'data',
        'query',
        '--use-tooling-api',
        '--target-org',
        targetOrg,
        '--query',
        query,
        '--json',
      ]);
      const output = JSON.parse(stdout) as SfQueryOutput;
      if (output.status && output.status !== 0) {
        return unavailable(classifyError(output.name, output.message));
      }
      const records = output.result?.records ?? [];
      if (records.length === 0) {
        return unavailable({ category: 'entity-not-found', message: 'EntityDefinition record was not found' });
      }
      if (records.length !== 1) {
        return unavailable({ category: 'invalid-response', message: 'EntityDefinition response was ambiguous' });
      }
      const record = records[0];
      return {
        kind: 'observed',
        observation: {
          internalSharingModel: asSanitizedModel(record?.InternalSharingModel),
          externalSharingModel: asSanitizedModel(record?.ExternalSharingModel),
        },
      };
    } catch (error) {
      const failure = error as SfExecFailure;
      const structured = parseFailureOutput(failure.stdout);
      return unavailable(
        classifyError(
          structured?.name ?? failure.code,
          `${structured?.message ?? failure.message} ${failure.stderr ?? ''}`
        )
      );
    }
  }
}

function parseFailureOutput(stdout: string | undefined): SfQueryOutput | undefined {
  if (!stdout) return undefined;
  try {
    return JSON.parse(stdout) as SfQueryOutput;
  } catch {
    return undefined;
  }
}

function unavailable(error: {
  category: 'authentication' | 'network' | 'query' | 'entity-not-found' | 'invalid-response';
  message: string;
}): SharingModelQueryResult {
  return { kind: 'unavailable', error };
}

function classifyError(
  name: unknown,
  detail: unknown
): { category: 'authentication' | 'network' | 'query'; message: string } {
  const normalized = `${String(name ?? '')} ${String(detail ?? '')}`.toLowerCase();
  const category = /auth|token|login|refresh|jwt|namedorgnotfound/.test(normalized)
    ? 'authentication'
    : /network|socket|econn|enotfound|timeout|timed out/.test(normalized)
    ? 'network'
    : 'query';
  return { category, message: `EntityDefinition ${category} unavailable` };
}

function isQualifiedApiName(value: string): boolean {
  return /^(?:[A-Za-z][A-Za-z0-9]*__)?[A-Za-z][A-Za-z0-9_]*$/.test(value);
}

function escapeSoqlLiteral(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
}

function asSanitizedModel(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z]+$/.test(value) ? value : undefined;
}
