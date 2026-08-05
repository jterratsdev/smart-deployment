---
name: elements-sync
description: >-
  Create and update Requirements and Stories in Elements.cloud from story maps,
  backlog documents, or free-form descriptions. Uses the Elements REST API
  (https://api.elements.cloud/v1) with ELEMENTS_API_KEY and ELEMENTS_SPACE_NAME
  environment variables. USE FOR: push to elements, create requirement, create story,
  sync elements, elements cloud, upload stories, elements backlog, push requirements.
  Reusable by BA, PM, and Architect profiles.
---

# Elements Sync

## Prerequisites

| Requirement | Check | How to obtain |
|-------------|-------|---------------|
| `ELEMENTS_API_KEY` env var | `echo $ELEMENTS_API_KEY` | Elements Space → Developer → API Tokens → Create |
| `ELEMENTS_SPACE_NAME` env var | `echo $ELEMENTS_SPACE_NAME` | Your Elements Space name (shown in the app URL) |
| `curl` | `curl --version` | Pre-installed on macOS/Linux |

> **Never hardcode credentials.** Always read from environment variables.
> If variables are not set, instruct the user to add them to their shell profile
> or `.env` file and **never commit them to version control**.

---

## Active Job Monitoring (CRITICAL)

When creating multiple items, create them **one by one** and report each result.
Never batch-create without tracking. After all items are created, report:
total created, any failures with error details, and the IDs of created items.

---

## Environment Setup

```bash
# Add to ~/.zshrc or ~/.bash_profile
export ELEMENTS_API_KEY="your-api-key-here"
export ELEMENTS_SPACE_NAME="your-space-name"
```

> Obtain your API key: Elements app → Space Management → Developer → API Tokens → Create API Token.
> The key is shown **only once** — store it in a password manager.

---

## Using the Helper Script

```bash
# Create a Requirement
bash .setup-agents/skills/elements-sync/scripts/push-to-elements.sh requirement \
  --summary "Implement vacation days feature" \
  --what "Users need a way to track remaining vacation days" \
  --priority 1 --impact 2 --risk 1

# Create a Story
bash .setup-agents/skills/elements-sync/scripts/push-to-elements.sh story \
  --summary "As a user I want to see my vacation balance" \
  --description "Display remaining days on the home dashboard" \
  --risk 1

# Create a Story linked to a Requirement
bash .setup-agents/skills/elements-sync/scripts/push-to-elements.sh story \
  --summary "Show vacation balance on dashboard" \
  --requirement-id "642d4765518823ea234f104e" \
  --risk 1
```

---

## API Reference

### Base URL

```
https://api.elements.cloud/v1
```

### Authentication

Every request must include the header:
```
X-API-KEY: $ELEMENTS_API_KEY
```

### Create a Requirement — `POST /requirements`

Required fields: `summary`, `priority`, `impact`, `risk`

```json
{
  "summary": "string (required)",
  "whatIsRequired": "string — what must be done",
  "howItMightBeImplemented": "string — implementation notes",
  "requiredByReason": "string — business justification",
  "requiredBy": "YYYY-MM-DD — target date",
  "priority": 1,
  "impact": 2,
  "risk": 1,
  "tags": ["tag1", "tag2"],
  "release": "Release Name",
  "assignee": "user@example.com"
}
```

`priority`, `impact`, `risk` are integers (typically 1–3, where 1 = high).

### Create a Story — `POST /stories`

Required field: `summary`

```json
{
  "summary": "string (required)",
  "description": "string — As a user I want...",
  "acceptanceCriteria": "string — Given/When/Then",
  "requirement": "requirementId — links story to parent requirement",
  "affectedRoles": ["Role Name"],
  "risk": 1,
  "tags": ["tag1"],
  "release": "Release Name",
  "assignee": "user@example.com",
  "externalId": "US-101 — your tracking ID"
}
```

### Responses

| Code | Meaning |
|------|---------|
| 201 | Created — response body contains the full object with `id` |
| 400 | Validation error — check required fields |
| 401 | Unauthorized — verify `ELEMENTS_API_KEY` |
| 429 | Rate limited — max 100 req/s, 5 000 req/month per Space |

---

## Field Mapping from Story Maps

When reading a story map document to push to Elements, use this mapping:

| Story Map field | Elements Requirement | Elements Story |
|-----------------|---------------------|----------------|
| Epic title | `summary` | — |
| Epic description | `whatIsRequired` | — |
| User story text | — | `summary` |
| Acceptance criteria | — | `acceptanceCriteria` |
| Priority (P1/P2/P3) | `priority` (1/2/3) | `risk` (1/2/3) |
| US ID (e.g. US-101) | — | `externalId` |
| Epic → Story link | — | `requirement` (parent ID) |

---

## Agent Workflow

1. **Verify credentials** — check `ELEMENTS_API_KEY` and `ELEMENTS_SPACE_NAME` are set.
   If missing, show the Environment Setup section above.
2. **Parse the source** — read the story map or backlog document.
3. **Create Requirements first** — one per Epic. Record the returned `id`.
4. **Create Stories** — one per user story, setting `requirement` to the parent Requirement ID.
5. **Report results** — list each created item with its Elements ID and summary.
   Flag any failures with the error message.

### Error Handling

- `400 validation_failed`: read the `error` field and fix the missing/invalid field.
- `401 Unauthorized`: remind the user to verify `ELEMENTS_API_KEY`.
- `429 Rate Limited`: wait and retry; the `X-RateLimit-Reset` header says when.
- Network error: verify the machine has internet access to `api.elements.cloud`.