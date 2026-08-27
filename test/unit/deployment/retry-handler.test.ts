import { expect } from 'chai';
import { describe, it } from 'mocha';
import { RetryHandler } from '../../../src/deployment/retry-handler.js';

describe('RetryHandler', () => {
  it('succeeds after a transient failure and records the attempt', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelay: 0, maxDelay: 0 });
    let calls = 0;
    const attempts: Array<{ attempt: number; willRetry: boolean }> = [];

    const result = await handler.executeWithRetry(
      async () => {
        calls += 1;
        if (calls === 1) throw new Error('TIMEOUT');
        return 'ok';
      },
      'wave-1',
      ({ attempt, willRetry }) => {
        attempts.push({ attempt, willRetry });
      }
    );

    expect(result).to.equal('ok');
    expect(calls).to.equal(2);
    expect(attempts).to.deep.equal([{ attempt: 1, willRetry: true }]);
  });

  it('stops at the configured retry limit', async () => {
    const handler = new RetryHandler({ maxRetries: 2, initialDelay: 0, maxDelay: 0 });
    let calls = 0;

    try {
      await handler.executeWithRetry(async () => {
        calls += 1;
        throw new Error('TIMEOUT');
      }, 'wave-1');
      expect.fail('expected retry limit to throw');
    } catch (error) {
      expect(calls).to.equal(3);
      expect(error).to.be.instanceOf(Error);
      expect((error as Error).message).to.include('Max retries (2) exceeded');
    }
  });

  it('reports the final failed attempt as not scheduled for retry', async () => {
    const handler = new RetryHandler({ maxRetries: 0, initialDelay: 0, maxDelay: 0 });
    let attempt: { attempt: number; willRetry: boolean; error: Error } | undefined;

    try {
      await handler.executeWithRetry(
        async () => {
          throw new Error('TIMEOUT');
        },
        'wave-1',
        (details) => {
          attempt = details;
        }
      );
      expect.fail('expected final attempt to throw');
    } catch {
      expect(attempt?.attempt).to.equal(1);
      expect(attempt?.willRetry).to.equal(false);
      expect(attempt?.error.message).to.equal('TIMEOUT');
    }
  });

  it('does not retry permanent errors across multiple waves', async () => {
    const handler = new RetryHandler({ maxRetries: 3, initialDelay: 0, maxDelay: 0 });
    const calls = new Map<number, number>();

    for (const wave of [2, 3]) {
      try {
        await handler.executeWithRetry(async () => {
          calls.set(wave, (calls.get(wave) ?? 0) + 1);
          throw new Error(`Validation failed in wave ${wave}`);
        }, `wave-${wave}`);
      } catch (error) {
        expect(error).to.be.instanceOf(Error);
      }
    }

    expect(calls.get(2)).to.equal(1);
    expect(calls.get(3)).to.equal(1);
  });
});
