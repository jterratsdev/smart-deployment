<!-- setup-agents: 2.0.2 -->

# Validate Deployment

## Goal

Run a dry-run validation before deploying to production.

## Steps

1. Execute:
   ```bash
   sf project deploy validate -d force-app --target-org <alias> --test-level RunLocalTests
   ```
2. Wait for validation to complete.
3. Report: pass/fail, coverage %, any errors.
4. Record the validation job ID for use in quick deploy.
5. Record evidence: `sf setup-agents evidence add --task <id> --type deploy --summary "Validation passed, jobId: <id>"`
