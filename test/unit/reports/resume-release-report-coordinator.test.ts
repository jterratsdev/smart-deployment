import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ReleaseReportPresenter } from '../../../src/presentation/release-report-presenter.js';
import { ReleaseReportCommandAdapter } from '../../../src/reports/release-report-command-adapter.js';
import { buildResumeReportFacts } from '../../../src/reports/release-report-facts-factory.js';
import { ResumeReleaseReportCoordinator } from '../../../src/reports/resume-release-report-coordinator.js';
import { ReleaseReportService } from '../../../src/reports/release-report-service.js';

describe('buildResumeReportFacts', () => {
  it('includes satisfied postcondition history in a successful resume report', () => {
    const postcondition = {
      code: 'OWD_PROPAGATION_SATISFIED' as const,
      status: 'satisfied' as const,
      objectName: 'Case',
      expectedInternalSharingModel: 'Private',
      observedInternalSharingModel: 'Private',
      attempts: 5,
      waitedMs: 1250,
      resumedPhase: 2,
    };
    const facts = buildResumeReportFacts(
      {
        success: true,
        resumedFromWave: 2,
        remainingWaves: 0,
        deploymentId: 'deploy-1',
        outcome: 'completed',
        postcondition,
      },
      'test-org'
    );

    expect(facts.outcome).to.equal('succeeded');
    expect(facts.postconditions).to.deep.equal([postcondition]);
  });

  it('preserves and sanitizes every barrier in stable order through the schema 1.1 report', async () => {
    let persisted = '';
    const service = new ReleaseReportService({
      store: async (serialized) => {
        persisted = serialized;
        return { kind: 'written', path: '/workspace/.smart-deployment/release-report.json' };
      },
    });
    const coordinator = new ResumeReleaseReportCoordinator(
      new ReleaseReportCommandAdapter(service, new ReleaseReportPresenter())
    );
    const postconditions = [
      {
        code: 'OWD_PROPAGATION_SATISFIED' as const,
        status: 'satisfied' as const,
        objectName: 'Case\u001b[31m',
        expectedInternalSharingModel: 'Private',
        observedInternalSharingModel: 'token=case-secret',
        attempts: 2,
        waitedMs: 500,
        resumedPhase: 2,
      },
      {
        code: 'OWD_PROPAGATION_SATISFIED' as const,
        status: 'satisfied' as const,
        objectName: 'Account',
        expectedInternalSharingModel: 'Read',
        observedInternalSharingModel: 'Bearer account-secret',
        attempts: 4,
        waitedMs: 1500,
        resumedPhase: 3,
      },
    ];

    const finalized = await coordinator.finalize(
      { log: () => {}, warn: () => {} },
      {
        success: true,
        resumedFromWave: 1,
        remainingWaves: 0,
        deploymentId: 'deploy-1',
        outcome: 'completed',
        postcondition: postconditions[0],
        postconditions,
      },
      { sourcePath: '/workspace', targetOrg: 'test-org' }
    );

    expect(finalized.releaseReport?.schemaVersion).to.equal('1.1');
    expect(finalized.releaseReport?.postconditions).to.have.length(2);
    expect(finalized.releaseReport?.postconditions?.map((condition) => condition.objectName)).to.deep.equal([
      'Case',
      'Account',
    ]);
    expect(
      finalized.releaseReport?.postconditions?.map((condition) => condition.observedInternalSharingModel)
    ).to.deep.equal(['token=[REDACTED]', 'Bearer [REDACTED]']);
    const persistedReport = JSON.parse(persisted) as {
      postconditions: Array<{ objectName: string; observedInternalSharingModel: string }>;
    };
    const persistedPostconditions = persistedReport.postconditions;
    expect(persistedPostconditions.map((condition) => condition.objectName)).to.deep.equal(['Case', 'Account']);
    expect(persistedPostconditions.map((condition) => condition.observedInternalSharingModel)).to.deep.equal([
      'token=[REDACTED]',
      'Bearer [REDACTED]',
    ]);
  });
});
