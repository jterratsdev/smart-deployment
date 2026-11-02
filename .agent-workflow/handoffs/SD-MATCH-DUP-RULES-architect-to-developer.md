# Handoff SD-MATCH-DUP-RULES: architect to developer

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
- Changed components: Technical tasking, design decisions, and size estimation Consumed context files: workflow task context and product handoff. Architecture decision: preserve existing workflow boundaries and route model selection through the shared sizing policy. Data flow: estimate -> phase routing -> provider executor -> append-only routing provenance. Risks: runtime model switching and provider capability checks remain owned by the runtime checkpoint work. Owned implementation-proof deferral: Developer must verify the selected route with a focused workflow E2E and report the exact command and result. Rationale: implementation files are owned by Developer and do not exist during architecture. Handoff notes: architecture is substantive and the implementation proof has an explicit owner and verification target.
- Behavior changed: Technical tasking, design decisions, and size estimation
- Unit tests: See phase task evidence
- Commands run: See phase task evidence
- Known gaps: All required transition checks were explicitly assessed.
- Risks: risks: Reviewed: no risk findings were recorded by this phase.; splitDecision: technical split recommended or explicit accepted-risk decision required: broad path count (7); multiple required roles (architect, developer, qa); technicalRisks: Reviewed: no risk findings were recorded by this phase.
- Recommended Playwright coverage: not applicable
- Executor provenance: mode=single-agent; executor=parent-agent; role=architect; phase=architect; runtime=codex-cli; session=SD-MATCH-DUP-RULES:wfrun-1790953337718-52dcd1:architect:codex-cli; fallback=workflow phase execution mode is single-agent; directProviderApiAllowed=false

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 0
- none
- Lessons applied: none available
- Prompt registry entries consulted: 4
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- services.md#DestructiveRollbackDeploymentServices: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-225-destructive-rollback - **Role:** developer ### Key decisions - WaveManifestService now emits empty package manifests plus per-wave destruc...
- services.md#MetadataGapAnalysisService: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added a deterministic scanner that compares package manifests and source-path ...
- code.md#CommitScopedDeploymentCommands: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** PLUGIN-COMMIT-SCOPED-DEPLOYMENTS - **Role:** developer ### Key decisions - Added --scope-commits and --scope-manifest flags to start, validate, ci preset...
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
- realProductProof: covered - architect->developer (architect->developer) SD-MATCH-DUP-RULES: architecture/security substance recorded with owned implementation evidence deferral.

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
