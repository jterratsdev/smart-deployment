import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { DeploymentContext } from '../deployment/deployment-context-service.js';
import type { CircularDependency, DependencyEdge, NodeId } from '../types/dependency.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';

export type GraphExportFormat = 'mermaid' | 'dot' | 'json' | 'html';

export type GraphExportOptions = {
  format: GraphExportFormat;
  outputPath?: string;
  reportDir?: string;
};

export type GraphExportResult = {
  success: boolean;
  format: GraphExportFormat;
  path: string;
  report: GraphExportReport;
};

export type GraphExportReport = {
  generatedAt: string;
  projectRoot: string;
  summary: {
    components: number;
    dependencyEdges: number;
    waves: number;
    cycles: number;
    isolatedComponents: number;
  };
  components: GraphExportComponent[];
  edges: GraphExportEdge[];
  waves: GraphExportWave[];
  cycles: GraphExportCycle[];
};

export type GraphExportComponent = {
  id: NodeId;
  type: string;
  name: string;
  filePath?: string;
  dependencies: NodeId[];
  dependents: NodeId[];
  wave?: number;
  inCycle: boolean;
  isolated: boolean;
};

export type GraphExportEdge = {
  from: NodeId;
  to: NodeId;
  type: DependencyEdge['type'];
  source?: DependencyEdge['source'];
  reason?: string;
  confidence?: number;
  fromWave?: number;
  toWave?: number;
  crossesWave: boolean;
  inCycle: boolean;
};

export type GraphExportWave = {
  number: number;
  componentCount: number;
  types: string[];
  maxDepth: number;
  estimatedTimeSeconds: number;
  hasCircularDependencies: boolean;
  components: NodeId[];
};

export type GraphExportCycle = {
  cycle: NodeId[];
  severity: CircularDependency['severity'];
  message: string;
};

const DEFAULT_REPORT_DIR = '.smart-deployment/reports/graph-export';
const FILE_NAMES: Record<GraphExportFormat, string> = {
  mermaid: 'dependency-graph.mmd',
  dot: 'dependency-graph.dot',
  json: 'dependency-graph.json',
  html: 'dependency-graph.html',
};

export class GraphExportService {
  public async generate(context: DeploymentContext, options: GraphExportOptions): Promise<GraphExportResult> {
    const report = this.createReport(context);
    const outputPath = this.resolveOutputPath(context, options);
    const content = this.render(report, options.format);

    await mkdir(path.dirname(outputPath), { recursive: true });
    await writeFile(outputPath, content, 'utf8');

    return { success: true, format: options.format, path: outputPath, report };
  }

