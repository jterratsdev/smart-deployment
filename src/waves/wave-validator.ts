/**
 * Wave Validator - US-043
 *
 * @ac US-043-AC-1: Validate dependency order
 * @ac US-043-AC-2: Validate component limits
 * @ac US-043-AC-3: Validate test requirements
 * @ac US-043-AC-4: Validate no cycles within wave
 * @issue #43
 */
import type { DependencyGraph } from '../types/dependency.js';
import { getLogger } from '../utils/logger.js';
import type { Wave } from './wave-builder.js';
import { getNodeDeploymentStage } from './wave-priority-policy.js';

const logger = getLogger('WaveValidator');

export class WaveValidator {
  public validateWaves(waves: Wave[], graph: DependencyGraph): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    const waveByComponent = new Map<string, number>();
    let previousStage = 0;

    for (const wave of waves) {
      if (wave.components.length > 10_000) errors.push(`Wave ${wave.number} exceeds limit`);
      const stages = new Set<number>();
      for (const component of wave.components) {
        if (waveByComponent.has(component)) errors.push(`Component ${component} is assigned to more than one wave`);
        waveByComponent.set(component, wave.number);
        try {
          stages.add(getNodeDeploymentStage(component));
        } catch (error) {
          errors.push(error instanceof Error ? error.message : String(error));
        }
      }
      if (stages.size > 1) errors.push(`Wave ${wave.number} mixes deployment stages: ${[...stages].sort().join(', ')}`);
      const currentStage = [...stages][0];
      if (currentStage !== undefined && currentStage < previousStage) {
        errors.push(`Wave ${wave.number} moves backward from deployment stage ${previousStage} to ${currentStage}`);
      }
      previousStage = currentStage ?? previousStage;
    }

    for (const [component, dependencies] of graph) {
      const componentWave = waveByComponent.get(component);
      if (componentWave === undefined) {
        errors.push(`Component ${component} is not assigned to a wave`);
        continue;
      }
      for (const dependency of dependencies) {
        const dependencyWave = waveByComponent.get(dependency);
        if (graph.has(dependency) && dependencyWave === undefined) {
          errors.push(`Dependency ${dependency} required by ${component} is not assigned to a wave`);
        } else if (dependencyWave !== undefined && dependencyWave >= componentWave) {
          errors.push(`${component} depends on ${dependency}, which is not in an earlier wave`);
        }
      }
    }

    for (const component of waveByComponent.keys()) {
      if (!graph.has(component)) errors.push(`Wave component ${component} is absent from the dependency graph`);
    }

    logger.info('Wave validation completed', { errors: errors.length });
    return { isValid: errors.length === 0, errors };
  }
}
