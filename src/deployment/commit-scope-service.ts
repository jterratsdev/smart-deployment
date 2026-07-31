import { execFile } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';

const execFileAsync = promisify(execFile);

export type CommitScopeOptions = {
  commits?: string[];
  manifestPath?: string;
  outputManifestPath?: string;
};

export type CommitScopeChangeStatus = 'added' | 'changed' | 'deleted';

export type CommitScopeGitChange = {
  commit: string;
  status: CommitScopeChangeStatus;
  path: string;
};

export type CommitScopeSummary = {
  enabled: boolean;
  commits: string[];
  manifestPath?: string;
  changedFiles: CommitScopeGitChange[];
  changedComponents: NodeId[];
  dependencyComponents: NodeId[];
  explicitComponents: NodeId[];
  includedComponents: NodeId[];
  ignoredComponents: NodeId[];
};

export type CommitScopeResult = {
  scanResult: ScanResult;
  summary: CommitScopeSummary;
};

export type CommitScopeGitChangeProvider = {
  listCommitChanges(projectRoot: string, commits: string[]): Promise<CommitScopeGitChange[]>;
};

type CommitScopeManifest = {
  schemaVersion?: 1;
  commits?: string[];
  generatedAt?: string;
  changes?: CommitScopeGitChange[];
  scope?: {
    changedComponents?: string[];
    dependencyComponents?: string[];
    explicitComponents?: string[];
    includedComponents?: string[];
    ignoredComponents?: string[];
  };
  includeComponents?: string[];
  stories?: Array<{
    id?: string;
    key?: string;
    commits?: string[];
    includeComponents?: string[];
  }>;
};

type CommitScopeServiceDependencies = {
  gitChangeProvider?: CommitScopeGitChangeProvider;
};

export class CommitScopeService {
  private readonly gitChangeProvider: CommitScopeGitChangeProvider;

  public constructor(dependencies: CommitScopeServiceDependencies = {}) {
    this.gitChangeProvider = dependencies.gitChangeProvider ?? new CliCommitScopeGitChangeProvider();
  }

  public async apply(scanResult: ScanResult, options: CommitScopeOptions = {}): Promise<CommitScopeResult> {
    const manifest = options.manifestPath
      ? await this.readManifest(scanResult.projectRoot, options.manifestPath)
      : undefined;
    const commits = this.resolveCommits(options, manifest);
    const manifestScope = manifest ? this.resolveManifestScope(manifest) : undefined;

    if (commits.length === 0 && (manifestScope?.includedComponents.length ?? 0) === 0) {
      return {
        scanResult,
        summary: createDisabledSummary(),
      };
    }

    const commitScope =
      manifestScope?.hasIncludedComponentContract === true
        ? {
            changedFiles: manifest?.changes ?? [],
            changedNodeIds: manifestScope.changedComponents,
            dependencyNodeIds: manifestScope.dependencyComponents,
            explicitNodeIds: manifestScope.explicitComponents,
            includedNodeIds: manifestScope.includedComponents,
          }
        : await this.resolveScopeFromCommits(scanResult, commits, manifestScope?.explicitComponents ?? []);
    const includedNodeIds = this.deduplicate(commitScope.includedNodeIds);
    const included = new Set(includedNodeIds);
    const scopedComponents = scanResult.components
      .filter((component) => included.has(toNodeId(component)))
      .map((component) => cloneComponentForScope(component, included));
    const graphBuilder = new DependencyGraphBuilder();
    graphBuilder.addComponents(scopedComponents);
    const scopedDependencyResult = graphBuilder.build();
    const ignoredComponents = scanResult.components
      .map((component) => toNodeId(component))
      .filter((nodeId) => !included.has(nodeId))
      .sort();
    const summary: CommitScopeSummary = {
      enabled: true,
      commits,
      manifestPath: options.outputManifestPath ?? options.manifestPath,
      changedFiles: commitScope.changedFiles,
      changedComponents: commitScope.changedNodeIds,
      dependencyComponents: commitScope.dependencyNodeIds,
      explicitComponents: commitScope.explicitNodeIds,
      includedComponents: includedNodeIds,
      ignoredComponents,
    };

    if (options.outputManifestPath) {
      await this.writeManifest(scanResult.projectRoot, options.outputManifestPath, summary);
    }

    return {
      scanResult: {
        ...scanResult,
        components: scopedComponents,
        dependencyResult: scopedDependencyResult,
      },
      summary,
    };
  }

  private resolveCommits(options: CommitScopeOptions, manifest?: CommitScopeManifest): string[] {
    const directCommits = parseCommitList(options.commits ?? []);
    const manifestCommits = manifest ? parseCommitList(extractManifestCommits(manifest)) : [];

    return this.deduplicate([...directCommits, ...manifestCommits]);
  }

