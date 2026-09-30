import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { DependencyGraph } from '../types/dependency.js';
import type { ManualCheckpoint } from '../types/manual-checkpoint.js';
import type { Wave, WaveMetadata } from '../waves/wave-builder.js';
import type { OwdPostcondition, SharingModelQueryResult } from './deployment-postcondition.js';

export type OwdTransition = {
  objectName: string;
  sharingModel?: { source?: string; observed?: string; changed: boolean };
  externalSharingModel?: { source?: string; observed?: string; changed: boolean };
  observationError?: Extract<SharingModelQueryResult, { kind: 'unavailable' }>['error'];
};

export type OwdBarrierPlan = {
  waves: Wave[];
  postconditions: OwdPostcondition[];
  transitions: OwdTransition[];
  blockedPostconditions: import('./deployment-postcondition.js').PausedPostcondition[];
  checkpoints: ManualCheckpoint[];
};

type OwdBarrierPlannerDependencies = {
  query: (targetOrg: string, objectName: string) => Promise<SharingModelQueryResult>;
};

export class OwdBarrierPlanner {
  public constructor(private readonly dependencies: OwdBarrierPlannerDependencies) {}

  public async createPlan(
    waves: readonly Wave[],
    components: ReadonlyMap<string, MetadataComponent>,
    targetOrg: string,
    checkpoints: readonly ManualCheckpoint[] = [],
    graph?: DependencyGraph
  ): Promise<OwdBarrierPlan> {
    const candidates = this.findCandidates(components);
    const observations = await Promise.all(
      candidates.map(async (candidate) => ({
        candidate,
        result: await this.dependencies.query(targetOrg, candidate.name),
      }))
    );
    const barrierObjects = observations
      .filter(({ candidate, result }) =>
        candidate.facts?.kind === 'custom-object-sharing-model' && candidate.facts.sharingModel
          ? result.kind === 'observed' && result.observation.internalSharingModel !== candidate.facts.sharingModel
          : false
      )
      .map(({ candidate }) => candidate.name);
    const normalized = isolateObjects(waves, components, new Set(barrierObjects), checkpoints, graph);
    const plannedWaves = normalized.waves;
    const transitions = observations.map(({ candidate, result }) => buildTransition(candidate, result));
    const postconditions = barrierObjects.map((objectName) => {
      const component = components.get(`CustomObject:${objectName}`)!;
      const facts = component.facts?.kind === 'custom-object-sharing-model' ? component.facts : undefined;
      const expectedInternalSharingModel = facts?.sharingModel;
      if (!expectedInternalSharingModel) throw new Error(`Missing source sharingModel for ${objectName}`);
      const observation = observations.find(({ candidate }) => candidate.name === objectName)?.result;
      return {
        id: `owd:${objectName}:${expectedInternalSharingModel}`,
        kind: 'owd-internal-sharing-model' as const,
        objectName,
        afterWaveNumber: plannedWaves.find((wave) => wave.components.includes(`CustomObject:${objectName}`))!.number,
        expectedInternalSharingModel,
        expectedExternalSharingModel: facts?.externalSharingModel,
        initialObservation: observation?.kind === 'observed' ? observation.observation : undefined,
        initialObservationError: observation?.kind === 'unavailable' ? observation.error : undefined,
      };
    });
    const blockedPostconditions = observations.flatMap(({ candidate, result }) => {
      const facts = candidate.facts?.kind === 'custom-object-sharing-model' ? candidate.facts : undefined;
      if (result.kind !== 'unavailable' || !facts?.sharingModel) return [];
      return [
        {
          id: `owd:${candidate.name}:${facts.sharingModel}`,
          kind: 'owd-internal-sharing-model' as const,
          objectName: candidate.name,
          afterWaveNumber:
            waves.find((wave) => wave.components.includes(`CustomObject:${candidate.name}`))?.number ?? 0,
          expectedInternalSharingModel: facts.sharingModel,
          expectedExternalSharingModel: facts.externalSharingModel,
          initialObservationError: result.error,
          status: 'blocked-before-deploy' as const,
          observationError: result.error,
          attempts: 1,
          waitedMs: 0,
          pausedAt: new Date().toISOString(),
          resumedPhase: 0,
        },
      ];
    });
    return {
      waves: plannedWaves,
      postconditions,
      transitions,
      blockedPostconditions,
      checkpoints: normalized.checkpoints,
    };
  }

  public restorePlan(
    waves: readonly Wave[],
    components: ReadonlyMap<string, MetadataComponent>,
    persisted: readonly OwdPostcondition[],
    checkpoints: readonly ManualCheckpoint[] = [],
    graph?: DependencyGraph
  ): OwdBarrierPlan {
    const normalized = isolateObjects(
      waves,
      components,
      new Set(persisted.map((condition) => condition.objectName)),
      checkpoints,
      graph
    );
    const plannedWaves = normalized.waves;
    return {
      waves: plannedWaves,
      postconditions: persisted.map((condition) => ({
        ...condition,
        afterWaveNumber: plannedWaves.find((wave) => wave.components.includes(`CustomObject:${condition.objectName}`))!
          .number,
      })),
      transitions: [],
      blockedPostconditions: [],
      checkpoints: normalized.checkpoints,
    };
  }

  private findCandidates(components: ReadonlyMap<string, MetadataComponent>): MetadataComponent[] {
    const sharingObjects = new Set<string>();
    for (const component of components.values()) {
      if (component.facts?.kind === 'sharing-rules') sharingObjects.add(component.facts.objectName);
    }
    return [...components.values()]
      .filter((component) => component.type === 'CustomObject' && sharingObjects.has(component.name))
      .sort((left, right) => left.name.localeCompare(right.name));
  }
}

