import { mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import CiPublish from '../../../src/commands/ci-publish.js';
import { SpecialDeploymentPlanExecutor } from '../../../src/deployment/special-deployment-executor.js';
import {
  SpecialDeploymentPlanService,
  type SpecialDeploymentPlan,
} from '../../../src/deployment/special-deployment-plan.js';

type ParseResult = {
  flags: Record<string, unknown>;
  args: Record<string, unknown>;
  argv: string[];
  raw: unknown[];
  metadata: {
    flags: Record<string, unknown>;
    args: Record<string, unknown>;
  };
  nonExistentFlags: string[];
  _runtime: unknown;
};

type CiPublishCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  warn: (message?: string | Error) => void;
  error: (message: string) => never;
};

function plan(overrides: Partial<SpecialDeploymentPlan> = {}): SpecialDeploymentPlan {
  return {
    success: true,
    projectRoot: '/tmp/sfdx-project',
    apiVersion: '66.0',
    since: 'abc123',
    dryRun: true,
    autoActivate: false,
    phases: [
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
    ],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('CiPublishCommand', () => {
  const originalBuildPlan = Object.getOwnPropertyDescriptor(SpecialDeploymentPlanService.prototype, 'buildPlan')
    ?.value as typeof SpecialDeploymentPlanService.prototype.buildPlan | undefined;
  const originalExecute = Object.getOwnPropertyDescriptor(SpecialDeploymentPlanExecutor.prototype, 'execute')?.value as
    | typeof SpecialDeploymentPlanExecutor.prototype.execute
    | undefined;

  afterEach(() => {
    Object.defineProperty(SpecialDeploymentPlanService.prototype, 'buildPlan', {
      value: originalBuildPlan,
      writable: true,
    });
    Object.defineProperty(SpecialDeploymentPlanExecutor.prototype, 'execute', {
      value: originalExecute,
      writable: true,
    });
  });

  it('returns the coordinated publish plan without executing external commands', async () => {
    let receivedOptions: unknown;
    SpecialDeploymentPlanService.prototype.buildPlan = async function buildPlanMock(options) {
      receivedOptions = options;
      return plan({ targetOrg: 'release-org' });
    };

    const command = new CiPublish([], {} as never);
    const logs: string[] = [];
    (command as unknown as CiPublishCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        since: 'abc123',
        'target-org': 'release-org',
        'dry-run': true,
        'auto-activate': false,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as CiPublishCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as CiPublishCommandTestDouble).warn = (message?: string | Error) => {
      logs.push(String(message));
    };

    const result = await command.run();

    expect(receivedOptions).to.deep.equal({
      sourcePath: 'force-app',
      since: 'abc123',
      targetOrg: 'release-org',
      dryRun: true,
      autoActivate: false,
    });
    expect(result.phases[0]?.commands[0]?.args).to.include.members(['agent', 'publish', 'authoring-bundle']);
    expect(logs).to.include('Coordinated publish plan');
    expect(logs).to.include('Target Org: release-org');
    expect(logs.some((message) => message.includes('sf agent publish authoring-bundle'))).to.equal(true);
    expect(result.releaseReport?.schemaVersion).to.equal('1.0');
    expect(result.releaseReport?.outcome).to.equal('skipped');
    expect(result.releaseReport?.items[0]).to.deep.include({
      metadataType: 'AiAuthoringBundle',
      fullName: 'SupportAgent',
      operation: 'publish',
      status: 'skipped',
    });
  });

  it('executes the plan when dry-run is disabled', async () => {
    let executedPlan: SpecialDeploymentPlan | undefined;
    SpecialDeploymentPlanService.prototype.buildPlan = async function buildPlanMock() {
      return plan({ dryRun: false });
    };
    SpecialDeploymentPlanExecutor.prototype.execute = async function executeMock(nextPlan) {
      executedPlan = nextPlan;
      return {
        success: true,
        completedPhases: ['agentforce-publish'],
        skippedPhases: [],
        errors: [],
        commands: [],
      };
    };

    const command = new CiPublish([], {} as never);
    const logs: string[] = [];
    (command as unknown as CiPublishCommandTestDouble).parse = async () => ({
      flags: { 'dry-run': false, 'auto-activate': false },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as CiPublishCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as CiPublishCommandTestDouble).warn = (message?: string | Error) => {
      logs.push(String(message));
    };

    const result = await command.run();

    expect(executedPlan?.projectRoot).to.equal(result.projectRoot);
    expect(result.releaseReport?.outcome).to.equal('succeeded');
    expect(result.releaseReport?.phases[0]?.status).to.equal('succeeded');
    expect(result.releaseReportPath).to.match(/release-report\.json$/u);
    expect(logs).to.include('Coordinated publish execution completed successfully.');
  });

  it('persists a failed report before preserving the command failure', async () => {
    const projectRoot = await mkdtemp(path.join(os.tmpdir(), 'ci-publish-report-failure-'));
    SpecialDeploymentPlanService.prototype.buildPlan = async function buildPlanMock() {
      return plan({ projectRoot, dryRun: false });
    };
    SpecialDeploymentPlanExecutor.prototype.execute = async function executeMock() {
      return {
        success: false,
        completedPhases: [],
        skippedPhases: [],
        failedPhase: 'agentforce-publish',
        exitCode: 1,
        errors: ['Agentforce publish failed.'],
        commands: [],
      };
    };

    const command = new CiPublish([], {} as never);
    (command as unknown as CiPublishCommandTestDouble).parse = async () => ({
      flags: { 'dry-run': false, 'auto-activate': false },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as CiPublishCommandTestDouble).log = () => undefined;
    (command as unknown as CiPublishCommandTestDouble).warn = () => undefined;
    (command as unknown as CiPublishCommandTestDouble).error = (message: string) => {
      throw new Error(message);
    };

    let thrownError: Error | undefined;
    try {
      await command.run();
    } catch (error) {
      thrownError = error as Error;
    }

    const report = JSON.parse(
      await readFile(path.join(projectRoot, '.smart-deployment', 'reports', 'release-report.json'), 'utf8')
    ) as { outcome: string; phases: Array<{ id: string; status: string }> };
    expect(thrownError?.message).to.equal('Agentforce publish failed.');
    expect(report.outcome).to.equal('failed');
    expect(report.phases.find((phase) => phase.id === 'agentforce-publish')).to.deep.include({
      id: 'agentforce-publish',
      status: 'failed',
    });
    await rm(projectRoot, { recursive: true, force: true });
  });
});
