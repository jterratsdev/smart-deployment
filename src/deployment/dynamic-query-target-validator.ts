import type { DependencyAnalysisResult, DependencyEdge } from '../types/dependency.js';
import type { NodeId } from '../types/dependency.js';

export type DynamicQueryMissingField = {
  consumerNodeId: NodeId;
  fieldNodeId: NodeId;
  objectName: string;
  fieldName: string;
  reason?: string;
  confidence?: number;
};

export type DynamicQueryTargetValidationResult = {
  checked: boolean;
  missingFields: DynamicQueryMissingField[];
  unresolvedFields: DynamicQueryMissingField[];
};

export type DynamicQueryTargetLookup = {
  hasCustomField(targetOrg: string, objectName: string, fieldName: string): Promise<boolean>;
};

export class DynamicQueryTargetValidator {
  public constructor(private readonly lookup: DynamicQueryTargetLookup) {}

  public async validate(
    dependencyResult: DependencyAnalysisResult,
    targetOrg?: string
  ): Promise<DynamicQueryTargetValidationResult> {
    const unresolvedFields = collectUnresolvedDynamicQueryFields(dependencyResult);
    if (!targetOrg || unresolvedFields.length === 0) {
      return {
        checked: false,
        missingFields: [],
        unresolvedFields,
      };
    }

    const checkedFields = await Promise.all(
      unresolvedFields.map(async (field) => ({
        field,
        exists: await this.lookup.hasCustomField(targetOrg, field.objectName, field.fieldName),
      }))
    );
    const missingFields = checkedFields
      .filter((fieldResult) => !fieldResult.exists)
      .map((fieldResult) => fieldResult.field);

    return {
      checked: true,
      missingFields,
      unresolvedFields,
    };
  }
}

export function collectUnresolvedDynamicQueryFields(
  dependencyResult: DependencyAnalysisResult
): DynamicQueryMissingField[] {
  const unresolvedFields: DynamicQueryMissingField[] = [];
  const seen = new Set<string>();

  for (const edge of dependencyResult.edges) {
    if (!isDynamicQueryFieldEdge(edge) || dependencyResult.components.has(edge.to)) {
      continue;
    }

    const parsed = parseCustomFieldNodeId(edge.to);
    if (!parsed || seen.has(`${edge.from}->${edge.to}`)) {
      continue;
    }

    seen.add(`${edge.from}->${edge.to}`);
    unresolvedFields.push({
      consumerNodeId: edge.from,
      fieldNodeId: edge.to,
      objectName: parsed.objectName,
      fieldName: parsed.fieldName,
      reason: edge.reason,
      confidence: edge.confidence,
    });
  }

  return unresolvedFields;
}

function isDynamicQueryFieldEdge(edge: DependencyEdge): boolean {
  return edge.to.startsWith('CustomField:') && edge.reason?.startsWith('Dynamic SOQL') === true;
}

function parseCustomFieldNodeId(nodeId: NodeId): { objectName: string; fieldName: string } | undefined {
  const match = /^CustomField:([a-zA-Z][a-zA-Z0-9_]*(?:__c|__mdt)?)\.([a-zA-Z][a-zA-Z0-9_]*(?:__c)?)$/.exec(nodeId);
  if (!match) {
    return undefined;
  }

  return {
    objectName: match[1],
    fieldName: match[2],
  };
}
