import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';

export type DependencyAvailability =
  | 'available-previous-wave'
  | 'available-same-wave'
  | 'unavailable-future-wave'
  | 'missing'
  | 'previous-wave-failed'
  | 'external';

export type DependencyAssessment = {
  componentId: NodeId;
  dependencyId: NodeId;
  availability: DependencyAvailability;
  canSimplify: boolean;
  reason: string;
};

export type DependencyAvailabilityOptions = {
  completedWaves?: Set<number>;
  failedComponents?: Set<NodeId>;
  externalDependencies?: Set<NodeId>;
};

export type SharedComponentAssessment = {
  componentId: NodeId;
  consumers: NodeId[];
  isShared: boolean;
  /** A consumer chain reaches an Agentforce component that must retain its references. */
  isHighImpact?: boolean;
};

/** Classifies dependency availability without mutating the dependency graph. */
export class DependencyAvailabilityAnalyzer {
  private readonly componentMap: Map<NodeId, MetadataComponent>;
  private readonly externalDependencies: Set<NodeId>;
  private readonly completedWaves: Set<number>;
  private readonly failedComponents: Set<NodeId>;

  public constructor(componentMap: Map<NodeId, MetadataComponent>, options: DependencyAvailabilityOptions = {}) {
    this.componentMap = componentMap;
    this.externalDependencies = options.externalDependencies ?? new Set();
    this.completedWaves = options.completedWaves ?? new Set();
    this.failedComponents = options.failedComponents ?? new Set();
  }

  public assess(componentId: NodeId, wave: Wave, allWaves: Wave[]): DependencyAssessment[] {
    const component = this.componentMap.get(componentId);
    if (!component) return [];

    const waveByComponent = this.buildWaveMap(allWaves);
    return Array.from(component.dependencies).map((dependencyId) => {
      const dependencyWave = waveByComponent.get(dependencyId);

      if (this.externalDependencies.has(dependencyId)) {
        return this.createAssessment(
          componentId,
          dependencyId,
          'external',
          false,
          'Dependency is external to the scanned project'
        );
      }
      if (this.failedComponents.has(dependencyId)) {
        return this.createAssessment(
          componentId,
          dependencyId,
          'previous-wave-failed',
          true,
          'Dependency belongs to a previously failed deployment'
        );
      }
      if (dependencyWave === undefined) {
        return this.createAssessment(
          componentId,
          dependencyId,
          this.componentMap.has(dependencyId) ? 'missing' : 'external',
          this.componentMap.has(dependencyId),
          'Dependency is not present in any generated wave'
        );
      }
      if (dependencyWave === wave.number) {
        return this.createAssessment(
          componentId,
          dependencyId,
          'available-same-wave',
          false,
          'Dependency is deployed in the same wave; no automatic simplification'
        );
      }
      if (dependencyWave < wave.number) {
        const completed = this.completedWaves.size === 0 || this.completedWaves.has(dependencyWave);
        return completed
          ? this.createAssessment(
              componentId,
              dependencyId,
              'available-previous-wave',
              false,
              'Dependency is in a completed previous wave'
            )
          : this.createAssessment(
              componentId,
              dependencyId,
              'previous-wave-failed',
              true,
              'Dependency is in a previous wave that did not complete'
            );
      }
      return this.createAssessment(
        componentId,
        dependencyId,
        'unavailable-future-wave',
        true,
        'Dependency is scheduled for a future wave'
      );
    });
  }

  public unavailableDependencies(componentId: NodeId, wave: Wave, allWaves: Wave[]): NodeId[] {
    return this.assess(componentId, wave, allWaves)
      .filter((assessment) => assessment.canSimplify)
      .map((assessment) => assessment.dependencyId);
  }

  /**
   * Returns project consumers through the reverse dependency graph.
   *
   * A Flow used by a GenAiFunction is also considered shared when that function
   * is consumed by a GenAiPlugin or AiAuthoringBundle. Keeping the traversal
   * here avoids relying on every parser to populate `dependents` consistently.
   */
  public assessSharedComponent(componentId: NodeId): SharedComponentAssessment {
    const consumers: NodeId[] = [];
    const visited = new Set<NodeId>([componentId]);
    const pending = [componentId];

    while (pending.length > 0) {
      const dependencyId = pending.pop()!;
      for (const [candidateId, component] of this.componentMap.entries()) {
        if (visited.has(candidateId) || !component.dependencies.has(dependencyId)) {
          continue;
        }
        visited.add(candidateId);
        consumers.push(candidateId);
        pending.push(candidateId);
      }
    }

    const isHighImpact = consumers.some((consumerId) => {
      const type = this.componentMap.get(consumerId)?.type;
      return type === 'GenAiPlugin' || type === 'AiAuthoringBundle';
    });

    return {
      componentId,
      consumers,
      isShared: consumers.length > 1 || isHighImpact,
      isHighImpact,
    };
  }

  private buildWaveMap(waves: Wave[]): Map<NodeId, number> {
    const result = new Map<NodeId, number>();
    for (const currentWave of waves) {
      for (const componentId of currentWave.components) result.set(componentId, currentWave.number);
    }
    return result;
  }

  private createAssessment(
    componentId: NodeId,
    dependencyId: NodeId,
    availability: DependencyAvailability,
    canSimplify: boolean,
    reason: string
  ): DependencyAssessment {
    return { componentId, dependencyId, availability, canSimplify, reason };
  }
}
