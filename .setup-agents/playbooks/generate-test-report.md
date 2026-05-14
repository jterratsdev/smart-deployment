<!-- setup-agents: 2.0.2 -->

# Generate Test Report

## Goal

Produce a QA sign-off report for this story.

## Steps

1. Run Apex tests:
   ```bash
   sf apex test run --target-org <alias> --code-coverage --result-format human
   ```
2. Collect results: pass/fail count, coverage %.
3. Run Playwright (if applicable) — see `run-playwright.md`.
4. Write a summary: what was tested, results, any known limitations.
5. Record evidence: `sf setup-agents evidence add --task <id> --type test --summary "Test report generated"`
