import { expect } from 'chai';
import { describe, it } from 'mocha';
import { DeploymentReporter, type DeploymentReport } from '../../../src/deployment/deployment-reporter.js';

const report: DeploymentReport = {
  deploymentId: 'deployment-123',
  targetOrg: 'test-org',
  startTime: '2026-08-27T10:00:00.000Z',
  endTime: '2026-08-27T10:00:12.500Z',
  totalDuration: 12.5,
  status: 'FAILED',
  success: false,
  totalWaves: 2,
  completedWaves: 1,
  totalComponents: 3,
  totalComponentFailures: 1,
  totalTests: 2,
  totalTestFailures: 0,
  waves: [
    {
      waveNumber: 1,
      components: 2,
      startTime: '2026-08-27T10:00:00.000Z',
      endTime: '2026-08-27T10:00:05.000Z',
      duration: 5,
      success: true,
      testsRun: 2,
      testFailures: 0,
    },
    {
      waveNumber: 2,
      components: 1,
      startTime: '2026-08-27T10:00:05.000Z',
      endTime: '2026-08-27T10:00:12.500Z',
      duration: 7.5,
      success: false,
      error: 'component failure',
      componentFailures: 1,
    },
  ],
  errors: ['component failure'],
};

describe('DeploymentReporter', () => {
  it('includes the terminal status and all deployment details', () => {
    const output = new DeploymentReporter().generateReport(report);

    expect(output).to.include('Deployment ID: deployment-123');
    expect(output).to.include('Status: ❌ FAILED');
    expect(output).to.include('Waves: 1/2');
    expect(output).to.include('Components: 3');
    expect(output).to.include('Tests: 2');
    expect(output).to.include('Duration: 12.5s');
    expect(output).to.include('Error: component failure');
  });

  it('serializes failure even when the deployment result had component failures', () => {
    const serialized = JSON.parse(new DeploymentReporter().toJSON(report)) as DeploymentReport;

    expect(serialized.success).to.equal(false);
    expect(serialized.status).to.equal('FAILED');
    expect(serialized.waves[1].success).to.equal(false);
    expect(serialized.errors).to.deep.equal(['component failure']);
  });

  it('does not present validation or dry-run as a real deployment success', () => {
    const reporter = new DeploymentReporter();
    const validation = { ...report, mode: 'VALIDATION' as const, status: 'SUCCESS' as const, success: true };
    const dryRun = { ...report, mode: 'DRY_RUN' as const, status: 'SUCCESS' as const, success: true };

    expect(reporter.generateReport(validation)).to.include('Mode: VALIDATION').and.include('Status: ✅ VALIDATED');
    expect(reporter.toJSON(validation)).to.include('"status": "VALIDATED"');
    expect(reporter.generateReport(dryRun)).to.include('Mode: DRY_RUN').and.include('Status: ✅ VALIDATED');
  });
});
