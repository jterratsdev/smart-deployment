<!-- setup-agents: 3.23.1 -->
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

## Jest/UI locators (same priority as Playwright — see QA Automation rule)
- Query the rendered shadow DOM by role/text/label, not by class or `querySelector('.slds-...')`:
  ```typescript
  // ❌ Wrong — couples the test to generated SLDS classes
  const btn = element.shadowRoot.querySelector('.slds-button');

  // ✅ Correct — queries by role, matching what Playwright/users see
  const btn = element.shadowRoot.querySelector('[role="button"]');
  ```
- Inspect the actual rendered template (not memory of the `.html` file) before picking a query —
  render the component in the test and log `element.shadowRoot.innerHTML` once if the structure is
  unclear, rather than guessing.
- If no role/label exists on an element under test, add one (or a `data-testid`) to the component
  markup rather than reaching for a brittle class/structure selector.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "Create Lightning Web Component completed"
```
