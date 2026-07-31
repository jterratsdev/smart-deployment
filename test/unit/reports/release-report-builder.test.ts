import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ReleaseReportBuilder } from '../../../src/reports/release-report-builder.js';
import type { ReleaseReportFacts } from '../../../src/types/release-report.js';

const FIXED_DATE = new Date('2026-07-27T12:34:56.000Z');

function createFacts(): ReleaseReportFacts {
  return {
    command: 'smart-deployment.ci-publish',
    analysisMode: 'deterministic',
    enrichment: {
      status: 'unavailable',
      warnings: ['Provider unavailable', 'Provider unavailable'],
    },
    outcome: 'partial',
    phases: [
      {
        id: 'community-publish',
        route: 'experience-cloud',
        operation: 'publish',
        status: 'failed',
      },
      {
        id: 'core-metadata',
        route: 'salesforce-metadata',
        operation: 'deploy',
        status: 'succeeded',
      },
      {
        id: 'agentforce-activate',
        route: 'agentforce',
        operation: 'activate',
        status: 'skipped',
      },
      {
        id: 'ai-evaluations',
        route: 'ai-evaluation',
        operation: 'validate',
        status: 'needs_review',
      },
    ],
    items: [
      {
        phaseId: 'community-publish',
        metadataType: 'DigitalExperience',
        fullName: 'Storefront',
        route: 'experience-cloud',
        operation: 'publish',
        status: 'failed',
      },
      {
        phaseId: 'core-metadata',
        metadataType: 'Flow',
        fullName: 'Checkout',
        route: 'salesforce-metadata',
        operation: 'deploy',
        status: 'succeeded',
      },
      {
        phaseId: 'agentforce-activate',
        metadataType: 'AiAuthoringBundle',
        fullName: 'Support',
        route: 'agentforce',
        operation: 'activate',
        status: 'skipped',
      },
      {
        phaseId: 'ai-evaluations',
        metadataType: 'AiEvaluationDefinition',
        fullName: 'SupportQuality',
        route: 'ai-evaluation',
        operation: 'validate',
        status: 'needs_review',
      },
    ],
    reportWarnings: ['B warning', 'A warning', 'A warning'],
  };
}

describe('ReleaseReportBuilder', () => {
  it('builds schema v1 with injected time, explicit counters, and underlying outcome', () => {
    const report = new ReleaseReportBuilder({ now: () => FIXED_DATE }).build(createFacts());

    expect(report.schemaVersion).to.equal('1.0');
    expect(report.generatedAt).to.equal('2026-07-27T12:34:56.000Z');
    expect(report.targetOrg).to.equal(undefined);
    expect(report.outcome).to.equal('partial');
    expect(report.enrichment).to.deep.equal({
      status: 'unavailable',
      warnings: ['Provider unavailable'],
    });
    expect(report.summary).to.deep.equal({
      total: 4,
      succeeded: 1,
      failed: 1,
      skipped: 1,
      needsReview: 1,
    });
    expect(report.reportWarnings).to.deep.equal(['A warning', 'B warning']);
  });

  it('orders special phases and shuffled items deterministically', () => {
    const facts = createFacts();
    const builder = new ReleaseReportBuilder({ now: () => FIXED_DATE });
    const first = builder.build(facts);
    const second = builder.build({
      ...facts,
      phases: [...facts.phases].reverse(),
      items: [...facts.items].reverse(),
    });

    expect(first).to.deep.equal(second);
    expect(first.phases.map((phase) => phase.id)).to.deep.equal([
      'core-metadata',
      'agentforce-activate',
      'ai-evaluations',
      'community-publish',
    ]);
    expect(first.items.map((item) => item.fullName)).to.deep.equal([
      'Checkout',
      'Support',
      'SupportQuality',
      'Storefront',
    ]);
  });

  it('sorts and deduplicates evidence and remediation without mutating facts', () => {
    const facts = createFacts();
    facts.phases[0].evidence = [
      { tool: 'sf', operationId: 'publish-z' },
      { tool: 'sf', operationId: 'publish-a' },
      { tool: 'sf', operationId: 'publish-a' },
    ];
    facts.items[0].remediation = ['Retry publish', 'Inspect site', 'Retry publish'];

    const report = new ReleaseReportBuilder({ now: () => FIXED_DATE }).build(facts);
    const phase = report.phases.find((candidate) => candidate.id === 'community-publish');
    const item = report.items.find((candidate) => candidate.fullName === 'Storefront');

    expect(phase?.evidence?.map((entry) => entry.operationId)).to.deep.equal(['publish-a', 'publish-z']);
    expect(item?.remediation).to.deep.equal(['Inspect site', 'Retry publish']);
    expect(facts.phases[0].evidence).to.have.length(3);
    expect(facts.items[0].remediation).to.have.length(3);
  });

  it('maps unknown provider outcomes to review and inapplicable work to skipped', () => {
    const facts = createFacts();
    facts.items[0].status = 'unknown';
    facts.items[1].status = 'inapplicable';
    facts.phases[0].status = 'unknown';

    const report = new ReleaseReportBuilder({ now: () => FIXED_DATE }).build(facts);
    const unknownPhase = report.phases.find((phase) => phase.id === 'community-publish');
    const unknownItem = report.items.find((item) => item.fullName === 'Storefront');
    const inapplicableItem = report.items.find((item) => item.fullName === 'Checkout');

    expect(unknownPhase?.status).to.equal('needs_review');
    expect(unknownItem?.status).to.equal('needs_review');
    expect(inapplicableItem?.status).to.equal('skipped');
    expect(report.summary).to.deep.equal({
      total: 4,
      succeeded: 0,
      failed: 0,
      skipped: 2,
      needsReview: 2,
    });
  });
});
