import { execFile } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { DependencyGraphBuilder } from '../dependencies/dependency-graph-builder.js';
import type { ScanResult } from '../services/metadata-scanner-service.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import type { DeploymentContext } from './deployment-context-service.js';

const execFileAsync = promisify(execFile);

export type RollbackChangeStatus = 'added' | 'modified' | 'deleted';

export type RollbackGitChange = {
  status: RollbackChangeStatus;
  path: string;
};

export type RollbackSummary = {
  from: string;
  to: string;
  changes: RollbackGitChange[];
  destructiveComponents: NodeId[];
  restoreComponents: NodeId[];
};

export type RollbackExecutionPlan = {
  summary: RollbackSummary;
  destructiveContext?: DeploymentContext;
  restoreContext?: DeploymentContext;
  cleanup: () => Promise<void>;
};

type RollbackPlanningServiceDependencies = {
  gitProvider?: RollbackGitProvider;
};

type BuildContext = (sourcePath: string) => Promise<DeploymentContext>;

export type RollbackGitProvider = {
  listChanges(projectRoot: string, fromRef: string, toRef: string): Promise<RollbackGitChange[]>;
  checkoutArchive(projectRoot: string, ref: string): Promise<RollbackWorkspace>;
};

export type RollbackWorkspace = {
  projectRoot: string;
  cleanup: () => Promise<void>;
};

export class RollbackPlanningService {
  private readonly gitProvider: RollbackGitProvider;

  public constructor(dependencies: RollbackPlanningServiceDependencies = {}) {
    this.gitProvider = dependencies.gitProvider ?? new CliRollbackGitProvider();
  }

  public async buildExecutionPlan(options: {
    projectRoot: string;
    fromRef: string;
    toRef: string;
    currentContext: DeploymentContext;
    buildContext: BuildContext;
  }): Promise<RollbackExecutionPlan> {
    const changes = await this.gitProvider.listChanges(options.projectRoot, options.fromRef, options.toRef);
    const destructiveChanges = changes.filter((change) => change.status === 'added');
    const restoreChanges = changes.filter((change) => change.status === 'modified' || change.status === 'deleted');
    const destructiveContext = this.filterContextByChanges(options.currentContext, destructiveChanges);
    const restoreWorkspace =
      restoreChanges.length > 0
        ? await this.gitProvider.checkoutArchive(options.projectRoot, options.fromRef)
        : undefined;
    const restoreContext = restoreWorkspace
      ? this.filterContextByChanges(await options.buildContext(restoreWorkspace.projectRoot), restoreChanges)
      : undefined;

    return {
      summary: {
        from: options.fromRef,
        to: options.toRef,
        changes,
        destructiveComponents: collectContextNodeIds(destructiveContext),
        restoreComponents: collectContextNodeIds(restoreContext),
      },
      destructiveContext: hasComponents(destructiveContext) ? destructiveContext : undefined,
      restoreContext: hasComponents(restoreContext) ? restoreContext : undefined,
      cleanup: async (): Promise<void> => {
        await restoreWorkspace?.cleanup();
      },
    };
  }

  public filterContextByChanges(context: DeploymentContext, changes: RollbackGitChange[]): DeploymentContext {
    const changedComponents = resolveChangedComponents(context.scanResult, changes);
    const included = new Set(changedComponents.map((component) => toNodeId(component)));
    const components = context.scanResult.components
      .filter((component) => included.has(toNodeId(component)))
      .map((component) => cloneComponent(component, included));
    const graphBuilder = new DependencyGraphBuilder();
    graphBuilder.addComponents(components);
    const dependencyResult = graphBuilder.build();

    return {
      ...context,
      scanResult: {
        ...context.scanResult,
        components,
        dependencyResult,
      },
      orderedWaves: filterWaves(context.orderedWaves, included),
    };
  }
}

class CliRollbackGitProvider implements RollbackGitProvider {
  public async listChanges(projectRoot: string, fromRef: string, toRef: string): Promise<RollbackGitChange[]> {
    const { stdout } = await execFileAsync('git', ['diff', '--name-status', '--no-renames', `${fromRef}..${toRef}`], {
      cwd: projectRoot,
    });
    return parseNameStatus(stdout);
  }

