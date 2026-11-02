# Handoff SD-WAVE-SAFETY-CONTRACTS: developer to qa

## Task Context

- Title: Add fail-closed wave planning contracts
- Goal: Make deployment order an executable partial-order contract with fail-closed unknowns, explicit wave boundaries and hard-cycle blocking
- Current owner: architect
- Current status: pending

## Acceptance Criteria

- A focused test proves independent metadata types with different order stages are emitted in separate waves
- A focused test proves an unknown metadata type is rejected from executable wave planning
- A focused test proves hard cycles remain unplaced and never appear in an executable fallback wave
- Focused tests prove explicit isolated stages survive wave generation and cannot be merged
- Build, lint and all touched tests complete successfully
- Run a focused test that asserts independent metadata types from different stages produce separate waves
- Run a focused test that asserts unknown metadata types are rejected from executable planning
- Run a focused test that asserts hard cycles produce zero executable waves and remain in unplacedComponents
- Run focused merger tests that assert different-stage and dependency-connected waves are not merged
- Run yarn compile, yarn lint and yarn test:only with successful exit codes

## Scope And Paths

- src/constants/deployment-order.ts
- src/waves
- src/deployment
- src/types
- test/unit/constants
- test/unit/waves
- test/unit/deployment

## Phase Handoff

- Status: ready_for_review
- Changed components: Executable deployment stages, fail-closed unknowns/cycles, graph-aware merger, integrated validator and pre-mutation execution gates.
- Behavior changed: Known stages split into separate waves; malformed plans, backward dependencies, unknown types, partial plans and unsafe mixed cycle remediation are blocked.
- Unit tests: 1746 passing, 3 pending, focused assertions passing.
- Commands run: yarn compile; yarn lint; yarn test:only; git diff --check
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
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- code.md#CiPresetCommand: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-CI-PRESET - **Role:** developer ### Key decisions - Added `smart-deployment ci preset` as a validation-safe CI command that reuses existing deploy...
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
