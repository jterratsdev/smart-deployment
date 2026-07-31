import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ReleaseReportPresenter } from '../../../src/presentation/release-report-presenter.js';
import type { ReleaseReportV1 } from '../../../src/types/release-report.js';

const report: ReleaseReportV1 = {
  schemaVersion: '1.0',
  generatedAt: '2026-07-27T12:34:56.000Z',
  command: 'smart-deployment.ci-publish',
  targetOrg: 'qa-org',
  analysisMode: 'ai_enriched',
  enrichment: { status: 'partial', warnings: ['AI provider timed out'] },
  outcome: 'partial',
  summary: { total: 2, succeeded: 1, failed: 1, skipped: 0, needsReview: 0 },
  phases: [
    {
      id: 'core-metadata',
      route: 'salesforce-metadata',
      operation: 'deploy',
      status: 'succeeded',
    },
    {
      id: 'community-publish',
      route: 'experience-cloud',
      operation: 'publish',
      status: 'failed',
      remediation: ['Retry community publish'],
    },
  ],
  items: [
    {
      phaseId: 'core-metadata',
      metadataType: 'ApexClass',
      fullName: 'Checkout',
      route: 'salesforce-metadata',
      operation: 'deploy',
      status: 'succeeded',
    },
    {
      phaseId: 'community-publish',
      metadataType: 'DigitalExperience',
      fullName: 'Storefront',
      route: 'experience-cloud',
      operation: 'publish',
      status: 'failed',
      remediation: ['Inspect community job'],
    },
  ],
  reportWarnings: ['Report enrichment is incomplete'],
};

describe('ReleaseReportPresenter', () => {
  it('renders supplied totals, target, analysis, phases, warnings, failures, and next actions', () => {
    const logs: string[] = [];
    const warnings: string[] = [];

    new ReleaseReportPresenter().present(
      {
        log: (message) => logs.push(message),
        warn: (message) => warnings.push(message),
      },
      report
    );

    expect(logs).to.include.members([
      'Release report: partial',
      'Target org: qa-org',
      'Analysis mode: ai_enriched',
      'Items: 2 total, 1 succeeded, 1 failed, 0 skipped, 0 need review',
      'Phase core-metadata: deploy via salesforce-metadata - succeeded',
      'Phase community-publish: publish via experience-cloud - failed',
      'Next action: Retry community publish',
      'Next action: Inspect community job',
    ]);
    expect(warnings).to.include.members([
      'Enrichment: AI provider timed out',
      'Report: Report enrichment is incomplete',
      'Failed phase: community-publish',
      'Failed item: DigitalExperience:Storefront',
    ]);
  });

  it('presents report finalization failures without throwing or calculating domain state', () => {
    const warnings: string[] = [];

    new ReleaseReportPresenter().presentFinalization(
      { warn: (message) => warnings.push(message) },
      { kind: 'unavailable', stage: 'persist', warning: 'Report unavailable', report }
    );

    expect(warnings).to.deep.equal(['Report unavailable']);
  });
});
