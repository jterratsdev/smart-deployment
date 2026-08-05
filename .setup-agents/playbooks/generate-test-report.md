<!-- setup-agents: 3.16.0 -->
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

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "Generate Test Report completed"
```
