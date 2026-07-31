import type { DeploymentValidationSummary } from '../deployment/deployment-validation-service.js';
import type { DeploymentContext } from '../deployment/deployment-context-service.js';
import type { SpecialDeploymentExecutionResult } from '../deployment/special-deployment-executor.js';
import type { SpecialDeploymentPhase, SpecialDeploymentPlan } from '../deployment/special-deployment-plan.js';
import type {
  ReleaseFactStatus,
  ReleaseItemFact,
  ReleaseOperation,
  ReleasePhaseFact,
  ReleaseReportFacts,
  ReleaseRoute,
} from '../types/release-report.js';

export function buildCiPublishReportFacts(
  plan: SpecialDeploymentPlan,
  execution?: SpecialDeploymentExecutionResult
): ReleaseReportFacts {
  const phases = plan.phases.map((phase) => toSpecialPhaseFact(phase, plan, execution));
  const statusByPhase = new Map(phases.map((phase) => [phase.id, phase.status]));

  return {
    command: 'smart-deployment ci-publish',
    targetOrg: plan.targetOrg,
    analysisMode: 'deterministic',
    enrichment: { status: 'skipped' },
    outcome: execution ? (execution.success ? 'succeeded' : 'failed') : plan.success ? 'skipped' : 'failed',
    phases,
    items: plan.phases.flatMap((phase) =>
      phase.components.map((component) =>
        toItem(
          component,
          phase.kind,
          operationForPhase(phase.kind),
          routeForPhase(phase.kind),
          statusByPhase.get(phase.kind),
          plan.targetOrg
        )
      )
    ),
    reportWarnings: [...plan.warnings, ...plan.errors],
  };
}

export function buildValidationReportFacts(
  summary: DeploymentValidationSummary,
  targetOrg: string | undefined,
  useAI: boolean
): ReleaseReportFacts {
  const status: ReleaseFactStatus = summary.valid ? 'succeeded' : 'needs_review';
  return {
    command: 'smart-deployment validate',
    targetOrg,
    analysisMode: summary.aiAnalyzed ? 'ai_enriched' : 'deterministic',
    enrichment: {
      status: summary.aiAnalyzed ? 'available' : useAI ? 'unavailable' : 'skipped',
      warnings:
        useAI && !summary.aiAnalyzed
          ? ['AI validation unavailable; deterministic validation was retained.']
          : undefined,
    },
    outcome: summary.valid ? 'succeeded' : 'failed',
    phases: [
      {
        id: 'validation',
        route: 'validation',
        operation: 'validate',
        status,
        remediation: summary.issues.map((issue) => issue.message),
      },
    ],
    items: summary.componentIds.map((component) =>
      toItem(component, 'validation', 'validate', 'validation', status, targetOrg)
    ),
    reportWarnings: summary.issues.map((issue) => issue.message),
  };
}

export function buildStartReportFacts(
  context: DeploymentContext,
  options: {
    targetOrg?: string;
    dryRun: boolean;
    validateOnly: boolean;
    failed?: boolean;
    warning?: string;
  }
): ReleaseReportFacts {
  const operation: ReleaseOperation = options.validateOnly ? 'validate' : 'deploy';
  const status: ReleaseFactStatus = options.failed ? 'failed' : options.dryRun ? 'skipped' : 'succeeded';
  const phaseId = options.validateOnly ? 'validation' : 'core-metadata';
  const route = options.validateOnly ? 'validation' : 'salesforce-metadata';
  const aiContext = context.aiContext;
  const isAIEnriched =
    aiContext?.enabled === true && aiContext.fallback !== true && aiContext.inferenceFallback !== true;

  return {
    command: 'smart-deployment start',
    targetOrg: options.targetOrg,
    analysisMode: isAIEnriched ? 'ai_enriched' : 'deterministic',
    enrichment: {
      status: isAIEnriched ? 'available' : aiContext?.enabled ? 'partial' : 'skipped',
      warnings:
        aiContext?.enabled && !isAIEnriched
          ? ['AI enrichment was partial; deterministic planning was retained.']
          : undefined,
    },
    outcome: options.failed ? 'failed' : options.dryRun ? 'skipped' : 'succeeded',
    phases: [
      {
        id: phaseId,
        route,
        operation,
        status,
        remediation: options.warning ? [options.warning] : undefined,
      },
    ],
    items: context.scanResult.components.map((component) => ({
      phaseId,
      metadataType: component.type,
      fullName: component.name,
      route,
      operation,
      status,
      targetOrg: options.targetOrg,
    })),
    reportWarnings: options.warning ? [options.warning] : undefined,
  };
}

function toSpecialPhaseFact(
  phase: SpecialDeploymentPhase,
  plan: SpecialDeploymentPlan,
  execution: SpecialDeploymentExecutionResult | undefined
): ReleasePhaseFact {
  const status = specialPhaseStatus(phase, plan, execution);
  const commandResults = execution?.commands.filter((result) => result.phaseKind === phase.kind) ?? [];

  return {
    id: phase.kind,
    route: routeForPhase(phase.kind),
    operation: operationForPhase(phase.kind),
    status,
    evidence: phase.commands.map((command, index) => {
      const result = commandResults[index];
      return {
        tool: command.tool,
        operationId: `${phase.kind}:${index + 1}`,
        exitCode: result?.exitCode ?? (result?.success ? 0 : undefined),
      };
    }),
    remediation: [...(phase.errors ?? []), ...(phase.warnings ?? []), ...(phase.skipReason ? [phase.skipReason] : [])],
  };
}

function specialPhaseStatus(
  phase: SpecialDeploymentPhase,
  plan: SpecialDeploymentPlan,
  execution: SpecialDeploymentExecutionResult | undefined
): ReleaseFactStatus {
  if ((phase.errors?.length ?? 0) > 0 || execution?.failedPhase === phase.kind) return 'failed';
  if (phase.skipped || execution?.skippedPhases.includes(phase.kind)) return 'skipped';
  if (!execution) return plan.dryRun ? 'skipped' : 'unknown';
  if (execution.completedPhases.includes(phase.kind)) return 'succeeded';
  return execution.success ? 'succeeded' : 'skipped';
}

function routeForPhase(kind: SpecialDeploymentPhase['kind']): ReleaseRoute {
  const routes: Record<SpecialDeploymentPhase['kind'], ReleaseRoute> = {
    'core-metadata': 'salesforce-metadata',
    'agentforce-publish': 'agentforce',
    'agentforce-activate': 'agentforce',
    'ai-evaluations': 'ai-evaluation',
    'community-publish': 'experience-cloud',
    'omnistudio-vlocity': 'omnistudio',
  };
  return routes[kind];
}

function operationForPhase(kind: SpecialDeploymentPhase['kind']): ReleaseOperation {
  if (kind === 'agentforce-activate') return 'activate';
  if (kind === 'agentforce-publish' || kind === 'community-publish' || kind === 'omnistudio-vlocity') return 'publish';
  return 'deploy';
}

function toItem(
  component: string,
  phaseId: ReleaseItemFact['phaseId'],
  operation: ReleaseOperation,
  route: ReleaseRoute,
  status: ReleaseFactStatus | undefined,
  targetOrg: string | undefined
): ReleaseItemFact {
  const separator = component.indexOf(':');
  return {
    phaseId,
    metadataType: separator > 0 ? component.slice(0, separator) : 'Unknown',
    fullName: separator > 0 ? component.slice(separator + 1) : component,
    route,
    operation,
    status: status ?? 'unknown',
    targetOrg,
  };
}
