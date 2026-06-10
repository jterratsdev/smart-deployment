import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import GraphExport from '../../../src/commands/graph/export.js';
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

type GraphExportCommandTestDouble = {
  parse: () => Promise<ParseResult>;
  log: (message?: string) => void;
};

function createContext(projectRoot: string): DeploymentContext {
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map([
      [
        'ApexClass:Base',
        {
          name: 'Base',
          type: 'ApexClass',
          filePath: path.join(projectRoot, 'force-app/main/default/classes/Base.cls'),
          dependencies: new Set(),
          dependents: new Set(['ApexClass:Service']),
          priorityBoost: 0,
        },
      ],
      [
        'ApexClass:Service',
        {
          name: 'Service',
          type: 'ApexClass',
          filePath: path.join(projectRoot, 'force-app/main/default/classes/Service.cls'),
          dependencies: new Set(['ApexClass:Base']),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]),
    graph: new Map([
      ['ApexClass:Base', new Set()],
      ['ApexClass:Service', new Set(['ApexClass:Base'])],
    ]),
    reverseGraph: new Map([['ApexClass:Base', new Set(['ApexClass:Service'])]]),
    edges: [{ from: 'ApexClass:Service', to: 'ApexClass:Base', type: 'hard', source: 'parser' }],
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: 2,
      totalDependencies: 1,
      componentsByType: { ApexClass: 2 },
      maxDepth: 1,
      mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
      mostDependencies: { nodeId: 'ApexClass:Service', count: 1 },
    },
  };

  return {
    scanResult: {
      projectRoot,
      apiVersion: '61.0',
      components: [...dependencyResult.components.values()],
      dependencyResult,
      errors: [],
      warnings: [],
      executionTime: 1,
    },
    orderedWaves: [
      {
        number: 1,
        components: ['ApexClass:Base'],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 0,
          hasCircularDeps: false,
          estimatedTime: 5,
        },
      },
      {
        number: 2,
        components: ['ApexClass:Service'],
        metadata: {
          componentCount: 1,
          types: ['ApexClass'],
          maxDepth: 1,
          hasCircularDeps: false,
          estimatedTime: 5,
        },
      },
    ],
    messages: { logs: [], warnings: [] },
  };
}

describe('GraphExportCommand', () => {
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

  it('exports the selected graph format and returns JSON-safe metadata', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-export-command-'));
    tempDirs.push(tempDir);
    const reportDir = path.join(tempDir, 'reports');
    const buildContextOptions: unknown[] = [];
    DeploymentContextService.prototype.buildContext = async function buildContextMock(options) {
      buildContextOptions.push(options);
      return createContext(tempDir);
    };

    const command = new GraphExport([], {} as never);
    const logs: string[] = [];
    (command as unknown as GraphExportCommandTestDouble).parse = async () => ({
      flags: {
        'source-path': 'force-app',
        'report-dir': reportDir,
        format: 'json',
        'use-ai': true,
        'org-type': 'Sandbox',
        industry: 'Financial Services',
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as GraphExportCommandTestDouble).log = (message?: string) => {
      if (message) logs.push(message);
    };

    const result = await command.run();
    const written = JSON.parse(await readFile(result.path, 'utf8')) as { summary: { components: number } };

    expect(result.success).to.equal(true);
    expect(result.format).to.equal('json');
    expect(result.path).to.equal(path.join(reportDir, 'dependency-graph.json'));
    expect(result.report.summary).to.deep.include({ components: 2, dependencyEdges: 1, waves: 2 });
    expect(written.summary.components).to.equal(2);
    expect(buildContextOptions[0]).to.deep.include({
      sourcePath: 'force-app',
      useAI: true,
      orgType: 'Sandbox',
      industry: 'Financial Services',
    });
    expect(logs.join('\n')).to.include('Graph export complete');
  });

  it('lets --output override --report-dir', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-export-command-output-'));
    tempDirs.push(tempDir);
    const output = path.join(tempDir, 'custom', 'graph.mmd');
    DeploymentContextService.prototype.buildContext = async () => createContext(tempDir);

    const command = new GraphExport([], {} as never);
    (command as unknown as GraphExportCommandTestDouble).parse = async () => ({
      flags: {
        'report-dir': path.join(tempDir, 'ignored'),
        output,
        format: 'mermaid',
        'use-ai': false,
      },
      args: {},
      argv: [],
      raw: [],
      metadata: { flags: {}, args: {} },
      nonExistentFlags: [],
      _runtime: {},
    });
    (command as unknown as GraphExportCommandTestDouble).log = () => {};

    const result = await command.run();

    expect(result.path).to.equal(output);
    expect(await readFile(output, 'utf8')).to.include('graph TD');
  });
});