  public createReport(context: DeploymentContext): GraphExportReport {
    const waveByComponent = this.createWaveIndex(context.orderedWaves);
    const cycles = context.scanResult.dependencyResult.circularDependencies.map((cycle) => ({
      cycle: [...cycle.cycle],
      severity: cycle.severity,
      message: cycle.message,
    }));
    const cycleEdges = this.createCycleEdgeSet(cycles);
    const cycleNodes = new Set(cycles.flatMap((cycle) => cycle.cycle));
    const components = this.createComponents(context, waveByComponent, cycleNodes);
    const edges = this.createEdges(context.scanResult.dependencyResult.edges, waveByComponent, cycleEdges);

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: context.scanResult.projectRoot,
      summary: {
        components: components.length,
        dependencyEdges: edges.length,
        waves: context.orderedWaves.length,
        cycles: cycles.length,
        isolatedComponents: components.filter((component) => component.isolated).length,
      },
      components,
      edges,
      waves: context.orderedWaves.map((wave) => this.createWave(wave)),
      cycles,
    };
  }

  public render(report: GraphExportReport, format: GraphExportFormat): string {
    if (format === 'mermaid') return `${this.toMermaid(report)}\n`;
    if (format === 'dot') return `${this.toDot(report)}\n`;
    if (format === 'html') return this.toHtml(report);
    return `${JSON.stringify(report, null, 2)}\n`;
  }

  public toMermaid(report: GraphExportReport): string {
    const lines = ['graph TD'];
    const nodesByWave = new Map<number | 'unplaced', GraphExportComponent[]>();

    for (const component of report.components) {
      const key = component.wave ?? 'unplaced';
      const group = nodesByWave.get(key) ?? [];
      group.push(component);
      nodesByWave.set(key, group);
    }

    for (const [waveNumber, components] of nodesByWave.entries()) {
      const label = waveNumber === 'unplaced' ? 'Unplaced components' : `Wave ${waveNumber}`;
      lines.push(`  subgraph ${this.toMermaidId(`wave:${waveNumber}`)}["${escapeMermaidText(label)}"]`);
      for (const component of components) {
        lines.push(`    ${this.toMermaidNode(component)}`);
      }
      lines.push('  end');
    }

    for (const edge of report.edges) {
      const label = edge.inCycle ? 'cycle' : edge.type;
      lines.push(`  ${this.toMermaidId(edge.from)} -->|"${escapeMermaidText(label)}"| ${this.toMermaidId(edge.to)}`);
    }

    if (report.components.length === 0) {
      lines.push('  empty["No components found"]');
    }

    lines.push('  classDef cycle fill:#fee2e2,stroke:#dc2626,stroke-width:2px');
    lines.push('  classDef normal fill:#eff6ff,stroke:#2563eb,stroke-width:1px');
    for (const component of report.components) {
      lines.push(`  class ${this.toMermaidId(component.id)} ${component.inCycle ? 'cycle' : 'normal'}`);
    }

    return lines.join('\n');
  }

  public toDot(report: GraphExportReport): string {
    const lines = ['digraph Dependencies {', '  rankdir=LR;', '  node [shape=box, style="rounded,filled"];'];
    const clustered = new Set<NodeId>();

    for (const wave of report.waves) {
      lines.push(`  subgraph cluster_wave_${wave.number} {`);
      lines.push(`    label="${escapeDot(`Wave ${wave.number}`)}";`);
      for (const componentId of wave.components) {
        const component = report.components.find((candidate) => candidate.id === componentId);
        if (component) {
          clustered.add(component.id);
          lines.push(`    "${escapeDot(component.id)}" [label="${escapeDot(this.componentLabel(component))}"];`);
        }
      }
      lines.push('  }');
    }

    for (const component of report.components.filter((candidate) => !clustered.has(candidate.id))) {
      lines.push(
        `  "${escapeDot(component.id)}" [label="${escapeDot(this.componentLabel(component))}", fillcolor="${
          component.inCycle ? '#fee2e2' : '#eff6ff'
        }"];`
      );
    }

    for (const edge of report.edges) {
      const attributes = [
        `label="${escapeDot(edge.inCycle ? 'cycle' : edge.type)}"`,
        edge.inCycle ? 'color="#dc2626"' : undefined,
        edge.type === 'soft' ? 'style=dashed' : undefined,
      ].filter((attribute): attribute is string => attribute !== undefined);
      lines.push(`  "${escapeDot(edge.from)}" -> "${escapeDot(edge.to)}" [${attributes.join(', ')}];`);
    }

    lines.push('}');
    return lines.join('\n');
  }

  public toHtml(report: GraphExportReport): string {
    const componentRows =
      report.components.length > 0
        ? report.components.map((component) => this.toComponentRow(component)).join('')
        : '<tr><td colspan="6">No components found.</td></tr>';
    const edgeRows =
      report.edges.length > 0
        ? report.edges.map((edge) => this.toEdgeRow(edge)).join('')
        : '<tr><td colspan="6">No dependency edges found.</td></tr>';
    const mermaid = this.toMermaid(report);
    const dot = this.toDot(report);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Dependency Graph Export</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    pre { background: #f9fafb; border: 1px solid #d1d5db; padding: 12px; overflow: auto; }
    code { white-space: nowrap; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #fff; }
  </style>
</head>
<body>
  <h1>Dependency Graph Export</h1>
  <p>Generated at ${escapeHtml(report.generatedAt)}</p>
  <p>Project root: <code>${escapeHtml(report.projectRoot)}</code></p>
  <div class="summary">
    <div class="card"><strong>Components</strong><br>${report.summary.components}</div>
    <div class="card"><strong>Edges</strong><br>${report.summary.dependencyEdges}</div>
    <div class="card"><strong>Waves</strong><br>${report.summary.waves}</div>
    <div class="card"><strong>Cycles</strong><br>${report.summary.cycles}</div>
    <div class="card"><strong>Isolated</strong><br>${report.summary.isolatedComponents}</div>
  </div>
  <h2>Components</h2>
  <table><thead><tr><th>ID</th><th>Type</th><th>Name</th><th>Wave</th><th>Cycle</th><th>File</th></tr></thead><tbody>${componentRows}</tbody></table>
  <h2>Dependency Edges</h2>
  <table><thead><tr><th>From</th><th>To</th><th>Type</th><th>Source</th><th>Waves</th><th>Cycle</th></tr></thead><tbody>${edgeRows}</tbody></table>
  <h2>Mermaid</h2><pre>${escapeHtml(mermaid)}</pre>
  <h2>DOT</h2><pre>${escapeHtml(dot)}</pre>
  <h2>JSON</h2><pre>${escapeHtml(JSON.stringify(report, null, 2))}</pre>
</body>
</html>
    `.trim();
  }

  private resolveOutputPath(context: DeploymentContext, options: GraphExportOptions): string {
    if (options.outputPath) return path.resolve(options.outputPath);
    const reportDir = options.reportDir ?? path.join(context.scanResult.projectRoot, DEFAULT_REPORT_DIR);
    return path.join(reportDir, FILE_NAMES[options.format]);
  }

  private createComponents(
    context: DeploymentContext,
    waveByComponent: ReadonlyMap<NodeId, number>,
    cycleNodes: ReadonlySet<NodeId>
  ): GraphExportComponent[] {
    const graphNodes = new Set<NodeId>(context.scanResult.dependencyResult.graph.keys());
    for (const dependencies of context.scanResult.dependencyResult.graph.values()) {
      for (const dependency of dependencies) graphNodes.add(dependency);
    }
    for (const nodeId of context.scanResult.dependencyResult.components.keys()) graphNodes.add(nodeId);

    return [...graphNodes]
      .sort((left, right) => left.localeCompare(right))
      .map((nodeId) => {
        const component = context.scanResult.dependencyResult.components.get(nodeId);
        const dependencies = [...(context.scanResult.dependencyResult.graph.get(nodeId) ?? [])].sort((left, right) =>
          left.localeCompare(right)
        );
        const dependents = [...(context.scanResult.dependencyResult.reverseGraph.get(nodeId) ?? [])].sort(
          (left, right) => left.localeCompare(right)
        );
        const parsed = parseNodeId(nodeId, component);
        return {
          id: nodeId,
          type: parsed.type,
          name: parsed.name,
          filePath: component?.filePath,
          dependencies,
          dependents,
          wave: waveByComponent.get(nodeId),
          inCycle: cycleNodes.has(nodeId),
          isolated: dependencies.length === 0 && dependents.length === 0,
        };
      });
  }

  private createEdges(
    edges: DependencyEdge[],
    waveByComponent: ReadonlyMap<NodeId, number>,
    cycleEdges: ReadonlySet<string>
  ): GraphExportEdge[] {
    return [...edges]
      .sort((left, right) => `${left.from}->${left.to}`.localeCompare(`${right.from}->${right.to}`))
      .map((edge) => {
        const fromWave = waveByComponent.get(edge.from);
        const toWave = waveByComponent.get(edge.to);
        return {
          from: edge.from,
          to: edge.to,
          type: edge.type,
          source: edge.source,
          reason: edge.reason,
          confidence: edge.confidence,
          fromWave,
          toWave,
          crossesWave: fromWave !== undefined && toWave !== undefined && fromWave !== toWave,
          inCycle: cycleEdges.has(edgeKey(edge.from, edge.to)),
        };
      });
  }

  private createWave(wave: Wave): GraphExportWave {
    return {
      number: wave.number,
      componentCount: wave.metadata.componentCount,
      types: [...wave.metadata.types].sort((left, right) => left.localeCompare(right)),
      maxDepth: wave.metadata.maxDepth,
      estimatedTimeSeconds: wave.metadata.estimatedTime,
      hasCircularDependencies: wave.metadata.hasCircularDeps,
      components: [...wave.components].sort((left, right) => left.localeCompare(right)),
    };
  }

  private createWaveIndex(waves: Wave[]): Map<NodeId, number> {
    const waveByComponent = new Map<NodeId, number>();
    for (const wave of waves) {
      for (const component of wave.components) waveByComponent.set(component, wave.number);
    }
    return waveByComponent;
  }

  private createCycleEdgeSet(cycles: GraphExportCycle[]): Set<string> {
    const cycleEdges = new Set<string>();
    for (const cycle of cycles) {
      for (let index = 0; index < cycle.cycle.length; index += 1) {
        const from = cycle.cycle[index];
        const to = cycle.cycle[(index + 1) % cycle.cycle.length];
        if (from && to) cycleEdges.add(edgeKey(from, to));
      }
    }
    return cycleEdges;
  }

  private toMermaidNode(component: GraphExportComponent): string {
    return `${this.toMermaidId(component.id)}["${escapeMermaidText(this.componentLabel(component))}"]`;
  }

  private toMermaidId(value: string): string {
    return `n_${value.replace(/[^a-zA-Z0-9_]/g, '_')}`;
  }

  private componentLabel(component: GraphExportComponent): string {
    const markers = [
      component.wave === undefined ? 'unplaced' : `wave ${component.wave}`,
      component.inCycle ? 'cycle' : '',
    ]
      .filter(Boolean)
      .join(', ');
    return markers ? `${component.type}:${component.name} (${markers})` : `${component.type}:${component.name}`;
  }

  private toComponentRow(component: GraphExportComponent): string {
    return `<tr><td><code>${escapeHtml(component.id)}</code></td><td>${escapeHtml(component.type)}</td><td>${escapeHtml(
      component.name
    )}</td><td>${component.wave ?? 'Unplaced'}</td><td>${component.inCycle ? 'Yes' : 'No'}</td><td><code>${escapeHtml(
      component.filePath ?? ''
    )}</code></td></tr>`;
  }

  private toEdgeRow(edge: GraphExportEdge): string {
    const waves =
      edge.fromWave === undefined || edge.toWave === undefined ? 'Unplaced' : `${edge.fromWave} -> ${edge.toWave}`;
    return `<tr><td><code>${escapeHtml(edge.from)}</code></td><td><code>${escapeHtml(
      edge.to
    )}</code></td><td>${escapeHtml(edge.type)}</td><td>${escapeHtml(edge.source ?? '')}</td><td>${escapeHtml(
      waves
    )}</td><td>${edge.inCycle ? 'Yes' : 'No'}</td></tr>`;
  }
}

function parseNodeId(nodeId: NodeId, component?: MetadataComponent): { type: string; name: string } {
  if (component) return { type: component.type, name: component.name };
  const separatorIndex = nodeId.indexOf(':');
  if (separatorIndex === -1) return { type: 'Unknown', name: nodeId };
  return { type: nodeId.slice(0, separatorIndex), name: nodeId.slice(separatorIndex + 1) };
}

function edgeKey(from: NodeId, to: NodeId): string {
  return `${from}->${to}`;
}

function escapeMermaidText(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('[', '(').replaceAll(']', ')');
}

function escapeDot(value: string): string {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"').replaceAll('\n', '\\n');
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
