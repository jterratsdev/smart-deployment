import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { DeploymentContext } from '../deployment/deployment-context-service.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataType } from '../types/metadata.js';
import type { Wave } from '../waves/wave-builder.js';
import type { ManualCheckpoint } from '../types/manual-checkpoint.js';

export type DeploymentPlanReportOptions = {
  reportDir?: string;
  targetOrg?: string;
  sourcePath?: string;
  dryRun: boolean;
  validateOnly: boolean;
  destructive?: boolean;
  skipTests: boolean;
  checkpoints?: ManualCheckpoint[];
};

export type DeploymentPlanReportResult = {
  report: DeploymentPlanReport;
  jsonPath: string;
  htmlPath: string;
};

export type DeploymentPlanReport = {
  generatedAt: string;
  projectRoot: string;
  command: {
    mode: 'dry-run' | 'validate-only' | 'execute';
    targetOrg?: string;
    sourcePath?: string;
    destructive: boolean;
    skipTests: boolean;
  };
  summary: {
    status: 'passed' | 'warning' | 'blocked';
    components: number;
    waves: number;
    blockers: number;
    warnings: number;
    estimatedTimeSeconds: number;
  };
  validationSummary: {
    passed: boolean;
    errors: number;
    warnings: number;
    circularDependencies: number;
    unplacedComponents: number;
  };
  providerPhases: Array<{
    name: string;
    provider: string;
    status: 'completed' | 'skipped' | 'blocked';
    detail: string;
  }>;
  blockers: string[];
  warnings: string[];
  checkpoints: ManualCheckpoint[];
  waves: Array<{
    number: number;
    componentCount: number;
    types: MetadataType[];
    estimatedTimeSeconds: number;
    hasCircularDependencies: boolean;
    components: Array<{
      id: NodeId;
      type: string;
      name: string;
    }>;
  }>;
};

const DEFAULT_REPORT_DIR = '.smart-deployment/reports/start-dry-run';
const JSON_REPORT_NAME = 'deployment-plan.json';
const HTML_REPORT_NAME = 'deployment-plan.html';

export class DeploymentPlanReportService {
  public async generate(
    context: DeploymentContext,
    options: DeploymentPlanReportOptions
  ): Promise<DeploymentPlanReportResult> {
    const reportDir = options.reportDir ?? path.join(context.scanResult.projectRoot, DEFAULT_REPORT_DIR);
    const jsonPath = path.join(reportDir, JSON_REPORT_NAME);
    const htmlPath = path.join(reportDir, HTML_REPORT_NAME);
    const report = this.createReport(context, options);

    await mkdir(reportDir, { recursive: true });
    await Promise.all([
      writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8'),
      writeFile(htmlPath, this.toHTML(report), 'utf8'),
    ]);

    return { report, jsonPath, htmlPath };
  }

  public createReport(context: DeploymentContext, options: DeploymentPlanReportOptions): DeploymentPlanReport {
    const blockers = this.collectBlockers(context);
    const warnings = this.collectWarnings(context);
    const mode = this.resolveMode(options);
    const validationPassed = blockers.length === 0;

    return {
      generatedAt: new Date().toISOString(),
      projectRoot: context.scanResult.projectRoot,
      command: {
        mode,
        targetOrg: options.targetOrg,
        sourcePath: options.sourcePath,
        destructive: options.destructive === true,
        skipTests: options.skipTests,
      },
      summary: {
        status: blockers.length > 0 ? 'blocked' : warnings.length > 0 ? 'warning' : 'passed',
        components: context.scanResult.components.length,
        waves: context.orderedWaves.length,
        blockers: blockers.length,
        warnings: warnings.length,
        estimatedTimeSeconds: context.orderedWaves.reduce((total, wave) => total + wave.metadata.estimatedTime, 0),
      },
      validationSummary: {
        passed: validationPassed,
        errors: blockers.length,
        warnings: warnings.length,
        circularDependencies: context.scanResult.dependencyResult.circularDependencies.length,
        unplacedComponents: this.collectUnplacedComponents(context).length,
      },
      providerPhases: this.createProviderPhases(context, mode, validationPassed),
      blockers,
      warnings,
      checkpoints: [...(options.checkpoints ?? [])],
      waves: context.orderedWaves.map((wave) => this.createWaveReport(wave)),
    };
  }

