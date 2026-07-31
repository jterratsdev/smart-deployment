import type { DeploymentContext } from '../deployment/deployment-context-service.js';
import type { ReleaseReportPresenterIO } from '../presentation/release-report-presenter.js';
import { ReleaseReportCommandAdapter, type ReleaseReportCommandOutput } from './release-report-command-adapter.js';
import { buildStartReportFacts } from './release-report-facts-factory.js';

export type StartReleaseReportOptions = {
  targetOrg?: string;
  dryRun: boolean;
  validateOnly: boolean;
  reportDir?: string;
};

export class StartReleaseReportCoordinator {
  public constructor(private readonly adapter = new ReleaseReportCommandAdapter()) {}

  public async finalizeSuccess<T>(
    io: ReleaseReportPresenterIO,
    result: T,
    context: DeploymentContext,
    options: StartReleaseReportOptions
  ): Promise<T & ReleaseReportCommandOutput> {
    const releaseReport = await this.adapter.finalize(
      io,
      { kind: 'succeeded', value: result },
      buildStartReportFacts(context, options),
      {
        projectRoot: context.scanResult.projectRoot,
        reportDir: options.reportDir,
      }
    );
    return { ...result, ...releaseReport };
  }

  public async finalizeFailure(
    io: ReleaseReportPresenterIO,
    error: unknown,
    context: DeploymentContext,
    options: StartReleaseReportOptions
  ): Promise<void> {
    const warning = error instanceof Error ? error.message : String(error);
    await this.adapter.finalize(
      io,
      { kind: 'failed', error },
      buildStartReportFacts(context, { ...options, failed: true, warning }),
      {
        projectRoot: context.scanResult.projectRoot,
        reportDir: options.reportDir,
      }
    );
  }
}
