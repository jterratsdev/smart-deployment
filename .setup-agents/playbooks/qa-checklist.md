<!-- setup-agents: 3.16.0 -->
# QA Checklist — Definition of Done

## Goal
Confirm every acceptance criterion is met before approving the QA gate.

## Definition of Done

### Code Quality
- [ ] No linter errors or suppressed warnings
- [ ] All new code covered by tests (target ≥ 90%)
- [ ] No SOQL or DML inside loops
- [ ] No hardcoded strings (Custom Labels used for UI text)

### Testing
- [ ] Apex test classes run without failures:
   ```bash
   sf apex test run --target-org <alias> --code-coverage --result-format human
   ```
- [ ] Code coverage ≥ 90% for all new/modified classes
- [ ] Playwright E2E tests pass (if applicable)

### Observable Assertions (CRITICAL — see observable-assertions.md)
- [ ] Every test validates an observable outcome, not just that the script ran
- [ ] Web tests assert rendered text, control states, or navigation — not just element existence
- [ ] API tests assert response body, persistence, and error shape — not just status 200
- [ ] Agentforce DML tests assert both conversational output AND persisted Salesforce records
- [ ] CLI tests assert exit code, stdout content, and generated file contents
- [ ] Evidence gaps and deferred validations are documented with owner and deadline

### Acceptance Criteria
- [ ] Every AC from the story is verified with evidence
- [ ] Edge cases tested: empty data, large data sets, invalid input
- [ ] No open blockers in `.setup-agents/state/`

### Handoff Readiness
- [ ] Deployment validation passed (`sf project deploy validate`)
- [ ] Validation job ID recorded for quick deploy

## Steps
1. Work through each checklist item above.
2. For any observable assertion gap: document it before proceeding, do not skip.
3. For each failure: create a defect task and block the QA gate.
4. When all items pass: record evidence and approve.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "QA Checklist — Definition of Done completed"
```
