<!-- setup-agents: 2.0.2 -->

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
5. Record evidence: `sf setup-agents evidence add --task <id> --type file --summary "Trigger created/updated: <Object>"`
