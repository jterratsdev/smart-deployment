import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { CiPresetService } from '../../../src/deployment/ci-preset-service.js';
import { DeploymentContextService } from '../../../src/deployment/deployment-context-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

function createBlockedContext(projectRoot: string): DeploymentContext {
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map([
      [
        'Flow:BlockedFlow',
        {
          name: 'BlockedFlow',
          type: 'Flow',
          filePath: path.join(projectRoot, 'force-app/main/default/flows/BlockedFlow.flow-meta.xml'),
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]),
    graph: new Map(),
    reverseGraph: new Map(),
    edges: [],
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: 1,
      totalDependencies: 0,
      componentsByType: { Flow: 1 },
      maxDepth: 0,
      mostDepended: { nodeId: 'Flow:BlockedFlow', count: 0 },
      mostDependencies: { nodeId: 'Flow:BlockedFlow', count: 0 },
    },
  };

  return {
    scanResult: {
      projectRoot,
      apiVersion: '61.0',
      components: [],
      dependencyResult,
      errors: ['Missing dependency'],
      warnings: ['Review deployment plan'],
      executionTime: 1,
    },
    orderedWaves: [
      {
        number: 1,
        components: ['Flow:BlockedFlow'],
        metadata: {
          componentCount: 1,
          types: ['Flow'],
          maxDepth: 0,
          hasCircularDeps: false,
          estimatedTime: 5,
        },
      },
    ],
    messages: { logs: [], warnings: [] },
  };
}

describe('CiPresetService', () => {
  const tempDirs: string[] = [];
  const originalBuildContext = Object.getOwnPropertyDescriptor(DeploymentContextService.prototype, 'buildContext')
    ?.value as typeof DeploymentContextService.prototype.buildContext;

  afterEach(async () => {
    Object.defineProperty(DeploymentContextService.prototype, 'buildContext', {
      value: originalBuildContext,
      writable: true,
    });
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('exits non-zero for strict mode blockers and emits artifact paths', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'ci-preset-service-'));
    tempDirs.push(tempDir);
    DeploymentContextService.prototype.buildContext = async () => createBlockedContext(tempDir);
    await writeFile(
      path.join(tempDir, '.smart-deployment.json'),
      JSON.stringify({ checkpoints: [{ id: 'approve-flow', phase: 'before', waveNumber: 1 }] })
    );

    const reportDir = path.join(tempDir, 'reports');
    const result = await new CiPresetService().run({
      sourcePath: 'force-app',
      targetOrg: 'dev-org',
      reportDir,
      validationMode: 'strict',
      skipTests: true,
      useAI: false,
    });
    const report = JSON.parse(await readFile(result.artifacts.jsonPath, 'utf8')) as {
      summary: { status: string; blockers: number };
      checkpoints: Array<{ id: string }>;
    };

    expect(result.exitCode).to.equal(2);
    expect(result.success).to.equal(false);
    expect(result.summary.conclusion).to.equal('blocked');
    expect(result.artifacts).to.deep.equal({
      jsonPath: path.join(reportDir, 'deployment-plan.json'),
      htmlPath: path.join(reportDir, 'deployment-plan.html'),
      reportDir,
    });
    expect(result.githubOutputs).to.deep.equal({
      ['deployment_plan_json']: result.artifacts.jsonPath,
      ['deployment_plan_html']: result.artifacts.htmlPath,
      ['deployment_report_dir']: result.artifacts.reportDir,
      ['deployment_status']: 'blocked',
      ['deployment_exit_code']: '2',
    });
    expect(report.summary).to.deep.include({ status: 'blocked', blockers: 1 });
    expect(result.checkpoints).to.deep.equal([{ id: 'approve-flow', phase: 'before', waveNumber: 1 }]);
    expect(report.checkpoints).to.deep.equal(result.checkpoints);
  });

  it('keeps warn-only and local-only modes at exit code zero for plan blockers', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'ci-preset-modes-'));
    tempDirs.push(tempDir);
    DeploymentContextService.prototype.buildContext = async () => createBlockedContext(tempDir);

    const warnOnly = await new CiPresetService().run({
      reportDir: path.join(tempDir, 'warn-only'),
      validationMode: 'warn-only',
      skipTests: true,
      useAI: false,
    });
    const localOnly = await new CiPresetService().run({
      reportDir: path.join(tempDir, 'local-only'),
      validationMode: 'local-only',
      skipTests: true,
      useAI: false,
    });

    expect(warnOnly.exitCode).to.equal(0);
    expect(warnOnly.success).to.equal(true);
    expect(localOnly.exitCode).to.equal(0);
    expect(localOnly.success).to.equal(true);
  });
});
