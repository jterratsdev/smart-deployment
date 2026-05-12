import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataDependencyReference, MetadataType } from '../types/metadata.js';
import { DEFAULT_GRAPH_DEPENDENCY_KIND, expandComponentDependencyReferences } from './dependency-semantics.js';
import type { DependencyType } from './dependency-graph-builder.js';

export type ExpandedDependencyDetail = {
  nodeId: NodeId;
  kind: DependencyType;
  source?: MetadataDependencyReference['source'];
  reason?: string;
  confidence?: number;
};

export type ComponentIntake = {
  nodeId: NodeId;
  dependencyDetails: ExpandedDependencyDetail[];
};

export function createComponentNodeId(type: MetadataType, name: string): NodeId {
  return `${type}:${name}`;
}

export function createComponentIntake(component: MetadataComponent): ComponentIntake {
  return {
    nodeId: createComponentNodeId(component.type, component.name),
    dependencyDetails: expandGraphDependencyDetails(component),
  };
}

export function expandGraphDependencyDetails(component: MetadataComponent): ExpandedDependencyDetail[] {
  return expandComponentDependencyReferences(component, DEFAULT_GRAPH_DEPENDENCY_KIND).map((dependency) => ({
    nodeId: dependency.nodeId,
    kind: dependency.kind,
    source: dependency.source,
    reason: dependency.reason,
    confidence: dependency.confidence,
  }));
}