  private async readManifest(projectRoot: string, manifestPath: string): Promise<CommitScopeManifest> {
    const resolvedPath = path.isAbsolute(manifestPath) ? manifestPath : path.join(projectRoot, manifestPath);
    const raw = await readFile(resolvedPath, 'utf8');
    const parsed = JSON.parse(raw) as CommitScopeManifest;

    if (!parsed || typeof parsed !== 'object') {
      throw new Error(`Commit scope manifest must be a JSON object: ${resolvedPath}`);
    }

    return parsed;
  }

  private async writeManifest(projectRoot: string, manifestPath: string, summary: CommitScopeSummary): Promise<void> {
    const resolvedPath = path.isAbsolute(manifestPath) ? manifestPath : path.join(projectRoot, manifestPath);
    await mkdir(path.dirname(resolvedPath), { recursive: true });
    await writeFile(resolvedPath, `${JSON.stringify(toManifest(summary), null, 2)}\n`, 'utf8');
  }

  private resolveManifestScope(manifest: CommitScopeManifest):
    | {
        changedComponents: NodeId[];
        dependencyComponents: NodeId[];
        explicitComponents: NodeId[];
        includedComponents: NodeId[];
        hasIncludedComponentContract: boolean;
      }
    | undefined {
    const changedComponents = parseNodeIdList(manifest.scope?.changedComponents ?? []);
    const dependencyComponents = parseNodeIdList(manifest.scope?.dependencyComponents ?? []);
    const explicitComponents = parseNodeIdList([
      ...(manifest.scope?.explicitComponents ?? []),
      ...(manifest.includeComponents ?? []),
      ...(manifest.stories?.flatMap((story) => story.includeComponents ?? []) ?? []),
    ]);
    const contractComponents = parseNodeIdList(manifest.scope?.includedComponents ?? []);
    const includedComponents = parseNodeIdList([
      ...contractComponents,
      ...changedComponents,
      ...dependencyComponents,
      ...explicitComponents,
    ]);

    if (
      changedComponents.length === 0 &&
      dependencyComponents.length === 0 &&
      explicitComponents.length === 0 &&
      includedComponents.length === 0
    ) {
      return undefined;
    }

    return {
      changedComponents,
      dependencyComponents,
      explicitComponents,
      includedComponents,
      hasIncludedComponentContract: contractComponents.length > 0,
    };
  }

  private async resolveScopeFromCommits(
    scanResult: ScanResult,
    commits: string[],
    explicitNodeIds: NodeId[]
  ): Promise<{
    changedFiles: CommitScopeGitChange[];
    changedNodeIds: NodeId[];
    dependencyNodeIds: NodeId[];
    explicitNodeIds: NodeId[];
    includedNodeIds: NodeId[];
  }> {
    const changedFiles = await this.gitChangeProvider.listCommitChanges(scanResult.projectRoot, commits);
    const changedComponents = this.resolveChangedComponents(scanResult, changedFiles);
    const changedNodeIds = this.deduplicate(changedComponents.map((component) => toNodeId(component)));
    const dependencyNodeIds = this.collectDependencyClosure(scanResult, changedNodeIds);
    const knownExplicitNodeIds = this.filterKnownNodeIds(scanResult, explicitNodeIds);
    const includedNodeIds = this.deduplicate([...changedNodeIds, ...dependencyNodeIds, ...knownExplicitNodeIds]);

    return {
      changedFiles,
      changedNodeIds,
      dependencyNodeIds,
      explicitNodeIds: knownExplicitNodeIds,
      includedNodeIds,
    };
  }

  private resolveChangedComponents(scanResult: ScanResult, changes: CommitScopeGitChange[]): MetadataComponent[] {
    const components: MetadataComponent[] = [];

    for (const change of changes) {
      if (change.status === 'deleted') {
        continue;
      }

      const component = scanResult.components.find((candidate) =>
        isComponentPathMatch(scanResult.projectRoot, candidate, change.path)
      );

      if (component) {
        components.push(component);
      }
    }

    return this.deduplicateComponents(components);
  }

  private collectDependencyClosure(scanResult: ScanResult, changedNodeIds: NodeId[]): NodeId[] {
    const knownComponents = scanResult.dependencyResult.components;
    const dependencies = new Set<NodeId>();
    const visited = new Set<NodeId>(changedNodeIds);
    const queue = [...changedNodeIds];

    while (queue.length > 0) {
      const nodeId = queue.shift()!;
      for (const dependency of scanResult.dependencyResult.graph.get(nodeId) ?? []) {
        if (!knownComponents.has(dependency) || visited.has(dependency)) {
          continue;
        }

        visited.add(dependency);
        dependencies.add(dependency);
        queue.push(dependency);
      }
    }

    return [...dependencies].sort();
  }

  private deduplicate(values: string[]): NodeId[] {
    return [...new Set(values.filter(Boolean))].sort();
  }

