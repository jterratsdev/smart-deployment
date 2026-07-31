import { readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import {
  CommitScopeService,
  type CommitScopeGitChange,
  type CommitScopeGitChangeProvider,
} from '../../../src/deployment/commit-scope-service.js';
import type { ScanResult } from '../../../src/services/metadata-scanner-service.js';
import type { DependencyAnalysisResult } from '../../../src/types/dependency.js';
import type { MetadataComponent, MetadataType } from '../../../src/types/metadata.js';

describe('CommitScopeService', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    await Promise.all(tempDirs.map(async (directory) => rm(directory, { recursive: true, force: true })));
    tempDirs.length = 0;
  });

  it('keeps changed components and required dependencies while excluding unrelated trunk metadata', async () => {
    const scanResult = createScanResult({
      components: [
        component('ApexClass', 'Base', 'force-app/main/default/classes/Base.cls'),
        component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls', ['ApexClass:Base']),
        component('ApexClass', 'FutureWork', 'force-app/main/default/classes/FutureWork.cls'),
      ],
      edges: [['ApexClass:Service', 'ApexClass:Base']],
    });
    const service = createService([
      { commit: 'abc123', status: 'changed', path: 'force-app/main/default/classes/Service.cls' },
    ]);

    const result = await service.apply(scanResult, { commits: ['abc123'] });

    expect(result.summary.changedComponents).to.deep.equal(['ApexClass:Service']);
    expect(result.summary.dependencyComponents).to.deep.equal(['ApexClass:Base']);
    expect(result.summary.includedComponents).to.deep.equal(['ApexClass:Base', 'ApexClass:Service']);
    expect(result.summary.ignoredComponents).to.deep.equal(['ApexClass:FutureWork']);
    expect(result.scanResult.components.map((item) => item.type + ':' + item.name).sort()).to.deep.equal([
      'ApexClass:Base',
      'ApexClass:Service',
    ]);
    expect([...result.scanResult.dependencyResult.graph.get('ApexClass:Service')!]).to.deep.equal(['ApexClass:Base']);
  });

  it('reads commits from story manifests and ignores deleted metadata that is no longer in the scan', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'commit-scope-manifest-'));
    tempDirs.push(projectRoot);
    await mkdir(path.join(projectRoot, 'manifests'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'manifests/scope.json'),
      JSON.stringify({ stories: [{ id: 'US-10', commits: ['story-sha'] }] }),
      'utf8'
    );
    const scanResult = createScanResult({
      projectRoot,
      components: [component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls')],
      edges: [],
    });
    const service = createService([
      { commit: 'story-sha', status: 'deleted', path: 'force-app/main/default/classes/Old.cls' },
      { commit: 'story-sha', status: 'changed', path: 'force-app/main/default/classes/Service.cls' },
    ]);

    const result = await service.apply(scanResult, { manifestPath: 'manifests/scope.json' });

    expect(result.summary.commits).to.deep.equal(['story-sha']);
    expect(result.summary.changedComponents).to.deep.equal(['ApexClass:Service']);
    expect(result.summary.includedComponents).to.deep.equal(['ApexClass:Service']);
  });

  it('writes a deterministic story scope manifest from commits', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'commit-scope-output-'));
    tempDirs.push(projectRoot);
    const outputPath = path.join(projectRoot, 'manifests/story-scope.generated.json');
    const scanResult = createScanResult({
      projectRoot,
      components: [
        component('ApexClass', 'Base', 'force-app/main/default/classes/Base.cls'),
        component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls', ['ApexClass:Base']),
        component('ApexClass', 'FutureWork', 'force-app/main/default/classes/FutureWork.cls'),
      ],
      edges: [['ApexClass:Service', 'ApexClass:Base']],
    });
    const service = createService([
      { commit: 'abc123', status: 'changed', path: 'force-app/main/default/classes/Service.cls' },
    ]);

    const result = await service.apply(scanResult, {
      commits: ['abc123'],
      outputManifestPath: 'manifests/story-scope.generated.json',
    });
    const expectedManifest = `${JSON.stringify(
      {
        schemaVersion: 1,
        commits: ['abc123'],
        changes: [{ commit: 'abc123', status: 'changed', path: 'force-app/main/default/classes/Service.cls' }],
        scope: {
          changedComponents: ['ApexClass:Service'],
          dependencyComponents: ['ApexClass:Base'],
          explicitComponents: [],
          includedComponents: ['ApexClass:Base', 'ApexClass:Service'],
          ignoredComponents: ['ApexClass:FutureWork'],
        },
      },
      null,
      2
    )}\n`;

    expect(result.summary.manifestPath).to.equal('manifests/story-scope.generated.json');
    const manifestText = readFileSync(outputPath, 'utf8');
    expect(manifestText).to.equal(expectedManifest);
  });

  it('loads generated manifest scope as the CI release contract without querying git changes', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'commit-scope-load-'));
    tempDirs.push(projectRoot);
    await mkdir(path.join(projectRoot, 'manifests'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'manifests/story-scope.generated.json'),
      JSON.stringify({
        schemaVersion: 1,
        commits: ['abc123'],
        scope: {
          changedComponents: ['ApexClass:Service'],
          dependencyComponents: ['ApexClass:Base'],
          explicitComponents: [],
          includedComponents: ['ApexClass:Base', 'ApexClass:Service'],
          ignoredComponents: ['ApexClass:FutureWork'],
        },
      }),
      'utf8'
    );
    const scanResult = createScanResult({
      projectRoot,
      components: [
        component('ApexClass', 'Base', 'force-app/main/default/classes/Base.cls'),
        component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls', ['ApexClass:Base']),
        component('ApexClass', 'FutureWork', 'force-app/main/default/classes/FutureWork.cls'),
      ],
      edges: [['ApexClass:Service', 'ApexClass:Base']],
    });
    const service = createService([
      { commit: 'wrong-commit', status: 'changed', path: 'force-app/main/default/classes/FutureWork.cls' },
    ]);

    const result = await service.apply(scanResult, { manifestPath: 'manifests/story-scope.generated.json' });

    expect(result.summary.commits).to.deep.equal(['abc123']);
    expect(result.summary.changedComponents).to.deep.equal(['ApexClass:Service']);
    expect(result.summary.includedComponents).to.deep.equal(['ApexClass:Base', 'ApexClass:Service']);
    expect(result.summary.ignoredComponents).to.deep.equal(['ApexClass:FutureWork']);
    expect(result.scanResult.components.map((item) => item.type + ':' + item.name).sort()).to.deep.equal([
      'ApexClass:Base',
      'ApexClass:Service',
    ]);
  });

  it('keeps explicitly included story manifest components inside the scope boundary', async () => {
    const projectRoot = await mkdtemp(path.join(tmpdir(), 'commit-scope-explicit-'));
    tempDirs.push(projectRoot);
    await mkdir(path.join(projectRoot, 'manifests'), { recursive: true });
    await writeFile(
      path.join(projectRoot, 'manifests/scope.json'),
      JSON.stringify({
        stories: [{ id: 'US-10', commits: ['story-sha'], includeComponents: ['ApexClass:FutureWork'] }],
      }),
      'utf8'
    );
    const scanResult = createScanResult({
      projectRoot,
      components: [
        component('ApexClass', 'Service', 'force-app/main/default/classes/Service.cls'),
        component('ApexClass', 'FutureWork', 'force-app/main/default/classes/FutureWork.cls'),
      ],
      edges: [],
    });
    const service = createService([
      { commit: 'story-sha', status: 'changed', path: 'force-app/main/default/classes/Service.cls' },
    ]);

    const result = await service.apply(scanResult, { manifestPath: 'manifests/scope.json' });

    expect(result.summary.changedComponents).to.deep.equal(['ApexClass:Service']);
    expect(result.summary.explicitComponents).to.deep.equal(['ApexClass:FutureWork']);
    expect(result.summary.includedComponents).to.deep.equal(['ApexClass:FutureWork', 'ApexClass:Service']);
    expect(result.summary.ignoredComponents).to.deep.equal([]);
  });

  it('matches bundle changes from files inside the bundle directory', async () => {
    const scanResult = createScanResult({
      components: [
        component('LightningComponentBundle', 'accountPanel', 'force-app/main/default/lwc/accountPanel'),
        component('LightningComponentBundle', 'futurePanel', 'force-app/main/default/lwc/futurePanel'),
      ],
      edges: [],
    });
    const service = createService([
      { commit: 'abc123', status: 'changed', path: 'force-app/main/default/lwc/accountPanel/accountPanel.js' },
    ]);

    const result = await service.apply(scanResult, { commits: ['abc123'] });

    expect(result.summary.includedComponents).to.deep.equal(['LightningComponentBundle:accountPanel']);
    expect(result.summary.ignoredComponents).to.deep.equal(['LightningComponentBundle:futurePanel']);
  });
});

