import { expect } from 'chai';
import { describe, it } from 'mocha';
import { StartCommandPresenter } from '../../../src/presentation/start-command-presenter.js';
describe('StartCommandPresenter', () => {
  it('reports analysis and deployment summaries', () => {
    const presenter = new StartCommandPresenter();
    const logs: string[] = [];

    presenter.reportExecutionStart({
      log: (message) => logs.push(message),
    });
    presenter.reportExecutionSkipped(
      {
        log: (message) => logs.push(message),
      },
      'dry-run'
    );
    presenter.reportExecutionSkipped(
      {
        log: (message) => logs.push(message),
      },
      'validate-only'
    );
    presenter.reportAnalysisSummary(
      {
        log: (message) => logs.push(message),
      },
      {
        metadataCount: 4,
        waves: 2,
        aiEnabled: true,
      }
    );
    presenter.reportDeploymentReport(
      {
        log: (message) => logs.push(message),
      },
      2
    );
    presenter.reportReportGenerationStart({
      log: (message) => logs.push(message),
    });
    presenter.reportPostconditionPaused(
      { log: (message) => logs.push(message) },
      {
        id: 'owd:Case:Private',
        kind: 'owd-internal-sharing-model',
        objectName: 'Case',
        afterWaveNumber: 1,
        expectedInternalSharingModel: 'Private',
        expectedExternalSharingModel: 'Private',
        status: 'timed-out',
        observedInternalSharingModel: 'ReadWriteTransfer',
        observedExternalSharingModel: 'Private',
        attempts: 3,
        waitedMs: 5000,
        pausedAt: '2026-01-01T00:00:00.000Z',
        resumedPhase: 2,
      }
    );

    expect(logs).to.include.members([
      '🚀 Executing deployment...',
      '🔍 Dry-run mode: skipping actual deployment',
      '🔍 Validate-only mode: skipping actual deployment',
      '✅ Found 4 metadata components',
      '🌊 Generating deployment waves...',
      '✅ Generated 2 waves',
      '🤖 AI-enhanced prioritization enabled',
      '📄 Generating deployment report...',
      '\n📊 Deployment Report:',
      '   - Waves: 2',
      '   - Status: Success',
      'OWD_PROPAGATION_PENDING: Case',
      'Internal sharing model: expected=Private, observed=ReadWriteTransfer',
      'External sharing model: expected=Private, observed=Private',
      'Attempts=3, waitedMs=5000, errorCategory=none, resumedPhase=2',
    ]);
  });
});
