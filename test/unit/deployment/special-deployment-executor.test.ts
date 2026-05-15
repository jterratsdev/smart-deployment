import { access, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { SpecialDeploymentPlanExecutor } from '../../../src/deployment/special-deployment-executor.js';
import type { SpecialDeploymentPlan } from '../../../src/deployment/special-deployment-plan.js';

function plan(projectRoot: string): SpecialDeploymentPlan {
  return {
    success: true,
    projectRoot,
    apiVersion: '66.0',
    dryRun: false,
    autoActivate: false,
    phases: [
      {
        kind: 'core-metadata',
        label: 'Phase 1: Core metadata deploy',
        components: ['ApexClass:AccountService'],
        commands: [
          {
            tool: 'sf',
            args: ['project', 'deploy', 'start', '--manifest', '<generated-core-manifest>'],
            reason: 'test',
          },
        ],
        skipped: false,
      },
      {
        kind: 'agentforce-publish',
        label: 'Phase 2: Agentforce authoring bundle publish',
        components: ['AiAuthoringBundle:SupportAgent'],
        commands: [
          {
            tool: 'sf',
            args: ['agent', 'publish', 'authoring-bundle', '-n', 'SupportAgent', '--skip-retrieve'],
            reason: 'test',
          },
        ],
        skipped: false,
      },
      {
        kind: 'agentforce-activate',
        label: 'Phase 3: Agentforce activation',
        components: [],
        commands: [],
        skipped: true,
        skipReason: 'Activation is disabled by default.',
      },
      {
        kind: 'community-publish',
        label: 'Phase 5: Experience Cloud community publish',
        components: [],
        commands: [],
        skipped: true,
        skipReason: 'No changed digitalExperiences/site directories detected.',
      },
    ],
    warnings: [],
    errors: [],
  };
}

describe('SpecialDeploymentPlanExecutor', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  it('executes non-skipped phases sequentially and records skipped phases', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-special-exec-'));
    const calls: string[] = [];
    const executor = new SpecialDeploymentPlanExecutor(async (command, cwd) => {
      calls.push(`${cwd}:${command.tool} ${command.args.join(' ')}`);
      return { stdout: 'ok', stderr: '' };
    });

    const result = await executor.execute(plan(tempDir));
    const manifestPath = path.join(tempDir, '.smart-deployment', 'ci-publish', 'core-metadata-package.xml');
    const manifest = await readFile(manifestPath, 'utf8');

    expect(result.success).to.equal(true);
    expect(result.completedPhases).to.deep.equal(['core-metadata', 'agentforce-publish']);
    expect(result.skippedPhases).to.deep.equal(['agentforce-activate', 'community-publish']);
    expect(calls).to.deep.equal([
      `${tempDir}:sf project deploy start --manifest ${manifestPath}`,
      `${tempDir}:sf agent publish authoring-bundle -n SupportAgent --skip-retrieve`,
    ]);
    expect(manifest).to.include('<members>AccountService</members>');
    expect(manifest).to.include('<name>ApexClass</name>');
  });

  it('stops at the first failed phase and reports the phase with exit code', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-special-exec-'));
    const calls: string[] = [];
    const executor = new SpecialDeploymentPlanExecutor(async (command) => {
      calls.push(command.args.join(' '));
      if (command.args.includes('publish')) {
        throw Object.assign(new Error('publish failed'), {
          code: 17,
          stderr: 'Agent publish failed',
        });
      }
      return { stdout: 'ok', stderr: '' };
    });

    const result = await executor.execute(plan(tempDir));
    const manifestPath = path.join(tempDir, '.smart-deployment', 'ci-publish', 'core-metadata-package.xml');

    expect(result.success).to.equal(false);
    expect(result.completedPhases).to.deep.equal(['core-metadata']);
    expect(result.failedPhase).to.equal('agentforce-publish');
    expect(result.exitCode).to.equal(17);
    expect(result.errors[0]).to.include('Phase 2: Agentforce authoring bundle publish failed with exit code 17');
    expect(calls).to.deep.equal([
      `project deploy start --manifest ${manifestPath}`,
      'agent publish authoring-bundle -n SupportAgent --skip-retrieve',
    ]);
  });

  it('runs deploy commands from a staging project that excludes forceignored files', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-special-exec-'));
    await writeProjectFile(tempDir);
    await writeNestedFile(
      tempDir,
      'force-app/main/default/classes/AccountService.cls',
      'public class AccountService {}'
    );
    await writeNestedFile(
      tempDir,
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json',
      '{"ignored":true}'
    );
    await writeFile(
      path.join(tempDir, '.forceignore'),
      'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/\n',
      'utf8'
    );

    const cwdValues: string[] = [];
    const executor = new SpecialDeploymentPlanExecutor(async (_command, cwd) => {
      cwdValues.push(cwd);
      await expectMissing(
        path.join(cwd, 'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json')
      );
      expect(await readFile(path.join(cwd, 'force-app/main/default/classes/AccountService.cls'), 'utf8')).to.include(
        'AccountService'
      );
      return { stdout: 'ok', stderr: '' };
    });

    const result = await executor.execute(plan(tempDir));

    expect(result.success).to.equal(true);
    expect(cwdValues[0]).to.not.equal(tempDir);
    expect(
      await readFile(
        path.join(
          tempDir,
          'force-app/main/default/digitalExperiences/site/PHP_Portal1/sfdc_cms__view/Privacy/view.json'
        ),
        'utf8'
      )
    ).to.equal('{"ignored":true}');
  });

  it('resolves Agentforce activation version from the preceding publish command', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-special-exec-'));
    const calls: string[] = [];
    const activationPlan = plan(tempDir);
    activationPlan.phases = [
      {
        kind: 'agentforce-publish',
        label: 'Phase 2: Agentforce authoring bundle publish',
        components: ['AiAuthoringBundle:SupportAgent'],
        commands: [
          {
            tool: 'sf',
            args: ['agent', 'publish', 'authoring-bundle', '-n', 'SupportAgent', '--skip-retrieve', '--json'],
            reason: 'test',
          },
        ],
        skipped: false,
      },
      {
        kind: 'agentforce-activate',
        label: 'Phase 3: Agentforce activation',
        components: ['AiAuthoringBundle:SupportAgent'],
        commands: [
          {
            tool: 'sf',
            args: ['agent', 'activate', '-n', 'SupportAgent', '--version', '<published-version:SupportAgent>'],
            reason: 'test',
          },
        ],
        skipped: false,
      },
    ];
    const executor = new SpecialDeploymentPlanExecutor(async (command) => {
      calls.push(command.args.join(' '));
      if (command.args.includes('publish')) {
        return { stdout: JSON.stringify({ result: { versionNumber: 12 } }), stderr: '' };
      }
      return { stdout: 'ok', stderr: '' };
    });

    const result = await executor.execute(activationPlan);

    expect(result.success).to.equal(true);
    expect(calls).to.deep.equal([
      'agent publish authoring-bundle -n SupportAgent --skip-retrieve --json',
      'agent activate -n SupportAgent --version 12',
    ]);
  });

  it('fails activation when the publish output does not include a version', async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), 'smart-deployment-special-exec-'));
    const activationPlan = plan(tempDir);
    activationPlan.phases = [
      {
        kind: 'agentforce-activate',
        label: 'Phase 3: Agentforce activation',
        components: ['AiAuthoringBundle:SupportAgent'],
        commands: [
          {
            tool: 'sf',
            args: ['agent', 'activate', '-n', 'SupportAgent', '--version', '<published-version:SupportAgent>'],
            reason: 'test',
          },
        ],
        skipped: false,
      },
    ];
    const executor = new SpecialDeploymentPlanExecutor(async () => ({ stdout: 'ok', stderr: '' }));

    const result = await executor.execute(activationPlan);

    expect(result.success).to.equal(false);
    expect(result.failedPhase).to.equal('agentforce-activate');
    expect(result.errors[0]).to.include('Published Agentforce version for "SupportAgent" is not available');
  });
});

async function writeProjectFile(projectRoot: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify({
      packageDirectories: [{ path: 'force-app', default: true }],
      sourceApiVersion: '66.0',
    }),
    'utf8'
  );
}

async function writeNestedFile(projectRoot: string, relativePath: string, content: string): Promise<void> {
  const filePath = path.join(projectRoot, relativePath);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content, 'utf8');
}

async function expectMissing(filePath: string): Promise<void> {
  try {
    await access(filePath);
    throw new Error(`${filePath} exists`);
  } catch (error) {
    if (error instanceof Error && error.message.endsWith('exists')) {
      throw error;
    }
  }
}
