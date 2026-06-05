import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  RollbackPlanningService,
  rollbackPlanningInternals,
  type RollbackGitProvider,
} from '../../../src/deployment/rollback-planning-service.js';
import type { DeploymentContext } from '../../../src/deployment/deployment-context-service.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

class FakeGitProvider implements RollbackGitProvider {
  public async listChanges(): Promise<Array<{ status: 'added' | 'modified' | 'deleted'; path: string }>> {
    return [
      { status: 'added', path: 'force-app/main/default/classes/NewService.cls' },
      { status: 'modified', path: 'force-app/main/default/classes/ChangedService.cls' },
      { status: 'deleted', path: 'force-app/main/default/classes/DeletedService.cls' },
    ];
  }

  public async checkoutArchive(): Promise<{ projectRoot: string; cleanup: () => Promise<void> }> {
    return { projectRoot: '/rollback-from', cleanup: async () => undefined };
  }
}

describe('RollbackPlanningService', () => {
  it('classifies added metadata as destructive and modified or deleted metadata as restore', async () => {
    const service = new RollbackPlanningService({ gitProvider: new FakeGitProvider() });
    const currentContext = createContext('/current', [component('/current', 'NewService')]);
    const rollbackContext = createContext('/rollback-from', [
      component('/rollback-from', 'ChangedService'),
      component('/rollback-from', 'DeletedService'),
    ]);

    const plan = await service.buildExecutionPlan({
      projectRoot: '/current',
      fromRef: 'v1.2.0',
      toRef: 'v1.2.1',
      currentContext,
      buildContext: async () => rollbackContext,
    });

    expect(plan.summary.destructiveComponents).to.deep.equal(['ApexClass:NewService']);
    expect(plan.summary.restoreComponents).to.deep.equal(['ApexClass:ChangedService', 'ApexClass:DeletedService']);
    expect(plan.destructiveContext?.orderedWaves.map((wave) => wave.components)).to.deep.equal([
      ['ApexClass:NewService'],
    ]);
    expect(plan.restoreContext?.orderedWaves.map((wave) => wave.components)).to.deep.equal([
      ['ApexClass:ChangedService', 'ApexClass:DeletedService'],
    ]);
  });

  it('parses git name-status rollback entries', () => {
    const changes = rollbackPlanningInternals.parseNameStatus(
      [
        'A	force-app/main/default/classes/New.cls',
        'M	force-app/main/default/classes/Changed.cls',
        'D	force-app/main/default/classes/Deleted.cls',
      ].join('\n')
    );

    expect(changes).to.deep.equal([
      { status: 'modified', path: 'force-app/main/default/classes/Changed.cls' },
      { status: 'deleted', path: 'force-app/main/default/classes/Deleted.cls' },
      { status: 'added', path: 'force-app/main/default/classes/New.cls' },
    ]);
  });
});

function createContext(projectRoot: string, components: MetadataComponent[]): DeploymentContext {
  const nodeIds = components.map((item) => `${item.type}:${item.name}`);
  return {
    scanResult: {
      components,
      dependencyResult: {
        components: new Map(components.map((item, index) => [nodeIds[index], item])),
        graph: new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()])),
        reverseGraph: new Map(nodeIds.map((nodeId) => [nodeId, new Set<string>()])),
        edges: [],
        circularDependencies: [],
        isolatedComponents: nodeIds,
        stats: {
          totalComponents: components.length,
          totalDependencies: 0,
          componentsByType: { ApexClass: components.length },
          maxDepth: 0,
          mostDepended: { nodeId: nodeIds[0], count: 0 },
          mostDependencies: { nodeId: nodeIds[0], count: 0 },
        },
      },
      projectRoot,
      apiVersion: '66.0',
      executionTime: 0,
      errors: [],
      warnings: [],
    },
    orderedWaves: [
      {
        number: 1,
        components: nodeIds,
        metadata: {
          componentCount: nodeIds.length,
          types: ['ApexClass'],
          maxDepth: 0,
          hasCircularDeps: false,
          estimatedTime: 0,
        },
      },
    ],
    messages: { logs: [], warnings: [] },
  };
}

function component(projectRoot: string, name: string, type: MetadataType = 'ApexClass'): MetadataComponent {
  return {
    name,
    type,
    filePath: `${projectRoot}/force-app/main/default/classes/${name}.cls`,
    dependencies: new Set<string>(),
    dependents: new Set<string>(),
    priorityBoost: 0,
  };
}
