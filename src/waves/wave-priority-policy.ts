import type { NodeId, DependencyEdge } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';

type DependencyRiskProfile = {
  hard: number;
  soft: number;
  inferred: number;
};

type WavePriorityProfile = {
  typeOrder: number;
  riskProfile: DependencyRiskProfile;
};

const TYPE_DEPLOYMENT_ORDER: MetadataType[] = [
  'CustomObject',
  'CustomField',
  'RecordType',
  'BusinessProcess',
  'Queue',
  'CompactLayout',
  'Layout',
  'ApexClass',
  'ApexTrigger',
  'Flow',
  'ValidationRule',
  'WorkflowRule',
  'EmailTemplate',
  'BrandingSet',
  'CustomSite',
  'Network',
  'DigitalExperienceBundle',
  'EmbeddedServiceConfig',
  'FlexiPage',
  'Profile',
  'PermissionSet',
];

export function buildEdgeTypesByFrom(
  dependencyEdges: readonly DependencyEdge[]
): Map<NodeId, Array<DependencyEdge['type']>> {
  const edgeTypesByFrom = new Map<NodeId, Array<DependencyEdge['type']>>();

  for (const edge of dependencyEdges) {
    const existing = edgeTypesByFrom.get(edge.from) ?? [];
    existing.push(edge.type);
    edgeTypesByFrom.set(edge.from, existing);
  }

  return edgeTypesByFrom;
}

export function compareWavePriority(
  edgeTypesByFrom: ReadonlyMap<NodeId, Array<DependencyEdge['type']>>,
  a: NodeId,
  b: NodeId
): number {
  const priorityA = createWavePriorityProfile(edgeTypesByFrom, a);
  const priorityB = createWavePriorityProfile(edgeTypesByFrom, b);
  const typeOrderComparison = priorityA.typeOrder - priorityB.typeOrder;
  if (typeOrderComparison !== 0) {
    return typeOrderComparison;
  }

  const riskComparison = compareTypedDependencyRisk(priorityA.riskProfile, priorityB.riskProfile);
  if (riskComparison !== 0) {
    return riskComparison;
  }

  return a.localeCompare(b);
}

export function extractMetadataType(nodeId: NodeId): MetadataType {
  return nodeId.split(':')[0] as MetadataType;
}

function createWavePriorityProfile(
  edgeTypesByFrom: ReadonlyMap<NodeId, Array<DependencyEdge['type']>>,
  nodeId: NodeId
): WavePriorityProfile {
  const metadataType = extractMetadataType(nodeId);
  return {
    typeOrder: getMetadataTypeDeploymentOrder(metadataType),
    riskProfile: getDependencyRiskProfile(edgeTypesByFrom, nodeId),
  };
}

function getMetadataTypeDeploymentOrder(type: MetadataType): number {
  const order = TYPE_DEPLOYMENT_ORDER.indexOf(type);
  return order === -1 ? 9999 : order;
}

function getDependencyRiskProfile(
  edgeTypesByFrom: ReadonlyMap<NodeId, Array<DependencyEdge['type']>>,
  nodeId: NodeId
): DependencyRiskProfile {
  const edgeTypes = edgeTypesByFrom.get(nodeId) ?? [];

  return edgeTypes.reduce(
    (accumulator, type) => ({
      ...accumulator,
      [type]: accumulator[type] + 1,
    }),
    {
      hard: 0,
      soft: 0,
      inferred: 0,
    }
  );
}

function compareTypedDependencyRisk(left: DependencyRiskProfile, right: DependencyRiskProfile): number {
  if (left.inferred !== right.inferred) {
    return left.inferred - right.inferred;
  }

  if (left.soft !== right.soft) {
    return left.soft - right.soft;
  }

  if (left.hard !== right.hard) {
    return right.hard - left.hard;
  }

  return 0;
}
