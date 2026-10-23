# Handoff GH-252-CORRECTION: qa to release_manager

## Task Context

- Title: Correct release contracts after QA
- Goal: not specified
- Current owner: developer
- Current status: pending

## Acceptance Criteria

- Git-write detection safely tokenizes static shell strings and detects commit or push through exec, builtin, command, env, assignments, absolute paths, parentheses, and brace groups without false positives for status, log, diff, or prose.
- yarn.lock is cleanly regenerated with Node 24 and Yarn 1; ip-address@10.2.0 resolves exactly to 10.2.0 with valid resolved and integrity fields; npm-shrinkwrap remains consistent.
- Release-contract CI deterministically validates every versioned Yarn entry has version, resolved, and integrity and that package.json resolutions select the required versions.
- All QA probes, focused tests, actionlint, shellcheck, build, unit tests, NUTs, analyzer, clean install, and warranted act checks pass with lock hashes preserved across sequential checks.

## Scope And Paths

- scripts/ci
- test/ci
- .github/workflows/test.yml
- package.json
- yarn.lock
- npm-shrinkwrap.json

## Phase Handoff

- Status: ready_for_review
- Changed components: QA validated both correction classes and lock-preserving packaging; no release operation requested or performed.
- Behavior changed: Protected-main writes are conservatively detected and Yarn lock corruption is a deterministic release-contract failure.
- Unit tests: All focused/full/static/install lanes pass; act deferred solely for inaccessible private runner image.
- Commands run: node --test test/ci/\*.test.mjs; npm run release:contracts; yarn build; yarn test; yarn test:nuts; yarn test:clean-install; actionlint; shellcheck
- Known gaps: none
- Risks: none
- Recommended Playwright coverage: not applicable
- Executor provenance: not recorded

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 0
- none
- Lessons applied: none available
- Prompt registry entries consulted: 3
- services.md#InitConfigGenerationService: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-INIT-WIZARD - **Role:** developer ### Key decisions - Centralized config generation in a service that detects `sfdx-project.json`, derives relativ...
- code.md#CiPresetCommand: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-CI-PRESET - **Role:** developer ### Key decisions - Added `smart-deployment ci preset` as a validation-safe CI command that reuses existing deploy...
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- Prompt registry entries updated: verify via PROMPT_REGISTRY_UPDATED events or accepted rationale before release.

## Transition Guard

- State transition: not recorded
- Required fields: none
- Contract result: not evaluated

## Flow-specific required context

- test plan
- test results
- known gaps
- release plan
