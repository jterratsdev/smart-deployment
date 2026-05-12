import type { NodeId } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';
import type { Wave, WaveMetadata, WaveStats } from './wave-builder.js';
import { extractMetadataType } from './wave-priority-policy.js';

export function assembleWaveMetadata(components: NodeId[], hasCircularDeps: boolean): WaveMetadata {
  const types = new Set<MetadataType>();

  for (const component of components) {
    types.add(extractMetadataType(component));
  }

  return {
    componentCount: components.length,
    types: Array.from(types),
    maxDepth: 0,
    hasCircularDeps,
    estimatedTime: Math.ceil(components.length * 0.1),
  };
}

export function calculateWaveStats(waves: Wave[]): WaveStats {
  if (waves.length === 0) {
    return {
      totalWaves: 0,
      avgComponentsPerWave: 0,
      largestWaveSize: 0,
      smallestWaveSize: 0,
      totalEstimatedTime: 0,
    };
  }

  const sizes = waves.map((w) => w.components.length);
  const totalComponents = sizes.reduce((sum, size) => sum + size, 0);
  const totalTime = waves.reduce((sum, w) => sum + w.metadata.estimatedTime, 0);

  return {
    totalWaves: waves.length,
    avgComponentsPerWave: Math.round(totalComponents / waves.length),
    largestWaveSize: Math.max(...sizes),
    smallestWaveSize: Math.min(...sizes),
    totalEstimatedTime: totalTime,
  };
}
