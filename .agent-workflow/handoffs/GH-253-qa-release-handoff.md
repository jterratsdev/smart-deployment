# GH-253 QA to Release Handoff

## Verdict

**QA APPROVED.** The prior implementation blockers are resolved. Final live fixture PR evidence is still required before release approval.

## Prior Blocker Resolution

1. Normal CI no longer calls GitHub repository ruleset APIs. `.github/required-checks.json` is the deterministic committed contract for target branch `main` and exact required context `nuts`; the workflow uses only `contents: read` and does not depend on standard `GITHUB_TOKEN` ruleset permissions.
2. Remote ruleset verification is explicitly optional through `--verify-remote`. It requires `RULESET_READ_TOKEN` with repository Administration read permission and provides actionable guidance when the token is absent or unauthorized.
3. Workflow context extraction now requires a `pull_request` trigger applicable to `main` and excludes statically false jobs, jobs restricted to non-PR events, and reusable-workflow caller jobs whose emitted suffix cannot be certified by the bounded parser.
4. Regression fixtures cover develop-only workflows and `if: false` jobs. Both prior false-positive probes now return no contexts.
5. `.generated-prompts/code.md` is absent from the implementation diff and worktree status.

## Verified Contract

- `.github/required-checks.json` declares `targetBranch: main`, `rulesetName: main`, and required context `nuts`.
- `.github/workflows/test.yml` runs for pull requests targeting `main` and pushes to `main`.
- The required job context is exactly lowercase `nuts`.
- `Linux unit tests`, `nuts`, and `Required check context drift` are eligible on a normal PR targeting `main`; manual/nightly Windows jobs are excluded by their job conditions.
- `.github/workflows/sonarqube.yml` runs for pull requests targeting `main` and pushes to `main`; `Analyze` uses literal `ubuntu-latest`.
- `docs/required-checks.md` documents the committed contract, update process, privileged token requirements, and opt-in remote verification.
- CI fixtures and focused tests exercise success, drift, develop-only trigger filtering, `if: false`, non-PR conditions, adapter behavior, local CLI behavior, and missing-token diagnostics.

## QA Evidence

- `node --test test/ci/*.test.mjs`: PASS, 11/11.
- `node scripts/ci/check-required-contexts.mjs`: PASS; required `nuts` matched emitted contexts.
- Drift fixture CLI: expected exit 1 with actionable exact lowercase `nuts` annotation.
- `--verify-remote` without `RULESET_READ_TOKEN`: expected exit 1 with repository Administration read guidance.
- Mocked authorized `--verify-remote`: PASS; remote `nuts` matched the committed contract.
- `actionlint .github/workflows/test.yml .github/workflows/sonarqube.yml`: PASS.
- Full `actionlint`: only the previously documented unrelated findings in `.github/workflows/acceptance-criteria-validation.yml`.
- Fresh TypeScript compile: PASS.
- Fresh ESLint: PASS with 0 errors and 47 pre-existing warnings.
- Unit tests: PASS, 1,679 passing and 2 pending.
- NUTs: PASS, 41 passing.
- `git diff --check`: PASS.
- `.generated-prompts/code.md`: no diff and no worktree status entry.

## Acceptance Criteria Status

- AC1, PR triggers Linux unit tests and exact `nuts`: statically and deterministically satisfied; final live PR observation remains.
- AC2, Analyze starts on a GitHub-hosted runner: statically satisfied by literal `ubuntu-latest`; final live PR observation remains.
- AC3, automated actionable drift check: satisfied by the committed contract validator and negative probes without standard `GITHUB_TOKEN` ruleset access.
- AC4, fixture PR satisfies protected-main checks without bypass: not yet executed because QA was prohibited from git/GitHub writes; this is the required final live evidence.

## Fixture PR Authorization

The parent **may commit and push the intended GH-253 worktree and open the fixture PR for final live evidence**. This QA approval does not authorize merging, administrator bypass, ruleset mutation, or unrelated changes.

The parent must confirm on the live PR:

- exact required status context `nuts` is created and succeeds;
- `Linux unit tests` runs and succeeds;
- `Analyze` is dispatched on a GitHub-hosted `ubuntu-latest` runner rather than remaining queued for self-hosted capacity;
- the protected-main ruleset is satisfied without administrator bypass;
- the committed diff remains limited to the reviewed implementation and excludes `.generated-prompts/code.md`.

## Release Recommendation

Proceed to the release phase only for live fixture validation. Keep final release approval pending until the fixture PR evidence is attached. Do not merge the fixture PR or bypass branch protections as part of this evidence collection.
