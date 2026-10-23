# Handoff SD-CGCLOUD-RETAIL-SETTINGS: developer to qa

## Task Context

- Title: Support CGCloud RetailExecutionSettings metadata
- Goal: Implement documentation-backed discovery, capability reporting and early settings-stage ordering for RetailExecutionSettings without conflating CGCloud package data
- Current owner: developer
- Current status: pending

## Acceptance Criteria

- Run a scanner test that discovers only settings/RetailExecution.settings-meta.xml as RetailExecutionSettings:RetailExecution
- Run a capability registry test that resolves RetailExecutionSettings with minimum API 47.0, C6 ownership and partial lifecycle evidence
- Run a wave test that places RetailExecutionSettings before independent CustomObject and Apex components
- Run negative tests that do not classify StockRotationSettings, Modeler, Mobile Sync or cgcloud records as executable metadata
- Run yarn compile, yarn lint and yarn test:only successfully

## Scope And Paths

- src/services/scanners
- src/types/metadata.ts
- src/analysis/metadata-capability-definitions.ts
- src/constants/deployment-order.ts
- test/unit/services
- test/unit/analysis
- test/unit/constants

## Phase Handoff

- Status: ready_for_review
- Changed components: Added exact RetailExecutionSettings discovery/parsing, capability registration, isolated stage 0, Settings manifest mapping, gap normalization and destructive guard.
- Behavior changed: Retail settings deploy before existing stages; malformed/unsupported sources fail closed; Modeler/Mobile Sync/StockRotation remain unsupported.
- Unit tests: 1755 passing, 3 pending; build and lint pass.
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
- services.md#MetadataGapAnalysisService: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added a deterministic scanner that compares package manifests and source-path ...
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#PlanExplainService: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-PLAN-EXPLAIN - **Role:** developer ### Key decisions - Reused `DeploymentContextService` and `SpecialDeploymentPlanService` instead of changing wa...
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
