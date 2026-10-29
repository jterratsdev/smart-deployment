<!-- setup-agents: 3.23.1 -->
# Run Playwright Tests

## Goal
Execute the Playwright E2E suite and report results.

## Locator discipline (see QA Automation rule for the full priority list)
Before writing or fixing a spec: inspect the real page (`npx playwright codegen <url>`, the
Inspector, or an ARIA snapshot) and cite what was inspected. Never invent a selector or click path
from memory. Prefer `getByRole()` with its accessible name; fall back to `getByLabel()`/
`getByText()`, then `getByTestId()`; CSS/XPath/class-chain only as a documented last resort. If an
element has no stable role/label, raise a testability defect and propose a `data-testid` instead of
coding around it.

## Steps
1. Start the target org / sandbox environment.
2. Run:
   ```bash
   npx playwright test
   ```
3. Wait for all tests to complete.
4. Report: pass/fail count, failed test names, screenshots for failures.
5. If failures exist, diagnose and fix before marking QA done.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "Run Playwright Tests completed"
```
