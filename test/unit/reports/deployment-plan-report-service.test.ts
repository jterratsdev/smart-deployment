import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { DeploymentPlanReportService } from '../../../src/reports/deployment-plan-report-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';

function createContext(projectRoot: string): DeploymentContext {
  const components = [
    {
      name: 'Base',
      type: 'ApexClass' as const,
      filePath: path.join(projectRoot, 'force-app/main/default/classes/Base.cls'),
      dependencies: new Set<string>(),
      dependents: new Set(['ApexClass:Service']),
      priorityBoost: 0,
    },
    {
      name: 'Service',
      type: 'ApexClass' as const,
      filePath: path.join(projectRoot, 'force-app/main/default/classes/Service.cls'),
      dependencies: new Set(['ApexClass:Base']),
      dependents: new Set<string>(),
      priorityBoost: 0,
    },
  ];
  const dependencyResult: DependencyAnalysisResult = {
    components: new Map(components.map((component) => [`${component.type}:${component.name}`, component])),
    graph: new Map([
      ['ApexClass:Base', new Set()],
      ['ApexClass:Service', new Set(['ApexClass:Base'])],
    ]),
    reverseGraph: new Map(),
    edges: [
      {
        from: 'ApexClass:Service',
        to: 'ApexClass:Base',
        type: 'hard',
        source: 'parser',
      },
    ],
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
      components,
      dependencyResult,
      errors: [],
      warnings: ['Review sharing settings before production deployment.'],
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

describe('DeploymentPlanReportService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('writes deterministic JSON and HTML dry-run reports', async () => {
    const tempDir = await mkdtemp(path.join(tmpdir(), 'deployment-plan-report-'));
    tempDirs.push(tempDir);
    const context = createContext(tempDir);
    const service = new DeploymentPlanReportService();

    const result = await service.generate(context, {
      dryRun: true,
      validateOnly: false,
      destructive: false,
      skipTests: true,
    });
    const jsonReport = JSON.parse(await readFile(result.jsonPath, 'utf8')) as {
      summary: { status: string; waves: number; warnings: number };
      providerPhases: Array<{ name: string; status: string }>;
      waves: Array<{ components: Array<{ id: string }> }>;
    };
    const htmlReport = await readFile(result.htmlPath, 'utf8');

    expect(result.jsonPath).to.equal(
      path.join(tempDir, '.smart-deployment/reports/start-dry-run/deployment-plan.json')
    );
    expect(result.htmlPath).to.equal(
      path.join(tempDir, '.smart-deployment/reports/start-dry-run/deployment-plan.html')
    );
    expect(jsonReport.summary).to.deep.include({ status: 'warning', waves: 2, warnings: 1 });
    expect(jsonReport.providerPhases).to.deep.include({
      name: 'deployment-execution',
      provider: 'sf-cli',
      status: 'skipped',
      detail: 'Skipped because --dry-run was requested',
    });
    expect(jsonReport.waves[1].components[0].id).to.equal('ApexClass:Service');
    expect(htmlReport).to.include('Deployment Plan Report');
    expect(htmlReport).to.include('ApexClass:Service');
  });

  it('reports empty and blocked plans without throwing', () => {
    const context = createContext('/tmp/project');
    context.scanResult.components = [];
    context.scanResult.errors = ['No deployable metadata found.'];
    context.scanResult.warnings = [];
    context.scanResult.dependencyResult.components = new Map([
      [
        'Flow:BlockedFlow',
        {
          name: 'BlockedFlow',
          type: 'Flow',
          filePath: 'flows/BlockedFlow.flow-meta.xml',
          dependencies: new Set(),
          dependents: new Set(),
          priorityBoost: 0,
        },
      ],
    ]);
    context.scanResult.dependencyResult.circularDependencies = [
      {
        cycle: ['Flow:BlockedFlow'],
        severity: 'error',
        message: 'Circular dependency prevents wave placement.',
      },
    ];
    context.orderedWaves = [];

    const report = new DeploymentPlanReportService().createReport(context, {
      dryRun: true,
      validateOnly: false,
      destructive: false,
      skipTests: false,
    });

    expect(report.summary.status).to.equal('blocked');
    expect(report.validationSummary.passed).to.equal(false);
    expect(report.validationSummary.unplacedComponents).to.equal(1);
    expect(report.blockers).to.deep.equal([
      'No deployable metadata found.',
      'Circular dependency prevents wave placement.',
      'Unplaced component: Flow:BlockedFlow',
    ]);
    expect(new DeploymentPlanReportService().toHTML(report)).to.include('No deployment waves generated.');
  });
});
