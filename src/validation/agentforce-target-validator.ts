import type { Manifest } from '../types/deployment.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { parseNodeId } from '../utils/node-id.js';

export type AgentforceTargetIssueSeverity = 'warning' | 'error';

export type AgentforceTargetIssue = {
  severity: AgentforceTargetIssueSeverity;
  consumer: NodeId;
  target: NodeId;
  message: string;
};

export type AgentforceTargetValidationResult = {
  valid: boolean;
  issues: AgentforceTargetIssue[];
};

const AGENTFORCE_TYPES = new Set(['AiAuthoringBundle', 'GenAiPlannerBundle', 'GenAiFunction', 'GenAiPlugin']);

const TARGET_TYPES = new Set([
  'Flow',
  'ApexClass',
  'GenAiPromptTemplate',
  'GenAiFunction',
  'GenAiPlugin',
  'AiAuthoringBundle',
  'GenAiPlannerBundle',
]);

const SALESFORCE_TYPE_BY_INTERNAL_TYPE: Record<string, string> = {
  GenAiPromptTemplate: 'GenAIPromptTemplate',
};

const INTERNAL_TYPE_BY_SALESFORCE_TYPE = new Map(
  Object.entries(SALESFORCE_TYPE_BY_INTERNAL_TYPE).map(([internalType, salesforceType]) => [
    salesforceType,
    internalType,
  ])
);

/**
 * Validates Agentforce references against the generated waves and manifests.
 * A target absent from source is a warning because it may already exist in the
 * target org; a local target missing from the plan or ordered after its
 * consumer is an error.
 */
export function validateAgentforceTargets(
  waves: Wave[],
  manifests: Manifest[],
  componentMap: Map<NodeId, MetadataComponent>
): AgentforceTargetValidationResult {
  const waveByComponent = new Map<NodeId, number>();
  for (const wave of waves) {
    for (const componentId of wave.components) {
      // Manifest adjustments can intentionally repeat a component. Its first
      // deployment is the wave that determines whether a target is available.
      const existingWave = waveByComponent.get(componentId);
      if (existingWave === undefined || wave.number < existingWave) {
        waveByComponent.set(componentId, wave.number);
      }
    }
  }

  const manifestComponents = new Set<string>();
  for (const manifest of manifests) {
    for (const [type, names] of Object.entries(manifest.components)) {
      const internalType = INTERNAL_TYPE_BY_SALESFORCE_TYPE.get(type) ?? type;
      for (const name of names) {
        manifestComponents.add(`${type}:${name}`);
        manifestComponents.add(`${internalType}:${name}`);
      }
    }
  }

  const issues: AgentforceTargetIssue[] = [];
  for (const [consumerId, consumer] of componentMap.entries()) {
    if (!AGENTFORCE_TYPES.has(consumer.type)) continue;

    const consumerWave = waveByComponent.get(consumerId);
    if (consumerWave === undefined) continue;

    for (const targetId of consumer.dependencies) {
      const parsedTarget = parseNodeId(targetId);
      if (!parsedTarget) continue;
      const { type: targetType, name: targetName } = parsedTarget;
      if (!TARGET_TYPES.has(targetType)) continue;

      const targetComponent = componentMap.get(targetId);
      if (!targetComponent) {
        issues.push({
          severity: 'warning',
          consumer: consumerId,
          target: targetId,
          message: 'Target is not present in the scanned source; it must already exist in the target org',
        });
        continue;
      }

      const targetWave = waveByComponent.get(targetId);
      if (targetWave === undefined) {
        issues.push({
          severity: 'error',
          consumer: consumerId,
          target: targetId,
          message: 'Target exists in source but is not assigned to a deployment wave',
        });
        continue;
      }

      const manifestType = SALESFORCE_TYPE_BY_INTERNAL_TYPE[targetType] ?? targetType;
      if (!manifestComponents.has(`${manifestType}:${targetName}`)) {
        issues.push({
          severity: 'error',
          consumer: consumerId,
          target: targetId,
          message: 'Target is assigned to a wave but is absent from all generated manifests',
        });
      }

      if (targetWave >= consumerWave) {
        issues.push({
          severity: 'error',
          consumer: consumerId,
          target: targetId,
          message: `Target is scheduled in wave ${targetWave}, not before consumer wave ${consumerWave}`,
        });
      }
    }
  }

  return {
    valid: issues.every((issue) => issue.severity !== 'error'),
    issues,
  };
}
