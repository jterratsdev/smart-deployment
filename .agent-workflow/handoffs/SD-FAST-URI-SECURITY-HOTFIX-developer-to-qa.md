# Handoff SD-FAST-URI-SECURITY-HOTFIX: developer to qa

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
- Changed components: Pinned fast-uri 3.1.7 in package resolutions and exact Yarn/npm lock entries; no other product files changed.
- Behavior changed: Runtime dependency audit no longer reports GHSA-qw65-cvwx-89v3 or GHSA-58mr-gqgx-xq4g.
- Unit tests: Isolated Yarn/npm installs selected 3.1.7 with stable hashes; audit zero; build, 1682 unit tests, 41 NUTs, clean-install and PR checks passed.
- Commands run: npm audit --omit=dev; yarn build; yarn test:only; yarn test:nuts; yarn test:clean-install
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
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
- code.md#RetrieveCommand: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-222-forceignore-stash - **Role:** developer ### Key decisions - Added a smart-deployment retrieve alias that wraps Salesforce CLI retrieve inp...
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