  public async checkoutArchive(projectRoot: string, ref: string): Promise<RollbackWorkspace> {
    const workspaceRoot = await mkdtemp(path.join(tmpdir(), 'smart-deployment-rollback-'));
    const archivePath = path.join(workspaceRoot, 'source.tar');
    await execFileAsync('git', ['archive', '--format=tar', '--output', archivePath, ref], { cwd: projectRoot });
    await execFileAsync('tar', ['-xf', archivePath, '-C', workspaceRoot]);
    await rm(archivePath, { force: true });

    return {
      projectRoot: workspaceRoot,
      cleanup: async (): Promise<void> => {
        await rm(workspaceRoot, { recursive: true, force: true });
      },
    };
  }
}

function parseNameStatus(output: string): RollbackGitChange[] {
  return output
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [statusCode, filePath] = line.split(/\t+/);
      return {
        status: toRollbackStatus(statusCode),
        path: normalizePath(filePath),
      };
    })
    .sort((left, right) => left.path.localeCompare(right.path));
}

function toRollbackStatus(statusCode: string): RollbackChangeStatus {
  if (statusCode.includes('A')) {
    return 'added';
  }

  if (statusCode.includes('D')) {
    return 'deleted';
  }

  return 'modified';
}

function resolveChangedComponents(scanResult: ScanResult, changes: RollbackGitChange[]): MetadataComponent[] {
  const components = new Map<NodeId, MetadataComponent>();
  for (const change of changes) {
    const component = scanResult.components.find((candidate) =>
      isComponentPathMatch(scanResult.projectRoot, candidate, change.path)
    );
    if (component) {
      components.set(toNodeId(component), component);
    }
  }

  return [...components.values()].sort((left, right) => toNodeId(left).localeCompare(toNodeId(right)));
}

function filterWaves(waves: Wave[], included: ReadonlySet<NodeId>): Wave[] {
  return waves
    .map((wave) => ({
      ...wave,
      components: wave.components.filter((nodeId) => included.has(nodeId)),
    }))
    .filter((wave) => wave.components.length > 0)
    .map((wave, index) => ({
      ...wave,
      number: index + 1,
      metadata: {
        ...wave.metadata,
        componentCount: wave.components.length,
      },
    }));
}

function cloneComponent(component: MetadataComponent, included: ReadonlySet<NodeId>): MetadataComponent {
  return {
    ...component,
    dependencies: filterNodeSet(component.dependencies, included),
    optionalDependencies: component.optionalDependencies
      ? filterNodeSet(component.optionalDependencies, included)
      : undefined,
    dependencyDetails: component.dependencyDetails?.filter((dependency) => included.has(dependency.nodeId)),
    dependents: filterNodeSet(component.dependents, included),
  };
}

function filterNodeSet(values: ReadonlySet<string>, included: ReadonlySet<NodeId>): Set<string> {
  return new Set([...values].filter((value) => included.has(value)));
}

function isComponentPathMatch(projectRoot: string, component: MetadataComponent, changedPath: string): boolean {
  const relativeComponentPath = path.isAbsolute(component.filePath)
    ? path.relative(projectRoot, component.filePath)
    : component.filePath;
  const componentPath = normalizePath(relativeComponentPath);
  if (changedPath === componentPath || changedPath === `${componentPath}-meta.xml`) {
    return true;
  }

  const bundleTypes = new Set([
    'LightningComponentBundle',
    'AuraDefinitionBundle',
    'DigitalExperienceBundle',
    'AiAuthoringBundle',
  ]);
  if (!bundleTypes.has(component.type)) {
    return false;
  }

  const componentDirectory = normalizePath(path.dirname(componentPath));
  return changedPath.startsWith(`${componentDirectory}/`);
}

function collectContextNodeIds(context?: DeploymentContext): NodeId[] {
  return context?.scanResult.components.map((component) => toNodeId(component)).sort() ?? [];
}

function hasComponents(context?: DeploymentContext): boolean {
  return (context?.scanResult.components.length ?? 0) > 0;
}

function normalizePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}

function toNodeId(component: MetadataComponent): NodeId {
  return `${component.type}:${component.name}`;
}

export const rollbackPlanningInternals = {
  parseNameStatus,
};
