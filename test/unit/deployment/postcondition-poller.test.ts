import { expect } from 'chai';
import { describe, it } from 'mocha';
import { PostconditionPoller } from '../../../src/deployment/postcondition-poller.js';

describe('PostconditionPoller', () => {
  it('uses bounded exponential waits and ignores an external-only match', async () => {
    let now = 0;
    const waits: number[] = [];
    const observations = ['ReadWriteTransfer', 'ReadWriteTransfer', 'Private'];
    const poller = new PostconditionPoller({
      query: async () => ({
        kind: 'observed',
        observation: { internalSharingModel: observations.shift(), externalSharingModel: 'Private' },
      }),
      now: () => now,
      sleep: async (milliseconds) => {
        waits.push(milliseconds);
        now += milliseconds;
      },
    });
    const result = await poller.wait('org', condition(), {
      timeoutMs: 10_000,
      initialDelayMs: 100,
      maximumDelayMs: 150,
    });
    expect(result.kind).to.equal('satisfied');
    expect(waits).to.deep.equal([100, 150]);
  });

  it('pauses observation-unavailable distinctly from a mismatch timeout', async () => {
    const poller = new PostconditionPoller({
      query: async () => ({
        kind: 'unavailable',
        error: { category: 'authentication', message: 'EntityDefinition authentication unavailable' },
      }),
      now: () => 0,
    });
    const result = await poller.wait('org', condition(), { timeoutMs: 100, initialDelayMs: 10, maximumDelayMs: 20 });
    expect(result).to.deep.include({ kind: 'paused' });
    if (result.kind === 'paused')
      expect(result.postcondition).to.deep.include({
        status: 'observation-unavailable',
        observationError: { category: 'authentication', message: 'EntityDefinition authentication unavailable' },
      });
  });

  for (const options of [
    { timeoutMs: 0, initialDelayMs: 1, maximumDelayMs: 1 },
    { timeoutMs: 100, initialDelayMs: Number.NaN, maximumDelayMs: 10 },
    { timeoutMs: 100, initialDelayMs: 20, maximumDelayMs: 10 },
    { timeoutMs: 100, initialDelayMs: 10, maximumDelayMs: 101 },
  ]) {
    it(`rejects invalid polling options ${JSON.stringify(options)}`, async () => {
      let queried = false;
      const poller = new PostconditionPoller({
        query: async () => {
          queried = true;
          return { kind: 'observed', observation: {} };
        },
      });
      let error: Error | undefined;
      try {
        await poller.wait('org', condition(), options);
      } catch (caught) {
        error = caught as Error;
      }
      expect(error?.message).to.include('OWD barrier');
      expect(queried).to.equal(false);
    });
  }
});

function condition() {
  return {
    id: 'owd:Case:Private',
    kind: 'owd-internal-sharing-model' as const,
    objectName: 'Case',
    afterWaveNumber: 1,
    expectedInternalSharingModel: 'Private',
    expectedExternalSharingModel: 'Private',
  };
}
