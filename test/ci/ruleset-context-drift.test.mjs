import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

import { fetchRepositoryRuleset } from '../../scripts/ci/github-rulesets.mjs';
import {
  compareRequiredContexts,
  formatContextComparison,
  requiredContextsFromRuleset,
  workflowContextsFromYaml,
} from '../../scripts/ci/ruleset-context-drift.mjs';

const execute = promisify(execFile);
const fixture = (name) => new URL(`../fixtures/ci/${name}`, import.meta.url);

test('accepts a workflow job whose name exactly matches the required context', async () => {
  const ruleset = JSON.parse(await readFile(fixture('main-ruleset.json'), 'utf8'));
  const workflow = await readFile(fixture('matching-workflow.yml'), 'utf8');

  const result = compareRequiredContexts(requiredContextsFromRuleset(ruleset), workflowContextsFromYaml(workflow));

  assert.deepEqual(result.missing, []);
});

test('reports actionable output when a required context is missing', async () => {
  const ruleset = JSON.parse(await readFile(fixture('main-ruleset.json'), 'utf8'));
  const workflow = await readFile(fixture('drifted-workflow.yml'), 'utf8');

  const output = formatContextComparison(
    compareRequiredContexts(requiredContextsFromRuleset(ruleset), workflowContextsFromYaml(workflow))
  );

  assert.match(output, /Ruleset context "nuts" has no matching workflow job name/);
});

test('does not count jobs from workflows that do not run on pull requests', () => {
  const workflow = `on:\n  push:\n    branches: [main]\njobs:\n  integration:\n    name: nuts\n`;

  const contexts = workflowContextsFromYaml(workflow);

  assert.deepEqual(contexts, []);
});

test('does not count jobs from pull request workflows restricted to develop', async () => {
  const workflow = await readFile(fixture('develop-only-workflow.yml'), 'utf8');

  assert.deepEqual(workflowContextsFromYaml(workflow), []);
});

test('does not count jobs with a statically false condition', async () => {
  const workflow = await readFile(fixture('false-job-workflow.yml'), 'utf8');

  assert.deepEqual(workflowContextsFromYaml(workflow), []);
});

test('does not count jobs restricted to non-PR events', () => {
  const workflow = `on:\n  pull_request:\n    branches: [main]\njobs:\n  nightly:\n    if: \${{ github.event_name == 'schedule' || github.event_name == 'workflow_dispatch' }}\n    name: nuts\n`;

  assert.deepEqual(workflowContextsFromYaml(workflow), []);
});

test('GitHub adapter resolves the named active branch ruleset', async () => {
  const requests = [];
  const fetchImpl = async (url) => {
    requests.push(url);
    return {
      ok: true,
      json: async () =>
        url.endsWith('/rulesets')
          ? [{ id: 42, name: 'main', target: 'branch', enforcement: 'active' }]
          : { id: 42, rules: [] },
    };
  };

  const ruleset = await fetchRepositoryRuleset({
    repository: 'example/project',
    rulesetName: 'main',
    token: 'fixture-token',
    fetchImpl,
  });

  assert.deepEqual(
    { ruleset, requests },
    {
      ruleset: { id: 42, rules: [] },
      requests: [
        'https://api.github.com/repos/example/project/rulesets',
        'https://api.github.com/repos/example/project/rulesets/42',
      ],
    }
  );
});

test('CLI accepts local fixture inputs without calling GitHub', async () => {
  const { stdout } = await execute(
    process.execPath,
    [
      'scripts/ci/check-required-contexts.mjs',
      '--contract-file',
      fileURLToPath(new URL('../../.github/required-checks.json', import.meta.url)),
      '--ruleset-file',
      fileURLToPath(fixture('main-ruleset.json')),
      '--workflow',
      fileURLToPath(fixture('matching-workflow.yml')),
    ],
    { cwd: fileURLToPath(new URL('../..', import.meta.url)) }
  );

  assert.match(stdout, /Required check contexts match workflow job contexts/);
});

test('remote verification explains how to provide an authorized token', async () => {
  await assert.rejects(
    execute(
      process.execPath,
      [
        'scripts/ci/check-required-contexts.mjs',
        '--contract-file',
        fileURLToPath(new URL('../../.github/required-checks.json', import.meta.url)),
        '--workflow',
        fileURLToPath(fixture('matching-workflow.yml')),
        '--verify-remote',
      ],
      {
        cwd: fileURLToPath(new URL('../..', import.meta.url)),
        env: { ...process.env, GITHUB_REPOSITORY: 'example/project', RULESET_READ_TOKEN: '' },
      }
    ),
    /Administration read permission/
  );
});
