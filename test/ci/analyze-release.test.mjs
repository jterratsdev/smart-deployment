import assert from 'node:assert/strict';
import test from 'node:test';
import { analyzeRelease, readAnalyzerOptions } from '../../scripts/ci/analyze-release.mjs';

const analyzerOptions = await readAnalyzerOptions();

test('analyzer-only release analysis asserts the next type and version', async () => {
  assert.deepEqual(
    await analyzeRelease({
      commits: [
        { hash: '1', message: 'fix: repair release contract' },
        { hash: '2', message: 'feat: add packed-install verification' },
      ],
      lastVersion: '1.6.1',
      analyzerOptions,
    }),
    { type: 'minor', version: '1.7.0' }
  );
});

test('non-releasing commits keep the tagged version', async () => {
  assert.deepEqual(
    await analyzeRelease({
      commits: [{ hash: '1', message: 'ci: validate pull request' }],
      lastVersion: '1.6.1',
      analyzerOptions,
    }),
    { type: null, version: '1.6.1' }
  );
});

test('breaking feat headers produce a major release', async () => {
  for (const message of ['feat!: replace release contract', 'feat(api)!: replace release contract']) {
    assert.deepEqual(
      await analyzeRelease({ commits: [{ hash: '1', message }], lastVersion: '1.6.1', analyzerOptions }),
      { type: 'major', version: '2.0.0' }
    );
  }
});

test('BREAKING CHANGE footers produce a major release', async () => {
  assert.deepEqual(
    await analyzeRelease({
      commits: [{ hash: '1', message: 'feat: replace release contract\n\nBREAKING CHANGE: callers must migrate' }],
      lastVersion: '1.6.1',
      analyzerOptions,
    }),
    { type: 'major', version: '2.0.0' }
  );
});
