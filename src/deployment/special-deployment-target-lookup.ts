import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export type SpecialDeploymentTargetLookup = {
  hasEvaluationSubject(targetOrg: string, subjectName: string): Promise<boolean>;
};

type SfMetadataListJson = {
  result?: Array<{
    fullName?: string;
    fileName?: string;
  }>;
};

const EVALUATION_SUBJECT_METADATA_TYPES = ['AiAuthoringBundle', 'Bot'] as const;

export class SfCliSpecialDeploymentTargetLookup implements SpecialDeploymentTargetLookup {
  public async hasEvaluationSubject(targetOrg: string, subjectName: string): Promise<boolean> {
    const lookups = await Promise.all(
      EVALUATION_SUBJECT_METADATA_TYPES.map(async (metadataType) =>
        this.metadataExists(targetOrg, metadataType, subjectName)
      )
    );
    return lookups.some(Boolean);
  }

  private async metadataExists(targetOrg: string, metadataType: string, fullName: string): Promise<boolean> {
    const { stdout } = await execFileAsync('sf', [
      'org',
      'list',
      'metadata',
      '--metadata-type',
      metadataType,
      '--target-org',
      targetOrg,
      '--json',
    ]);
    const parsed = JSON.parse(stdout) as SfMetadataListJson;
    const records = parsed.result ?? [];

    return records.some((record) => record.fullName === fullName || record.fileName?.endsWith(`/${fullName}`));
  }
}
