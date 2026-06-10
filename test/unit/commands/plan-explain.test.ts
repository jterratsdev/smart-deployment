import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import PlanExplain from '../../../src/commands/plan/explain.js';
import { DeploymentContextService } from '../../../src/deployment/deployment-context-service.js';
import { SpecialDeploymentPlanService } from '../../../src/deployment/special-deployment-plan.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { SpecialDeploymentPlan } from '../../../src/deployment/special-deployment-plan.js';

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

type PlanExplainCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  warn: (message?: string | Error) => void;
  error: (message: string) => never;
};

function emptyContext(): DeploymentContext {
  return {
    scanResult: {
      components: [],
      dependencyResult: {
        components: new Map(),
        graph: new Map(),
        reverseGraph: new Map(),
        edges: [],
        circularDependencies: [],
        isolatedComponents: [],
        stats: {
          totalComponents: 0,
          totalDependencies: 0,
          componentsByType: {},
          maxDepth: 0,
          mostDepended: { nodeId: '', count: 0 },
          mostDependencies: { nodeId: '', count: 0 },
        },
      },
      projectRoot: '/tmp/project',
      apiVersion: '61.0',
      executionTime: 1,
      errors: [],
      warnings: [],
    },
    orderedWaves: [],
    messages: {
      logs: [],
      warnings: [],
    },
  };
}

function emptyProviderPlan(): SpecialDeploymentPlan {
  return {
    success: true,
    projectRoot: '/tmp/project',
    apiVersion: '61.0',
    dryRun: true,
    autoActivate: false,
    phases: [],
    warnings: [],
    errors: [],
  };
}

describe('PlanExplainCommand', () => {
  const originalBuildContext = Object.getOwnPropertyDescriptor(DeploymentContextService.prototype, 'buildContext')
    ?.value as typeof DeploymentContextService.prototype.buildContext;
  const originalBuildPlan = Object.getOwnPropertyDescriptor(SpecialDeploymentPlanService.prototype, 'buildPlan')
    ?.value as typeof SpecialDeploymentPlanService.prototype.buildPlan;

  afterEach(() => {
    Object.defineProperty(DeploymentContextService.prototype, 'buildContext', {
      value: originalBuildContext,
      writable: true,
    });
    Object.defineProperty(SpecialDeploymentPlanService.prototype, 'buildPlan', {
      value: originalBuildPlan,
      writable: true,
    });
  });

  it('accepts start dry-run style inputs and returns explanation JSON', async () => {
    const buildContextOptions: unknown[] = [];
    const buildPlanOptions: unknown[] = [];
    DeploymentContextService.prototype.buildContext = async function buildContextMock(options) {
      buildContextOptions.push(options);
      return emptyContext();
    };
    SpecialDeploymentPlanService.prototype.buildPlan = async function buildPlanMock(options) {
      buildPlanOptions.push(options);
      return emptyProviderPlan();
    };

    const command = new PlanExplain([], {} as never);
    const logs: string[] = [];
    (command as unknown as PlanExplainCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        'target-org': 'dev-org',
        'dry-run': true,
        'skip-tests': true,
        'validate-only': false,
        'allow-cycle-remediation': false,
        'use-ai': true,
        'org-type': 'Sandbox',
        industry: 'Financial Services',
        since: 'HEAD~1',
        'auto-activate': true,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as PlanExplainCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };
    (command as unknown as PlanExplainCommandTestDouble).warn = (message?: string | Error) => {
      logs.push(String(message));
    };

    const result = await command.run();

    expect(result.success).to.equal(true);
    expect(result.summary).to.deep.include({
      componentCount: 0,
      dependencyCount: 0,
      waves: 0,
    });
    expect(buildContextOptions[0]).to.deep.include({
      sourcePath: 'force-app',
      useAI: true,
      orgType: 'Sandbox',
      industry: 'Financial Services',
    });
    expect(buildPlanOptions[0]).to.deep.include({
      sourcePath: 'force-app',
      targetOrg: 'dev-org',
      since: 'HEAD~1',
      dryRun: true,
      autoActivate: true,
    });
    expect(logs.join('\n')).to.include('Plan Explain:');
  });
});
