# GH-252 Developer Correction To QA Handoff

## Status

**READY FOR INDEPENDENT QA.** Both blockers in the replacement QA handoff are corrected. This handoff does not authorize commit, push, PR creation, merge, tag, publish, release, or deploy.

## Corrections

- `.github/workflows/test.yml` keeps dependency-free release-contract tests in `required-check-contexts` and moves `test/ci/analyze-release.test.mjs` after the existing locked dependency install in `linux-unit-tests`. `linux-unit-tests` still depends on both required-context and lockfile checks, so no release protection was removed and no extra install job was added.
- `.releaserc.json` configures `breakingHeaderPattern` for Conventional Commits bang headers. `feat!:`, `feat(scope)!:`, and `BREAKING CHANGE:` footers now produce a major release through `@semantic-release/commit-analyzer`.
- `scripts/ci/analyze-release.mjs` exposes the production analyzer options loader so tests and CLI analysis use the same semantic-release configuration.
- `test/ci/analyze-release.test.mjs` now covers normal feat/fix/no-release behavior plus bang, scoped-bang, and footer breaking forms.

## Verification

- Focused: 9 release-contract tests and 4 analyzer tests passed; `npm run release:contracts` passed.
- Static: `actionlint .github/workflows/test.yml`, `shellcheck`, `bash -n`, and `git diff --check` passed.
- Release analysis: current history reports `type=none version=1.6.1`. Synthetic Git histories report none `1.6.1`, fix `1.6.2`, feat `1.7.0`, `feat!` `2.0.0`, and `BREAKING CHANGE:` `2.0.0`.
- Install and locks: frozen offline Yarn install and offline npm dry-run passed. Hashes remained `package.json dc1b0fab811df90cb0635d8d8952d0aad2bcd66b800a462c89764a1be0c7fe99`, `yarn.lock b86e9da1b6e563984ab935aba0c545c75f82216e98d03459ba050bcc91d217f7`, and `npm-shrinkwrap.json 51dc02923af9506248f82e6abb1600339903e7cbf6ec0d776b1483cdd5399144`.
- Regression: `yarn build`, `yarn test`, `yarn test:only`, 41 NUTs, and `yarn test:clean-install` passed.
- Clean-checkout integration: `act pull_request -W .github/workflows/test.yml -j clean-install --bind --container-options '-v /Users/jterrats/dev:/Users/jterrats/dev' --container-architecture linux/amd64 --pull=false --var CI_LINUX_RUNNER=github-hosted -P ubuntu-latest=gh252-act-yarn:qa` passed the required-context, reusable lockfile, Linux unit/analyzer, and packed clean-install jobs. The image derives from public `catthehacker/ubuntu:act-latest` and supplies Yarn 1.22.21. Non-fatal `act` cache socket warnings persisted.
- Host policy remained `min-release-age=3`; `/Users/jterrats/.npmrc` retained SHA-256 `d0079905f5d79fc7db7f9383839ad4896e72dbc4366cb5c4a26354655b0279f7`.

## QA Focus

- Confirm `required-check-contexts` remains dependency-free and `linux-unit-tests` is blocked by both release-contract and lockfile gates.
- Re-run analyzer cases from the checked-in `.releaserc.json`, especially `feat!:`, `feat(scope)!:`, and footer breaking changes.
- Confirm the analyzer-only path loads no publication plugins or credentials and performs no Git, npm, or GitHub writes.
- Replace `.agent-workflow/handoffs/GH-252-qa-release-handoff.md` only after independent review.

## Orchestra Records

- Command evidence: `.agent-workflow/evidence/GH-252-FINAL-QA-1790125778675-b0fa9b3e-f503-45ed-a191-56dbeaf24d53-command.md`
- File evidence: `.agent-workflow/evidence/GH-252-FINAL-QA-1790125778675-06b8fa55-7bec-4060-b3dc-0c509ea22bae-file.md`
- Developer review: `.agent-workflow/reviews/GH-252-FINAL-QA-developer-review.md`
