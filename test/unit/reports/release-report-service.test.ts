import { expect } from 'chai';
import { describe, it } from 'mocha';
import {
  ReleaseReportService,
  type ReleaseReportServiceDependencies,
} from '../../../src/reports/release-report-service.js';
import type { ReleaseReportFacts, ReleaseReportV1 } from '../../../src/types/release-report.js';

const report: ReleaseReportV1 = {
  schemaVersion: '1.0',
  generatedAt: '2026-07-27T12:34:56.000Z',
  command: 'smart-deployment.validate',
  analysisMode: 'deterministic',
  enrichment: { status: 'skipped' },
  outcome: 'failed',
  summary: { total: 0, succeeded: 0, failed: 0, skipped: 0, needsReview: 0 },
  phases: [],
  items: [],
  reportWarnings: [],
};

const facts: ReleaseReportFacts = {
  command: report.command,
  analysisMode: report.analysisMode,
  enrichment: report.enrichment,
  outcome: report.outcome,
  phases: [],
  items: [],
};

function dependencies(): ReleaseReportServiceDependencies {
  return {
    build: () => report,
    sanitize: (value) => value,
    serialize: (value) => JSON.stringify(value),
    store: async () => ({ kind: 'written', path: '/workspace/release-report.json' }),
  };
}

describe('ReleaseReportService', () => {
  it('writes a sanitized report while preserving the underlying success value identity', async () => {
    const value = { deploymentId: '0Af-safe' };
    let persisted = '';
    const service = new ReleaseReportService({
      ...dependencies(),
      store: async (serialized) => {
        persisted = serialized;
        return { kind: 'written', path: '/workspace/release-report.json' };
      },
    });

    const result = await service.finalize({ kind: 'succeeded', value }, facts, { projectRoot: '/workspace' });

    expect(result.underlying.kind).to.equal('succeeded');
    if (result.underlying.kind === 'succeeded') expect(result.underlying.value).to.equal(value);
    expect(result.report.kind).to.equal('written');
    expect(JSON.parse(persisted)).to.deep.equal(report);
  });

  for (const stage of ['build', 'sanitize', 'serialize'] as const) {
    it(`returns a discriminated ${stage} warning and preserves the original error object`, async () => {
      const originalError = new Error('underlying validation failure');
      const overrides: Partial<ReleaseReportServiceDependencies> = {};
      overrides[stage] = (() => {
        throw new Error(`${stage} failed`);
      }) as never;
      const service = new ReleaseReportService({ ...dependencies(), ...overrides });

      const result = await service.finalize({ kind: 'failed', error: originalError }, facts, {
        projectRoot: '/workspace',
      });

      expect(result.underlying.kind).to.equal('failed');
      if (result.underlying.kind === 'failed') expect(result.underlying.error).to.equal(originalError);
      expect(result.report).to.include({ kind: 'unavailable', stage });
    });
  }

  it('keeps the report available when persistence is advisory-unavailable', async () => {
    const service = new ReleaseReportService({
      ...dependencies(),
      store: async () => ({ kind: 'unavailable', warning: 'Read-only filesystem' }),
    });

    const result = await service.finalize({ kind: 'succeeded', value: 42 }, facts, { projectRoot: '/workspace' });

    expect(result.report).to.deep.equal({
      kind: 'unavailable',
      stage: 'persist',
      warning: 'Read-only filesystem',
      report,
    });
  });

  it('converts a throwing store adapter into a non-throwing persistence warning', async () => {
    const service = new ReleaseReportService({
      ...dependencies(),
      store: async () => {
        throw new Error('rename failed');
      },
    });

    const result = await service.finalize({ kind: 'succeeded', value: true }, facts, {
      projectRoot: '/workspace',
    });

    expect(result.report).to.include({ kind: 'unavailable', stage: 'persist' });
  });
});
