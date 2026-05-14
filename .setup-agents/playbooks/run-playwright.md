<!-- setup-agents: 2.0.2 -->

# Run Playwright Tests

## Goal

Execute the Playwright E2E suite and report results.

## Steps

1. Start the target org / sandbox environment.
2. Run:
   ```bash
   npx playwright test
   ```
3. Wait for all tests to complete.
4. Report: pass/fail count, failed test names, screenshots for failures.
5. If failures exist, diagnose and fix before marking QA done.
6. Record evidence: `sf setup-agents evidence add --task <id> --type test --summary "Playwright: X/Y passed"`
