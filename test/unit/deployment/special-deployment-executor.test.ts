import { expect } from 'chai';
import { describe, it } from 'mocha';
import { SpecialDeploymentPlanExecutor } from '../../../src/deployment/special-deployment-executor.js';
import type { SpecialDeploymentPlan } from '../../../src/deployment/special-deployment-plan.js';

function plan(): SpecialDeploymentPlan {
  return {
    success: true,
    projectRoot: '/tmp/project',
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
  it('executes non-skipped phases sequentially and records skipped phases', async () => {
    const calls: string[] = [];
    const executor = new SpecialDeploymentPlanExecutor(async (command, cwd) => {
      calls.push(`${cwd}:${command.tool} ${command.args.join(' ')}`);
      return { stdout: 'ok', stderr: '' };
    });

    const result = await executor.execute(plan());

    expect(result.success).to.equal(true);
    expect(result.completedPhases).to.deep.equal(['core-metadata', 'agentforce-publish']);
    expect(result.skippedPhases).to.deep.equal(['community-publish']);
    expect(calls).to.deep.equal([
      '/tmp/project:sf project deploy start --manifest <generated-core-manifest>',
      '/tmp/project:sf agent publish authoring-bundle -n SupportAgent --skip-retrieve',
    ]);
  });

  it('stops at the first failed phase and reports the phase with exit code', async () => {
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

    const result = await executor.execute(plan());

    expect(result.success).to.equal(false);
    expect(result.completedPhases).to.deep.equal(['core-metadata']);
    expect(result.failedPhase).to.equal('agentforce-publish');
    expect(result.exitCode).to.equal(17);
    expect(result.errors[0]).to.include('Phase 2: Agentforce authoring bundle publish failed with exit code 17');
    expect(calls).to.deep.equal([
      'project deploy start --manifest <generated-core-manifest>',
      'agent publish authoring-bundle -n SupportAgent --skip-retrieve',
    ]);
  });
});
