<!-- setup-agents: 3.16.0 -->
# Wireframe

## Goal
Produce a lo-fi then hi-fi wireframe that captures component inventory, responsive breakpoints, and interaction states.

## Steps
1. Clarify: What is the user goal for this screen/flow?
2. Lo-fi wireframe:
   - Sketch the layout: header, sidebar, main content, footer.
   - List all interactive elements: buttons, inputs, dropdowns, modals.
   - Note empty states, loading states, and error states.
3. Hi-fi wireframe:
   - Map lo-fi elements to SLDS components (lightning-button, lightning-input, etc.).
   - Define responsive breakpoints: mobile (320px), tablet (768px), desktop (1280px).
   - Confirm component inventory — no net-new LWC without justification.
4. Share with team for feedback before implementation handoff.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ux --type file --summary "Wireframe completed"
```
