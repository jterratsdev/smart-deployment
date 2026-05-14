# Runtime Subagent Delegation Packet: DQ-002

- Runtime: Codex CLI (codex-cli)
- Delegation mode: runtime-native
- Runtime-native subagents supported: true
- Direct provider API calls allowed: false

## Parent Task

Extract SOQL and field-list references from Custom Metadata records that configure dynamic Apex behavior.

## Subagent Assignments

### architect

- Ownership paths: src/parsers/custom-metadata-parser.ts, src/services/scanners/data-metadata-scanner.ts, test/unit/parsers/custom-metadata-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Phase Playbook: architect

Source: .agent-workflow/playbooks/architect.md

# Architect Playbook

- Define boundaries, data flow, integration contracts, and rollback risk.
- Prefer existing project patterns before adding abstractions.
- Record sizing and ADR-level decisions when the design has lasting impact.

### developer

- Ownership paths: src/parsers/custom-metadata-parser.ts, src/services/scanners/data-metadata-scanner.ts, test/unit/parsers/custom-metadata-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Phase Playbook: developer

Source: .agent-workflow/playbooks/developer.md

# Developer Playbook

- Implement the smallest coherent change that satisfies acceptance criteria.
- Keep business logic typed, tested, and close to existing patterns.
- Always include `Architectural Concerns (inherited)` for upstream design drift; write `None` when empty.
- Always include `Architectural Concerns (self-imposed)` for new abstractions, files, metadata, APIs, config, scripts, or workflow changes; write `None` when empty.
- For every self-imposed concern, explain why existing project patterns or a simpler alternative are insufficient.
- Carry architectural concern findings in structured output as `architecturalConcerns.inherited` and `architecturalConcerns.selfImposed`.
- Record evidence, changed files, known gaps, and handoff notes.

### qa

- Ownership paths: src/parsers/custom-metadata-parser.ts, src/services/scanners/data-metadata-scanner.ts, test/unit/parsers/custom-metadata-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Phase Playbook: qa

Source: .agent-workflow/playbooks/qa.md

# QA Playbook

## QA Checklist

- Map each acceptance criterion to deterministic verification or a documented manual check.
- Confirm changed behavior, regression areas, edge cases, data setup, and environment assumptions.
- Record exact commands, pass/fail result, artifacts, known gaps, and release recommendation.

## Regression

- Identify critical flows, prior defects, adjacent modules, and brittle integration points.
- Prefer existing automated coverage before adding new tests; note any intentional manual coverage.

## Smoke Test

- Define the smallest high-confidence smoke path for the changed behavior.
- Include CLI, API, or browser smoke evidence based on the user-facing surface.

- Verify acceptance criteria, regressions, edge cases, and evidence quality.
- Prefer deterministic automated checks; add browser evidence for UI flows.
- State residual risks and whether release should proceed.

### release_manager

- Ownership paths: src/parsers/custom-metadata-parser.ts, src/services/scanners/data-metadata-scanner.ts, test/unit/parsers/custom-metadata-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Phase Playbook: release

Source: .agent-workflow/playbooks/release.md

# Release Playbook

## Deployment Risk Challenge

- Challenge rollout, rollback, config, API, security-boundary, observability, and production-impact complexity before sign-off.
- Flag smells such as excessive rollout waves for the story size, rollback complexity disproportionate to the change, production-impacting config/API changes, security-boundary changes, and missing observability.
- If challenge findings exceed the project's risk threshold, record a blocking release review or action-policy approval request instead of approving the runbook.
- If no challenge findings exist, state `None` explicitly.

- Confirm CI, versioning, release notes, rollback path, and operational risk.
- Verify published artifacts or deployment evidence before closing the work.
- Record go/no-go rationale and any follow-up monitoring needs.

## Release Promote

- Validate changelog or release note impact, smoke evidence, rollback evidence, and customer/support readiness.
- Confirm whether the change ships alone or is batched with adjacent completed tasks.
- Record promote, hold, or accepted-risk rationale before closing the release phase.

## Guardrails

- Do not call OpenAI, Anthropic, or other vendor APIs from Orchestra for this delegation.
- Use the active runtime's own authenticated agent/subagent mechanism.
- If runtime-native delegation is unsupported, stop at this packet and ask the user for approval.
- Avoid overlapping writes; respect ownership paths and active locks.
- Use `orchestra commands manifest --json` for supported commands and flags.

## Tool Permission Policy

- Mode: runtime-managed
- Explicit opt-in required: false
- Read-only tools: none
- Write tools: none
- Shell tools: none
- Autonomous flags: none
- Gated flags: none
- Warning: Codex permission flags are managed by the active Codex CLI/session; Orchestra renders briefs and does not inject direct execution flags.
