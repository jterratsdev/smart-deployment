import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
    expect(result.skippedPhases).to.deep.equal(['community-publish']);
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
});
