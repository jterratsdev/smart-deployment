# GH-253 Release Handoff

## Verdict

**RELEASE READY PENDING HUMAN REVIEW.** All technical acceptance criteria are satisfied on live PR #263 at head `4043c9bf2e5dcc7f35460bcdbed4b8d370377491`. GitHub reports the PR as mergeable but blocked with `REVIEW_REQUIRED`; the only remaining ruleset requirement is one independent approving human review. No GitHub review, merge, administrator bypass, or ruleset change was performed.

## Live Checks

- `validate-acceptance-criteria`: success.
- `Required check context drift`: success.
- `yarn-lockfile-check / lockfile-check`: success.
- `Linux unit tests`: success on GitHub-hosted `ubuntu-latest`.
- Exact required context `nuts`: success on GitHub-hosted `ubuntu-latest`.
- `Analyze`: started three seconds after run creation and succeeded on GitHub-hosted `ubuntu-latest`; it did not queue for self-hosted capacity.
- Windows manual/nightly jobs: skipped as intended for a normal pull request.
- QA handoff: approved after focused tests, changed-workflow actionlint, compile, lint, 1,679 unit tests, 41 NUTs, negative probes, and `git diff --check` passed.

## Branch Rules

- Active ruleset: `main` (`10698511`), targeting the default branch.
- Required status check: exact context `nuts`, GitHub Actions integration `15368`.
- Strict required-status policy: enabled.
- Pull request required with one approving review and resolved review threads.
- PR #263 is `MERGEABLE` with merge state `BLOCKED` and review decision `REVIEW_REQUIRED`.
- The successful `nuts` check is emitted by integration `15368`, so the status requirement is satisfied without bypass.

## Acceptance Criteria

- AC1: satisfied. A normal PR emitted successful `Linux unit tests` and exact lowercase `nuts`.
- AC2: satisfied. Sonar `Analyze` started on a GitHub-hosted `ubuntu-latest` runner within seconds.
- AC3: satisfied. `Required check context drift` ran and passed; QA verified actionable failure output with drift fixtures.
- AC4: technically satisfied. The live fixture PR satisfies the required protected-main status check without administrator bypass. It remains intentionally unmerged only because the required human review is absent.

## Merge Readiness

PR #263 is technically ready for the standard protected-branch merge path. Do not use the available organization-administrator bypass. Because strict status checks are enabled, re-confirm checks if `main` advances or the PR head changes; a push also dismisses stale reviews.

## Rollback

If a post-merge regression appears, revert merge commit through a new pull request and let the same protected-main checks and human review run. The revert should remove the committed required-check contract, validator, fixtures, documentation, and restore the prior `test.yml` and `sonarqube.yml` behavior together; do not mutate the ruleset as a rollback shortcut.

## Residual Risks

- The Sonar job succeeded and proved hosted-runner dispatch, but policy caused scan/test steps to be skipped after provider resolution. This does not violate GH-253, whose criterion is runner startup rather than a completed Sonar analysis.
- The ruleset grants organization administrators bypass capability. Operational discipline is still required not to use it.
- Any new commit or base-branch movement can invalidate this snapshot and require checks or review to be repeated.

## Next Exact Action

An eligible human other than the PR author must review and approve PR #263 at head `4043c9bf2e5dcc7f35460bcdbed4b8d370377491`. After GitHub reports the review requirement satisfied and all required checks remain green, merge through the normal protected-branch path without administrator bypass.

Task GH-253 remains `in_progress` until that review and merge occur.
