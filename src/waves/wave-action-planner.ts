import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { ManualCheckpoint } from '../types/manual-checkpoint.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';
import type { ResolvedWaveAction, WaveActionRule } from '../types/wave-action.js';
import type { Wave } from './wave-builder.js';

export type WaveActionPlan = {
  waves: Wave[];
  unmatchedRuleIds: string[];
};

export function mergeWaveActionRules(...ruleSets: readonly WaveActionRule[][]): WaveActionRule[] {
  const rules: WaveActionRule[] = [];
  const ids = new Set<string>();
  for (const ruleSet of ruleSets) {
    for (const rule of ruleSet) {
      if (ids.has(rule.id)) throw new Error(`Duplicate wave action id across configuration and scripts: ${rule.id}`);
      ids.add(rule.id);
      rules.push(rule);
    }
  }
  return rules;
}

/** Resolves and fingerprints configured Apex scripts so resume detects content changes. */
export async function hydrateWaveActionScripts(waves: readonly Wave[], projectRoot: string): Promise<Wave[]> {
  const resolvedRoot = path.resolve(projectRoot);
  return Promise.all(
    waves.map(async (wave) => {
      const requiredActions = await Promise.all(
        (wave.metadata.requiredActions ?? []).map(async (action) => {
          if (action.action.kind !== 'apex-anonymous') return action;
          const scriptPath = resolveScriptPath(resolvedRoot, action.action.script);
          let content: Buffer;
          try {
            content = await readFile(scriptPath);
          } catch {
            throw new Error(
              `Anonymous Apex script for wave action ${action.id} was not found: ${action.action.script}`
            );
          }
          const sha256 = createHash('sha256').update(content).digest('hex');
          if (action.action.sha256 !== undefined && action.action.sha256.toLowerCase() !== sha256) {
            throw new Error(
              `Anonymous Apex script hash does not match wave action ${action.id}: ${action.action.script}`
            );
          }
          return { ...action, action: { ...action.action, sha256 } };
        })
      );
      return requiredActions.length === 0 ? wave : { ...wave, metadata: { ...wave.metadata, requiredActions } };
    })
  );
}

/** Resolves declarative action rules without coupling wave generation to repo I/O. */
export class WaveActionPlanner {
  public plan(waves: readonly Wave[], rules: readonly WaveActionRule[]): WaveActionPlan {
    const matchedRuleIds = new Set<string>();
    const plannedWaves = waves.map((wave) => {
      const requiredActions = rules.flatMap((rule) => {
        const matchedComponents = matchComponents(wave.components, rule);
        if (matchedComponents.length === 0) return [];
        matchedRuleIds.add(rule.id);
        return [{ id: rule.id, phase: rule.phase, action: rule.action, matchedComponents }];
      });

      return requiredActions.length === 0
        ? wave
        : {
            ...wave,
            metadata: {
              ...wave.metadata,
              requiresAction: true,
              requiredActions: requiredActions.sort((left, right) => left.id.localeCompare(right.id)),
            },
          };
    });

    return {
      waves: plannedWaves,
      unmatchedRuleIds: rules
        .map((rule) => rule.id)
        .filter((id) => !matchedRuleIds.has(id))
        .sort(),
    };
  }
}

/** Adds one durable checkpoint per wave boundary and merges with an explicit checkpoint at that boundary. */
export function addWaveActionCheckpoints(
  waves: readonly Wave[],
  explicitCheckpoints: readonly ManualCheckpoint[] = []
): ManualCheckpoint[] {
  const actionsById = collectActionBoundaries(waves);
  const checkpoints = explicitCheckpoints.map(cloneCheckpoint);
  assertCheckpointCollisions(checkpoints);
  const byPosition = new Map(checkpoints.map((checkpoint) => [positionOf(checkpoint), checkpoint]));
  const explicitMessages = new Set(
    explicitCheckpoints.filter((checkpoint) => checkpoint.message !== undefined).map(positionOf)
  );

  for (const boundary of actionsById.values()) {
    const position = `${boundary.action.phase}:${boundary.waveNumber}`;
    const existing = byPosition.get(position);
    const generatedId = `required-actions-${boundary.action.phase}-wave-${boundary.waveNumber}`;
    const conflictingCheckpoint = checkpoints.find(
      (checkpoint) => checkpoint.id === generatedId && positionOf(checkpoint) !== position
    );
    if (conflictingCheckpoint) {
      throw new Error(
        `Generated wave action checkpoint ${generatedId} conflicts with explicit checkpoint at ${positionOf(
          conflictingCheckpoint
        )}.`
      );
    }
    if (existing) {
      existing.requiredActions = mergeActions(existing.requiredActions ?? [], [boundary.action]);
      if (!explicitMessages.has(position)) existing.message = formatActions(existing.requiredActions);
      continue;
    }

    const checkpoint: ManualCheckpoint = {
      id: generatedId,
      phase: boundary.action.phase,
      waveNumber: boundary.waveNumber,
      message: formatActions([boundary.action]),
      requiredActions: [boundary.action],
    };
    checkpoints.push(checkpoint);
    byPosition.set(position, checkpoint);
  }

  return checkpoints.sort(
    (left, right) =>
      left.waveNumber - right.waveNumber || left.phase.localeCompare(right.phase) || left.id.localeCompare(right.id)
  );
}

