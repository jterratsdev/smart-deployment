# Handoff GH-268: developer to qa

## Task Context

- Title: Add OWD propagation barrier before dependent SharingRules
- Goal: Detect OWD transitions, isolate dependent SharingRules, wait for effective InternalSharingModel, and resume safely after propagation timeout
- Current owner: developer
- Current status: blocked

## Acceptance Criteria

- Semantic diff reports sharingModel and externalSharingModel transitions independently
- SharingRules files are discovered with hard dependencies on their object and referenced local principals
- Execution deploys an OWD-changing object separately and observes expected InternalSharingModel before dependent SharingRules
- ExternalSharingModel alone never satisfies the barrier
- Timeout persists a resumable postcondition and resume rechecks it without redeploying the completed OWD phase
- Auth/network unknown remains distinct from missing principals and propagation timeout
- Human and JSON reports expose stable sanitized postcondition status
- Deterministic tests and an opt-in disposable-org E2E cover delayed internal propagation

## Scope And Paths

- src/deployment
- src/services/scanners
- src/parsers
- src/types
- test
- docs

## Phase Handoff

- Status: ready_for_review
- Changed components: Fixed all architect blockers/majors in GH-268 worktree: legacy fingerprint compatibility; stable checkpoint remapping and dependency validation; persisted typed blocked-before-deploy pause; explicit pending-postcondition resume; cumulative sanitized satisfied history; backward-compatible state normalization; deterministic regressions.
- Behavior changed: Legacy checkpoint/failed-wave states resume unchanged. OWD wave splitting preserves before/after checkpoint boundaries and graph order. Auth/network/query observation failures pause before mutation at cursor 0 and resume by re-query/replan. Satisfied barriers are not rechecked and remain in cumulative reports across invocations.
- Unit tests: 1731 unit passing (3 pending), 42 NUT passing, 36 E2E passing (3 guarded live pending), 34 integration passing, 6 performance passing; focused deployment runner adds cumulative multi-barrier history regression.
- Commands run: npm run format; npm run build; npm run test:only; npm run test:nuts; npm run test:e2e; npm run test:integration; npm run test:performance; npm run release:contracts; npm audit --omit=dev --package-lock-only --audit-level=high; git diff --check
- Known gaps: none
- Risks: none
- Recommended Playwright coverage: not applicable
- Executor provenance: not recorded

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 1
- AUTONOMOUS_RUN_FAILED: fix=Verified by command evidence: Final parent-attributed validation after local-principal dependency tightening and start JSON projection: n...; prevent=Capture recoverable failure context in Orchestra and verify the corrected sequence before handoff.
- Lessons applied: review required in handoff evidence
- Prompt registry entries consulted: 4
- code.md#ImpactCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-IMPACT-COMMAND - **Role:** developer ### Key decisions - Added `smart-deployment impact` as a read-only command that accepts either `--base` plus ...
- services.md#MetadataGapAnalysisService: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added a deterministic scanner that compares package manifests and source-path ...
- code.md#InitCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-INIT-WIZARD - **Role:** developer ### Key decisions - Added `smart-deployment init` as a deterministic, non-destructive command that delegates con...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
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
