# Handoff SD-WAVE-SAFETY-CONTRACTS: architect to developer

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
- Changed components: Technical tasking, design decisions, and size estimation Consumed context files: workflow task context and product handoff. Architecture decision: preserve existing workflow boundaries and route model selection through the shared sizing policy. Data flow: estimate -> phase routing -> provider executor -> append-only routing provenance. Risks: runtime model switching and provider capability checks remain owned by the runtime checkpoint work. Owned implementation-proof deferral: Developer must verify the selected route with a focused workflow E2E and report the exact command and result. Rationale: implementation files are owned by Developer and do not exist during architecture. Handoff notes: architecture is substantive and the implementation proof has an explicit owner and verification target.
- Behavior changed: Technical tasking, design decisions, and size estimation
- Unit tests: See phase task evidence
- Commands run: See phase task evidence
- Known gaps: All required transition checks were explicitly assessed.
- Risks: risks: Reviewed: no risk findings were recorded by this phase.; splitDecision: technical split recommended or explicit accepted-risk decision required: broad path count (7); multiple required roles (architect, developer, qa); technicalRisks: Reviewed: no risk findings were recorded by this phase.
- Recommended Playwright coverage: not applicable
- Executor provenance: mode=single-agent; executor=parent-agent; role=architect; phase=architect; runtime=codex-cli; session=SD-WAVE-SAFETY-CONTRACTS:wfrun-1790846178627-8e4903:architect:codex-cli; fallback=workflow phase execution mode is single-agent; directProviderApiAllowed=false

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 0
- none
- Lessons applied: none available
- Prompt registry entries consulted: 4
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- services.md#PlanExplainService: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 1 - **Task:** PLUGIN-PLAN-EXPLAIN - **Role:** developer ### Key decisions - Reused `DeploymentContextService` and `SpecialDeploymentPlanService` instead of changing wa...
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
- code.md#PlanExplainCommand: - **Created:** 2026-05-22 - **Updated:** 2026-05-22 - **Iterations:** 2 - **Task:** PLUGIN-PLAN-EXPLAIN - **Role:** qa ### Key decisions - Added `smart-deployment plan explain` as a read-only command that accepts start dry-run style plan...
- Prompt registry entries updated: verify via PROMPT_REGISTRY_UPDATED events or accepted rationale before release.

## Transition Guard

- State transition: architect (architect) -> developer (developer)
- Required fields: decision, tradeoffs, risks, scopeAssessment, affectedBoundaries, splitDecision, technicalRisks, realProductProof
- Contract result: evaluated

## Required Handoff Field Coverage

- decision: covered - Use incremental implementation
- tradeoffs: covered - Reviewed: no risk findings were recorded by this phase.
- risks: covered - Reviewed: no risk findings were recorded by this phase.
- scopeAssessment: covered - technical scope requires split review: broad path count (7); multiple required roles (architect, developer, qa)
- affectedBoundaries: covered - src, test
- splitDecision: covered - technical split recommended or explicit accepted-risk decision required: broad path count (7); multiple required roles (architect, developer, qa)
- technicalRisks: covered - Reviewed: no risk findings were recorded by this phase.
- realProductProof: covered - architect->developer (architect->developer) SD-WAVE-SAFETY-CONTRACTS: architecture/security substance recorded with owned implementation evidence deferral.

## Role Quality Contract

- Contract: generic-advisory
- Validation mode: advisory
- Result: pass
- Transition allowed: true
- Allowed transitions: \*
- Return to phase: not required
- Human approval required: false

## Role Contract Requirement Coverage

- Handoff notes: covered - Handoff notes covered.

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
