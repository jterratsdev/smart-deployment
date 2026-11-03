#!/usr/bin/env node
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { fetchRepositoryRuleset } from './github-rulesets.mjs';
import {
  compareRequiredContexts,
  formatContextComparison,
  requiredContextsFromRuleset,
  workflowContextsFromYaml,
} from './ruleset-context-drift.mjs';

export async function main(argv, environment = process.env) {
  const options = parseOptions(argv, environment);
  const contract = JSON.parse(await readFile(options.contractFile, 'utf8'));
  const requiredContexts = options.rulesetFile
    ? requiredContextsFromRuleset(JSON.parse(await readFile(options.rulesetFile, 'utf8')))
    : contract.requiredContexts;
  const workflowFiles = await resolveWorkflowFiles(options);
  const workflowContexts = (
    await Promise.all(
      workflowFiles.map(async (file) => workflowContextsFromYaml(await readFile(file, 'utf8'), contract.targetBranch))
    )
  ).flat();
  const result = compareRequiredContexts(requiredContexts, workflowContexts);

  console.log(formatContextComparison(result));
  if (result.missing.length > 0) return 1;
  if (options.verifyRemote) return verifyRemoteContract(contract, environment);
  return 0;
}

function parseOptions(argv, environment) {
  const options = {
    contractFile: '.github/required-checks.json',
    workflowDir: '.github/workflows',
    workflowFiles: [],
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--verify-remote') {
      options.verifyRemote = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) throw new Error(`Missing value for ${argument}.`);

    if (argument === '--contract-file') options.contractFile = value;
    else if (argument === '--ruleset-file') options.rulesetFile = value;
    else if (argument === '--workflow-dir') options.workflowDir = value;
    else if (argument === '--workflow') options.workflowFiles.push(value);
    else throw new Error(`Unknown option: ${argument}.`);
    index += 1;
  }

  if (options.verifyRemote && !environment.GITHUB_REPOSITORY) {
    throw new Error('GITHUB_REPOSITORY is required with --verify-remote.');
  }
  return options;
}

async function verifyRemoteContract(contract, environment) {
  if (!environment.RULESET_READ_TOKEN) {
    throw new Error(
      'Remote ruleset verification is unavailable: set RULESET_READ_TOKEN to a fine-grained PAT or GitHub App token with repository Administration read permission.'
    );
  }

  const ruleset = await fetchRepositoryRuleset({
    repository: environment.GITHUB_REPOSITORY,
    rulesetName: contract.rulesetName,
    token: environment.RULESET_READ_TOKEN,
  });
  const remote = requiredContextsFromRuleset(ruleset);
  const expected = [...new Set(contract.requiredContexts)].sort();
  const matches = remote.length === expected.length && remote.every((context, index) => context === expected[index]);
  if (!matches) {
    console.error(
      `Remote ruleset contexts (${remote.join(', ') || 'none'}) do not match the contract (${
        expected.join(', ') || 'none'
      }).`
    );
    return 1;
  }
  console.log('Remote ruleset contexts match the committed contract.');
  return 0;
}

async function resolveWorkflowFiles(options) {
  if (options.workflowFiles.length > 0) return options.workflowFiles;
  const entries = await readdir(options.workflowDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/.test(entry.name))
    .map((entry) => path.join(options.workflowDir, entry.name))
    .sort();
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2))
    .then((exitCode) => {
      process.exitCode = exitCode;
    })
    .catch((error) => {
      console.error(`Required check context validation failed: ${error.message}`);
      process.exitCode = 1;
    });
}
