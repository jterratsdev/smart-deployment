<!-- setup-agents: 3.16.0 -->
# Create Apex Class

## Goal
Implement the Apex class(es) required by this story.

## Pre-flight
1. Read `sfdx-project.json` → `sourceApiVersion`.
2. Grep for existing utility classes before writing new ones.
3. Check `.setup-agents/state/evidence.jsonl` for lessons learned on this topic.

## Steps
1. Follow existing naming conventions (infer from `force-app/main/default/classes/`).
2. Default `with sharing`. Exception: `@RestResource` → `without sharing`.
3. No SOQL or DML inside loops. Bulkify all methods.
4. Write the test class (`<ClassName>_Test`) with ≥90% coverage.
5. Deploy and validate:
   ```bash
   sf project deploy validate -d force-app --target-org <alias>
   ```

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "Create Apex Class completed"
```
