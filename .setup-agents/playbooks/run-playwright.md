<!-- setup-agents: 3.16.0 -->
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

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "Run Playwright Tests completed"
```
