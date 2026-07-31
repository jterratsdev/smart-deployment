import { expect } from 'chai';
import { describe, it } from 'mocha';
import { sanitizeReleaseReport } from '../../../src/reports/release-report-sanitizer.js';
import type { ReleaseReportV1 } from '../../../src/types/release-report.js';

function createReport(): ReleaseReportV1 {
  return {
    schemaVersion: '1.0',
    generatedAt: '2026-07-27T12:34:56.000Z',
    command: 'smart-deployment.start',
    targetOrg: '\u001B[31mqa-org\u001B[0m\u0000',
    analysisMode: 'ai_enriched',
    enrichment: {
      status: 'partial',
      warnings: ['Authorization: Bearer secret-token'],
    },
    outcome: 'failed',
    summary: { total: 1, succeeded: 0, failed: 1, skipped: 0, needsReview: 0 },
    phases: [
      {
        id: 'core-metadata',
        route: 'salesforce-metadata',
        operation: 'deploy',
        status: 'failed',
        evidence: [
          {
            tool: 'sf',
            operationId: 'deploy\u0007start',
            deploymentId: '0Af-safe',
            artifact: '/workspace/project/.smart-deployment/logs/deploy.json',
          },
        ],
        remediation: ['Open force://user:password@example.test and retry'],
      },
    ],
    items: [
      {
        phaseId: 'core-metadata',
        metadataType: 'Apex\u0000Class',
        fullName: '\u001B[32mCheckout\u001B[0m',
        route: 'salesforce-metadata',
        operation: 'deploy',
        status: 'failed',
        evidenceReferences: ['/workspace/project/reports/safe.json', '/private/outside/secret.log', '../outside.log'],
        remediation: [`token=${'x'.repeat(1200)}`],
      },
    ],
    reportWarnings: ['client_secret=do-not-emit'],
  };
}

describe('sanitizeReleaseReport', () => {
  it('redacts credentials and strips ANSI and control characters with length limits', () => {
    const sanitized = sanitizeReleaseReport(createReport(), { projectRoot: '/workspace/project' });
    const serialized = JSON.stringify(sanitized);

    expect(sanitized.targetOrg).to.equal('qa-org');
    expect(sanitized.items[0]).to.include({ metadataType: 'ApexClass', fullName: 'Checkout' });
    expect(sanitized.phases[0].evidence?.[0].operationId).to.equal('deploystart');
    expect(serialized).not.to.include('secret-token');
    expect(serialized).not.to.include('do-not-emit');
    expect(serialized).not.to.include('force://');
    expect(serialized).not.to.include(String.fromCharCode(27));
    expect(serialized).not.to.include(String.fromCharCode(0));
    expect(sanitized.items[0].remediation?.[0].length).to.be.at.most(1000);
  });

  it('keeps only validated project-relative artifact references', () => {
    const sanitized = sanitizeReleaseReport(createReport(), { projectRoot: '/workspace/project' });

    expect(sanitized.phases[0].evidence?.[0].artifact).to.equal('.smart-deployment/logs/deploy.json');
    expect(sanitized.items[0].evidenceReferences).to.deep.equal(['reports/safe.json']);
  });

  it('reconstructs the DTO and drops unsupported raw output fields at runtime', () => {
    const unsafe = createReport() as ReleaseReportV1 & {
      stdout: string;
      phases: Array<ReleaseReportV1['phases'][number] & { stderr: string }>;
    };
    unsafe.stdout = 'raw command output';
    unsafe.phases[0].stderr = 'raw provider failure';

    const sanitized = sanitizeReleaseReport(unsafe, { projectRoot: '/workspace/project' });
    const serialized = JSON.stringify(sanitized);

    expect(serialized).not.to.include('raw command output');
    expect(serialized).not.to.include('raw provider failure');
  });

  it('normalizes in-project Windows references and omits external Windows paths', () => {
    const source = createReport();
    source.items[0].evidenceReferences = ['C:\\workspace\\project\\reports\\safe.json', 'D:\\external\\secret.log'];

    const sanitized = sanitizeReleaseReport(source, { projectRoot: 'C:\\workspace\\project' });

    expect(sanitized.items[0].evidenceReferences).to.deep.equal(['reports/safe.json']);
  });
});
