Task id: GH-253
Phase: developer
Role: developer
Runtime: codex-cli
Session id: GH-253:wfrun-1790055860819-7c9781:developer:codex-cli

# Developer Handoff

## Status

- Result: approve for automatic QA review.
- Branch: `fix/gh-253-required-checks`
- Worktree: `/Users/jterrats/dev/smart-deployment-gh-253`
- Base: current `origin/main` at `e4efd7f`.
- No commit, push, pull request, or repository ruleset mutation was performed.

## Changed Components

- `.github/workflows/test.yml`: runs on pull requests to `main`, emits the required check context exactly as `nuts`, and runs the context drift check in PR CI.
- `.github/workflows/sonarqube.yml`: pins `Analyze` to `ubuntu-latest` and removes self-hosted/local runner selection paths.
- `scripts/ci/ruleset-context-drift.mjs`: pure deterministic ruleset/workflow context extraction, comparison, and actionable output.
- `scripts/ci/github-rulesets.mjs`: small GitHub API adapter for resolving an active named branch ruleset.
- `scripts/ci/check-required-contexts.mjs`: thin CLI supporting live GitHub input or local fixture files.
- `test/ci/*.test.mjs` and `test/fixtures/ci/*`: focused checker, adapter, CLI, PR trigger, exact context, and hosted Sonar contract coverage.
- `.generated-prompts/code.md`: prompt registry entry for the new checker boundary.

## Commands And Results

- `node --test test/ci/*.test.mjs`: pass, 7 tests.
- Live ruleset comparison with `GITHUB_REPOSITORY=jterratsdev/smart-deployment`: pass; required `nuts` matched PR workflow context.
- `actionlint .github/workflows/test.yml .github/workflows/sonarqube.yml`: pass.
- Focused `prettier --check`: pass.
- `git diff --check`: pass.
- `npm test`: pass.
- `npm run build`: pass when run sequentially. An initial parallel invocation with `npm test` hit a Wireit local-cache race; no source/build error remained.
- `npm run test:nuts`: pass, 41 tests.
- GitHub runner inspection: `CI_LINUX_RUNNER=github-hosted`; repository self-hosted runner count is zero.

## Test Scenarios and Expected Results

| Surface           | Scenario                         | Expected observable result                                                                            | Evidence                                        |
| ----------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| workflow/runtime  | Pull request targets `main`      | Tests workflow dispatches Linux unit tests and NUTs                                                   | Workflow contract test and `actionlint` passed  |
| workflow/runtime  | Main ruleset requires `nuts`     | PR workflow contains job context exactly `nuts`                                                       | Fixture and live ruleset comparisons passed     |
| workflow/runtime  | Sonar workflow dispatches        | `Analyze` selects `ubuntu-latest`, independent of unavailable self-hosted labels                      | Workflow contract test and `actionlint` passed  |
| CLI/local sandbox | Fixture ruleset matches workflow | CLI exits 0 without GitHub access                                                                     | Local CLI test passed                           |
| CLI/local sandbox | Required context is absent       | CLI exits nonzero and prints a GitHub `::error` annotation naming the missing context and remediation | Deterministic drift-output test passed          |
| integration       | Existing plugin behavior         | Build, unit suite, and NUT suite remain green                                                         | `npm run build`, `npm test`, and 41 NUTs passed |

## Acceptance Criteria Assessment

1. Pull request triggers Linux unit tests and status context `nuts`: satisfied by workflow contract and current `CI_LINUX_RUNNER=github-hosted` configuration.
2. Sonar Analyze starts on GitHub-hosted runner: satisfied statically; job is pinned to `ubuntu-latest` and local/self-hosted provider branches were removed.
3. Automated actionable drift check: satisfied by pure checker, fixture/local CLI support, GitHub adapter, seven tests, and PR CI integration.
4. Fixture PR satisfies protected-main checks without admin bypass: implementation-ready but not yet proven end-to-end because commit/push/PR creation was explicitly not authorized. QA must treat actual fixture-PR evidence as the remaining release gate.

## Architectural Concerns (inherited)

- Existing workflow files use expression-based runner selection tied to repository variables. For the touched required PR and Sonar paths, current configuration is dispatchable; broader runner-policy cleanup is outside GH-253.

## Architectural Concerns (self-imposed)

- Added three focused scripts instead of one combined script to keep pure comparison, network I/O, and CLI orchestration separately testable. Existing project code had no ruleset/workflow validation seam, and combining these concerns would make deterministic no-network tests harder.
- The dependency-free workflow parser intentionally supports the repository's conventional top-level `on` and `jobs` YAML shape rather than all YAML features. This avoids a new production dependency for a narrow CI contract; QA should flag future aliases, anchors, dynamic names, or unusual inline job maps if workflows adopt them.

## Consumed Context Files

- `.agent-workflow/runs/GH-253-wfrun-1790055860819-7c9781-developer-runtime-codex-cli-spawn-prompt.md`: applied assignment, ownership, return contract, and lifecycle requirements.
- `.agent-workflow/playbooks/developer.md`: applied minimal-change, evidence, handoff, and architectural-concern requirements.
- `AGENTS.md`: applied separation, small-module, side-effect isolation, testing, and git discipline rules.
- `rules/development/semantic-code.md`: applied intent-revealing names and focused pure behavior.
- `rules/development-engineering.mdc`: applied thin adapter and project-context-first guidance.
- `rules/dry-clean-code.mdc`: applied single source of truth and no duplicated context collections.
- `rules/module-boundaries.mdc`: applied pure domain, API adapter, and CLI boundaries.
- `rules/testing-discipline.mdc`: applied deterministic fixture/unit and contract tests.
- `.generated-prompts/code.md`: read and updated as required by prompt-registry guidance.
- All required rules were applicable; no required context file was omitted.

## Risks And Gaps

- No actual GitHub Actions run exists until the parent authorizes commit/push/PR creation.
- Ruleset reads require repository metadata access through `GITHUB_TOKEN`; GitHub Actions normally grants this under `contents: read`, and the live local API check succeeded.
- Ruleset comparison validates context existence among PR-triggered workflow jobs, not every conditional path that might skip a job. The required `nuts` job itself has no job-level condition.

## QA Recommendation

- Automatically proceed to QA.
- QA should rerun focused checks, inspect workflow/API permissions, and review the parser's bounded YAML assumptions.
- After parent authorization for git/GitHub writes, open a fixture PR and verify `Linux unit tests`, `nuts`, and `Analyze` dispatch, then confirm protected-main mergeability without administrator bypass.
