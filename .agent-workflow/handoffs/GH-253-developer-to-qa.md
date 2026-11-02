# Handoff GH-253: developer to qa

## Task Context

- Title: Align required PR checks runners and branch rules
- Goal: Make normal pull requests emit every main-ruleset check without admin bypass and prevent workflow/ruleset drift
- Current owner: developer
- Current status: blocked

## Acceptance Criteria

- A pull request triggers Linux unit tests and a status context named nuts
- The SonarQube Analyze job starts on a GitHub-hosted runner instead of remaining queued for a self-hosted runner
- An automated check compares required main-ruleset contexts with workflow job contexts and fails with actionable drift output
- A fixture pull request can satisfy the protected-main checks without administrator bypass

## Scope And Paths

- .github/workflows
- scripts
- test

## Phase Handoff

- Status: ready_for_review
- Changed components: Added .github/required-checks.json initialized to nuts, documented update/privileged verification, changed PR CI to deterministic local contract validation, added explicit --verify-remote using RULESET_READ_TOKEN, tightened main-PR job extraction, and added develop-only/if:false regressions. Removed generated prompt scope diff.
- Behavior changed: Standard GITHUB_TOKEN is no longer used for rulesets. CI deterministically fails when required contract contexts cannot be emitted for main PRs. Local/admin remote verification is opt-in and actionably errors when authorization is unavailable.
- Unit tests: 11/11 focused CI tests pass; changed workflows actionlint-clean; contract check passes; build and unit pass; NUT 41 passing; drift and missing-token negative probes fail as expected; git diff --check passes.
- Commands run: node --test test/ci/\*.test.mjs; node scripts/ci/check-required-contexts.mjs; actionlint .github/workflows/test.yml .github/workflows/sonarqube.yml; yarn build; yarn test:only; yarn test:nuts; git diff --check
- Known gaps: none
- Risks: none
- Recommended Playwright coverage: not applicable
- Executor provenance: not recorded

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 0
- none
- Lessons applied: none available
- Prompt registry entries consulted: 4
- code.md#CiPresetCommand: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-CI-PRESET - **Role:** developer ### Key decisions - Added `smart-deployment ci preset` as a validation-safe CI command that reuses existing deploy...
- code.md#RetrieveCommand: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-222-forceignore-stash - **Role:** developer ### Key decisions - Added a smart-deployment retrieve alias that wraps Salesforce CLI retrieve inp...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#MetadataGapAnalysisService: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added a deterministic scanner that compares package manifests and source-path ...
- Prompt registry entries updated: verify via PROMPT_REGISTRY_UPDATED events or accepted rationale before release.

## Transition Guard

- State transition: not recorded
- Required fields: none
- Contract result: not evaluated

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
