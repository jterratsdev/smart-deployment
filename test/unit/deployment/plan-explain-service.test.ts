import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PlanExplainService } from '../../../src/deployment/plan-explain-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { SpecialDeploymentPlan } from '../../../src/deployment/special-deployment-plan.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

function component(type: MetadataType, name: string, dependencies: string[] = []): MetadataComponent {
  return {
    type,
    name,
    filePath: `force-app/main/default/${type}/${name}`,
    dependencies: new Set(dependencies),
    dependents: new Set(),
    priorityBoost: 0,
  };
}

function dependencyResult(components: MetadataComponent[]): DependencyAnalysisResult {
  const componentMap = new Map(components.map((entry) => [`${entry.type}:${entry.name}`, entry] as const));
  const graph = new Map(
    components.map((entry) => [`${entry.type}:${entry.name}`, new Set(entry.dependencies)] as const)
  );
  const edges = components.flatMap((entry) =>
    [...entry.dependencies].map((dependency) => ({
      from: `${entry.type}:${entry.name}`,
      to: dependency,
      type: dependency.includes('Dynamic_Field__c') ? ('inferred' as const) : ('hard' as const),
      source: dependency.includes('Dynamic_Field__c') ? ('parser' as const) : ('parser' as const),
      reason: dependency.includes('Dynamic_Field__c') ? 'Dynamic SOQL field reference' : 'Static reference',
      confidence: dependency.includes('Dynamic_Field__c') ? 0.8 : 1,
    }))
  );

  return {
    components: componentMap,
    graph,
    reverseGraph: new Map(),
    edges,
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

function context(components: MetadataComponent[], waves: string[][]): DeploymentContext {
  const result = dependencyResult(components);
  return {
    scanResult: {
      components,
      dependencyResult: result,
      projectRoot: '/tmp/project',
      apiVersion: '61.0',
      executionTime: 1,
      errors: [],
      warnings: [],
    },
    orderedWaves: waves.map((waveComponents, index) => ({
      number: index + 1,
      components: waveComponents,
      metadata: {
        componentCount: waveComponents.length,
        types: [],
        maxDepth: 0,
        hasCircularDeps: false,
        estimatedTime: 1,
      },
    })),
    messages: {
      logs: [],
      warnings: [],
    },
  };
}

function providerPlan(overrides: Partial<SpecialDeploymentPlan> = {}): SpecialDeploymentPlan {
  return {
    success: true,
    projectRoot: '/tmp/project',
    apiVersion: '61.0',
    dryRun: true,
    autoActivate: false,
    phases: [],
    warnings: [],
    errors: [],
    ...overrides,
  };
}

describe('PlanExplainService', () => {
  it('explains dependency placement and transitive blockers', async () => {
    const base = component('ApexClass', 'Base');
    const helper = component('ApexClass', 'Helper', ['ApexClass:Base']);
    const serviceComponent = component('ApexClass', 'Service', ['ApexClass:Helper']);
    const service = new PlanExplainService({
      deploymentContextService: {
        buildContext: async () =>
          context([base, helper, serviceComponent], [['ApexClass:Base'], ['ApexClass:Helper'], ['ApexClass:Service']]),
      },
      specialDeploymentPlanService: {
        buildPlan: async () => providerPlan(),
      },
    });

    const explanation = await service.explain();
    const serviceExplanation = explanation.components.find((entry) => entry.nodeId === 'ApexClass:Service');

    expect(explanation.summary.waves).to.equal(3);
    expect(serviceExplanation?.wave).to.equal(3);
    expect(serviceExplanation?.placement.directDependencies).to.deep.equal(['ApexClass:Helper']);
    expect(serviceExplanation?.placement.transitiveBlockers).to.deep.equal(['ApexClass:Base']);
    expect(explanation.dependencies[0]).to.include({
      from: 'ApexClass:Helper',
      to: 'ApexClass:Base',
      resolved: true,
      confidence: 1,
    });
  });

  it('reports provider-owned metadata decisions', async () => {
    const service = new PlanExplainService({
      deploymentContextService: {
        buildContext: async () =>
          context([component('AiAuthoringBundle', 'SupportAgent')], [['AiAuthoringBundle:SupportAgent']]),
      },
      specialDeploymentPlanService: {
        buildPlan: async () =>
          providerPlan({
            phases: [
              {
                kind: 'agentforce-publish',
                label: 'Phase 2: Agentforce authoring bundle publish',
                components: ['AiAuthoringBundle:SupportAgent'],
                commands: [
                  {
                    tool: 'sf',
                    args: ['agent', 'publish', 'authoring-bundle', '-n', 'SupportAgent'],
                    reason:
                      'Publish changed Agentforce authoring bundle without retrieving generated version artifacts.',
                  },
                ],
                skipped: false,
              },
            ],
          }),
      },
    });

    const explanation = await service.explain();

    expect(explanation.providerDecisions).to.deep.include({
      kind: 'agentforce-publish',
      label: 'Phase 2: Agentforce authoring bundle publish',
      decision: 'included',
      components: ['AiAuthoringBundle:SupportAgent'],
      excludedTypes: [],
      commands: [
        {
          tool: 'sf',
          args: ['agent', 'publish', 'authoring-bundle', '-n', 'SupportAgent'],
          reason: 'Publish changed Agentforce authoring bundle without retrieving generated version artifacts.',
        },
      ],
      reason: 'Publish changed Agentforce authoring bundle without retrieving generated version artifacts.',
      warnings: [],
      errors: [],
    });
  });

  it('reports unresolved references with reduced confidence', async () => {
    const consumer = component('ApexClass', 'DynamicConsumer', ['CustomField:Account.Dynamic_Field__c']);
    const service = new PlanExplainService({
      deploymentContextService: {
        buildContext: async () => context([consumer], [['ApexClass:DynamicConsumer']]),
      },
      specialDeploymentPlanService: {
        buildPlan: async () => providerPlan(),
      },
    });

    const explanation = await service.explain();

    expect(explanation.summary.unresolvedReferenceCount).to.equal(1);
    expect(explanation.unresolvedReferences[0]).to.include({
      from: 'ApexClass:DynamicConsumer',
      to: 'CustomField:Account.Dynamic_Field__c',
      resolved: false,
      confidence: 0.8,
    });
    expect(explanation.components[0].placement.confidence).to.equal(0.55);
  });

  it('returns stable empty plan output', async () => {
    const service = new PlanExplainService({
      deploymentContextService: {
        buildContext: async () => context([], []),
      },
      specialDeploymentPlanService: {
        buildPlan: async () => providerPlan(),
      },
    });

    const explanation = await service.explain();

    expect(explanation.success).to.equal(true);
    expect(explanation.components).to.deep.equal([]);
    expect(explanation.dependencies).to.deep.equal([]);
    expect(explanation.unresolvedReferences).to.deep.equal([]);
    expect(explanation.summary).to.deep.equal({
      componentCount: 0,
      dependencyCount: 0,
      unresolvedReferenceCount: 0,
      providerDecisionCount: 0,
      waves: 0,
    });
  });
});
