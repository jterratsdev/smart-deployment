<!-- setup-agents: 3.16.0 -->
# Create Lightning Web Component

## Goal
Implement the LWC required by this story.

## Pre-flight
1. Read `sfdx-project.json` → `sourceApiVersion`.
2. Check `force-app/main/default/lwc/` for an existing component to extend.

## Steps
1. Prioritize SLDS Styling Hooks over custom CSS.
2. Use Lightning Data Service / LDS 2 where possible.
3. User feedback: Toasts with Custom Labels — never hardcode strings.
4. UX gate: contrast (4.5:1), empty states, loading spinners, touch targets (44×44px).
5. Write Jest tests in `__tests__/`.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "Create Lightning Web Component completed"
```
