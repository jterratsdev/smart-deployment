import type { NodeId, DependencyGraph } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import {
  getComponentDependencyKind,
  isSoftDependencyKind,
  shouldIncludeDependencyInResolution,
} from './dependency-semantics.js';

export type DependencyFilterDecision = 'include' | 'exclude-managed' | 'exclude-optional';

export type DependencyResolutionClassifierOptions = {
  includeOptional: boolean;
  skipManaged: boolean;
};

export class DependencyResolutionClassifier {
  public constructor(
    private readonly components: ReadonlyMap<NodeId, MetadataComponent>,
    private readonly options: DependencyResolutionClassifierOptions
  ) {}

  public shouldIncludeNode(nodeId: NodeId): boolean {
    return !(this.options.skipManaged && this.isManagedPackage(nodeId));
  }

  public collectIncludedDependencies(nodeId: NodeId, dependencies: ReadonlySet<NodeId>): Set<NodeId> {
    const filteredDependencies = new Set<NodeId>();

    for (const dependencyId of dependencies) {
      if (this.classifyDependency(nodeId, dependencyId) === 'include') {
        filteredDependencies.add(dependencyId);
      }
    }

    return filteredDependencies;
  }

  public classifyDependency(nodeId: NodeId, dependencyId: NodeId): DependencyFilterDecision {
    if (this.options.skipManaged && this.isManagedPackage(dependencyId)) {
      return 'exclude-managed';
    }

    if (
      !shouldIncludeDependencyInResolution(
        getComponentDependencyKind(this.components.get(nodeId), dependencyId),
        this.options.includeOptional
      )
    ) {
      return 'exclude-optional';
    }

    return 'include';
  }

  public findOptionalDependencies(graph: DependencyGraph): NodeId[] {
    if (this.options.includeOptional) {
      return [];
    }

    const optional: NodeId[] = [];

    for (const [nodeId, deps] of graph.entries()) {
      for (const dep of deps) {
        if (!this.isOptionalDependency(nodeId, dep)) {
          continue;
        }

        if (this.options.skipManaged && this.isManagedPackage(dep)) {
          continue;
        }

        if (!optional.includes(dep)) {
          optional.push(dep);
        }
      }
    }

    return optional;
  }

  public findManagedPackages(): NodeId[] {
    const managed: NodeId[] = [];

    for (const nodeId of this.components.keys()) {
      if (this.isManagedPackage(nodeId)) {
        managed.push(nodeId);
      }
    }

    return managed;
  }

  public isManagedPackage(nodeId: NodeId): boolean {
    return nodeId.includes('__') || (this.components.get(nodeId)?.name.includes('__') ?? false);
  }

  private isOptionalDependency(nodeId: NodeId, dependencyId: NodeId): boolean {
    const component = this.components.get(nodeId);
    return isSoftDependencyKind(getComponentDependencyKind(component, dependencyId));
  }
}