function matchComponents(components: readonly NodeId[], rule: WaveActionRule): NodeId[] {
  const selectedComponents = new Set(rule.when.components ?? []);
  const selectedTypes = new Set(rule.when.types ?? []);
  return components.filter((component) => {
    const type = component.split(':', 1)[0];
    return selectedComponents.has(component) || selectedTypes.has(type as MetadataType);
  });
}

function collectActionBoundaries(
  waves: readonly Wave[]
): Map<string, { action: ResolvedWaveAction; waveNumber: number }> {
  const boundaries = new Map<string, { action: ResolvedWaveAction; waveNumber: number }>();
  for (const wave of waves) {
    for (const action of wave.metadata.requiredActions ?? []) {
      const current = boundaries.get(action.id);
      if (!current) {
        boundaries.set(action.id, { action, waveNumber: wave.number });
        continue;
      }
      const waveNumber =
        action.phase === 'before'
          ? Math.min(current.waveNumber, wave.number)
          : Math.max(current.waveNumber, wave.number);
      boundaries.set(action.id, {
        action: {
          ...action,
          matchedComponents: [...new Set([...current.action.matchedComponents, ...action.matchedComponents])].sort(),
        },
        waveNumber,
      });
    }
  }
  return boundaries;
}

function cloneCheckpoint(checkpoint: ManualCheckpoint): ManualCheckpoint {
  return {
    ...checkpoint,
    ...(checkpoint.requiredActions === undefined
      ? {}
      : {
          requiredActions: checkpoint.requiredActions.map((action) => ({
            ...action,
            action: { ...action.action },
            matchedComponents: [...action.matchedComponents],
          })),
        }),
  };
}

function mergeActions(
  existing: readonly ResolvedWaveAction[],
  additions: readonly ResolvedWaveAction[]
): ResolvedWaveAction[] {
  const merged = new Map<string, ResolvedWaveAction>();
  for (const action of [...existing, ...additions]) {
    const current = merged.get(action.id);
    if (current === undefined) {
      merged.set(action.id, action);
      continue;
    }
    if (current.phase !== action.phase || JSON.stringify(current.action) !== JSON.stringify(action.action)) {
      throw new Error(`Conflicting wave action definitions share the id ${action.id}.`);
    }
    merged.set(action.id, {
      ...current,
      matchedComponents: [...new Set([...current.matchedComponents, ...action.matchedComponents])].sort(),
    });
  }
  return [...merged.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function assertCheckpointCollisions(checkpoints: readonly ManualCheckpoint[]): void {
  const ids = new Set<string>();
  const positions = new Set<string>();
  for (const checkpoint of checkpoints) {
    const position = positionOf(checkpoint);
    if (ids.has(checkpoint.id)) throw new Error(`Duplicate manual checkpoint id: ${checkpoint.id}`);
    if (positions.has(position)) throw new Error(`Multiple manual checkpoints target ${position}.`);
    ids.add(checkpoint.id);
    positions.add(position);
  }
}

function resolveScriptPath(projectRoot: string, script: string): string {
  const normalizedScript = script.replaceAll('\\', path.sep);
  const resolved = path.resolve(projectRoot, normalizedScript);
  const relative = path.relative(projectRoot, resolved);
  if (relative === '' || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    throw new Error(`Anonymous Apex script must remain within the project: ${script}`);
  }
  return resolved;
}

function positionOf(checkpoint: Pick<ManualCheckpoint, 'phase' | 'waveNumber'>): string {
  return `${checkpoint.phase}:${checkpoint.waveNumber}`;
}

function formatActions(actions: readonly ResolvedWaveAction[]): string {
  return actions
    .map((requirement) =>
      requirement.action.kind === 'apex-anonymous'
        ? `Run anonymous Apex script ${requirement.action.script}.`
        : requirement.action.instruction
    )
    .join(' ');
}
