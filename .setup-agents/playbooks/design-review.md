<!-- setup-agents: 3.16.0 -->
# Design Review

## Goal
Validate wireframe/mockup fidelity against SLDS standards and Salesforce UX patterns before development begins.

## Steps
1. Gather the wireframe or mockup (file path, Figma link, or description).
2. Review against:
   - **SLDS Components:** Are standard SLDS components used instead of custom HTML?
   - **Styling Hooks:** Are SLDS Styling Hooks used for colors, spacing, and typography?
   - **Component Reuse:** Are existing LWC components reused before proposing new ones?
   - **Accessibility Baseline:** Does the design specify contrast ratios (4.5:1), touch targets (44×44px), and keyboard navigation paths?
3. List deviations with severity (Critical / High / Medium / Low).
4. Approve for development or return with required changes.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ux --type report --summary "Design Review completed"
```
