import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { GraphExportService } from '../../../src/reports/graph-export-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

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
          dependents: new Set(['ApexClass:Service "Quoted"']),
          priorityBoost: 0,
        },
      ],
      [
        'ApexClass:Service "Quoted"',
        {
          name: 'Service "Quoted"',
          type: 'ApexClass',
          filePath: path.join(projectRoot, 'force-app/main/default/classes/Service.cls'),
          dependencies: new Set(['ApexClass:Base']),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
      [
        'Flow:Unsafe <Flow>',
        {
          name: 'Unsafe <Flow>',
          type: 'Flow',
          filePath: path.join(projectRoot, 'force-app/main/default/flows/Unsafe.flow-meta.xml'),
          dependencies: new Set(['Flow:Unsafe <Flow>']),
          dependents: new Set(['Flow:Unsafe <Flow>']),
          priorityBoost: 0,
        },
      ],
    ]),
    graph: new Map([
      ['ApexClass:Base', new Set()],
      ['ApexClass:Service "Quoted"', new Set(['ApexClass:Base'])],
      ['Flow:Unsafe <Flow>', new Set(['Flow:Unsafe <Flow>'])],
    ]),
    reverseGraph: new Map([
      ['ApexClass:Base', new Set(['ApexClass:Service "Quoted"'])],
      ['ApexClass:Service "Quoted"', new Set()],
      ['Flow:Unsafe <Flow>', new Set(['Flow:Unsafe <Flow>'])],
    ]),
    edges: [
      {
        from: 'ApexClass:Service "Quoted"',
        to: 'ApexClass:Base',
        type: 'hard',
        source: 'parser',
        reason: 'Uses base class',
      },
      {
        from: 'Flow:Unsafe <Flow>',
        to: 'Flow:Unsafe <Flow>',
        type: 'soft',
        source: 'parser',
        reason: 'Self reference',
      },
    ],
    circularDependencies: [
      {
        cycle: ['Flow:Unsafe <Flow>'],
        severity: 'warning',
        message: 'Flow self-reference requires review.',
      },
    ],
    isolatedComponents: [],
    stats: {
      totalComponents: 3,
      totalDependencies: 2,
      componentsByType: { ApexClass: 2, Flow: 1 },
      maxDepth: 1,
      mostDepended: { nodeId: 'ApexClass:Base', count: 1 },
      mostDependencies: { nodeId: 'ApexClass:Service "Quoted"', count: 1 },
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
        components: ['ApexClass:Service "Quoted"', 'Flow:Unsafe <Flow>'],
        metadata: {
          componentCount: 2,
          types: ['ApexClass', 'Flow'],
          maxDepth: 1,
          hasCircularDeps: true,
          estimatedTime: 10,
        },
      },
    ],
    messages: { logs: [], warnings: [] },
  };
}

function emptyContext(projectRoot: string): DeploymentContext {
  return {
    scanResult: {
      projectRoot,
      apiVersion: '61.0',
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
      errors: [],
      warnings: [],
      executionTime: 1,
    },
    orderedWaves: [],
    messages: { logs: [], warnings: [] },
  };
}

describe('GraphExportService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('writes Mermaid DOT JSON and HTML graph artifacts', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'graph-export-'));
    tempDirs.push(tempDir);
    const context = createContext(tempDir);
    const service = new GraphExportService();

    const mermaid = await service.generate(context, { format: 'mermaid', reportDir: path.join(tempDir, 'reports') });
    const dot = await service.generate(context, { format: 'dot', reportDir: path.join(tempDir, 'reports') });
    const json = await service.generate(context, { format: 'json', reportDir: path.join(tempDir, 'reports') });
    const html = await service.generate(context, { format: 'html', reportDir: path.join(tempDir, 'reports') });

    expect(await readFile(mermaid.path, 'utf8')).to.include('subgraph n_wave_1["Wave 1"]');
    expect(await readFile(dot.path, 'utf8')).to.include('subgraph cluster_wave_2');
    expect(JSON.parse(await readFile(json.path, 'utf8'))).to.deep.include({
      projectRoot: tempDir,
    });
    expect(await readFile(html.path, 'utf8')).to.include('Dependency Graph Export');
  });

  it('includes deployment review metadata for waves and cycles', () => {
    const report = new GraphExportService().createReport(createContext('/tmp/project'));

    expect(report.summary).to.deep.include({ components: 3, dependencyEdges: 2, waves: 2, cycles: 1 });
    expect(report.waves[1]).to.deep.include({ number: 2, componentCount: 2, hasCircularDependencies: true });
    expect(report.components.find((component) => component.id === 'Flow:Unsafe <Flow>')).to.deep.include({
      wave: 2,
      inCycle: true,
      isolated: false,
    });
    expect(report.edges.find((edge) => edge.from === 'Flow:Unsafe <Flow>')).to.deep.include({
      type: 'soft',
      inCycle: true,
      crossesWave: false,
    });
  });

  it('renders an empty graph without throwing', () => {
    const service = new GraphExportService();
    const report = service.createReport(emptyContext('/tmp/project'));

    expect(report.summary.components).to.equal(0);
    expect(service.toMermaid(report)).to.include('empty["No components found"]');
    expect(service.toDot(report)).to.include('digraph Dependencies');
    expect(service.toHtml(report)).to.include('No dependency edges found.');
  });

  it('escapes graph labels and HTML content', () => {
    const service = new GraphExportService();
    const report = service.createReport(createContext('/tmp/project'));
    const mermaid = service.toMermaid(report);
    const dot = service.toDot(report);
    const html = service.toHtml(report);

    expect(mermaid).to.include('Service &quot;Quoted&quot;');
    expect(dot).to.include('Service \\"Quoted\\"');
    expect(html).to.include('Flow:Unsafe &lt;Flow&gt;');
    expect(html).to.not.include('<Flow></code>');
  });
});
