import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { DynamicQueryTargetLookup } from './dynamic-query-target-validator.js';

const execFileAsync = promisify(execFile);

type SfDataQueryJson = {
  result?: {
    records?: unknown[];
  };
};

export class SfCliMetadataLookup implements DynamicQueryTargetLookup {
  public async hasCustomField(targetOrg: string, objectName: string, fieldName: string): Promise<boolean> {
    const query = [
      'SELECT QualifiedApiName',
      'FROM FieldDefinition',
      `WHERE EntityDefinition.QualifiedApiName = '${objectName}'`,
      `AND QualifiedApiName = '${fieldName}'`,
      'LIMIT 1',
    ].join(' ');
    const { stdout } = await execFileAsync('sf', [
      'data',
      'query',
      '--target-org',
      targetOrg,
      '--query',
      query,
      '--json',
    ]);
    const parsed = JSON.parse(stdout) as SfDataQueryJson;

    return (parsed.result?.records?.length ?? 0) > 0;
  }
}
