---
name: backlog-sync
description: >-
  Push user stories from story maps to issue trackers. Supports GitHub Issues,
  GitLab Issues, Jira, Azure DevOps, and Bitbucket. Auto-detects the platform
  from project files, parses the story map markdown, creates issues with field
  mapping, and guards against duplicates.
  USE FOR: create issues, push stories, sync backlog, upload user stories,
  create tickets, push to jira, push to github, create work items, backlog sync.
  Reusable by PM and BA profiles.
---

# Backlog Sync

## Prerequisites

| Platform     | CLI / Tool        | Check                   | Install / Configure                                            |
| ------------ | ----------------- | ----------------------- | -------------------------------------------------------------- |
| GitHub       | `gh`              | `gh auth status`        | `gh auth login`                                                |
| GitLab       | `glab`            | `glab auth status`      | `glab auth login`                                              |
| Azure DevOps | `az`              | `az account show`       | `az login && az extension add --name azure-devops`             |
| Jira         | `curl` + env vars | `echo $JIRA_API_TOKEN`  | Set `JIRA_BASE_URL`, `JIRA_USER_EMAIL`, `JIRA_API_TOKEN`       |
| Bitbucket    | `curl` + env vars | `echo $BITBUCKET_TOKEN` | Set `BITBUCKET_WORKSPACE`, `BITBUCKET_REPO`, `BITBUCKET_TOKEN` |

> Only the CLI for the target platform is required. You do not need all of them.

---

## Active Job Monitoring (CRITICAL)

When creating issues, you MUST create them one by one and report progress.
**Never** batch-create without tracking. After all issues are created, report:
total created, any failures, and the URLs of the new issues.

---

## 1. Platform Detection

Auto-detect the target platform from project files:

| Indicator                            | Platform         |
| ------------------------------------ | ---------------- |
| `.github/` directory exists          | **GitHub**       |
| `.gitlab-ci.yml` exists              | **GitLab**       |
| `azure-pipelines.yml` exists         | **Azure DevOps** |
| `JIRA_BASE_URL` env var is set       | **Jira**         |
| `BITBUCKET_WORKSPACE` env var is set | **Bitbucket**    |

If multiple indicators match, ask the user which platform to use.
If none match, ask: "Which issue tracker does this project use?"

---

## 2. Parsing the Story Map

The story map follows the standard format from the Story Mapping skill.
Parse each epic table to extract:

| Field               | Source column                     | Maps to                           |
| ------------------- | --------------------------------- | --------------------------------- |
| US ID               | `US ID`                           | Issue title prefix                |
| Title               | `User Story`                      | Issue title                       |
| Persona             | `Persona`                         | Label                             |
| Priority            | `Priority`                        | Label (P1/P2/P3)                  |
| Acceptance Criteria | `Acceptance Criteria`             | Issue body                        |
| Epic                | Table heading (`## Epic N: Name`) | Milestone, parent issue, or label |

Compose the issue title as: `US-NNN: <User Story text>`

Compose the issue body as:

```markdown
## User Story

As a [Persona], I want [action], so that [value].

## Acceptance Criteria

- **Given** [precondition]
  **When** [action]
  **Then** [expected result]

## Metadata

- **Epic:** [Epic Name]
- **Persona:** [Persona ID and Name]
- **Priority:** [P1/P2/P3]
- **T-shirt Size:** [if estimated]
```

---

## 3. Idempotency Guard (CRITICAL)

Before creating any issue, **search for an existing issue with the same US ID**
to avoid duplicates:

```bash
# GitHub
gh issue list --search "US-101" --json number,title --limit 5

# GitLab
glab issue list --search "US-101" --per-page 5

# Azure DevOps
az boards work-item query --wiql "SELECT [System.Id] FROM WorkItems WHERE [System.Title] CONTAINS 'US-101'"
```

For Jira and Bitbucket, use their respective search APIs via `curl`.

If a match is found:

- Report: "US-101 already exists as #<number> — skipping."
- Do NOT create a duplicate. Move to the next story.

---

## 4. Creating Issues by Platform

### GitHub Issues

```bash
gh issue create \
  --title "US-101: Login via SSO" \
  --body "<body markdown>" \
  --label "P1,persona:FieldRep,epic:Authentication"
```

To assign to a milestone (epic): `--milestone "Epic 1: Authentication"`

### GitLab Issues

```bash
glab issue create \
  --title "US-101: Login via SSO" \
  --description "<body markdown>" \
  --label "P1,persona:FieldRep,epic:Authentication"
```

To assign to a milestone: `--milestone "Sprint N"` or `--milestone "Epic 1"`

### Azure DevOps

```bash
az boards work-item create \
  --type "User Story" \
  --title "US-101: Login via SSO" \
  --fields "System.Description=<body>" "Microsoft.VSTS.Common.Priority=1" \
  --area "ProjectName\\Epic 1"
```

### Jira (REST API)

Priority mapping: P1 = High, P2 = Medium, P3 = Low.

```bash
curl -s -X POST \
  -H "Authorization: Basic $(echo -n \"$JIRA_USER_EMAIL:$JIRA_API_TOKEN\" | base64)" \
  -H "Content-Type: application/json" \
  "$JIRA_BASE_URL/rest/api/3/issue" \
  -d '{"fields":{"project":{"key":"<KEY>"},"summary":"US-101: Login via SSO","issuetype":{"name":"Story"},"priority":{"name":"High"},"labels":["persona:FieldRep","epic:Authentication"]}}'
```

Ask the user for `<KEY>` (Jira project key) if not previously provided.

### Bitbucket Issues

Priority mapping: P1 = critical, P2 = major, P3 = minor.

```bash
curl -s -X POST \
  -H "Authorization: Bearer $BITBUCKET_TOKEN" \
  -H "Content-Type: application/json" \
  "https://api.bitbucket.org/2.0/repositories/$BITBUCKET_WORKSPACE/$BITBUCKET_REPO/issues" \
  -d '{"title":"US-101: Login via SSO","content":{"raw":"<body>"},"priority":"critical","kind":"enhancement"}'
```

---

## 5. Execution Flow

Follow this sequence for each story map sync:

1. **Detect platform** (or ask user).
2. **Verify authentication** — run the check command from Prerequisites.
   If auth fails, guide the user through login. Run auth commands **outside the sandbox**.
3. **Parse** the story map markdown — extract all user stories.
4. **Preview** — show the user a summary table: US ID, Title, Priority, Platform.
   Ask for confirmation before creating.
5. **Create issues** one by one:
   - Check for existing (idempotency guard).
   - Create if not found.
   - Report: "Created US-101 -> #42 (https://...)".
6. **Final report** — total created, skipped (duplicates), failed, and all URLs.

---

## Quick Reference

| Task         | GitHub                   | GitLab                     | Azure DevOps                 | Jira                   | Bitbucket               |
| ------------ | ------------------------ | -------------------------- | ---------------------------- | ---------------------- | ----------------------- |
| Auth check   | `gh auth status`         | `glab auth status`         | `az account show`            | `echo $JIRA_API_TOKEN` | `echo $BITBUCKET_TOKEN` |
| Create issue | `gh issue create`        | `glab issue create`        | `az boards work-item create` | `curl POST .../issue`  | `curl POST .../issues`  |
| Search       | `gh issue list --search` | `glab issue list --search` | `az boards work-item query`  | `curl GET .../search`  | `curl GET .../issues`   |
| Labels       | `--label`                | `--label`                  | `--fields System.Tags`       | `labels` field         | `kind` + `priority`     |