function createService(changes: CommitScopeGitChange[]): CommitScopeService {
  const gitChangeProvider: CommitScopeGitChangeProvider = {
    listCommitChanges: async () => changes,
  };

  return new CommitScopeService({ gitChangeProvider });
}

function createScanResult(options: {
  projectRoot?: string;
  components: MetadataComponent[];
  edges: Array<[string, string]>;
}): ScanResult {
  const projectRoot = options.projectRoot ?? '/repo';
  const components = options.components.map((item) => ({
    ...item,
    filePath: path.isAbsolute(item.filePath) ? item.filePath : path.join(projectRoot, item.filePath),
  }));

  return {
    projectRoot,
    apiVersion: '61.0',
    components,
    dependencyResult: createDependencyResult(components, options.edges),
    executionTime: 1,
    errors: [],
    warnings: [],
  };
}

function createDependencyResult(
  components: MetadataComponent[],
  edges: Array<[string, string]>
): DependencyAnalysisResult {
  const componentMap = new Map(components.map((item) => [item.type + ':' + item.name, item]));
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

function component(type: MetadataType, name: string, filePath: string, dependencies: string[] = []): MetadataComponent {
  return {
    type,
    name,
    filePath,
    dependencies: new Set(dependencies),
    dependencyDetails: dependencies.map((nodeId) => ({ nodeId, kind: 'hard' as const, source: 'parser' as const })),
    dependents: new Set(),
    priorityBoost: 0,
  };
}
