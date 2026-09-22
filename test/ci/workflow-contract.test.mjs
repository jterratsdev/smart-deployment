import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const workflow = (name) => new URL(`../../.github/workflows/${name}`, import.meta.url);

test('Tests workflow runs on pull requests and emits the exact nuts context', async () => {
  const source = await readFile(workflow('test.yml'), 'utf8');

  assert.match(source, /^on:\n  pull_request:\n    branches:\n      - main$/m);
  assert.match(source, /^  linux-nuts:\n    name: nuts$/m);
});

test('Sonar Analyze always dispatches on a GitHub-hosted runner', async () => {
  const source = await readFile(workflow('sonarqube.yml'), 'utf8');
  const analyzeJob = source.match(/  scan:\n    name: Analyze\n    runs-on: (.+)/);

  assert.equal(analyzeJob?.[1], 'ubuntu-latest');
});
