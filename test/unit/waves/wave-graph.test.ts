import { expect } from 'chai';
import { describe, it } from 'mocha';
import type { DeploymentState } from '../../../src/deployment/state-manager.js';
import type { DependencyGraph } from '../../../src/types/dependency.js';
import type { Wave } from '../../../src/waves/wave-builder.js';
import { buildWaveGraph } from '../../../src/waves/wave-graph.js';

describe('buildWaveGraph', () => {
  it('creates ordered sequence edges between waves', () => {
    const graph = buildWaveGraph(
      [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['ApexClass:AccountService']),
        createWave(3, ['PermissionSet:Sales']),
      ],
      new Map()
    );

    expect(graph.nodes.map((node) => node.waveNumber)).to.deep.equal([1, 2, 3]);
    expect(graph.edges.filter((edge) => edge.kind === 'sequence')).to.deep.equal([
      { fromWave: 1, toWave: 2, kind: 'sequence' },
      { fromWave: 2, toWave: 3, kind: 'sequence' },
    ]);
  });

  it('adds dependency edges from prerequisite waves to dependent waves', () => {
    const dependencyGraph: DependencyGraph = new Map([
      ['ApexClass:AccountService', new Set(['CustomField:Account.External_Id__c', 'CustomObject:Account'])],
      ['CustomField:Account.External_Id__c', new Set(['CustomObject:Account'])],
      ['CustomObject:Account', new Set()],
    ]);

    const graph = buildWaveGraph(
      [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['CustomField:Account.External_Id__c']),
        createWave(3, ['ApexClass:AccountService']),
      ],
      dependencyGraph
    );

    expect(graph.edges).to.include.deep.members([
      { fromWave: 1, toWave: 2, kind: 'dependency', dependencyCount: 1 },
      { fromWave: 1, toWave: 3, kind: 'dependency', dependencyCount: 1 },
      { fromWave: 2, toWave: 3, kind: 'dependency', dependencyCount: 1 },
    ]);
  });

  it('marks wave application state when deployment state is provided', () => {
    const state: DeploymentState = {
      deploymentId: 'deployment-1',
      targetOrg: 'test@example.com',
      timestamp: '2026-05-14T00:00:00.000Z',
      totalWaves: 3,
      completedWaves: [1],
      currentWave: 2,
      failedWave: {
        waveNumber: 3,
        error: 'Deploy failed',
        timestamp: '2026-05-14T00:01:00.000Z',
      },
    };

    const graph = buildWaveGraph(
      [
        createWave(1, ['CustomObject:Account']),
        createWave(2, ['CustomField:Account.External_Id__c']),
        createWave(3, ['ApexClass:AccountService']),
      ],
      new Map(),
      state
    );

    expect(graph.nodes.map((node) => node.status)).to.deep.equal(['completed', 'current', 'failed']);
    expect(graph.visualizations.mermaid).to.include('class W1 completed');
    expect(graph.visualizations.dot).to.include('Wave 3\\nfailed');
  });
});

function createWave(number: number, components: string[]): Wave {
  return {
    number,
    components,
    metadata: {
      componentCount: components.length,
      types: [],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 0,
    },
  };
}