function buildTransition(component: MetadataComponent, result: SharingModelQueryResult): OwdTransition {
  const facts = component.facts?.kind === 'custom-object-sharing-model' ? component.facts : undefined;
  if (result.kind === 'unavailable') return { objectName: component.name, observationError: result.error };
  return {
    objectName: component.name,
    sharingModel: facts?.sharingModel
      ? {
          source: facts.sharingModel,
          observed: result.observation.internalSharingModel,
          changed: facts.sharingModel !== result.observation.internalSharingModel,
        }
      : undefined,
    externalSharingModel: facts?.externalSharingModel
      ? {
          source: facts.externalSharingModel,
          observed: result.observation.externalSharingModel,
          changed: facts.externalSharingModel !== result.observation.externalSharingModel,
        }
      : undefined,
  };
}

function isolateObjects(
  waves: readonly Wave[],
  components: ReadonlyMap<string, MetadataComponent>,
  objectNames: ReadonlySet<string>,
  checkpoints: readonly ManualCheckpoint[],
  graph?: DependencyGraph
): { waves: Wave[]; checkpoints: ManualCheckpoint[] } {
  const isolatedIds = new Set([...objectNames].map((name) => `CustomObject:${name}`));
  const originalRanges = new Map<number, { first: number; last: number }>();
  const groups = waves.flatMap((wave) => {
    const pending = orderWaveComponents(wave.components, graph);
    const result: string[][] = [];
    while (pending.length > 0) {
      const isolatedIndex = pending.findIndex((nodeId) => isolatedIds.has(nodeId));
      if (isolatedIndex < 0) {
        result.push(pending.splice(0));
      } else {
        if (isolatedIndex > 0) result.push(pending.splice(0, isolatedIndex));
        result.push(pending.splice(0, 1));
      }
    }
    return result.map((componentsInGroup) => ({ components: componentsInGroup, originalWaveNumber: wave.number }));
  });
  for (const objectName of objectNames) {
    const objectId = `CustomObject:${objectName}`;
    const sharingId = `SharingRules:${objectName}`;
    const objectIndex = groups.findIndex((group) => group.components.includes(objectId));
    const sharingIndex = groups.findIndex((group) => group.components.includes(sharingId));
    if (objectIndex >= 0 && sharingIndex >= 0 && objectIndex > sharingIndex) {
      const [objectGroup] = groups.splice(objectIndex, 1);
      const updatedSharingIndex = groups.findIndex((group) => group.components.includes(sharingId));
      groups.splice(updatedSharingIndex, 0, objectGroup);
    }
  }
  assertDependencyOrder(
    groups.map((group) => group.components),
    graph
  );
  const plannedWaves = groups.map(({ components: nodeIds, originalWaveNumber }, index) => {
    const number = index + 1;
    const range = originalRanges.get(originalWaveNumber);
    originalRanges.set(originalWaveNumber, { first: range?.first ?? number, last: number });
    return {
      number: index + 1,
      components: nodeIds,
      metadata: metadata(nodeIds, components),
    };
  });
  const remappedCheckpoints = checkpoints.map((checkpoint) => {
    const range = originalRanges.get(checkpoint.waveNumber);
    if (!range)
      throw new Error(`Cannot preserve checkpoint ${checkpoint.id}: wave ${checkpoint.waveNumber} is missing.`);
    return { ...checkpoint, waveNumber: checkpoint.phase === 'before' ? range.first : range.last };
  });
  return { waves: plannedWaves, checkpoints: remappedCheckpoints };
}

function assertDependencyOrder(groups: readonly string[][], graph?: DependencyGraph): void {
  if (!graph) return;
  const positions = new Map(groups.flatMap((group, index) => group.map((nodeId) => [nodeId, index] as const)));
  for (const [dependent, dependencies] of graph) {
    const dependentPosition = positions.get(dependent);
    if (dependentPosition === undefined) continue;
    for (const dependency of dependencies) {
      const dependencyPosition = positions.get(dependency);
      if (dependencyPosition !== undefined && dependencyPosition > dependentPosition) {
        throw new Error(
          `Cannot isolate OWD waves without violating dependency order: ${dependent} depends on ${dependency}.`
        );
      }
    }
  }
}

function orderWaveComponents(nodeIds: readonly string[], graph?: DependencyGraph): string[] {
  if (!graph || nodeIds.length < 2) return [...nodeIds];
  const positions = new Map(nodeIds.map((nodeId, index) => [nodeId, index]));
  const remaining = new Set(nodeIds);
  const ordered: string[] = [];
  while (remaining.size > 0) {
    const ready = [...remaining]
      .filter((nodeId) => [...(graph.get(nodeId) ?? [])].every((dependency) => !remaining.has(dependency)))
      .sort((left, right) => (positions.get(left) ?? 0) - (positions.get(right) ?? 0));
    if (ready.length === 0) return [...nodeIds];
    for (const nodeId of ready) {
      remaining.delete(nodeId);
      ordered.push(nodeId);
    }
  }
  return ordered;
}

function metadata(nodeIds: string[], components: ReadonlyMap<string, MetadataComponent>): WaveMetadata {
  return {
    componentCount: nodeIds.length,
    types: [
      ...new Set(
        nodeIds.map((nodeId) => components.get(nodeId)?.type).filter((type): type is MetadataType => type !== undefined)
      ),
    ],
    maxDepth: 0,
    hasCircularDeps: false,
    estimatedTime: nodeIds.length * 2,
  };
}
