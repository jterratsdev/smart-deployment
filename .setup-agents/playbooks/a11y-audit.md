<!-- setup-agents: 3.16.0 -->
# Accessibility Audit (a11y)

## Goal
Verify the component or page meets WCAG 2.1 AA standards before QA sign-off.

## Checklist

### Visual
- [ ] Text contrast ratio: ≥ 4.5:1 (normal text), ≥ 3:1 (large text / UI components)
- [ ] No information conveyed by color alone
- [ ] Focus indicators visible for all interactive elements

### Keyboard Navigation
- [ ] All interactive elements reachable via Tab / Shift+Tab
- [ ] Enter / Space activates buttons and links
- [ ] Escape closes modals and dropdowns
- [ ] No keyboard traps

### Screen Reader
- [ ] All images have `alt` text or `aria-hidden`
- [ ] Form fields have associated `<label>` or `aria-labelledby`
- [ ] Dynamic updates announce via `aria-live` regions

### Touch / Mobile
- [ ] Touch targets ≥ 44×44px
- [ ] No hover-only interactions

## Steps
1. Run automated audit (Axe DevTools, WAVE, or equivalent).
2. Manual keyboard-only walkthrough of all interactive flows.
3. Screen reader walkthrough (NVDA, JAWS, or VoiceOver).
4. Document findings with severity and remediation steps.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ux --type report --summary "Accessibility Audit (a11y) completed"
```
