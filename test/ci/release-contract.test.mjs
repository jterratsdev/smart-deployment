import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canonicalRepository,
  validateReleaseContract,
  validateReleaseContractFiles,
  validateYarnLock,
} from '../../scripts/ci/release-contract.mjs';

const validPackage = {
  repository: { type: 'git', url: canonicalRepository },
  homepage: canonicalRepository,
  bugs: `${canonicalRepository}/issues`,
};

test('active package and semantic-release configuration satisfy the release contract', async () => {
  assert.deepEqual(await validateReleaseContractFiles(), []);
});

test('repository, homepage, and bugs must all identify the canonical repository', () => {
  const errors = validateReleaseContract({ ...validPackage, homepage: 'https://example.com' }, { plugins: [] });
  assert.deepEqual(errors, [`package.json homepage must be ${canonicalRepository}; received https://example.com`]);
});

test('semantic-release may not commit or push directly to protected main', () => {
  assert.deepEqual(validateReleaseContract(validPackage, { plugins: ['@semantic-release/git'] }), [
    '@semantic-release/git commits release artifacts directly to main',
  ]);
  assert.deepEqual(
    validateReleaseContract(validPackage, {
      plugins: [['@semantic-release/exec', { prepareCmd: 'git push origin main' }]],
    }),
    ['@semantic-release/exec config contains a direct git commit or push command']
  );
});

test('direct Git writes are detected through wrappers, assignments, paths, options, and groups', () => {
  const commands = [
    'git -C . push origin main',
    'env git commit -m x',
    'env CI=true /usr/bin/git push origin main',
    'command /opt/homebrew/bin/git --git-dir .git commit -m x',
    '/usr/bin/env -i HOME=/tmp git -c user.name=test push origin main',
    'exec git push origin main',
    'builtin git commit -m x',
    'CI=true git push origin main',
    '(git push origin main)',
    '{ git commit -m x; }',
    'printf ready && ( env CI=true command /usr/bin/git push origin main )',
    'git --config-env=http.extraHeader=HEADER push origin main',
    'sh -c "git push origin main"',
    "bash -c 'exec git commit -m x'",
    "eval 'git push origin main'",
  ];

  for (const prepareCmd of commands) {
    assert.deepEqual(validateReleaseContract(validPackage, { plugins: [['@semantic-release/exec', { prepareCmd }]] }), [
      '@semantic-release/exec config contains a direct git commit or push command',
    ]);
  }
});

test('benign commands containing Git words are not treated as direct writes', () => {
  const commands = [
    'git -C . status --short',
    'env CI=true git diff --check',
    '/usr/bin/git log --oneline',
    'printf "git push origin main"',
    "printf '%s\\n' 'git commit -m release'",
    'echo git push origin main',
    'node -e "console.log(\'git push origin main\')"',
    'node scripts/check-git-commit-message.mjs',
    '(git status --short)',
    '{ command git diff --check; }',
  ];

  for (const verifyCmd of commands) {
    assert.deepEqual(
      validateReleaseContract(validPackage, { plugins: [['@semantic-release/exec', { verifyCmd }]] }),
      []
    );
  }
});

const validLock = `# yarn lockfile v1

ip-address@10.2.0:
  version "10.2.0"
  resolved "https://registry.npmjs.org/ip-address/-/ip-address-10.2.0.tgz"
  integrity sha512-dmFsaWQ=
`;

test('Yarn lock validation accepts complete entries matching package resolutions', () => {
  assert.deepEqual(validateYarnLock({ resolutions: { '**/socks/**/ip-address': '10.2.0' } }, validLock), []);
});

test('Yarn lock validation rejects missing structural fields', () => {
  const cases = [
    ['resolved', validLock.replace(/^  resolved.*\n/m, '')],
    ['integrity', validLock.replace(/^  integrity.*\n/m, '')],
  ];
  for (const [field, lock] of cases) {
    assert.deepEqual(validateYarnLock({}, lock), [`yarn.lock entry ip-address@10.2.0 is missing ${field}`]);
  }
});

test('Yarn lock validation rejects malformed resolved and integrity fields', () => {
  const cases = [
    ['resolved', validLock.replace('https://registry.npmjs.org/ip-address/-/ip-address-10.2.0.tgz', 'not-a-url')],
    ['integrity', validLock.replace('sha512-dmFsaWQ=', 'invalid')],
  ];
  for (const [field, lock] of cases) {
    assert.deepEqual(validateYarnLock({}, lock), [`yarn.lock entry ip-address@10.2.0 has invalid ${field}`]);
  }
});

test('Yarn lock validation rejects required resolutions selecting another version', () => {
  const lock = validLock.replace('version "10.2.0"', 'version "10.5.0"');
  assert.deepEqual(validateYarnLock({ resolutions: { '**/socks/**/ip-address': '10.2.0' } }, lock), [
    'yarn.lock resolution **/socks/**/ip-address must select 10.2.0',
  ]);
});
