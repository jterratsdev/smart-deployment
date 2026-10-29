# GH-252 Developer Correction to QA Handoff

## Status

**READY FOR QA RE-REVIEW.** All three blockers from `GH-252-qa-release-handoff.md` were corrected in `/Users/jterrats/dev/smart-deployment-gh-252`. No commit, push, pull request, merge, tag, publish, release, or deploy action was performed.

## Corrections

1. Protected-main direct Git-write detection now tokenizes configuration strings without executing them, skips common benign `env` and `command` wrappers, normalizes executable paths, and skips Git global options before checking the subcommand. Regression fixtures reject `git -C . push`, `env git commit`, absolute Git paths, environment assignments, and Git global options while accepting read-only Git commands and quoted text.
2. Pull-request release analysis now directly invokes only `@semantic-release/commit-analyzer`. It reads commits after the latest reachable semantic-version tag, independently derives the expected release from configured rules, asserts analyzer output, and calculates the expected next version. Fixture tests prove `fix + feat` yields `minor / 1.7.0` from `1.6.1`, while CI-only commits yield no release. npm/GitHub plugins, remotes, tokens, and publishing lifecycle steps are not loaded.
3. `@semantic-release/git` was removed and `@semantic-release/commit-analyzer` made explicit. `npm-shrinkwrap.json` and `yarn.lock` were regenerated sequentially from `package.json`. CI uses invocation-scoped `npm_config_min_release_age=0`, required for Yarn 1 to resolve the pinned `ip-address@10.2.0` deterministically without changing user/global npm policy.
4. CI and release documentation now describe analyzer-only assertions, isolated packed installation, unsigned confirmation, and invocation-scoped npm policy.

## Files Changed

- `.github/workflows/test.yml`
- `docs/release-workflow.md`
- `package.json`
- `npm-shrinkwrap.json`
- `yarn.lock`
- `scripts/ci/analyze-release.mjs`
- `scripts/ci/clean-install-test.sh`
- `scripts/ci/release-contract.mjs`
- `scripts/ci/semantic-release-analysis.sh`
- `test/ci/analyze-release.test.mjs`
- `test/ci/release-contract.test.mjs`

## Verification Evidence

- `node --test test/ci/*.test.mjs`: 18/18 passed.
- `actionlint .github/workflows/test.yml`: passed.
- `shellcheck scripts/ci/clean-install-test.sh scripts/ci/semantic-release-analysis.sh`: passed.
- `bash -n scripts/ci/clean-install-test.sh scripts/ci/semantic-release-analysis.sh`: passed.
- `yarn build`: passed.
- `yarn test:only`: 1679 passing, 2 pending. The first run had one millisecond timing-order flake in an unrelated performance test; the focused retry and complete retry passed.
- `yarn test:nuts`: 41/41 passed.
- `yarn release:analyze`: passed; real worktree result was `type=none version=1.6.1` for zero commits after `v1.6.1`.
- `yarn test:clean-install`: passed; installed exact packed `@jterrats/smart-deployment@1.5.0` and discovered `validate` and `ci-publish`.
- Sequential lock proof: frozen Yarn install and `npm ci --dry-run --ignore-scripts --offline` both passed, with SHA-256 hashes unchanged before and after each command. No concurrent lock-mutating probes were run.
- `act pull_request -W .github/workflows/test.yml -j clean-install --bind --container-options '-v /Users/jterrats/dev:/Users/jterrats/dev' --container-architecture linux/amd64 --pull=false --var CI_LINUX_RUNNER=github-hosted -P ubuntu-latest=smart-deployment-gh252-act-yarn:qa`: passed lockfile lint, Linux build/unit, analyzer assertion, and packed clean-install jobs. The final run had no invalid `ip-address` lock warning.
- `git diff --check`: passed.

## Security And Publication Boundary

- Workflow permissions remain `contents: read`.
- Analyzer code imports only `@semantic-release/commit-analyzer`; it does not load semantic-release npm/GitHub publication plugins.
- Release analysis uses no remote and no npm/GitHub credentials.
- Packed-install isolation and global npm policy checks remain unchanged.
- No authorized or accidental Git publication operation was performed.

## QA Focus

- Re-run the wrapper/path/global-option bypass fixtures.
- Confirm analyzer evidence appears under pull-request CI and reports type/version.
- Confirm final lock hashes remain unchanged across frozen Yarn and npm dry-run consistency checks.
- Review the invocation-scoped lowercase `npm_config_min_release_age=0` usage on all workflow Yarn installs.

## Residual Notes

- `act` reports cache service socket warnings; these are local `act` cache limitations and did not fail jobs.
- Existing dependency peer/resolution warnings remain unrelated to GH-252.
