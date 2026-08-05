<!-- setup-agents: 3.16.0 -->
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

## Evidence
```bash
sf setup-agents evidence add --task <id> --role devops --type validation --summary "Validate Deployment completed"
```
