import type { DependencyGraph, NodeId } from '../types/dependency.js';
import { buildWaveGraph, type WaveGraph } from '../waves/wave-graph.js';
import type { Wave } from '../waves/wave-builder.js';
import type { DeploymentState } from './state-manager.js';

type PersistedWaveGraphContext = {
  waves: Array<{
    number: number;
    components: NodeId[];
  }>;
  dependencies: Array<{
    from: NodeId;
    to: NodeId;
  }>;
};

export function buildPersistedWaveGraphContext(
  orderedWaves: readonly Wave[],
  dependencyGraph?: DependencyGraph
): Record<string, unknown> {
  return {
    waves: orderedWaves.map((wave) => ({
      number: wave.number,
      components: [...wave.components],
    })),
    dependencies: [...(dependencyGraph?.entries() ?? [])].flatMap(([from, dependencies]) =>
      [...dependencies].map((to) => ({ from, to }))
    ),
  };
}

export function buildWaveGraphFromState(state: DeploymentState): WaveGraph | undefined {
  const context = parseWaveGraphContext(state.metadata?.waveGraphContext);
  if (!context) {
    return undefined;
  }

  return buildWaveGraph(toWaves(context.waves), toDependencyGraph(context), state);
}

function parseWaveGraphContext(value: unknown): PersistedWaveGraphContext | undefined {
  if (!isRecord(value)) {
    return undefined;
  }

  const waves = Array.isArray(value.waves) ? value.waves.map((wave) => parseWave(wave)) : [];
  const dependencies = Array.isArray(value.dependencies)
    ? value.dependencies.map((dependency) => parseDependency(dependency))
    : [];
  const validWaves = waves.filter((wave): wave is PersistedWaveGraphContext['waves'][number] => wave !== undefined);
  const validDependencies = dependencies.filter(
    (dependency): dependency is PersistedWaveGraphContext['dependencies'][number] => dependency !== undefined
  );

  if (validWaves.length === 0) {
    return undefined;
  }

  return {
    waves: validWaves,
    dependencies: validDependencies,
  };
}

function parseWave(value: unknown): PersistedWaveGraphContext['waves'][number] | undefined {
  if (!isRecord(value) || typeof value.number !== 'number' || !Array.isArray(value.components)) {
    return undefined;
  }

  const components = value.components.filter((component): component is string => typeof component === 'string');
  return {
    number: value.number,
    components,
  };
}

function parseDependency(value: unknown): PersistedWaveGraphContext['dependencies'][number] | undefined {
  if (!isRecord(value) || typeof value.from !== 'string' || typeof value.to !== 'string') {
    return undefined;
  }

  return {
    from: value.from,
    to: value.to,
  };
}

function toWaves(waves: PersistedWaveGraphContext['waves']): Wave[] {
  return waves.map((wave) => ({
    number: wave.number,
    components: wave.components,
    metadata: {
      componentCount: wave.components.length,
      types: [],
      maxDepth: 0,
      hasCircularDeps: false,
      estimatedTime: 0,
    },
  }));
}

function toDependencyGraph(context: PersistedWaveGraphContext): DependencyGraph {
  const graph: DependencyGraph = new Map();

  for (const wave of context.waves) {
    for (const component of wave.components) {
      graph.set(component, new Set());
    }
  }

  for (const dependency of context.dependencies) {
    if (!graph.has(dependency.from)) {
      graph.set(dependency.from, new Set());
    }
    graph.get(dependency.from)!.add(dependency.to);
    if (!graph.has(dependency.to)) {
      graph.set(dependency.to, new Set());
    }
  }

  return graph;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
