import { execFile } from 'node:child_process';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { DeploymentContextService, type DeploymentContext } from '../deployment/deployment-context-service.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { DependencyImpactAnalyzer, type ImpactLevel, type TestScope } from './dependency-impact-analyzer.js';

const execFileAsync = promisify(execFile);

export type ImpactMode = 'refs' | 'working-tree';
export type ImpactChangeStatus = 'added' | 'changed' | 'deleted';

export type ImpactGitChange = {
  status: ImpactChangeStatus;
  path: string;
};

export type ImpactChangedComponent = {
  nodeId: NodeId;
  type: string;
  name: string;
  filePath: string;
  status: ImpactChangeStatus;
  foundInScan: boolean;
};

export type ImpactPlannedWave = {
  number: number;
  components: NodeId[];
};

export type ImpactSummary = {
  changedComponentCount: number;
  transitiveDependentCount: number;
  affectedComponentCount: number;
  plannedWaveCount: number;
  suggestedApexTestCount: number;
  overallImpactLevel: ImpactLevel;
};

export type ImpactCommandResult = {
  success: boolean;
  mode: ImpactMode;
  base?: string;
  head?: string;
  projectRoot: string;
  changedFiles: ImpactGitChange[];
  changedComponents: ImpactChangedComponent[];
  transitiveDependents: NodeId[];
  affectedComponents: NodeId[];
  plannedWaves: ImpactPlannedWave[];
  suggestedApexTests: TestScope;
  impact: {
    totalAffected: number;
    overallImpactLevel: ImpactLevel;
    criticalComponents: NodeId[];
  };
  summary: ImpactSummary;
};

export type ImpactAnalysisOptions = {
  sourcePath?: string;
  base?: string;
  head?: string;
  workingTree?: boolean;
  maxDepth?: number;
};

export type GitChangeProvider = {
  listRefChanges(projectRoot: string, base: string, head: string): Promise<ImpactGitChange[]>;
  listWorkingTreeChanges(projectRoot: string): Promise<ImpactGitChange[]>;
};

type ImpactAnalysisServiceDependencies = {
  contextService?: Pick<DeploymentContextService, 'buildContext'>;
  gitChangeProvider?: GitChangeProvider;
};

export class ImpactAnalysisService {
  private readonly contextService: Pick<DeploymentContextService, 'buildContext'>;
  private readonly gitChangeProvider: GitChangeProvider;

  public constructor(dependencies: ImpactAnalysisServiceDependencies = {}) {
    this.contextService = dependencies.contextService ?? new DeploymentContextService();
    this.gitChangeProvider = dependencies.gitChangeProvider ?? new CliGitChangeProvider();
  }

  public async analyze(options: ImpactAnalysisOptions = {}): Promise<ImpactCommandResult> {
    this.validateMode(options);
    const context = await this.contextService.buildContext({ sourcePath: options.sourcePath });
    const mode: ImpactMode = options.base && options.head ? 'refs' : 'working-tree';
    const changedFiles =
      mode === 'refs'
        ? await this.gitChangeProvider.listRefChanges(context.scanResult.projectRoot, options.base!, options.head!)
        : await this.gitChangeProvider.listWorkingTreeChanges(context.scanResult.projectRoot);
    const changedComponents = this.resolveChangedComponents(context, changedFiles);
    const changedNodeIds = this.deduplicate(changedComponents.map((component) => component.nodeId));
    const impactAnalyzer = new DependencyImpactAnalyzer(
      context.scanResult.dependencyResult.graph,
      context.scanResult.dependencyResult.reverseGraph,
      { maxDepth: options.maxDepth, includeTests: true }
    );
    const impact = impactAnalyzer.analyze(changedNodeIds);
    const transitiveDependents = this.collectTransitiveDependents(
      context.scanResult.dependencyResult.reverseGraph,
      changedNodeIds,
      options.maxDepth
    );
    const affectedComponents = this.deduplicate([...changedNodeIds, ...transitiveDependents]);
    const plannedWaves = this.filterPlannedWaves(context.orderedWaves, affectedComponents);

    return {
      success: true,
      mode,
      base: mode === 'refs' ? options.base : undefined,
      head: mode === 'refs' ? options.head : undefined,
      projectRoot: context.scanResult.projectRoot,
      changedFiles,
      changedComponents,
      transitiveDependents,
      affectedComponents,
      plannedWaves,
      suggestedApexTests: impact.testScope,
      impact: {
        totalAffected: impact.totalAffected,
        overallImpactLevel: impact.overallImpactLevel,
        criticalComponents: impact.criticalComponents,
      },
      summary: {
        changedComponentCount: changedComponents.length,
        transitiveDependentCount: transitiveDependents.length,
        affectedComponentCount: affectedComponents.length,
        plannedWaveCount: plannedWaves.length,
        suggestedApexTestCount: impact.testScope.estimatedTestCount,
        overallImpactLevel: impact.overallImpactLevel,
      },
    };
  }

