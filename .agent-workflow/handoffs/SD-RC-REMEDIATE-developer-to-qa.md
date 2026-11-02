# Handoff SD-RC-REMEDIATE: developer to qa

## Task Context

- Title: Remediate release candidate blockers
- Goal: Resolve runtime audit findings, establish one 1.6.0-compatible release authority, correct repository metadata, integrate the accepted RC fixes, and produce a merge-ready release candidate without publishing
- Current owner: developer
- Current status: in_progress

## Acceptance Criteria

- none

## Scope And Paths

- package.json
- npm-shrinkwrap.json
- yarn.lock
- .github/workflows/publish-npm.yml
- .releaserc.json

## Phase Handoff

- Status: ready_for_review
- Changed components: Regenerated yarn.lock under Node 24.20.0/Yarn 1.22.21; all 1,499 entries now have resolved/integrity and required resolutions select fast-uri 3.1.6, csv-parse 7.0.2, ip-address 10.2.0. Added lock correction handoff.
- Behavior changed: Frozen Yarn installation no longer emits Lockfile has incorrect entry. npm shrinkwrap/prepack can rewrite yarn.lock, so final Yarn regeneration must remain after packaging validation.
- Unit tests: Frozen install warning guard passed; production audit zero; npm/yarn resolution checks passed; build, focused tests, test:all, prepack, 805-entry pack dry-run, and diff check passed.
- Commands run: See .agent-workflow/handoffs/SD-RC-REMEDIATE-lock-correction-handoff.md and recorded command evidence.
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
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#MetadataGapAnalysisService: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added a deterministic scanner that compares package manifests and source-path ...
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
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
