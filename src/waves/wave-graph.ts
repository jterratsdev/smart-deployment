import type { DeploymentState } from '../deployment/state-manager.js';
import type { DependencyGraph, NodeId } from '../types/dependency.js';
import type { Wave } from './wave-builder.js';

export type WaveGraphStatus = 'pending' | 'current' | 'completed' | 'failed';

export type WaveGraphNode = {
  waveNumber: number;
  componentCount: number;
  components: NodeId[];
  status: WaveGraphStatus;
};

export type WaveGraphEdge = {
  fromWave: number;
  toWave: number;
  kind: 'sequence' | 'dependency';
  dependencyCount?: number;
};

export type WaveGraph = {
  nodes: WaveGraphNode[];
  edges: WaveGraphEdge[];
  visualizations: {
    mermaid: string;
    dot: string;
  };
};

export function buildWaveGraph(
  waves: readonly Wave[],
  dependencyGraph: DependencyGraph,
  state?: DeploymentState | null
): WaveGraph {
  const sortedWaves = [...waves].sort((left, right) => left.number - right.number);
  const componentWaveLookup = buildComponentWaveLookup(sortedWaves);
  const nodes = sortedWaves.map((wave) => ({
    waveNumber: wave.number,
    componentCount: wave.components.length,
    components: [...wave.components],
    status: resolveWaveStatus(wave.number, state),
  }));
  const edges = [...buildSequenceEdges(sortedWaves), ...buildDependencyEdges(dependencyGraph, componentWaveLookup)];
  const visualizations = {
    mermaid: renderWaveGraphMermaid(nodes, edges),
    dot: renderWaveGraphDot(nodes, edges),
  };

  return {
    nodes,
    edges,
    visualizations,
  };
}

function buildComponentWaveLookup(waves: readonly Wave[]): Map<NodeId, number> {
  const lookup = new Map<NodeId, number>();

  for (const wave of waves) {
    for (const component of wave.components) {
      lookup.set(component, wave.number);
    }
  }

  return lookup;
}

function resolveWaveStatus(waveNumber: number, state?: DeploymentState | null): WaveGraphStatus {
  if (!state) {
    return 'pending';
  }

  if (state.failedWave?.waveNumber === waveNumber) {
    return 'failed';
  }

  if (state.completedWaves.includes(waveNumber)) {
    return 'completed';
  }

  if (state.currentWave === waveNumber) {
    return 'current';
  }

  return 'pending';
}

function buildSequenceEdges(waves: readonly Wave[]): WaveGraphEdge[] {
  const edges: WaveGraphEdge[] = [];

  for (let index = 0; index < waves.length - 1; index += 1) {
    edges.push({
      fromWave: waves[index].number,
      toWave: waves[index + 1].number,
      kind: 'sequence',
    });
  }

  return edges;
}

function buildDependencyEdges(
  dependencyGraph: DependencyGraph,
  componentWaveLookup: ReadonlyMap<NodeId, number>
): WaveGraphEdge[] {
  const dependencyCounts = new Map<string, WaveGraphEdge>();

  for (const [dependent, dependencies] of dependencyGraph.entries()) {
    const dependentWave = componentWaveLookup.get(dependent);
    if (dependentWave === undefined) {
      continue;
    }

    for (const dependency of dependencies) {
      const dependencyWave = componentWaveLookup.get(dependency);
      if (dependencyWave === undefined || dependencyWave === dependentWave) {
        continue;
      }

      const key = `${dependencyWave}->${dependentWave}`;
      const existing = dependencyCounts.get(key);
      if (existing) {
        existing.dependencyCount = (existing.dependencyCount ?? 0) + 1;
      } else {
        dependencyCounts.set(key, {
          fromWave: dependencyWave,
          toWave: dependentWave,
          kind: 'dependency',
          dependencyCount: 1,
        });
      }
    }
  }

  return [...dependencyCounts.values()].sort(
    (left, right) => left.fromWave - right.fromWave || left.toWave - right.toWave || left.kind.localeCompare(right.kind)
  );
}

function renderWaveGraphMermaid(nodes: readonly WaveGraphNode[], edges: readonly WaveGraphEdge[]): string {
  const lines = ['graph LR'];

  for (const node of nodes) {
    lines.push(
      `    W${node.waveNumber}["Wave ${node.waveNumber}<br/>${node.status}<br/>${node.componentCount} components"]`
    );
  }

  for (const edge of edges) {
    const label =
      edge.kind === 'dependency'
        ? `${edge.dependencyCount ?? 0} dependenc${edge.dependencyCount === 1 ? 'y' : 'ies'}`
        : 'next';
    const connector = edge.kind === 'dependency' ? '==>' : '-->';
    lines.push(`    W${edge.fromWave} ${connector}|${label}| W${edge.toWave}`);
  }

  lines.push('');
  lines.push('    classDef pending fill:#f3f4f6,stroke:#6b7280,color:#111827');
  lines.push('    classDef current fill:#dbeafe,stroke:#2563eb,color:#1e3a8a,stroke-width:2px');
  lines.push('    classDef completed fill:#dcfce7,stroke:#16a34a,color:#14532d');
  lines.push('    classDef failed fill:#fee2e2,stroke:#dc2626,color:#7f1d1d,stroke-width:2px');

  for (const node of nodes) {
    lines.push(`    class W${node.waveNumber} ${node.status}`);
  }

  return lines.join('\n');
}

function renderWaveGraphDot(nodes: readonly WaveGraphNode[], edges: readonly WaveGraphEdge[]): string {
  const lines = ['digraph WaveGraph {'];
  lines.push('    rankdir=LR;');
  lines.push('    node [shape=box, style="filled,rounded"];');
  lines.push('');

  for (const node of nodes) {
    lines.push(
      `    "W${node.waveNumber}" [label="Wave ${node.waveNumber}\\n${node.status}\\n${
        node.componentCount
      } components", fillcolor="${getDotStatusColor(node.status)}"];`
    );
  }

  lines.push('');

  for (const edge of edges) {
    const label =
      edge.kind === 'dependency'
        ? `${edge.dependencyCount ?? 0} dependenc${edge.dependencyCount === 1 ? 'y' : 'ies'}`
        : 'next';
    const attributes = edge.kind === 'dependency' ? `label="${label}", penwidth=2.0` : `label="${label}", style=dashed`;
    lines.push(`    "W${edge.fromWave}" -> "W${edge.toWave}" [${attributes}];`);
  }

  lines.push('}');
  return lines.join('\n');
}

function getDotStatusColor(status: WaveGraphStatus): string {
  switch (status) {
    case 'completed':
      return '#dcfce7';
    case 'current':
      return '#dbeafe';
    case 'failed':
      return '#fee2e2';
    case 'pending':
      return '#f3f4f6';
  }
}
