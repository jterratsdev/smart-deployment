import type { ReleaseReportFinalization } from '../reports/release-report-service.js';
import type { ReleaseReportV1 } from '../types/release-report.js';

export type ReleaseReportPresenterIO = {
  log: (message: string) => void;
  warn: (message: string) => void;
};

export class ReleaseReportPresenter {
  public present(io: ReleaseReportPresenterIO, report: ReleaseReportV1): void {
    io.log(`Release report: ${report.outcome}`);
    if (report.targetOrg) io.log(`Target org: ${report.targetOrg}`);
    io.log(`Analysis mode: ${report.analysisMode}`);
    io.log(
      `Items: ${report.summary.total} total, ${report.summary.succeeded} succeeded, ` +
        `${report.summary.failed} failed, ${report.summary.skipped} skipped, ` +
        `${report.summary.needsReview} need review`
    );

    for (const phase of report.phases) {
      io.log(`Phase ${phase.id}: ${phase.operation} via ${phase.route} - ${phase.status}`);
    }

    for (const warning of report.enrichment.warnings ?? []) io.warn(`Enrichment: ${warning}`);
    for (const warning of report.reportWarnings) io.warn(`Report: ${warning}`);

    for (const phase of report.phases) {
      if (phase.status === 'failed') io.warn(`Failed phase: ${phase.id}`);
      for (const remediation of phase.remediation ?? []) io.log(`Next action: ${remediation}`);
    }

    for (const item of report.items) {
      if (item.status === 'failed') io.warn(`Failed item: ${item.metadataType}:${item.fullName}`);
      for (const remediation of item.remediation ?? []) io.log(`Next action: ${remediation}`);
    }
  }

  public presentFinalization(
    io: Pick<ReleaseReportPresenterIO, 'warn'>,
    finalization: ReleaseReportFinalization
  ): void {
    if (finalization.kind === 'unavailable') io.warn(finalization.warning);
  }
}