  public toHTML(report: DeploymentPlanReport): string {
    const blockerItems = this.toListItems(report.blockers, 'No blockers detected.');
    const warningItems = this.toListItems(report.warnings, 'No warnings detected.');
    const phaseRows = report.providerPhases
      .map(
        (phase) => `
      <tr>
        <td>${escapeHtml(phase.name)}</td>
        <td>${escapeHtml(phase.provider)}</td>
        <td>${escapeHtml(phase.status)}</td>
        <td>${escapeHtml(phase.detail)}</td>
      </tr>`
      )
      .join('');
    const waveRows =
      report.waves.length > 0
        ? report.waves.map((wave) => this.toWaveRow(wave)).join('')
        : '<tr><td colspan="6">No deployment waves generated.</td></tr>';
    const checkpointItems =
      report.checkpoints.length > 0
        ? report.checkpoints
            .map(
              (checkpoint) =>
                `<li><code>${escapeHtml(checkpoint.id)}</code>: ${escapeHtml(checkpoint.phase)} wave ${
                  checkpoint.waveNumber
                }${checkpoint.message ? ` - ${escapeHtml(checkpoint.message)}` : ''}</li>`
            )
            .join('')
        : '<li>No manual checkpoints configured.</li>';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Deployment Plan Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }
    h1, h2 { margin-bottom: 0.5rem; }
    table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
    th, td { border: 1px solid #d1d5db; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #f3f4f6; }
    code { white-space: nowrap; }
    .summary { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 12px; background: #fff; }
  </style>
</head>
<body>
  <h1>Deployment Plan Report</h1>
  <p>Generated at ${escapeHtml(report.generatedAt)}</p>
  <p>Project root: <code>${escapeHtml(report.projectRoot)}</code></p>

  <div class="summary">
    <div class="card"><strong>Status</strong><br>${escapeHtml(report.summary.status)}</div>
    <div class="card"><strong>Components</strong><br>${report.summary.components}</div>
    <div class="card"><strong>Waves</strong><br>${report.summary.waves}</div>
    <div class="card"><strong>Blockers</strong><br>${report.summary.blockers}</div>
    <div class="card"><strong>Warnings</strong><br>${report.summary.warnings}</div>
    <div class="card"><strong>Estimated Time</strong><br>${report.summary.estimatedTimeSeconds}s</div>
  </div>

  <h2>Validation Summary</h2>
  <p>Passed: <strong>${report.validationSummary.passed ? 'Yes' : 'No'}</strong></p>
  <p>Errors: <strong>${report.validationSummary.errors}</strong></p>
  <p>Warnings: <strong>${report.validationSummary.warnings}</strong></p>
  <p>Circular dependencies: <strong>${report.validationSummary.circularDependencies}</strong></p>
  <p>Unplaced components: <strong>${report.validationSummary.unplacedComponents}</strong></p>

  <h2>Provider Phases</h2>
  <table>
    <thead>
      <tr><th>Phase</th><th>Provider</th><th>Status</th><th>Detail</th></tr>
    </thead>
    <tbody>${phaseRows}</tbody>
  </table>

  <h2>Blockers</h2>
  <ul>${blockerItems}</ul>

  <h2>Warnings</h2>
  <ul>${warningItems}</ul>

  <h2>Manual Checkpoints</h2>
  <ul>${checkpointItems}</ul>

  <h2>Waves</h2>
  <table>
    <thead>
      <tr>
        <th>Wave</th>
        <th>Components</th>
        <th>Types</th>
        <th>Estimated Time</th>
        <th>Circular</th>
        <th>Component List</th>
      </tr>
    </thead>
    <tbody>${waveRows}</tbody>
  </table>
</body>
</html>
    `.trim();
  }

  private resolveMode(options: DeploymentPlanReportOptions): DeploymentPlanReport['command']['mode'] {
    if (options.dryRun) {
      return 'dry-run';
    }

    return options.validateOnly ? 'validate-only' : 'execute';
  }

  private collectBlockers(context: DeploymentContext): string[] {
    return [
      ...context.scanResult.errors,
      ...context.scanResult.dependencyResult.circularDependencies
        .filter((cycle) => cycle.severity === 'error')
        .map((cycle) => cycle.message),
      ...this.collectUnplacedComponents(context).map((component) => `Unplaced component: ${component}`),
    ];
  }

  private collectWarnings(context: DeploymentContext): string[] {
    return [
      ...context.scanResult.warnings,
      ...context.scanResult.dependencyResult.circularDependencies
        .filter((cycle) => cycle.severity === 'warning')
        .map((cycle) => cycle.message),
    ];
  }

  private collectUnplacedComponents(context: DeploymentContext): NodeId[] {
    const placed = new Set(context.orderedWaves.flatMap((wave) => wave.components));
    return [...context.scanResult.dependencyResult.components.keys()]
      .filter((component) => !placed.has(component))
      .sort((left, right) => left.localeCompare(right));
  }

  private createProviderPhases(
    context: DeploymentContext,
    mode: DeploymentPlanReport['command']['mode'],
    validationPassed: boolean
  ): DeploymentPlanReport['providerPhases'] {
    return [
      {
        name: 'metadata-scan',
        provider: 'local-scanner',
        status: context.scanResult.errors.length > 0 ? 'blocked' : 'completed',
        detail: `${context.scanResult.components.length} component(s) scanned`,
      },
      {
        name: 'wave-generation',
        provider: 'wave-builder',
        status: validationPassed ? 'completed' : 'blocked',
        detail: `${context.orderedWaves.length} wave(s) planned`,
      },
      {
        name: 'deployment-execution',
        provider: 'sf-cli',
        status: mode === 'execute' && validationPassed ? 'completed' : mode === 'execute' ? 'blocked' : 'skipped',
        detail: mode === 'dry-run' ? 'Skipped because --dry-run was requested' : `Command mode: ${mode}`,
      },
    ];
  }

  private createWaveReport(wave: Wave): DeploymentPlanReport['waves'][number] {
    return {
      number: wave.number,
      componentCount: wave.metadata.componentCount,
      types: [...wave.metadata.types],
      estimatedTimeSeconds: wave.metadata.estimatedTime,
      hasCircularDependencies: wave.metadata.hasCircularDeps,
      components: wave.components.map((component) => {
        const [type, ...nameParts] = component.split(':');
        return {
          id: component,
          type,
          name: nameParts.join(':'),
        };
      }),
    };
  }

  private toListItems(values: string[], emptyMessage: string): string {
    return values.length > 0
      ? values.map((value) => `<li>${escapeHtml(value)}</li>`).join('')
      : `<li>${escapeHtml(emptyMessage)}</li>`;
  }

  private toWaveRow(wave: DeploymentPlanReport['waves'][number]): string {
    const components = wave.components.map((component) => `<code>${escapeHtml(component.id)}</code>`).join('<br>');
    return `
      <tr>
        <td>${wave.number}</td>
        <td>${wave.componentCount}</td>
        <td>${escapeHtml(wave.types.join(', ') || 'Unknown')}</td>
        <td>${wave.estimatedTimeSeconds}s</td>
        <td>${wave.hasCircularDependencies ? 'Yes' : 'No'}</td>
        <td>${components}</td>
      </tr>`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
