<!-- setup-agents: 3.16.0 -->
# QA Plan — Story Definition Gate

## Goal
Define the QA strategy for this story during BA/Definition phase.
A QA Plan must be approved by the QA role before the story can move to the Developer phase.

## Instructions
Fill in each section for the story in scope. Submit for QA review when complete.

---

## Story Reference
- **Story ID:** <!-- e.g., PROJ-123 -->
- **Story Title:** <!-- one-line summary -->
- **Acceptance Criteria count:** <!-- how many ACs -->

## Scope

### What is being built / changed?
<!-- Describe the feature, change, or fix in plain language. -->

### In scope for this QA cycle
<!-- List components, objects, flows, APIs, or UI surfaces to test. -->

### Out of scope / deferred
<!-- List what will NOT be tested now, and why. Document owner for deferred items. -->

## Test Strategy

### Test types required
- [ ] Unit tests (Apex) — required for all Apex changes
- [ ] E2E / Playwright — required for UI changes
- [ ] API tests — required for REST endpoint changes
- [ ] Agentforce DML validation — required if agent performs DML
- [ ] Manual exploratory — required for complex UX flows

### Environments
- **Dev / Sandbox:** <!-- org alias -->
- **UAT / Staging:** <!-- org alias if applicable -->

### Test Data & Fixtures
<!-- Describe data setup: persona, records, Permission Set Groups needed. -->

## Observable Assertions Plan
<!-- For each test type in scope, describe what observable outcome will be asserted. -->
<!-- Reference: .setup-agents/playbooks/observable-assertions.md -->

| Test Type | What will be asserted |
|-----------|----------------------|
| Unit | |
| E2E | |
| API | |

## Risks & Gaps
| Risk | Impact | Mitigation |
|------|--------|------------|
| | | |

## Deferred Validation
| What | Why deferred | Owner | Follow-up by |
|------|--------------|-------|--------------|
| | | | |

## Sign-off
- **QA Author:** <!-- name or role -->
- **Reviewer (QA role):** <!-- must be approved before developer phase -->

## Commands
Record QA Plan approval:
```bash
sf setup-agents review --task <id> --role qa --result approve --findings "QA Plan reviewed and approved" --recommendation "Proceed to Developer phase"
```

Block if plan is incomplete:
```bash
sf setup-agents review --task <id> --role qa --result changes --findings "<what is missing>" --recommendation "Complete QA Plan before proceeding"
```

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "QA Plan — Story Definition Gate completed"
```