  private deduplicateComponents(components: MetadataComponent[]): MetadataComponent[] {
    const byNodeId = new Map<NodeId, MetadataComponent>();
    for (const component of components) {
      byNodeId.set(toNodeId(component), component);
    }

    return [...byNodeId.values()].sort((left, right) => toNodeId(left).localeCompare(toNodeId(right)));
  }

  private filterKnownNodeIds(scanResult: ScanResult, nodeIds: NodeId[]): NodeId[] {
    return this.deduplicate(nodeIds.filter((nodeId) => scanResult.dependencyResult.components.has(nodeId)));
  }
}

class CliCommitScopeGitChangeProvider implements CommitScopeGitChangeProvider {
  public async listCommitChanges(projectRoot: string, commits: string[]): Promise<CommitScopeGitChange[]> {
    const changesByCommit = await Promise.all(
      commits.map(async (commit) => {
        const { stdout } = await execFileAsync(
          'git',
          ['diff-tree', '--no-commit-id', '--name-status', '--no-renames', '-r', '--root', commit],
          { cwd: projectRoot }
        );
        return parseNameStatus(stdout, commit);
      })
    );

    return deduplicateChanges(changesByCommit.flat());
  }
}

function parseNameStatus(output: string, commit: string): CommitScopeGitChange[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [statusCode, filePath] = line.split(/\t+/);
      return {
        commit,
        status: toChangeStatus(statusCode),
        path: normalizePath(filePath),
      };
    });
}

function parseCommitList(values: string[]): string[] {
  return values
    .flatMap((value) => value.split(','))
    .map((value) => value.trim())
    .filter(Boolean);
}

function parseNodeIdList(values: string[]): NodeId[] {
  return [...new Set(values.map((value) => value.trim()).filter((value) => value.includes(':')))].sort();
}

function extractManifestCommits(manifest: CommitScopeManifest): string[] {
  return [
    ...(Array.isArray(manifest.commits) ? manifest.commits : []),
    ...(Array.isArray(manifest.stories) ? manifest.stories.flatMap((story) => story.commits ?? []) : []),
  ];
}

function cloneComponentForScope(component: MetadataComponent, included: ReadonlySet<NodeId>): MetadataComponent {
  const dependencies = filterNodeSet(component.dependencies, included);
  const optionalDependencies = component.optionalDependencies
    ? filterNodeSet(component.optionalDependencies, included)
    : undefined;

  return {
    ...component,
    dependencies,
    optionalDependencies,
    dependencyDetails: component.dependencyDetails?.filter((dependency) => included.has(dependency.nodeId)),
    dependents: filterNodeSet(component.dependents, included),
  };
}

function filterNodeSet(values: ReadonlySet<string>, allowed: ReadonlySet<NodeId>): Set<string> {
  return new Set([...values].filter((value) => allowed.has(value)));
}

function isComponentPathMatch(projectRoot: string, component: MetadataComponent, changedPath: string): boolean {
  const relativeComponentPath = path.isAbsolute(component.filePath)
    ? path.relative(projectRoot, component.filePath)
    : component.filePath;
  const componentPath = normalizePath(relativeComponentPath);
  if (changedPath === componentPath || changedPath === `${componentPath}-meta.xml`) {
    return true;
  }

  if (component.type !== 'LightningComponentBundle' && component.type !== 'AuraDefinitionBundle') {
    return false;
  }

  const componentDirectory = normalizePath(path.dirname(componentPath));
  return changedPath.startsWith(`${componentDirectory}/`);
}

function toChangeStatus(statusCode: string): CommitScopeChangeStatus {
  if (statusCode.includes('D')) {
    return 'deleted';
  }

  if (statusCode.includes('A')) {
    return 'added';
  }

  return 'changed';
}

function deduplicateChanges(changes: CommitScopeGitChange[]): CommitScopeGitChange[] {
  const byCommitAndPath = new Map<string, CommitScopeGitChange>();
  for (const change of changes) {
    byCommitAndPath.set(`${change.commit}:${change.path}`, change);
  }

  return [...byCommitAndPath.values()].sort(
    (left, right) => left.commit.localeCompare(right.commit) || left.path.localeCompare(right.path)
  );
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function toNodeId(component: MetadataComponent): NodeId {
  return `${component.type}:${component.name}`;
}

function toManifest(summary: CommitScopeSummary): CommitScopeManifest {
  return {
    schemaVersion: 1,
    commits: summary.commits,
    changes: summary.changedFiles,
    scope: {
      changedComponents: summary.changedComponents,
      dependencyComponents: summary.dependencyComponents,
      explicitComponents: summary.explicitComponents,
      includedComponents: summary.includedComponents,
      ignoredComponents: summary.ignoredComponents,
    },
  };
}

function createDisabledSummary(): CommitScopeSummary {
  return {
    enabled: false,
    commits: [],
    changedFiles: [],
    changedComponents: [],
    dependencyComponents: [],
    explicitComponents: [],
    includedComponents: [],
    ignoredComponents: [],
  };
}
