import { ReleaseReportPresenter, type ReleaseReportPresenterIO } from '../presentation/release-report-presenter.js';
import type { ReleaseReportFacts, ReleaseReportV1 } from '../types/release-report.js';
import {
  ReleaseReportService,
  type ReleaseReportServiceOptions,
  type UnderlyingOperationResult,
} from './release-report-service.js';

export type ReleaseReportCommandOutput = {
  releaseReport?: ReleaseReportV1;
  releaseReportPath?: string;
  releaseReportWarning?: string;
};

export class ReleaseReportCommandAdapter {
  public constructor(
    private readonly service = new ReleaseReportService(),
    private readonly presenter = new ReleaseReportPresenter()
  ) {}

  public async finalize<T>(
    io: ReleaseReportPresenterIO,
    underlying: UnderlyingOperationResult<T>,
    facts: ReleaseReportFacts,
    options: ReleaseReportServiceOptions
  ): Promise<ReleaseReportCommandOutput> {
    const finalized = await this.service.finalize(underlying, facts, options);
    this.presenter.presentFinalization(io, finalized.report);

    if (finalized.report.kind === 'unavailable') {
      if (finalized.report.report) this.presenter.present(io, finalized.report.report);
      return {
        releaseReport: finalized.report.report,
        releaseReportWarning: finalized.report.warning,
      };
    }

    this.presenter.present(io, finalized.report.report);
    return {
      releaseReport: finalized.report.report,
      releaseReportPath: finalized.report.path,
    };
  }
}
