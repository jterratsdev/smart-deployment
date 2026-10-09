import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PostconditionPoller } from '../../src/deployment/postcondition-poller.js';
import { SfCliOrgQuery } from '../../src/deployment/sf-cli-org-query.js';
import { pollSharingModels, runLiveOwdHarness } from '../helpers/live-owd-harness.js';

const execute = promisify(execFile);
const live = process.env.SMART_DEPLOYMENT_LIVE_OWD === '1' ? describe : describe.skip;

live('live OWD propagation barrier', () => {
  it('mutates Case OWD, waits for propagation, deploys dependent rules, and restores the captured baseline', async function () {
    this.timeout(900_000);
    const targetOrg = required('SMART_DEPLOYMENT_LIVE_ORG');
    const role = required('SMART_DEPLOYMENT_LIVE_OWD_ROLE');
    expect(targetOrg.toLowerCase()).not.to.equal('cg-demo');
    expect(required('SMART_DEPLOYMENT_LIVE_OWD_ALLOW_MUTATION')).to.equal('I_APPROVE_DISPOSABLE_ORG_MUTATION');
    expect(required('SMART_DEPLOYMENT_LIVE_OWD_ALLOW_RESTORE')).to.equal('I_APPROVE_AUTOMATED_BASELINE_RESTORE');

    const workspace = await mkdtemp(path.join(tmpdir(), 'live-owd-barrier-'));
    const baseline = path.join(workspace, 'baseline');
    const transition = path.join(workspace, 'transition');
    const rules = path.join(workspace, 'rules');
    const query = new SfCliOrgQuery();
    const poller = new PostconditionPoller({
      query: (org, objectName) => query.getEntitySharingModels(org, objectName),
    });

    await runLiveOwdHarness({
      observe: async () => {
        const initial = await query.getEntitySharingModels(targetOrg, 'Case');
        if (initial.kind === 'observed') expect(initial.observation.internalSharingModel).to.equal('ReadWriteTransfer');
        return initial;
      },
      retrieveBaseline: async () => {
        await initializeProject(baseline);
        await sf(
          [
            'project',
            'retrieve',
            'start',
            '--metadata',
            'CustomObject:Case',
            '--metadata',
            'SharingRules:Case',
            '--target-org',
            targetOrg,
            '--json',
          ],
          baseline
        );
        return baseline;
      },
      deployTransition: async () => {
        await writeObjectProject(transition, 'Private');
        await deploySource(transition, targetOrg);
      },
      pollTransition: async () => assertInternalModel(poller, targetOrg, 'Private'),
      deployRules: async () => {
        await writeSharingRulesProject(rules, role);
        await deploySource(rules, targetOrg);
      },
      restore: async (sourceDir) => deploySourceDir(sourceDir, baseline, targetOrg),
      pollRestoration: async (expected) =>
        pollSharingModels(() => query.getEntitySharingModels(targetOrg, 'Case'), expected, {
          timeoutMs: 300_000,
          initialDelayMs: 1000,
          maximumDelayMs: 10_000,
        }),
      cleanup: async () => rm(workspace, { recursive: true, force: true }),
    });
  });
});

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required; refusing live mutation before baseline capture.`);
  return value;
}

async function sf(args: string[], cwd?: string): Promise<void> {
  const { stdout } = await execute('sf', args, { cwd, maxBuffer: 10 * 1024 * 1024 });
  const output = JSON.parse(stdout) as { status?: number };
  if (output.status !== 0) throw new Error('Salesforce CLI operation failed');
}

async function deploySource(projectRoot: string, targetOrg: string): Promise<void> {
  return deploySourceDir(path.join(projectRoot, 'force-app'), projectRoot, targetOrg);
}

async function deploySourceDir(sourceDir: string, projectRoot: string, targetOrg: string): Promise<void> {
  await sf(
    ['project', 'deploy', 'start', '--source-dir', sourceDir, '--target-org', targetOrg, '--wait', '20', '--json'],
    projectRoot
  );
  expect(sourceDir.startsWith(projectRoot)).to.equal(true);
}

async function assertInternalModel(
  poller: PostconditionPoller,
  targetOrg: string,
  internalSharingModel: string | undefined
): Promise<void> {
  if (!internalSharingModel) throw new Error('Expected internal sharing model is required for bounded polling.');
  const result = await poller.wait(
    targetOrg,
    {
      id: `owd:Case:${internalSharingModel}`,
      kind: 'owd-internal-sharing-model',
      objectName: 'Case',
      afterWaveNumber: 1,
      expectedInternalSharingModel: internalSharingModel,
    },
    { timeoutMs: 300_000, initialDelayMs: 1000, maximumDelayMs: 10_000 }
  );
  if (result.kind !== 'satisfied') {
    throw new Error(`Case sharing models did not reach the expected values (${result.postcondition.status}).`);
  }
}

async function initializeProject(root: string): Promise<void> {
  await mkdir(root, { recursive: true });
  await writeFile(
    path.join(root, 'sfdx-project.json'),
    JSON.stringify({ packageDirectories: [{ path: 'force-app', default: true }], sourceApiVersion: '67.0' })
  );
}

async function writeObjectProject(root: string, sharingModel: string): Promise<void> {
  await initializeProject(root);
  const directory = path.join(root, 'force-app/main/default/objects/Case');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'Case.object-meta.xml'),
    `<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><sharingModel>${sharingModel}</sharingModel></CustomObject>`
  );
}

async function writeSharingRulesProject(root: string, role: string): Promise<void> {
  await initializeProject(root);
  const directory = path.join(root, 'force-app/main/default/sharingRules');
  await mkdir(directory, { recursive: true });
  await writeFile(
    path.join(directory, 'Case.sharingRules-meta.xml'),
    `<SharingRules xmlns="http://soap.sforce.com/2006/04/metadata"><sharingOwnerRules><fullName>SmartDeploymentDisposableHarness</fullName><sharedFrom><role>${xml(
      role
    )}</role></sharedFrom><sharedTo><role>${xml(
      role
    )}</role></sharedTo><accessLevel>Read</accessLevel></sharingOwnerRules></SharingRules>`
  );
}

function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
