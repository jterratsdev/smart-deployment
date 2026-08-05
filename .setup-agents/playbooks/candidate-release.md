<!-- setup-agents: 3.16.0 -->
# Candidate Release

## Goal
Tag the current commit as a release candidate.

## Steps
1. Confirm all stories in scope are in `done` status.
2. Create a git tag:
   ```bash
   git tag rc-<version>-<YYYYMMDD>
   git push origin rc-<version>-<YYYYMMDD>
   ```
3. Create a GitHub release draft (do not publish yet).

## Evidence
```bash
sf setup-agents evidence add --task <id> --role devops --type command --summary "Candidate Release completed"
```
