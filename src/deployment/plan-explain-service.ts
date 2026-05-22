import type { DependencyAnalysisResult, DependencyEdge, NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import { DeploymentContextService, type DeploymentContextBuildOptions } from './deployment-context-service.js';
import { SpecialDeploymentPlanService, type SpecialDeploymentPlan } from './special-deployment-plan.js';

export type PlanExplainOptions = DeploymentContextBuildOptions & {
  targetOrg?: string;
  since?: string;
  autoActivate?: boolean;
};

export type PlanExplainDependency = {
  from: NodeId;
  to: NodeId;
  type: DependencyEdge['type'];
  source: NonNullable<DependencyEdge['source']> | 'unknown';
  reason: string;
  confidence: number;
  resolved: boolean;
  fromWave?: number;
  toWave?: number;
};

export type PlanExplainComponent = {
  nodeId: NodeId;
  type: MetadataComponent['type'];
  name: string;
  filePath: string;
  wave: number;
  placement: {
    rationale: string;
    confidence: number;
    directDependencies: NodeId[];
    transitiveBlockers: NodeId[];
    unresolvedReferences: NodeId[];
  };
};

export type PlanExplainProviderDecision = {
  kind: string;
  label: string;
  decision: 'included' | 'skipped' | 'blocked';
  components: string[];
  excludedTypes: string[];
  commands: Array<{
    tool: string;
    args: string[];
    reason: string;
  }>;
  reason: string;
  warnings: string[];
  errors: string[];
};

export type PlanExplainResult = {
  success: boolean;
  projectRoot: string;
  apiVersion: string;
  components: PlanExplainComponent[];
  dependencies: PlanExplainDependency[];
  unresolvedReferences: PlanExplainDependency[];
  providerDecisions: PlanExplainProviderDecision[];
  summary: {
    componentCount: number;
    dependencyCount: number;
    unresolvedReferenceCount: number;
    providerDecisionCount: number;
    waves: number;
  };
  ai?: {
    enabled: boolean;
    provider?: string;
    model?: string;
    fallback?: boolean;
    inferredDependencies?: number;
    inferenceFallback?: boolean;
  };
  architecturalConcerns: {
    inherited: string[];
    selfImposed: string[];
  };
};

type PlanExplainServiceDependencies = {
  deploymentContextService?: Pick<DeploymentContextService, 'buildContext'>;
  specialDeploymentPlanService?: Pick<SpecialDeploymentPlanService, 'buildPlan'>;
};

export class PlanExplainService {
  private readonly deploymentContextService: Pick<DeploymentContextService, 'buildContext'>;
  private readonly specialDeploymentPlanService: Pick<SpecialDeploymentPlanService, 'buildPlan'>;

  public constructor(dependencies: PlanExplainServiceDependencies = {}) {
    this.deploymentContextService = dependencies.deploymentContextService ?? new DeploymentContextService();
    this.specialDeploymentPlanService = dependencies.specialDeploymentPlanService ?? new SpecialDeploymentPlanService();
  }

  public async explain(options: PlanExplainOptions = {}): Promise<PlanExplainResult> {
    const context = await this.deploymentContextService.buildContext(options);
    const providerPlan = await this.specialDeploymentPlanService.buildPlan({
      sourcePath: options.sourcePath,
      targetOrg: options.targetOrg,
      since: options.since,
      dryRun: true,
      autoActivate: options.autoActivate ?? false,
    });
    const waveByNodeId = buildWaveIndex(context.orderedWaves);
    const dependencyResult = context.scanResult.dependencyResult;
    const dependencies = dependencyResult.edges.map((edge) => explainDependency(edge, dependencyResult, waveByNodeId));
    const unresolvedReferences = dependencies.filter((dependency) => !dependency.resolved);

    return {
      success: context.scanResult.errors.length === 0 && providerPlan.success,
      projectRoot: context.scanResult.projectRoot,
      apiVersion: context.scanResult.apiVersion,
      components: context.scanResult.components
        .map((component) => explainComponent(component, dependencyResult, waveByNodeId))
        .sort((left, right) => left.nodeId.localeCompare(right.nodeId)),
      dependencies: dependencies.sort(compareDependency),
      unresolvedReferences: unresolvedReferences.sort(compareDependency),
      providerDecisions: explainProviderDecisions(providerPlan),
      summary: {
        componentCount: context.scanResult.components.length,
        dependencyCount: dependencies.length,
        unresolvedReferenceCount: unresolvedReferences.length,
        providerDecisionCount: providerPlan.phases.length,
        waves: context.orderedWaves.length,
      },
      ai: context.aiContext
        ? {
            enabled: context.aiContext.enabled,
            provider: context.aiContext.provider,
            model: context.aiContext.model,
            fallback: context.aiContext.fallback,
            inferredDependencies: context.aiContext.inferredDependencies,
            inferenceFallback: context.aiContext.inferenceFallback,
          }
        : undefined,
      architecturalConcerns: {
        inherited: [],
        selfImposed: [
          'Introduces a stable JSON explanation contract over existing deployment analysis outputs without changing wave generation.',
        ],
      },
    };
  }
}

function explainComponent(
  component: MetadataComponent,
  dependencyResult: DependencyAnalysisResult,
  waveByNodeId: ReadonlyMap<NodeId, number>
): PlanExplainComponent {
  const nodeId = toNodeId(component);
  const directDependencies = [...(dependencyResult.graph.get(nodeId) ?? [])].sort();
  const unresolvedReferences = directDependencies
    .filter((dependency) => !dependencyResult.components.has(dependency))
    .sort();
  const transitiveBlockers = collectTransitiveBlockers(nodeId, dependencyResult.graph, dependencyResult.components);
  const wave = waveByNodeId.get(nodeId) ?? 0;

  return {
    nodeId,
    type: component.type,
    name: component.name,
    filePath: component.filePath,
    wave,
    placement: {
      rationale: formatPlacementRationale(wave, directDependencies, transitiveBlockers, unresolvedReferences),
      confidence: calculatePlacementConfidence(directDependencies, unresolvedReferences, transitiveBlockers),
      directDependencies,
      transitiveBlockers,
      unresolvedReferences,
    },
  };
}

function explainDependency(
  edge: DependencyEdge,
  dependencyResult: DependencyAnalysisResult,
  waveByNodeId: ReadonlyMap<NodeId, number>
): PlanExplainDependency {
  return {
    from: edge.from,
    to: edge.to,
    type: edge.type,
    source: edge.source ?? 'unknown',
    reason: edge.reason ?? `${edge.from} depends on ${edge.to}`,
    confidence: edge.confidence ?? (edge.type === 'inferred' ? 0.7 : 1),
    resolved: dependencyResult.components.has(edge.to),
    fromWave: waveByNodeId.get(edge.from),
    toWave: waveByNodeId.get(edge.to),
  };
}

function explainProviderDecisions(plan: SpecialDeploymentPlan): PlanExplainProviderDecision[] {
  return plan.phases.map((phase) => ({
    kind: phase.kind,
    label: phase.label,
    decision: (phase.errors?.length ?? 0) > 0 ? 'blocked' : phase.skipped ? 'skipped' : 'included',
    components: [...phase.components].sort(),
    excludedTypes: [...(phase.excludedTypes ?? [])].sort(),
    commands: phase.commands.map((command) => ({
      tool: command.tool,
      args: [...command.args],
      reason: command.reason,
    })),
    reason: phase.skipReason ?? phase.commands.map((command) => command.reason).join(' '),
    warnings: [...(phase.warnings ?? [])],
    errors: [...(phase.errors ?? [])],
  }));
}

function buildWaveIndex(waves: readonly Wave[]): Map<NodeId, number> {
  const waveByNodeId = new Map<NodeId, number>();
  for (const wave of waves) {
    for (const nodeId of wave.components) {
      waveByNodeId.set(nodeId, wave.number);
    }
  }
  return waveByNodeId;
}

function collectTransitiveBlockers(
  nodeId: NodeId,
  graph: DependencyAnalysisResult['graph'],
  components: ReadonlyMap<NodeId, MetadataComponent>
): NodeId[] {
  const direct = graph.get(nodeId) ?? new Set<NodeId>();
  const blockers = new Set<NodeId>();
  const visited = new Set<NodeId>([nodeId]);
  const stack = [...direct];

  while (stack.length > 0) {
    const dependency = stack.pop()!;
    if (visited.has(dependency)) {
      continue;
    }

    visited.add(dependency);
    if (!direct.has(dependency) && components.has(dependency)) {
      blockers.add(dependency);
    }

    for (const next of graph.get(dependency) ?? []) {
      stack.push(next);
    }
  }

  return [...blockers].sort();
}

function formatPlacementRationale(
  wave: number,
  directDependencies: readonly NodeId[],
  transitiveBlockers: readonly NodeId[],
  unresolvedReferences: readonly NodeId[]
): string {
  if (wave === 0) {
    return 'Component was not assigned to a deployment wave.';
  }

  if (unresolvedReferences.length > 0) {
    return `Placed in wave ${wave} with unresolved references requiring target-org or pre-existing metadata checks.`;
  }

  if (directDependencies.length === 0) {
    return `Placed in wave ${wave} because it has no deployment dependencies.`;
  }

  if (transitiveBlockers.length > 0) {
    return `Placed in wave ${wave} after direct dependencies and ${transitiveBlockers.length} transitive blocker(s).`;
  }

  return `Placed in wave ${wave} after its direct dependencies are available.`;
}

function calculatePlacementConfidence(
  directDependencies: readonly NodeId[],
  unresolvedReferences: readonly NodeId[],
  transitiveBlockers: readonly NodeId[]
): number {
  if (unresolvedReferences.length > 0) {
    return 0.55;
  }

  if (directDependencies.length === 0) {
    return 1;
  }

  return transitiveBlockers.length > 0 ? 0.9 : 0.95;
}

function toNodeId(component: MetadataComponent): NodeId {
  return `${component.type}:${component.name}`;
}

function compareDependency(left: PlanExplainDependency, right: PlanExplainDependency): number {
  return left.from.localeCompare(right.from) || left.to.localeCompare(right.to);
}
