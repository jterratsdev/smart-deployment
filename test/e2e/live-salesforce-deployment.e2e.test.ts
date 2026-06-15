import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';

const execFileAsync = promisify(execFile);
const LIVE_TARGET_ORG = process.env.SMART_DEPLOYMENT_LIVE_TARGET_ORG;
const maybeLiveIt = LIVE_TARGET_ORG ? it : it.skip;

type DeployValidateResult = {
  result?: {
    id?: string;
    status?: string;
    success?: boolean;
    done?: boolean;
  };
  data?: {
    deployId?: string;
  };
};

describe('E2E: live Salesforce deployment validation - issue 198', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  maybeLiveIt('validates metadata and can report the remote deployment job', async () => {
    const targetOrg = LIVE_TARGET_ORG ?? '';
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-live-e2e-'));
    const objectDir = path.join(tempDir, 'force-app/main/default/objects/Issue198LiveValidation__c');
    await mkdir(objectDir, { recursive: true });
    await writeFile(
      path.join(tempDir, 'sfdx-project.json'),
      JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '61.0' }, null, 2),
      'utf8'
    );
    await writeFile(path.join(tempDir, '.forceignore'), '', 'utf8');
    await writeFile(
      path.join(objectDir, 'Issue198LiveValidation__c.object-meta.xml'),
      [
        '<?xml version="1.0" encoding="UTF-8"?>',
        '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata">',
        '  <deploymentStatus>Deployed</deploymentStatus>',
        '  <label>Issue 198 Live Validation</label>',
        '  <pluralLabel>Issue 198 Live Validations</pluralLabel>',
        '  <nameField>',
        '    <label>Name</label>',
        '    <type>Text</type>',
        '  </nameField>',
        '  <sharingModel>ReadWrite</sharingModel>',
        '</CustomObject>',
        '',
      ].join('\n'),
      'utf8'
    );

    const validate = await runSfJson(
      [
        'project',
        'deploy',
        'validate',
        '--source-dir',
        'force-app',
        '--target-org',
        targetOrg,
        '--json',
        '--wait',
        '10',
      ],
      tempDir
    );
    const deployId = validate.result?.id ?? validate.data?.deployId;

    expect(deployId).to.be.a('string').and.not.empty;

    const report = await runSfJson(
      ['project', 'deploy', 'report', '--job-id', deployId!, '--target-org', targetOrg, '--json'],
      tempDir
    );

    expect(report.result?.id).to.equal(deployId);
    expect(report.result?.done).to.equal(true);
  });
});

async function runSfJson(args: string[], cwd: string): Promise<DeployValidateResult> {
  try {
    const { stdout } = await execFileAsync('sf', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
    return JSON.parse(stdout) as DeployValidateResult;
  } catch (error) {
    const failure = error as Error & { stdout?: string };
    if (failure.stdout) {
      return JSON.parse(failure.stdout) as DeployValidateResult;
    }

    throw error;
  }
}
