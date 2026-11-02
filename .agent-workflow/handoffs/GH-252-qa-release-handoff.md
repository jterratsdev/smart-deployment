# GH-252 QA to Release Handoff

## Decision

**BLOCKED.** Independent correction review found two unresolved defects. The parent may not commit, push, or open a pull request from `/Users/jterrats/dev/smart-deployment-gh-252`. No merge, tag, publish, release, or deploy is authorized.

## Blocking Findings

1. `scripts/ci/release-contract.mjs:13-55` still permits executable direct Git writes through shell builtins and grouping syntax. Independent probes accepted `exec git push origin main`, `builtin git commit -m x`, `(git push origin main)`, and `{ git push origin main; }`. These are executable command forms, so the protected-main contract remains bypassable even though the submitted wrapper/path/global-option fixtures now pass. The parser should either fail closed for unrecognized shell syntax/wrappers or use a shell-aware tokenizer, with regression coverage for these forms.
2. `yarn.lock:6303-6305` remains malformed: selector `ip-address@10.2.0` records `version "10.5.0"` and has no `resolved` or `integrity` fields. Both local frozen install and the `act pull_request` Linux jobs warn `Lockfile has incorrect entry for "ip-address@10.2.0". Ignoring it.` Hashes remain stable, but Yarn is resolving around an invalid lock entry, so the lock consistency requirement is not satisfied and the correction handoff's claim that this warning was eliminated is inaccurate.

## Corrected Blocker Results

- PASS: Submitted direct-write fixtures reject `git -C`, `env`, `command`, absolute Git paths, assignments, `--unset`, and Git global options. Benign status/diff/log/printf/node commands remain accepted.
- BLOCK: Additional executable shell forms bypass detection as described above.
- PASS: PR-context analysis directly executes `@semantic-release/commit-analyzer`; it does not invoke semantic-release or load npm/GitHub publication plugins.
- PASS: Current worktree after `v1.6.1` deterministically reports `type=none version=1.6.1` for zero commits.
- PASS: Synthetic `fix + feat` history under PR environment variables reports `type=minor version=1.7.0`; patch and breaking histories report `1.6.2` and `2.0.0`; repeated CI-only history reports identical `type=none version=1.6.1` output.
- PASS: Synthetic analysis with sentinel `GITHUB_TOKEN` and `NPM_TOKEN` left a temporary bare remote's refs hash unchanged. Analyzer source imports only `@semantic-release/commit-analyzer` and uses no network or publication lifecycle.
- PASS: Sequential frozen Yarn and offline npm dry-run checks preserved SHA-256 hashes exactly: `package.json` `dc1b0fab811df90cb0635d8d8952d0aad2bcd66b800a462c89764a1be0c7fe99`, `npm-shrinkwrap.json` `51dc02923af9506248f82e6abb1600339903e7cbf6ec0d776b1483cdd5399144`, and `yarn.lock` `16929b41d9bc69263966a66f04805ca2fbb680a9ee64c23e413ecd3b32d5869c` before, between, and after checks.
- BLOCK: Stable hashes do not cure the malformed Yarn record; local and container installs ignore it.

## Clean Install And Security

- PASS: `yarn test:clean-install` installed the generated absolute local tarball as exact `@jterrats/smart-deployment@1.5.0` into isolated Salesforce CLI `2.150.6` and discovered `validate` and `ci-publish` help.
- PASS: `HOME`, XDG paths, npm cache/user config, and Salesforce CLI cache/config/plugin data are temporary. The real npm `min-release-age` remained `3`; the real npmrc hash and unsigned allowlist state were unchanged.
- PASS: Unsigned consent is supplied only to the tarball install. No `--force`, org authentication, npm/GitHub release credentials, external Git write, registry install of the plugin under test, or global policy mutation occurs.
- PASS: Workflow permissions remain `contents: read`; analyzer and clean-install jobs reference no publication secrets.

## CI, Docs, And Resource Behavior

- PASS: Documentation accurately explains analyzer-only PR assertions, local tarball installation, exact version/command checks, one-invocation unsigned consent, and invocation-scoped `npm_config_min_release_age=0` without weakening global npm policy.
- PASS with cost note: `clean-install` is a separate hosted Ubuntu job, depends on Linux unit tests, and has a 20-minute timeout. It repeats dependency installation plus 704-package Salesforce CLI and 295-package plugin installations for every workflow event, including push, schedule, and dispatch.
- PASS: `act pull_request -j clean-install` completed reusable lockfile-lint, Linux build/unit, PR analyzer output, and packed clean-install. Local `act` cache socket warnings were non-fatal. The invalid `ip-address` lock warning appeared in both Linux installs.

## Independent Commands

- `node --test test/ci/*.test.mjs`: 18/18 passed.
- `actionlint .github/workflows/test.yml`: passed.
- `shellcheck scripts/ci/clean-install-test.sh scripts/ci/semantic-release-analysis.sh`: passed.
- `bash -n scripts/ci/clean-install-test.sh scripts/ci/semantic-release-analysis.sh`: passed.
- `npm run release:contracts`: passed the submitted configuration but failed independent adversarial expectations for four executable direct-write forms.
- `yarn release:analyze`: `0` commits, `type=none version=1.6.1`.
- `yarn build`: passed.
- `yarn test:only`: 1679 passing, 2 pending.
- `yarn test:nuts`: 41/41 passed.
- `yarn test:clean-install`: passed exact tarball/version, command discovery, and host-policy immutability assertions.
- `npm_config_min_release_age=0 yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000`: exited successfully with invalid lock-entry warning; hashes unchanged.
- `npm ci --dry-run --ignore-scripts --offline`: passed; hashes unchanged.
- `act pull_request -W .github/workflows/test.yml -j clean-install --bind --container-options '-v /Users/jterrats/dev:/Users/jterrats/dev' --container-architecture linux/amd64 --pull=false --var CI_LINUX_RUNNER=github-hosted -P ubuntu-latest=smart-deployment-gh252-act-yarn:qa`: passed jobs with the invalid lock-entry warning.
- `git diff --check`: passed.

## Required Rework

1. Reject executable Git writes through `exec`, `builtin`, subshell/group syntax, and equivalent shell forms, or replace the heuristic with a fail-closed contract that cannot be bypassed by command syntax. Add regression tests.
2. Regenerate or correct `yarn.lock` so `ip-address@10.2.0` resolves to the exact valid package with registry URL and integrity metadata, then rerun sequential frozen/dry-run checks and prove the warning is absent locally and in `act`.
3. Rerun focused tests, static checks, analyzer histories, clean-install, build/unit/NUT, and the `act` PR path.

## Parent Authorization

- Commit: **NO**
- Push: **NO**
- Open PR: **NO**
- Merge/tag/publish/release/deploy: **NO**
