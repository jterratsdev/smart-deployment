# Setup Agents Local State

This directory stores lightweight project-local coordination records for AI agents.
Files use JSON Lines so agents can append entries without rewriting the full history.

## Files

- `decisions.jsonl` — key decisions, rationale, owner, and timestamp.
- `handoffs.jsonl` — role-to-role handoff summaries, changed files, risks, and next actions.
- `evidence.jsonl` — command, file, screenshot, trace, report, or validation evidence.
- `tasks.jsonl` — append-only task create, claim, and completion records.

## Entry Contract

Each line should be a JSON object with these common fields:

```json
{
  "id": "local-<timestamp>",
  "task": "optional-task-id",
  "role": "developer",
  "summary": "short summary",
  "createdAt": "2026-05-06T00:00:00.000Z"
}
```

Tools may add type-specific fields, but they should preserve the common fields above.
Do not store secrets, credentials, tokens, or raw sensitive customer data in local state.
