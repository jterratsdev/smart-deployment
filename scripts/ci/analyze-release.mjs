import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { analyzeCommits } from '@semantic-release/commit-analyzer';

const runGit = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const releaseRank = { major: 3, minor: 2, patch: 1 };
const parseVersion = (value) => {
  const match = value.match(/^v?(\d+)\.(\d+)\.(\d+)$/);
  return match?.slice(1).map(Number);
};

const incrementVersion = (version, releaseType) => {
  const [major, minor, patch] = parseVersion(version) ?? [];
  if (major === undefined) return null;
  if (releaseType === 'major') return `${major + 1}.0.0`;
  if (releaseType === 'minor') return `${major}.${minor + 1}.0`;
  if (releaseType === 'patch') return `${major}.${minor}.${patch + 1}`;
  return `${major}.${minor}.${patch}`;
};

export const expectedReleaseType = (commits, releaseRules) =>
  commits.reduce((highest, { message }) => {
    const type = message.match(/^([a-z]+)(?:\([^)]*\))?(!)?:/i)?.[1]?.toLowerCase();
    const isBreaking = /(?:^[a-z]+(?:\([^)]*\))?!:|^BREAKING (?:CHANGE|CHANGES):)/im.test(message);
    const matchedRule = releaseRules?.find(
      (rule) => (rule.breaking === true && isBreaking) || (rule.type && rule.type === type)
    );
    const release = isBreaking ? 'major' : matchedRule?.release;
    return release && release !== false && releaseRank[release] > (releaseRank[highest] ?? 0) ? release : highest;
  }, null);

export const analyzeRelease = async ({ commits, lastVersion, analyzerOptions }) => {
  const expectedType = expectedReleaseType(commits, analyzerOptions.releaseRules);
  const actualType = await analyzeCommits(analyzerOptions, { commits, logger: { log() {} } });
  assert.equal(actualType, expectedType, 'Commit analyzer result differs from configured release rules');
  const nextVersion = incrementVersion(lastVersion, actualType);
  assert(nextVersion, `Could not derive the next version from ${lastVersion} and ${actualType}`);
  return { type: actualType, version: nextVersion };
};

export const readAnalyzerOptions = async () => {
  const releaseConfig = JSON.parse(await readFile(new URL('../../.releaserc.json', import.meta.url), 'utf8'));
  const analyzerEntry = releaseConfig.plugins.find(
    (plugin) => (Array.isArray(plugin) ? plugin[0] : plugin) === '@semantic-release/commit-analyzer'
  );
  assert(Array.isArray(analyzerEntry), 'Release config must contain configured commit analyzer options');
  return analyzerEntry[1] ?? {};
};

const main = async () => {
  const latestTag = runGit('describe', '--tags', '--abbrev=0', '--match', 'v[0-9]*');
  const lastVersion = parseVersion(latestTag)?.join('.');
  assert(lastVersion, `Latest tag ${latestTag} is not a semantic version`);

  const records = runGit('log', '--format=%H%x00%B%x00', `${latestTag}..HEAD`);
  const fields = records ? records.split('\0') : [];
  const commits = [];
  for (let index = 0; index + 1 < fields.length; index += 2) {
    commits.push({ hash: fields[index].trim(), message: fields[index + 1].trim() });
  }

  const result = await analyzeRelease({ commits, lastVersion, analyzerOptions: await readAnalyzerOptions() });

  console.log(`Commit analysis executed for ${commits.length} commit(s) since ${latestTag}.`);
  console.log(`Expected next release: type=${result.type ?? 'none'} version=${result.version}.`);
  console.log('Analyzer-only execution loaded no npm or GitHub publication plugins or credentials.');
};

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