  private validateMode(options: ImpactAnalysisOptions): void {
    if (
      (options.base !== undefined && options.head === undefined) ||
      (options.base === undefined && options.head !== undefined)
    ) {
      throw new Error('Both --base and --head are required when analyzing git refs');
    }

    if (options.workingTree === true && (options.base !== undefined || options.head !== undefined)) {
      throw new Error('--working-tree cannot be combined with --base or --head');
    }
  }

  private resolveChangedComponents(context: DeploymentContext, changes: ImpactGitChange[]): ImpactChangedComponent[] {
    const resolved: ImpactChangedComponent[] = [];

    for (const change of changes) {
      const component = this.findComponentForPath(context, change.path);
      if (component) {
        resolved.push({
          nodeId: toNodeId(component),
          type: component.type,
          name: component.name,
          filePath: path.relative(context.scanResult.projectRoot, component.filePath),
          status: change.status,
          foundInScan: true,
        });
        continue;
      }

      const inferred = inferComponentFromPath(change.path);
      if (inferred) {
        resolved.push({
          nodeId: inferred.nodeId,
          type: inferred.type,
          name: inferred.name,
          filePath: change.path,
          status: change.status,
          foundInScan: false,
        });
      }
    }

    return this.deduplicateChangedComponents(resolved);
  }

  private findComponentForPath(context: DeploymentContext, relativeFilePath: string): MetadataComponent | undefined {
    const normalizedChangedPath = normalizePath(relativeFilePath);

    return context.scanResult.components.find((component) =>
      isComponentPathMatch(context.scanResult.projectRoot, component, normalizedChangedPath)
    );
  }

  private collectTransitiveDependents(
    reverseGraph: ReadonlyMap<NodeId, ReadonlySet<NodeId>>,
    changedNodeIds: NodeId[],
    maxDepth = Number.POSITIVE_INFINITY
  ): NodeId[] {
    const changed = new Set(changedNodeIds);
    const dependents = new Set<NodeId>();
    const visited = new Set<NodeId>();
    const queue = changedNodeIds.map((nodeId) => ({ nodeId, depth: 0 }));

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift()!;
      if (visited.has(nodeId) || depth > maxDepth) {
        continue;
      }

      visited.add(nodeId);
      for (const dependent of reverseGraph.get(nodeId) ?? []) {
        if (!changed.has(dependent)) {
          dependents.add(dependent);
        }

        if (!visited.has(dependent)) {
          queue.push({ nodeId: dependent, depth: depth + 1 });
        }
      }
    }

    return [...dependents].sort();
  }

  private filterPlannedWaves(waves: Wave[], affectedComponents: NodeId[]): ImpactPlannedWave[] {
    const affected = new Set(affectedComponents);
    return waves
      .map((wave) => ({
        number: wave.number,
        components: wave.components.filter((component) => affected.has(component)),
      }))
      .filter((wave) => wave.components.length > 0);
  }

  private deduplicate(values: NodeId[]): NodeId[] {
    return [...new Set(values)].sort();
  }

  private deduplicateChangedComponents(components: ImpactChangedComponent[]): ImpactChangedComponent[] {
    const byNodeId = new Map<NodeId, ImpactChangedComponent>();

    for (const component of components) {
      byNodeId.set(component.nodeId, component);
    }

    return [...byNodeId.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId));
  }
}

