<!-- setup-agents: 2.0.2 -->

## <!-- setup-agents:block:start id="doc-sync-skill" version="2.0.2" -->

name: doc-sync
description: >-
Update project documentation after task completion. USE FOR: sync docs, update ADR,
update changelog, post-task doc update, sf setup-agents task done, doc sync.
pluginVersion: "2.0.2"

---

# doc-sync Skill

Run this skill after every `sf setup-agents task done` to keep project docs in sync with actual implementation.

## Trigger

After any `sf setup-agents task done` or `orchestra task done` call completes successfully.

## Protocol

1. Run `sf setup-agents evidence list --task <id> --json` and `sf setup-agents decision list --task <id> --json`.
2. Identify which doc files are affected based on the task role and evidence type (see checklist below).
3. Open the relevant file. Find or create the section for this task using managed-block markers:
   `<!-- setup-agents:block:start id="<task-id>" -->`
   `<!-- setup-agents:block:end id="<task-id>" -->`
4. Update the content between markers. If markers don't exist, append a new section at the end of the file.
5. Never delete content outside managed blocks.

## Doc Target Checklist by Profile

### Architect

- [ ] `docs/adr/` — create or update ADR for any decision record with `kind: 'decision'`
- [ ] `docs/architecture.md` — update integration points section if new integrations were added
- [ ] `docs/diagrams/` — reference new Mermaid diagrams produced in this task
- [ ] `docs/reviews/` — append architecture review findings if a review record exists

## Rules

- Keep each update under 20 lines per managed block — link to ADRs for detail.
- Use `should` not `must` — missing docs do not block task completion.
- Do not modify content outside managed blocks.
<!-- setup-agents:block:end id="doc-sync-skill" -->
