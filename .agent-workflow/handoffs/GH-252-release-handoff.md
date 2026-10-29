# GH-252 Release Handoff

## Verdict

**APPROVE / MERGE READY** for PR #265 at head `c36d7a32bd72dda16ac69ca808a3388d29236200` into `main` at `6afbadd09b54443b54fde9c0c1bb17829703491a`. GitHub reports the PR mergeable with potential merge commit `a002e0e734918c317d7f4a162d95f36e3dd32833`. All applicable checks are successful; the only merge block is the ruleset's required independent approval.

## Acceptance Criteria

- PASS: Canonical repository, homepage, and issue URL are checked before release, with a failing mismatch fixture.
- PASS: `@semantic-release/git` and executable direct `git commit`/`git push` forms are rejected, including wrappers, paths, assignments, options, subshells, groups, `sh -c`, and `eval`.
- PASS: The packed local tarball installs into isolated HOME, XDG, npm, and Salesforce CLI paths as exact `@jterrats/smart-deployment@1.5.0`; `validate` and `ci-publish` help are discovered.
- PASS: Documentation explains one-invocation unsigned-plugin consent and invocation-scoped `npm_config_min_release_age=0` without changing global npm policy.

## Release Safety

- Live checks on the PR merge commit are green: acceptance criteria, Sonar, required-context drift, lockfile lint, Linux build/unit, packed clean install, NUTs, and required `nuts` context. Windows-only manual/nightly jobs are intentionally skipped for pull requests.
- Definitive QA approves after corrections: focused release tests, adversarial Git-write cases, analyzer histories, actionlint, shellcheck, build, 1,679 unit tests with 2 pending, 41 NUTs, isolated install, lock stability, `act` clean-checkout path, and production audit passed.
- PR analysis imports and invokes only `@semantic-release/commit-analyzer`; it does not invoke semantic-release publication lifecycle, npm/GitHub plugins, publication credentials, or a write-capable token. The live job had `contents: read` and reported `patch / 1.6.2`.
- `git diff --check` passes. The exact PR diff is 12 files, 5,242 additions, and 4,943 deletions; no `.agent-workflow` files are in the PR.

## Lockfile Risk

- `yarn.lock` and `npm-shrinkwrap.json` were regenerated and account for most of the diff. They remove `@semantic-release/git`, add the explicit commit analyzer dependency, repair the exact `ip-address@10.2.0` resolution, and refresh many transitive versions allowed by existing ranges.
- Structural validation covers all Yarn entries and required resolutions. Live frozen Yarn install and lockfile-lint pass without the former incorrect-entry warning; sequential local checks preserved lock hashes; npm dry-run and `npm audit --omit=dev` reported no production vulnerabilities.
- Residual risk is broader transitive dependency drift than the direct package change, including some newer engine constraints in development-only paths. Full build/unit/NUT and clean-install coverage makes this acceptable but not zero risk.

## Admin Merge

Ruleset `main` requires one approving review and successful `nuts`, allows organization-admin bypass, and reports `current_user_can_bypass: always`. The author cannot supply the required independent GitHub approval. Under the standing instruction to use governed admin merge only after checks pass, admin merge is technically warranted now. This handoff does not approve the GitHub PR as another identity and performs no merge, tag, publish, release, or deploy.

## Rollback

If post-merge validation regresses, revert the PR merge commit on `main`. This restores both lockfiles, removes the release/clean-install contracts and analyzer scripts, restores the prior workflow, and restores `@semantic-release/git`. Do not publish from the reverted or failing state; rerun required checks on the revert PR.

## Residual Risks

- Broad transitive lock refresh increases review and supply-chain surface despite successful validation.
- Clean install pins Salesforce CLI `2.150.6`; future CLI behavior remains outside this merge's proof.
- Existing peer/resolution warnings remain, but the invalid `ip-address` lock warning is gone.
- The legacy QA-to-release handoff still records pre-correction blockers; the current QA review and live head checks supersede it.

## Next Action

The authorized maintainer may admin-merge PR #265 at the reviewed head SHA, then monitor post-merge Tests and release analysis. Do not tag, publish, or deploy as part of this merge action.