class CliGitChangeProvider implements GitChangeProvider {
  public async listRefChanges(projectRoot: string, base: string, head: string): Promise<ImpactGitChange[]> {
    const { stdout } = await execFileAsync('git', ['diff', '--name-status', '--no-renames', base, head], {
      cwd: projectRoot,
    });
    return parseNameStatus(stdout);
  }

  public async listWorkingTreeChanges(projectRoot: string): Promise<ImpactGitChange[]> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd: projectRoot });
    return parsePorcelainStatus(stdout);
  }
}

function parseNameStatus(output: string): ImpactGitChange[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [statusCode, filePath] = line.split(/\t+/);
      return { status: toChangeStatus(statusCode), path: normalizePath(filePath) };
    });
}

function parsePorcelainStatus(output: string): ImpactGitChange[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const statusCode = line.slice(0, 2);
      const rawPath = line.slice(3);
      const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;
      return { status: toChangeStatus(statusCode), path: normalizePath(filePath) };
    });
}

function toChangeStatus(statusCode: string): ImpactChangeStatus {
  if (statusCode.includes('D')) {
    return 'deleted';
  }

  if (statusCode.includes('A') || statusCode.includes('?')) {
    return 'added';
  }

  return 'changed';
}

function isComponentPathMatch(projectRoot: string, component: MetadataComponent, changedPath: string): boolean {
  const componentPath = normalizePath(path.relative(projectRoot, component.filePath));
  if (changedPath === componentPath || changedPath === `${componentPath}-meta.xml`) {
    return true;
  }

  if (component.type !== 'LightningComponentBundle' && component.type !== 'AuraDefinitionBundle') {
    return false;
  }

  const componentDirectory = normalizePath(path.dirname(componentPath));
  return changedPath.startsWith(`${componentDirectory}/`);
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function toNodeId(component: MetadataComponent): NodeId {
  return `${component.type}:${component.name}`;
}

function inferComponentFromPath(
  filePath: string
): Pick<ImpactChangedComponent, 'nodeId' | 'type' | 'name'> | undefined {
  const normalized = normalizePath(filePath);
  const rules: Array<{ pattern: RegExp; type: string; name: (match: RegExpExecArray) => string }> = [
    { pattern: /\/classes\/([^/]+)\.cls(?:-meta\.xml)?$/, type: 'ApexClass', name: (match) => match[1] },
    { pattern: /\/triggers\/([^/]+)\.trigger(?:-meta\.xml)?$/, type: 'ApexTrigger', name: (match) => match[1] },
    { pattern: /\/flows\/([^/]+)\.flow-meta\.xml$/, type: 'Flow', name: (match) => match[1] },
    { pattern: /\/lwc\/([^/]+)\//, type: 'LightningComponentBundle', name: (match) => match[1] },
    { pattern: /\/aura\/([^/]+)\//, type: 'AuraDefinitionBundle', name: (match) => match[1] },
    { pattern: /\/objects\/([^/]+)\/\1\.object-meta\.xml$/, type: 'CustomObject', name: (match) => match[1] },
    {
      pattern: /\/objects\/([^/]+)\/fields\/([^/]+)\.field-meta\.xml$/,
      type: 'CustomField',
      name: (match) => `${match[1]}.${match[2]}`,
    },
    {
      pattern: /\/permissionsets\/([^/]+)\.permissionset-meta\.xml$/,
      type: 'PermissionSet',
      name: (match) => match[1],
    },
    { pattern: /\/profiles\/([^/]+)\.profile-meta\.xml$/, type: 'Profile', name: (match) => match[1] },
    { pattern: /\/layouts\/([^/]+)\.layout-meta\.xml$/, type: 'Layout', name: (match) => match[1] },
    { pattern: /\/flexipages\/([^/]+)\.flexipage-meta\.xml$/, type: 'FlexiPage', name: (match) => match[1] },
  ];

  for (const rule of rules) {
    const match = rule.pattern.exec(`/${normalized}`);
    if (match) {
      const name = rule.name(match);
      return {
        nodeId: `${rule.type}:${name}`,
        type: rule.type,
        name,
      };
    }
  }

  return undefined;
}
