import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { describe, it } from 'mocha';

const execute = promisify(execFile);
const live = process.env.SMART_DEPLOYMENT_LIVE_SCOPE === '1' ? describe : describe.skip;
const targetOrg = 'cg-demo';

live('isolated live commit scope', () => {
  it('deploys only the scoped SD_ class and removes it afterward', async function () {
    this.timeout(900_000);
    expect(process.env.SMART_DEPLOYMENT_LIVE_SCOPE_APPROVAL).to.equal('I_APPROVE_CG_DEMO_SD_CREATE_DELETE');
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12);
    const unrelated = `SD_ScopeOther_${suffix}`;
    const selected = `SD_ScopeTarget_${suffix}`;
    const workspace = await mkdtemp(path.join(tmpdir(), 'sd-scope-'));
    let baselineVerified = false;
    let cleanupVerified = false;
    let primaryError: unknown;

    try {
      expect(await classCount(selected)).to.equal(0);
      expect(await classCount(unrelated)).to.equal(0);
      baselineVerified = true;
      await writeFile(
        path.join(workspace, 'sfdx-project.json'),
        JSON.stringify({
          packageDirectories: [{ path: 'force-app', default: true }],
          sourceApiVersion: '67.0',
        })
      );
      await run('git', ['init', '-q'], workspace);
      await writeClass(workspace, unrelated);
      await run('git', ['add', 'force-app', 'sfdx-project.json'], workspace);
      await run(
        'git',
        [
          '-c',
          'user.name=Scope Probe',
          '-c',
          'user.email=scope-probe@example.invalid',
          'commit',
          '-qm',
          'Add isolated baseline class',
        ],
        workspace
      );
      await writeClass(workspace, selected);
      await run('git', ['add', 'force-app'], workspace);
      await run(
        'git',
        [
          '-c',
          'user.name=Scope Probe',
          '-c',
          'user.email=scope-probe@example.invalid',
          'commit',
          '-qm',
          'Add scoped class',
        ],
        workspace
      );
      const { stdout: commit } = await run('git', ['rev-parse', 'HEAD'], workspace);
      const scoped = [`ApexClass:${selected}`];
      const args = [
        'smart-deployment',
        'start',
        '--source-path',
        workspace,
        '--target-org',
        targetOrg,
        '--scope-commits',
        commit.trim(),
        '--json',
      ];
      const validation = await sf([...args, '--validate-only']);
      expect(validation.result?.commitScope?.includedComponents).to.deep.equal(scoped);
      expect(validation.result?.commitScope?.changedComponents).to.deep.equal(scoped);
      expect(await classCount(selected)).to.equal(0);
      expect(await classCount(unrelated)).to.equal(0);

      const deployment = await sf([...args, '--skip-tests']);
      expect(deployment.result?.commitScope?.includedComponents).to.deep.equal(scoped);
      expect(deployment.result?.outcome).to.equal('completed');
      expect(await classCount(selected)).to.equal(1);
      expect(await classCount(unrelated)).to.equal(0);
    } catch (error) {
      primaryError = error;
    }

    try {
      if (baselineVerified) {
        const counts = await Promise.all([classCount(selected), classCount(unrelated)]);
        if (counts.some((count) => count > 1)) throw new Error('Ambiguous temporary Apex class identity');
        await Promise.all(
          [selected, unrelated]
            .filter((_, index) => counts[index] === 1)
            .map((name) =>
              sf(
                [
                  'project',
                  'delete',
                  'source',
                  '--metadata',
                  `ApexClass:${name}`,
                  '--target-org',
                  targetOrg,
                  '--no-prompt',
                  '--json',
                ],
                workspace
              )
            )
        );
      }
      cleanupVerified = baselineVerified && (await classCount(selected)) === 0 && (await classCount(unrelated)) === 0;
      if (!cleanupVerified) throw new Error('Temporary Apex class cleanup could not be verified');
    } catch (error) {
      primaryError = primaryError
        ? new AggregateError([primaryError, error], `Scope probe failed and cleanup is unverified: ${workspace}`)
        : new Error(`Scope probe cleanup is unverified: ${workspace}`, { cause: error });
    }
    if (cleanupVerified) await rm(workspace, { recursive: true, force: true });
    if (primaryError) throw primaryError;
  });
});

async function writeClass(root: string, name: string): Promise<void> {
  const directory = path.join(root, 'force-app/main/default/classes');
  await mkdir(directory, { recursive: true });
  await writeFile(path.join(directory, `${name}.cls`), `public class ${name} {}\n`);
  await writeFile(
    path.join(directory, `${name}.cls-meta.xml`),
    '<?xml version="1.0" encoding="UTF-8"?><ApexClass xmlns="http://soap.sforce.com/2006/04/metadata"><apiVersion>67.0</apiVersion><status>Active</status></ApexClass>'
  );
}

async function classCount(name: string): Promise<number> {
  const result = await sf([
    'data',
    'query',
    '--use-tooling-api',
    '--target-org',
    targetOrg,
    '--query',
    `SELECT Name FROM ApexClass WHERE Name = '${name}' LIMIT 2`,
    '--json',
  ]);
  const records = result.result?.records;
  if (!Array.isArray(records)) throw new Error('Unable to verify temporary Apex class identity');
  return records.filter((record) => record.Name === name).length;
}

async function sf(
  args: string[],
  cwd?: string
): Promise<{
  result?: {
    records?: Array<{ Name?: string }>;
    outcome?: string;
    commitScope?: { includedComponents?: string[]; changedComponents?: string[] };
  };
}> {
  const { stdout } = await run('sf', args, cwd);
  type Output = {
    status?: number;
    result?: {
      records?: Array<{ Name?: string }>;
      outcome?: string;
      commitScope?: { includedComponents?: string[]; changedComponents?: string[] };
    };
  };
  const lines = stdout.trim().split('\n');
  let output: Output | undefined;
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    if (!lines[index].trimStart().startsWith('{')) continue;
    try {
      const candidate = JSON.parse(lines.slice(index).join('\n')) as Output;
      if ('result' in candidate) {
        output = candidate;
        break;
      }
    } catch {
      // The plugin emits structured logs before its final JSON result.
    }
  }
  if (!output) throw new Error('Salesforce CLI did not return a result document');
  if (output.status !== 0) throw new Error(`Salesforce CLI returned status ${output.status}`);
  return output;
}

async function run(command: string, args: string[], cwd?: string): Promise<{ stdout: string }> {
  return execute(command, args, { cwd, maxBuffer: 10 * 1024 * 1024 });
}
