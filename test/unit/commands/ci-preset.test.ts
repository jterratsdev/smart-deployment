import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import CiPreset from '../../../src/commands/ci/preset.js';
import { DeploymentContextService } from '../../../src/deployment/deployment-context-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

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

type CiPresetCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
  exit: (code?: number) => never;
};

function createContext(projectRoot: string, errors: string[] = []): DeploymentContext {
  const dependencyResult: DependencyAnalysisResult = {
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
  };

  return {
    scanResult: {
      projectRoot,
      apiVersion: '61.0',
      components: [],
      dependencyResult,
      errors,
      warnings: [],
      executionTime: 1,
    },
    orderedWaves: [],
    messages: { logs: [], warnings: [] },
  };
}

describe('CiPresetCommand', () => {
  const tempDirs: string[] = [];
  const originalGithubOutput = process.env.GITHUB_OUTPUT;
  const originalBuildContext = Object.getOwnPropertyDescriptor(DeploymentContextService.prototype, 'buildContext')
    ?.value as typeof DeploymentContextService.prototype.buildContext;

  afterEach(async () => {
    Object.defineProperty(DeploymentContextService.prototype, 'buildContext', {
      value: originalBuildContext,
      writable: true,
    });
    if (originalGithubOutput === undefined) {
      delete process.env.GITHUB_OUTPUT;
    } else {
      process.env.GITHUB_OUTPUT = originalGithubOutput;
    }
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('writes GitHub Actions artifact outputs for successful CI runs', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'ci-preset-command-'));
    tempDirs.push(tempDir);
    const reportDir = path.join(tempDir, 'reports');
    const githubOutput = path.join(tempDir, 'github-output.txt');
    const buildContextOptions: unknown[] = [];
    DeploymentContextService.prototype.buildContext = async function buildContextMock(options) {
      buildContextOptions.push(options);
      return createContext(tempDir);
    };
    process.env.GITHUB_OUTPUT = githubOutput;

    const command = new CiPreset([], {} as never);
    const logs: string[] = [];
    (command as unknown as CiPresetCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        'target-org': 'dev-org',
        'report-dir': reportDir,
        'validation-mode': 'strict',
        'skip-tests': true,
        'use-ai': true,
        'org-type': 'Sandbox',
        industry: 'Financial Services',
        'scope-commits': 'abc123,def456',
        'scope-manifest': 'manifests/release.json',
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as CiPresetCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();
    const output = await readFile(githubOutput, 'utf8');

    expect(result.exitCode).to.equal(0);
    expect(buildContextOptions[0]).to.deep.include({
      sourcePath: 'force-app',
      useAI: true,
      orgType: 'Sandbox',
      industry: 'Financial Services',
      commitScope: {
        commits: ['abc123,def456'],
        manifestPath: 'manifests/release.json',
      },
    });
    expect(output).to.include(`deployment_plan_json=${path.join(reportDir, 'deployment-plan.json')}`);
    expect(output).to.include(`deployment_plan_html=${path.join(reportDir, 'deployment-plan.html')}`);
    expect(output).to.include(`deployment_report_dir=${reportDir}`);
    expect(output).to.include('deployment_status=passed');
    expect(output).to.include('deployment_exit_code=0');
    expect(logs.join('\n')).to.include('Smart deployment CI preset');
  });

  it('exits with the service exit code for strict blockers', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'ci-preset-command-blocked-'));
    tempDirs.push(tempDir);
    DeploymentContextService.prototype.buildContext = async () => createContext(tempDir, ['Missing dependency']);

    const command = new CiPreset([], {} as never);
    let exitCode: number | undefined;
    (command as unknown as CiPresetCommandTestDouble).parse = async () => ({
      flags: {
        'report-dir': path.join(tempDir, 'reports'),
        'validation-mode': 'strict',
        'skip-tests': true,
        'use-ai': false,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as CiPresetCommandTestDouble).log = () => {};
    (command as unknown as CiPresetCommandTestDouble).exit = (code?: number): never => {
      exitCode = code;
      throw new Error(`exit:${code}`);
    };

    try {
      await command.run();
      throw new Error('Expected command to exit');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('exit:2');
    }

    expect(exitCode).to.equal(2);
  });
});
