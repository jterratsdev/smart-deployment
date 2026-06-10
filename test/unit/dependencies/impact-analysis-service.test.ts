import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  ImpactAnalysisService,
  type GitChangeProvider,
  type ImpactGitChange,
} from '../../../src/dependencies/impact-analysis-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';

describe('ImpactAnalysisService', () => {
  it('maps added components to planned waves and suggested tests', async () => {
    const context = createDeploymentContext({
      components: [
        component('ApexClass', 'AccountService', 'force-app/main/default/classes/AccountService.cls'),
        component('ApexClass', 'AccountService_Test', 'force-app/main/default/classes/AccountService_Test.cls'),
      ],
      edges: [['ApexClass:AccountService_Test', 'ApexClass:AccountService']],
      waves: [['ApexClass:AccountService'], ['ApexClass:AccountService_Test']],
    });
    const service = createService(context, [
      { status: 'added', path: 'force-app/main/default/classes/AccountService.cls' },
    ]);

    const result = await service.analyze({ base: 'origin/main', head: 'HEAD' });

    expect(result.changedComponents).to.deep.include({
      nodeId: 'ApexClass:AccountService',
      type: 'ApexClass',
      name: 'AccountService',
      filePath: 'force-app/main/default/classes/AccountService.cls',
      status: 'added',
      foundInScan: true,
    });
    expect(result.suggestedApexTests.recommendedTests).to.deep.equal(['ApexClass:AccountService_Test']);
    expect(result.plannedWaves.map((wave) => wave.components)).to.deep.equal([
      ['ApexClass:AccountService'],
      ['ApexClass:AccountService_Test'],
    ]);
  });

  it('expands changed components to transitive dependents', async () => {
    const context = createDeploymentContext({
      components: [
        component('ApexClass', 'Domain', 'force-app/main/default/classes/Domain.cls'),
        component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls'),
        component('ApexClass', 'Controller', 'force-app/main/default/classes/Controller.cls'),
      ],
      edges: [
        ['ApexClass:Service', 'ApexClass:Domain'],
        ['ApexClass:Controller', 'ApexClass:Service'],
      ],
      waves: [['ApexClass:Domain'], ['ApexClass:Service'], ['ApexClass:Controller']],
    });
    const service = createService(context, [{ status: 'changed', path: 'force-app/main/default/classes/Domain.cls' }]);

    const result = await service.analyze({ workingTree: true });

    expect(result.transitiveDependents).to.deep.equal(['ApexClass:Controller', 'ApexClass:Service']);
    expect(result.affectedComponents).to.deep.equal(['ApexClass:Controller', 'ApexClass:Domain', 'ApexClass:Service']);
  });

  it('infers deleted components from paths and keeps dependent impact', async () => {
    const context = createDeploymentContext({
      components: [component('ApexClass', 'Controller', 'force-app/main/default/classes/Controller.cls')],
      edges: [['ApexClass:Controller', 'ApexClass:DeletedService']],
      waves: [['ApexClass:Controller']],
    });
    const service = createService(context, [
      { status: 'deleted', path: 'force-app/main/default/classes/DeletedService.cls' },
    ]);

    const result = await service.analyze({ base: 'v1.0.0', head: 'HEAD' });

    expect(result.changedComponents).to.deep.equal([
      {
        nodeId: 'ApexClass:DeletedService',
        type: 'ApexClass',
        name: 'DeletedService',
        filePath: 'force-app/main/default/classes/DeletedService.cls',
        status: 'deleted',
        foundInScan: false,
      },
    ]);
    expect(result.transitiveDependents).to.deep.equal(['ApexClass:Controller']);
  });

  it('rejects partial ref mode before scanning', async () => {
    const service = createService(createDeploymentContext({ components: [], edges: [], waves: [] }), []);

    try {
      await service.analyze({ base: 'origin/main' });
      throw new Error('Expected analyze to reject partial refs');
    } catch (error) {
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.equal('Both --base and --head are required when analyzing git refs');
    }
  });
});

function createService(context: DeploymentContext, changes: ImpactGitChange[]): ImpactAnalysisService {
  const gitChangeProvider: GitChangeProvider = {
    listRefChanges: async () => changes,
    listWorkingTreeChanges: async () => changes,
  };

  return new ImpactAnalysisService({
    contextService: {
      buildContext: async () => context,
    },
    gitChangeProvider,
  });
}

function createDeploymentContext(options: {
  components: MetadataComponent[];
  edges: Array<[string, string]>;
  waves: string[][];
}): DeploymentContext {
  const dependencyResult = createDependencyResult(options.components, options.edges);

  return {
    scanResult: {
      projectRoot: '/repo',
      apiVersion: '61.0',
      components: options.components,
      dependencyResult,
      errors: [],
      warnings: [],
      executionTime: 1,
    },
    orderedWaves: options.waves.map((components, index) => ({
      number: index + 1,
      components,
      metadata: {
        componentCount: components.length,
        types: [],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 1,
      },
    })),
    messages: { logs: [], warnings: [] },
  };
}

function createDependencyResult(
  components: MetadataComponent[],
  edges: Array<[string, string]>
): DependencyAnalysisResult {
  const componentMap = new Map(components.map((item) => [`${item.type}:${item.name}`, item]));
  const graph = new Map<string, Set<string>>();
  const reverseGraph = new Map<string, Set<string>>();

  for (const nodeId of componentMap.keys()) {
    graph.set(nodeId, new Set());
    reverseGraph.set(nodeId, new Set());
  }

  for (const [from, to] of edges) {
    graph.set(from, graph.get(from) ?? new Set());
    graph.get(from)!.add(to);
    reverseGraph.set(to, reverseGraph.get(to) ?? new Set());
    reverseGraph.get(to)!.add(from);
  }

  return {
    components: componentMap,
    graph,
    reverseGraph,
    edges: edges.map(([from, to]) => ({ from, to, type: 'hard' as const, source: 'parser' as const })),
    circularDependencies: [],
    isolatedComponents: [],
    stats: {
      totalComponents: components.length,
      totalDependencies: edges.length,
      componentsByType: {},
      maxDepth: 0,
      mostDepended: { nodeId: '', count: 0 },
      mostDependencies: { nodeId: '', count: 0 },
    },
  };
}

function component(type: MetadataType, name: string, filePath: string): MetadataComponent {
  return {
    type,
    name,
    filePath: `/repo/${filePath}`,
    dependencies: new Set(),
    dependents: new Set(),
    priorityBoost: 0,
  };
}
