import { execFile } from 'node:child_process';
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { SfCliOrgQuery } from '../../src/deployment/sf-cli-org-query.js';
import { PostconditionPoller } from '../../src/deployment/postcondition-poller.js';

const execute = promisify(execFile);
const live = process.env.SMART_DEPLOYMENT_LIVE_ISOLATED_OWD === '1' ? describe : describe.skip;
const targetOrg = 'cg-demo';

live('isolated live OWD barrier', () => {
  it('observes a temporary object transition before deploying its sharing rule, then removes it', async function () {
    this.timeout(900_000);
    expect(process.env.SMART_DEPLOYMENT_LIVE_ISOLATED_OWD_APPROVAL).to.equal('I_APPROVE_CG_DEMO_OBJECT_CREATE_DELETE');
    const name = `SD_OwdProbe_${randomUUID().replaceAll('-', '').slice(0, 12)}__c`;
    const workspace = await mkdtemp(path.join(tmpdir(), 'sd-isolated-owd-'));
    const query = new SfCliOrgQuery();
    let cleanupVerified = false;
    let primaryError: unknown;
    try {
      expect(await objectCount(name)).to.equal(0);
      await writeProject(workspace, name, 'ReadWrite');
      await sf(
        [
          'project',
          'deploy',
          'start',
          '--source-dir',
          'force-app',
          '--target-org',
          targetOrg,
          '--wait',
          '20',
          '--json',
        ],
        workspace
      );
      expect(await objectCount(name)).to.equal(1);
      await waitFor(query, name, 'ReadWrite');

      await writeProject(workspace, name, 'Private');
      await sf(
        [
          'project',
          'deploy',
          'start',
          '--source-dir',
          'force-app',
          '--target-org',
          targetOrg,
          '--wait',
          '20',
          '--json',
        ],
        workspace
      );
      await waitFor(query, name, 'Private');
      await writeRule(workspace, name);
      await sf(
        [
          'project',
          'deploy',
          'start',
          '--source-dir',
          'force-app/main/default/sharingRules',
          '--target-org',
          targetOrg,
          '--wait',
          '20',
          '--json',
        ],
        workspace
      );
    } catch (error) {
      primaryError = error;
    }
    try {
      const count = await objectCount(name);
      if (count === 1) {
        await sf(
          [
            'project',
            'delete',
            'source',
            '--metadata',
            `CustomObject:${name}`,
            '--target-org',
            targetOrg,
            '--no-prompt',
            '--json',
          ],
          workspace
        );
      } else if (count !== 0) {
        throw new Error('Temporary object identity is ambiguous; refusing cleanup deletion');
      }
      cleanupVerified = (await objectCount(name)) === 0;
      if (!cleanupVerified) throw new Error('Temporary object cleanup could not be verified');
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError(
            [primaryError, error],
            `OWD probe failed and cleanup could not be verified; workspace: ${workspace}`
          )
        : new Error(`OWD probe cleanup could not be verified; workspace: ${workspace}`, { cause: error });
    }
    if (cleanupVerified) await rm(workspace, { recursive: true, force: true });
    if (primaryError) throw primaryError;
  });

  it('runs the linked plugin across an isolated OWD barrier and resumes a paused postcondition', async function () {
    this.timeout(900_000);
    expect(process.env.SMART_DEPLOYMENT_LIVE_ISOLATED_OWD_APPROVAL).to.equal('I_APPROVE_CG_DEMO_OBJECT_CREATE_DELETE');
    const name = `SD_OwdProbe_${randomUUID().replaceAll('-', '').slice(0, 12)}__c`;
    const workspace = await mkdtemp(path.join(tmpdir(), 'sd-plugin-owd-'));
    const query = new SfCliOrgQuery();
    let cleanupVerified = false;
    let primaryError: unknown;
    try {
      expect(await objectCount(name)).to.equal(0);
      await writeProject(workspace, name, 'ReadWrite');
      await sf(
        [
          'project',
          'deploy',
          'start',
          '--source-dir',
          'force-app',
          '--target-org',
          targetOrg,
          '--wait',
          '20',
          '--json',
        ],
        workspace
      );
      await waitFor(query, name, 'ReadWrite');
      await writeProject(workspace, name, 'Private');
      await writeRule(workspace, name);
      await writeFile(
        path.join(workspace, '.smart-deployment.json'),
        JSON.stringify({
          owdBarrier: { timeoutMs: 1, initialDelayMs: 1, maximumDelayMs: 1 },
        })
      );

      await plugin([
        'smart-deployment',
        'start',
        '--source-path',
        workspace,
        '--target-org',
        targetOrg,
        '--validate-only',
        '--json',
      ]);
      const start = await plugin([
        'smart-deployment',
        'start',
        '--source-path',
        workspace,
        '--target-org',
        targetOrg,
        '--skip-tests',
        '--json',
      ]);
      const startResult = start.result as { outcome?: string; postcondition?: { objectName?: string } } | undefined;
      expect(startResult?.outcome).to.equal('paused');
      expect(startResult?.postcondition?.objectName).to.equal(name);
      const statePath = path.join(workspace, '.smart-deployment/deployment-state.json');
      const state = JSON.parse(await readFile(statePath, 'utf8')) as {
        completedWaves: number[];
        execution?: { nextExecutionIndex: number };
        pausedPostcondition?: { objectName: string; status: string; attempts: number };
      };
      expect(state.pausedPostcondition?.objectName).to.equal(name);
      expect(state.pausedPostcondition?.status).to.equal('timed-out');
      expect(state.completedWaves).to.have.length.greaterThan(0);
      expect(state.execution?.nextExecutionIndex).to.equal(state.completedWaves.length);
      await waitFor(query, name, 'Private');
      const resumed = await plugin([
        'smart-deployment',
        'resume',
        '--source-path',
        workspace,
        '--target-org',
        targetOrg,
        '--json',
      ]);
      const resumeResult = resumed.result as
        | {
            outcome?: string;
            postconditions?: Array<{ objectName: string; status: string; attempts: number }>;
            releaseReport?: { postconditions?: Array<{ objectName: string; status: string }> };
          }
        | undefined;
      expect(resumeResult?.outcome).to.equal('completed');
      const satisfied = resumeResult?.postconditions?.find((condition) => condition.objectName === name);
      expect(satisfied?.status).to.equal('satisfied');
      expect(satisfied?.attempts).to.be.greaterThan(state.pausedPostcondition?.attempts ?? 0);
      expect(
        resumeResult?.releaseReport?.postconditions?.some(
          (condition) => condition.objectName === name && condition.status === 'satisfied'
        )
      ).to.equal(true);
      try {
        await access(statePath);
        throw new Error('Completed resume retained a deployment checkpoint');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await waitFor(query, name, 'Private');
      expect(await objectCount(name)).to.equal(1);
    } catch (error) {
      primaryError = error;
    }
    try {
      const count = await objectCount(name);
      if (count === 1) {
        await sf(
          [
            'project',
            'delete',
            'source',
            '--metadata',
            `CustomObject:${name}`,
            '--target-org',
            targetOrg,
            '--no-prompt',
            '--json',
          ],
          workspace
        );
      } else if (count !== 0) {
        throw new Error('Temporary object identity is ambiguous; refusing cleanup deletion');
      }
      cleanupVerified = (await objectCount(name)) === 0;
      if (!cleanupVerified) throw new Error('Temporary object cleanup could not be verified');
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError(
            [primaryError, error],
            `Plugin OWD probe failed and cleanup is unverified; workspace: ${workspace}`
          )
        : new Error(`Plugin OWD probe cleanup unverified; workspace: ${workspace}`, { cause: error });
    }
    if (cleanupVerified) await rm(workspace, { recursive: true, force: true });
    if (primaryError) throw primaryError;
  });
});

async function objectCount(name: string): Promise<number> {
  const output = await sf([
    'data',
    'query',
    '--use-tooling-api',
    '--target-org',
    targetOrg,
    '--query',
    `SELECT QualifiedApiName FROM EntityDefinition WHERE QualifiedApiName = '${name}' LIMIT 2`,
    '--json',
  ]);
  const records = output.result?.records;
  if (!Array.isArray(records)) throw new Error('Unable to verify temporary object identity');
  return records.filter((record) => record.QualifiedApiName === name).length;
}

async function waitFor(query: SfCliOrgQuery, name: string, expected: string): Promise<void> {
  const poller = new PostconditionPoller({ query: (org, objectName) => query.getEntitySharingModels(org, objectName) });
  const result = await poller.wait(
    targetOrg,
    {
      id: `owd:${name}:${expected}`,
      kind: 'owd-internal-sharing-model',
      objectName: name,
      afterWaveNumber: 1,
      expectedInternalSharingModel: expected,
    },
    { timeoutMs: 300_000, initialDelayMs: 1000, maximumDelayMs: 10_000 }
  );
  if (result.kind !== 'satisfied') throw new Error(`Temporary object OWD did not reach ${expected}`);
}

async function writeProject(root: string, name: string, sharingModel: string): Promise<void> {
  const objectDir = path.join(root, 'force-app/main/default/objects', name);
  await mkdir(objectDir, { recursive: true });
  await writeFile(
    path.join(root, 'sfdx-project.json'),
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '67.0',
    })
  );
  await writeFile(
    path.join(objectDir, `${name}.object-meta.xml`),
    `<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><label>SD OWD Probe</label><pluralLabel>SD OWD Probes</pluralLabel><nameField><label>Probe Name</label><type>Text</type></nameField><deploymentStatus>Deployed</deploymentStatus><sharingModel>${sharingModel}</sharingModel></CustomObject>`
  );
}

