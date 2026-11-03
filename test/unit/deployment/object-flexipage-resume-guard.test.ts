import { expect } from 'chai';
import { describe, it } from 'mocha';
import { planObjectFlexipageOperations } from '../../../src/deployment/object-flexipage-operation-plan.js';
import {
  assessObjectFlexipageResume,
  type ObjectFlexipageResumeState,
} from '../../../src/deployment/object-flexipage-resume-guard.js';

const source =
  '<CustomObject xmlns="http://soap.sforce.com/2006/04/metadata"><actionOverrides><actionName>View</actionName><content>Tour_Page</content><formFactor>Large</formFactor><type>Flexipage</type></actionOverrides></CustomObject>';
const pageSource =
  '<FlexiPage xmlns="http://soap.sforce.com/2006/04/metadata"><sobjectType>Tour__c</sobjectType><type>RecordPage</type></FlexiPage>';
const plan = planObjectFlexipageOperations({
  objectName: 'Tour__c',
  source,
  pages: ['Tour_Page'],
  pageSources: new Map([['Tour_Page', pageSource]]),
  observation: { object: 'absent', pages: new Map([['Tour_Page', 'absent']]) },
});
const state = (statuses: ObjectFlexipageResumeState['operations']): ObjectFlexipageResumeState => ({
  targetOrgId: '00Dtest',
  planFingerprint: plan.fingerprint,
  operations: statuses,
});
const [foundation, page, activation] = plan.operations.map((operation) => operation.id);

describe('assessObjectFlexipageResume', () => {
  it('requires a fresh match for completed operations before identifying the next candidate', () => {
    const persisted = state([
      { id: foundation, status: 'verified' },
      { id: page, status: 'pending' },
      { id: activation, status: 'pending' },
    ]);
    const input = {
      plan,
      state: persisted,
      targetOrgId: '00Dtest',
      observedCompleted: new Map([[foundation, 'matches' as const]]),
    };
    expect(assessObjectFlexipageResume(input)).to.deep.equal({ kind: 'candidate', operationId: page });
    expect(assessObjectFlexipageResume({ ...input, observedCompleted: new Map() }).kind).to.equal('blocked');
    expect(
      assessObjectFlexipageResume({ ...input, observedCompleted: new Map([[foundation, 'mismatch' as const]]) }).kind
    ).to.equal('blocked');
  });

  it('blocks started or ambiguously persisted remote jobs without replay', () => {
    const base = [
      { id: foundation, status: 'verified' as const },
      { id: activation, status: 'pending' as const },
    ];
    const observedCompleted = new Map([[foundation, 'matches' as const]]);
    for (const operation of [
      { id: page, status: 'started' as const, jobId: '0Af123' },
      { id: page, status: 'pending' as const, jobId: '0Af123' },
    ]) {
      const result = assessObjectFlexipageResume({
        plan,
        state: state([base[0], operation, base[1]]),
        targetOrgId: '00Dtest',
        observedCompleted,
      });
      expect(result.kind).to.equal('blocked');
    }
  });

  it('rejects org/source drift, missing operations and out-of-order completion', () => {
    const operations = [
      { id: foundation, status: 'pending' as const },
      { id: page, status: 'verified' as const },
      { id: activation, status: 'pending' as const },
    ];
    const input = {
      plan,
      state: state(operations),
      targetOrgId: '00Dtest',
      observedCompleted: new Map([[page, 'matches' as const]]),
    };
    expect(assessObjectFlexipageResume(input).kind).to.equal('blocked');
    expect(assessObjectFlexipageResume({ ...input, targetOrgId: 'another' }).kind).to.equal('blocked');
    expect(
      assessObjectFlexipageResume({ ...input, state: { ...input.state, planFingerprint: 'stale' } }).kind
    ).to.equal('blocked');
    expect(assessObjectFlexipageResume({ ...input, state: state(operations.slice(1)) }).kind).to.equal('blocked');
    expect(
      assessObjectFlexipageResume({
        ...input,
        state: state([
          { id: foundation, status: 'pending' },
          { id: page, status: 'verified' },
          { id: activation, status: 'verified' },
        ]),
      }).kind
    ).to.equal('blocked');
    expect(
      assessObjectFlexipageResume({
        ...input,
        state: state([
          { id: foundation, status: 'verified' },
          { id: page, status: 'verified' },
          { id: activation, status: 'verified' },
        ]),
        observedCompleted: new Map([
          [foundation, 'matches' as const],
          [page, 'matches' as const],
          [activation, 'matches' as const],
        ]),
      })
    ).to.deep.equal({ kind: 'complete' });
  });
});
