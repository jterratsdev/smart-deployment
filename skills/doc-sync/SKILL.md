# Doc Sync

Keep architecture docs, changelog, onboarding, runbooks, site copy, and prompt registers aligned with delivered changes.

## When To Load

- Trigger: `documentation`
- Trigger: `docs`
- Trigger: `changelog`
- Trigger: `readme`
- Trigger: `quickstart`
- Trigger: `runbook`
- Trigger: `architecture`
- Trigger: `adr`
- Trigger: `release notes`
- Trigger: `public site`
- Trigger: `prompt registry`

## Procedure

- Identify changed behavior, architecture, release surface, workflows, commands, and user-facing copy from the task, issue, diff, and evidence.
- Update the smallest authoritative documentation surfaces for the audience: README for onboarding, CHANGELOG for release history, `docs/` for architecture and runbooks, `.generated-prompts/` for prompt intent, and the public site for product-facing guidance.
- Keep code, service, and domain generation prompts traceable: update `.generated-prompts/code.md` or `.generated-prompts/services.md` after substantial class, model, service, controller, or module changes.
- Keep documentation and diagram prompts traceable: update `.generated-prompts/docs.md` or `.generated-prompts/diagrams.md` after substantial docs, architecture, ADR, runbook, changelog, or Mermaid changes.
- Run `orchestra doc-sync audit --task <id>` before handoff when documentation, changelog, architecture, diagram, or public-site surfaces changed. Use `--strict` in CI or release checks that should fail on missing prompt registry coverage.
- If the audit reports repeated documentation iterations, use `orchestra lessons assist` to capture the reusable correction pattern after verification.
- Validate command examples against `orchestra commands manifest --json`, `orchestra --help`, or the repo-local `node bin/orchestra.js` during Open Orchestra development.
- If README, docs, or site onboarding changes, check the sibling surfaces so quickstart language, command names, and release positioning do not drift.
- Record unresolved documentation gaps as review findings or follow-up tasks instead of burying them in prose.

## Surface Checklist

- Architecture changes: `docs/architecture.md`, ADRs, Mermaid diagrams, public site architecture section, `.generated-prompts/diagrams.md`.
- Release changes: `CHANGELOG.md`, release notes, rollback and observability notes, `.generated-prompts/docs.md`.
- CLI or workflow changes: `README.md`, command reference docs, public site quickstart, `.generated-prompts/code.md`.
- Product or support changes: public site, user guides, known issues, support FAQs, `.generated-prompts/docs.md`.

## Evidence

- `file`
- `report`
- `command`
