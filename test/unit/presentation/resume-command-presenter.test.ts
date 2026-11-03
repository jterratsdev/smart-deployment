import { expect } from 'chai';
import { describe, it } from 'mocha';
import { ResumeCommandPresenter } from '../../../src/presentation/resume-command-presenter.js';

describe('ResumeCommandPresenter', () => {
  it('renders resume preparation details', () => {
    const presenter = new ResumeCommandPresenter();
    const logs: string[] = [];

    presenter.reportResumePreparation(
      {
        log: (message) => logs.push(message),
      },
      {
        deploymentId: 'deploy-123',
        currentWave: 2,
        totalWaves: 4,
        remainingWaves: 3,
        failureReason: 'UNABLE_TO_LOCK_ROW',
      },
      'quick'
    );

    expect(logs).to.deep.equal([
      '🔄 Resume prepared for deployment deploy-123',
      'Retry strategy: quick',
      'Resuming from wave 2/4',
      'Remaining waves: 3',
      'Previous failure: UNABLE_TO_LOCK_ROW',
    ]);
  });

  it('renders complete resumed postcondition diagnostics', () => {
    const logs: string[] = [];
    new ResumeCommandPresenter().reportPostcondition(
      { log: (message) => logs.push(message) },
      {
        code: 'OWD_PROPAGATION_PENDING',
        objectName: 'Case',
        expectedInternalSharingModel: 'Private',
        expectedExternalSharingModel: 'Private',
        status: 'observation-unavailable',
        attempts: 2,
        waitedMs: 1000,
        resumedPhase: 2,
        errorCategory: 'network',
      }
    );
    expect(logs).to.deep.equal([
      'OWD_PROPAGATION_PENDING: Case',
      'Internal expected=Private, observed=unavailable; external expected=Private, observed=unavailable',
      'Attempts=2, waitedMs=1000, errorCategory=network, resumedPhase=2',
    ]);
  });

  it('renders satisfied resume history for human output', () => {
    const logs: string[] = [];
    new ResumeCommandPresenter().reportPostcondition(
      { log: (message) => logs.push(message) },
      {
        code: 'OWD_PROPAGATION_SATISFIED',
        status: 'satisfied',
        objectName: 'Case',
        expectedInternalSharingModel: 'Private',
        observedInternalSharingModel: 'Private',
        attempts: 5,
        waitedMs: 1250,
        resumedPhase: 2,
      }
    );
    expect(logs).to.include('OWD_PROPAGATION_SATISFIED: Case');
    expect(logs).to.include('Attempts=5, waitedMs=1250, errorCategory=none, resumedPhase=2');
  });
});
