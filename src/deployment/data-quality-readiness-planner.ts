import type { ManualCheckpoint } from '../types/manual-checkpoint.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';

export function addDataQualityReadinessCheckpoints(
  waves: readonly Wave[],
  components: ReadonlyMap<string, MetadataComponent>,
  checkpoints: readonly ManualCheckpoint[]
): ManualCheckpoint[] {
  const result = [...checkpoints];
  for (const wave of waves) {
    const activeObjects = wave.components
      .map((nodeId) => components.get(nodeId)?.facts)
      .filter(
        (facts): facts is Extract<NonNullable<MetadataComponent['facts']>, { kind: 'matching-rules' }> =>
          facts?.kind === 'matching-rules'
      )
      .filter((facts) => hasActiveDependentRule(facts, components))
      .map((facts) => facts.objectName)
      .sort();
    if (activeObjects.length === 0) continue;
    const id = `matching-rules-ready:wave-${wave.number}`;
    const expected: ManualCheckpoint = {
      id,
      phase: 'after',
      waveNumber: wave.number,
      message: `Confirm matching-rule activation completed for ${activeObjects.join(
        ', '
      )} before deploying DuplicateRule metadata.`,
    };
    const collision = result.find((checkpoint) => checkpoint.id === id);
    if (collision) {
      if (JSON.stringify(collision) !== JSON.stringify(expected)) {
        throw new Error(`Reserved matching-rule readiness checkpoint id collision: ${id}`);
      }
      continue;
    }
    const positionCollision = result.find(
      (checkpoint) => checkpoint.phase === expected.phase && checkpoint.waveNumber === expected.waveNumber
    );
    if (positionCollision) {
      throw new Error(
        `Matching-rule readiness checkpoint conflicts with ${positionCollision.id} at after wave ${wave.number}`
      );
    }
    result.push(expected);
  }
  return result.sort((left, right) => left.waveNumber - right.waveNumber || left.id.localeCompare(right.id));
}

function hasActiveDependentRule(
  facts: Extract<NonNullable<MetadataComponent['facts']>, { kind: 'matching-rules' }>,
  components: ReadonlyMap<string, MetadataComponent>
): boolean {
  return [...components.values()].some(
    (component) =>
      component.facts?.kind === 'duplicate-rule' &&
      component.facts.isActive &&
      component.facts.matchingRules.some(
        (reference) =>
          reference.objectName === facts.objectName &&
          facts.rules.some((rule) => rule.name === reference.matchingRuleName && rule.isActive)
      )
  );
}
