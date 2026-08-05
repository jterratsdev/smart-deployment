<!-- setup-agents: 3.16.0 -->
# Regression Protocol

## Goal
Identify and execute the minimum regression test set to confirm no existing functionality was broken.

## Scope Identification
1. List all files/metadata changed in this story.
2. Identify impacted objects, processes, and integrations:
   - Apex class changes → run related test classes
   - Trigger changes → run all trigger test classes for that object
   - LWC changes → run Jest tests + Playwright flows for that component
   - Flow changes → test all entry paths for that flow
   - Schema changes → test all pages/components that reference those fields

## Execution Order
1. Unit tests first (Apex, Jest)
2. Integration tests (trigger → flow → output)
3. E2E tests (Playwright — critical user paths only)
4. Manual exploratory for high-risk areas

## Pass/Fail Criteria
- **Pass:** all existing tests pass, no new failures introduced
- **Fail:** any test that passed before this change now fails
- **Acceptable:** pre-existing failures that are documented in a known-issues log

## Escalation
If a regression is found:
1. Block the QA gate immediately.
2. Create a defect task with: what broke, when it broke (commit reference), severity.
3. Notify the developer for fix.

## Steps
1. Run full Apex test suite for changed objects:
   ```bash
   sf apex test run --target-org <alias> --code-coverage --result-format human
   ```
2. Run Playwright (if applicable).
3. Document results.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "Regression Protocol completed"
```
