<!-- setup-agents: 3.16.0 -->
# Release

## Goal
Deploy validated changes to the target environment.

## Pre-flight
1. Confirm QA gate is approved (`sf setup-agents workflow gate`).
2. Confirm no open blockers in `.setup-agents/state/`.

## Steps
1. Quick deploy (uses last successful validation job):
   ```bash
   sf project deploy quick --job-id <validationJobId> --target-org <alias>
   ```
   Or full deploy if quick deploy is unavailable:
   ```bash
   sf project deploy start -d force-app --target-org <alias>
   ```
2. Monitor to completion. Report: status, duration, errors.
3. Run post-deploy smoke tests.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role devops --type command --summary "Release completed"
```
