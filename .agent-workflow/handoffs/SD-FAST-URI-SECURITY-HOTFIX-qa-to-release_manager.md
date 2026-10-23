# Handoff SD-FAST-URI-SECURITY-HOTFIX: qa to release_manager

## Task Context

- Title: Remediate fast-uri runtime advisories
- Goal: Restore release readiness by upgrading fast-uri to 3.1.7 and repairing deterministic Yarn/npm lock integrity exposed by clean installs
- Current owner: developer
- Current status: blocked

## Acceptance Criteria

- npm audit --omit=dev reports zero vulnerabilities
- Yarn frozen install and npm clean install preserve lockfiles
- Unit, build, NUT, clean-install and release checks pass before merge
- Hash comparison asserts package.json, yarn.lock and npm-shrinkwrap.json remain unchanged after a frozen Yarn install followed by npm ci --dry-run
- Release contract validates every Yarn entry has complete resolved and integrity metadata and required resolutions select exact versions

## Scope And Paths

- package.json
- yarn.lock
- npm-shrinkwrap.json

## Phase Handoff

- Status: ready_for_review
- Changed components: QA verified exact nine-line three-file patch and matching registry integrity.
- Behavior changed: Security advisories are remediated without unrelated dependency churn.
- Unit tests: All local and GitHub gates green, including required nuts and packed clean install.
- Commands run: gh pr checks 267; npm audit --omit=dev; node scripts/ci/release-contract.mjs
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
- code.md#CiPresetCommand: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-CI-PRESET - **Role:** developer ### Key decisions - Added `smart-deployment ci preset` as a validation-safe CI command that reuses existing deploy...
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
- code.md#RetrieveCommand: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-222-forceignore-stash - **Role:** developer ### Key decisions - Added a smart-deployment retrieve alias that wraps Salesforce CLI retrieve inp...
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