async function writeRule(root: string, name: string): Promise<void> {
  const directory = path.join(root, 'force-app/main/default/sharingRules');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, `${name}.sharingRules-meta.xml`),
    '<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingOwnerRules><fullName>SD_OwdProbeRule</fullName><label>SD OWD Probe Rule</label><sharedFrom><role>AdminRoleFromQuickstart</role></sharedFrom><sharedTo><role>BDDirector</role></sharedTo><accessLevel>Read</accessLevel></sharingOwnerRules></SharingRules>'
  );
}

async function sf(
  args: string[],
  cwd?: string
): Promise<{ status?: number; result?: { records?: Array<{ QualifiedApiName?: string }> | undefined } | undefined }> {
  let stdout: string;
  try {
    ({ stdout } = await execute('sf', args, { cwd, maxBuffer: 10 * 1024 * 1024 }));
  } catch (error) {
    const failure = error as Error & { stdout?: string };
    const output = failure.stdout
      ? (JSON.parse(failure.stdout) as {
          result?: { details?: { componentFailures?: Array<{ fullName?: string; problem?: string }> } };
        })
      : undefined;
    const problems = output?.result?.details?.componentFailures?.map(
      (item) => `${item.fullName ?? 'unknown'}: ${item.problem ?? 'unknown problem'}`
    );
    throw new Error(`Salesforce CLI operation failed: ${problems?.join('; ') ?? 'no component failure details'}`, {
      cause: error,
    });
  }
  const output = JSON.parse(stdout) as { status?: number; result?: { records?: Array<{ QualifiedApiName?: string }> } };
  if (output.status !== 0) throw new Error('Salesforce CLI operation failed');
  return output;
}

async function plugin(args: string[]): Promise<{ result?: unknown }> {
  try {
    const { stdout } = await execute('sf', args, { maxBuffer: 10 * 1024 * 1024 });
    return parsePluginOutput(stdout);
  } catch (error) {
    const failure = error as Error & { stdout?: string };
    if (failure.stdout) {
      const output = parsePluginOutput(failure.stdout) as { result?: { outcome?: string } };
      if (output.result?.outcome === 'paused') return output;
    }
    throw error;
  }
}

function parsePluginOutput(stdout: string): { result?: unknown } {
  const lines = stdout.trim().split('\n');
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].trimStart().startsWith('{')) continue;
    try {
      const parsed = JSON.parse(lines.slice(index).join('\n')) as { result?: unknown };
      if ('result' in parsed) return parsed;
    } catch {
      // The CLI also prints structured log lines before its final JSON document.
    }
  }
  throw new Error('Plugin did not return a parseable result document');
}
