# Handoff SD-MATCH-DUP-RULES: developer to qa

## Task Context

- Title: Support MatchingRules and DuplicateRule deployment sequencing
- Goal: Discover and parse MatchingRules and DuplicateRule metadata, emit typed object/field/matching-rule dependencies, sequence waves with resumable readiness approval, and render safe manifests/destructive behavior
- Current owner: developer
- Current status: pending

## Acceptance Criteria

- Run parser/scanner tests that produce canonical MatchingRules and DuplicateRule nodes with typed object, field and matching-rule dependencies
- Run wave tests that assert CustomObject and CustomField precede MatchingRules and DuplicateRule follows MatchingRules
- Run execution tests that assert active matching rules with dependent duplicate rules pause at a resumable readiness checkpoint before DuplicateRule deployment
- Run manifest tests for exact MatchingRules and DuplicateRule transport identities and destructive guards
- Run yarn compile, yarn lint and yarn test:only successfully

## Scope And Paths

- src/parsers
- src/services/scanners
- src/types
- src/constants
- src/deployment
- src/analysis
- test/unit

## Phase Handoff

- Status: ready_for_review
- Changed components: Added MatchingRules/DuplicateRule parsers and scanner, CustomField nodes, lifecycle-aware graph ordering, resumable readiness checkpoints, manifest and destructive safety.
- Behavior changed: Activation: schema then MatchingRules, approval, DuplicateRule. Deactivation reverses rule order. Target-only dependencies do not strand waves.
- Unit tests: 1777 passing, 3 pending; build/lint pass.
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
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- code.md#CommitScopedDeploymentCommands: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** PLUGIN-COMMIT-SCOPED-DEPLOYMENTS - **Role:** developer ### Key decisions - Added --scope-commits and --scope-manifest flags to start, validate, ci preset...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
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
