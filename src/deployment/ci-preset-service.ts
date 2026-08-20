import * as path from 'node:path';
import { DeploymentPlanReportService, type DeploymentPlanReport } from '../reports/deployment-plan-report-service.js';
import { loadRepoConfigStrict } from '../config/repo-config.js';
import { validateManualCheckpoints, type ManualCheckpoint } from '../types/manual-checkpoint.js';
import type { CommitScopeOptions } from './commit-scope-service.js';
import { DeploymentContextService } from './deployment-context-service.js';

export type CiPresetValidationMode = 'strict' | 'warn-only' | 'local-only';

export type CiPresetOptions = {
  sourcePath?: string;
  targetOrg?: string;
  reportDir?: string;
  validationMode: CiPresetValidationMode;
  skipTests: boolean;
  useAI: boolean;
  orgType?: string;
  industry?: string;
  commitScope?: CommitScopeOptions;
};

export type CiPresetResult = {
  success: boolean;
  validationMode: CiPresetValidationMode;
  exitCode: number;
  artifacts: {
    jsonPath: string;
    htmlPath: string;
    reportDir: string;
  };
  githubOutputs: Record<string, string>;
  summary: DeploymentPlanReport['summary'] & {
    conclusion: 'passed' | 'warning' | 'blocked';
  };
  blockers: string[];
  warnings: string[];
  checkpoints: ManualCheckpoint[];
};

type CiPresetServiceDependencies = {
  deploymentContextService?: DeploymentContextService;
  deploymentPlanReportService?: DeploymentPlanReportService;
};

export class CiPresetService {
  private readonly deploymentContextService: DeploymentContextService;
  private readonly deploymentPlanReportService: DeploymentPlanReportService;

  public constructor(dependencies: CiPresetServiceDependencies = {}) {
    this.deploymentContextService = dependencies.deploymentContextService ?? new DeploymentContextService();
    this.deploymentPlanReportService = dependencies.deploymentPlanReportService ?? new DeploymentPlanReportService();
  }

  public async run(options: CiPresetOptions): Promise<CiPresetResult> {
    const context = await this.deploymentContextService.buildContext({
      sourcePath: options.sourcePath,
      useAI: options.useAI,
      orgType: options.orgType,
      industry: options.industry,
      commitScope: options.commitScope,
    });
    const config = await loadRepoConfigStrict(context.scanResult.projectRoot);
    const checkpoints = config.checkpoints ?? [];
    validateManualCheckpoints(checkpoints, context.orderedWaves);
    const reportResult = await this.deploymentPlanReportService.generate(context, {
      reportDir: options.reportDir,
      targetOrg: options.targetOrg,
      sourcePath: options.sourcePath,
      dryRun: true,
      validateOnly: options.validationMode !== 'local-only',
      skipTests: options.skipTests,
      destructive: false,
      checkpoints,
    });
    const exitCode = this.resolveExitCode(reportResult.report, options.validationMode);
    const reportDir = path.dirname(reportResult.jsonPath);
    const conclusion = reportResult.report.summary.status;

    return {
      success: exitCode === 0,
      validationMode: options.validationMode,
      exitCode,
      artifacts: {
        jsonPath: reportResult.jsonPath,
        htmlPath: reportResult.htmlPath,
        reportDir,
      },
      githubOutputs: this.createGithubOutputs(
        reportResult.jsonPath,
        reportResult.htmlPath,
        reportDir,
        conclusion,
        exitCode
      ),
      summary: {
        ...reportResult.report.summary,
        conclusion,
      },
      blockers: reportResult.report.blockers,
      warnings: reportResult.report.warnings,
      checkpoints,
    };
  }

  private resolveExitCode(report: DeploymentPlanReport, validationMode: CiPresetValidationMode): number {
    if (validationMode === 'strict' && report.summary.blockers > 0) {
      return 2;
    }

    return 0;
  }

  private createGithubOutputs(
    jsonPath: string,
    htmlPath: string,
    reportDir: string,
    conclusion: 'passed' | 'warning' | 'blocked',
    exitCode: number
  ): Record<string, string> {
    return Object.fromEntries([
      ['deployment_plan_json', jsonPath],
      ['deployment_plan_html', htmlPath],
      ['deployment_report_dir', reportDir],
      ['deployment_status', conclusion],
      ['deployment_exit_code', String(exitCode)],
    ]);
  }
}
