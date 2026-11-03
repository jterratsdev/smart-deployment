import type { ReleaseReportPresenterIO } from '../presentation/release-report-presenter.js';
import type { ResumeCommandResult } from '../presentation/resume-result-projector.js';
import { ReleaseReportCommandAdapter, type ReleaseReportCommandOutput } from './release-report-command-adapter.js';
import { buildResumeReportFacts } from './release-report-facts-factory.js';

export class ResumeReleaseReportCoordinator {
  public constructor(private readonly adapter = new ReleaseReportCommandAdapter()) {}

  public async finalize(
    io: ReleaseReportPresenterIO,
    result: ResumeCommandResult,
    options: { sourcePath?: string; targetOrg?: string }
  ): Promise<ResumeCommandResult & ReleaseReportCommandOutput> {
    const output = await this.adapter.finalize(
      io,
      { kind: 'succeeded', value: result },
      buildResumeReportFacts(result, options.targetOrg),
      { projectRoot: options.sourcePath ?? process.cwd() }
    );
    return { ...result, ...output };
  }
}
