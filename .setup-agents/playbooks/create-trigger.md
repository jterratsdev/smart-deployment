<!-- setup-agents: 3.16.0 -->
# Create Apex Trigger

## Goal
Implement an Apex trigger following the one-trigger-per-object pattern.

## Pre-flight
1. Check `force-app/main/default/triggers/` — if a trigger exists for this object, extend it; never create a second one.
2. Check for existing trigger handler (`<Object>TriggerHandler.cls`).

## Steps
1. Create or update the trigger (zero logic — delegate to handler).
2. Create or update `<Object>TriggerHandler.cls` with the business logic.
3. Write test class with ≥90% coverage.
4. Deploy and validate.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "Create Apex Trigger completed"
```
