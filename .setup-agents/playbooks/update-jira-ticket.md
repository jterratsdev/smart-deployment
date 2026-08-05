<!-- setup-agents: 3.16.0 -->
# Update Jira Ticket

## Goal
Keep the Jira ticket synchronized with the current state of the story.

## Steps
1. Read the story context from `.setup-agents/state/`.
2. Update the Jira ticket: status, assignee, description, and acceptance criteria.
3. Add a comment summarizing what was done in this phase.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ba --type command --summary "Update Jira Ticket completed"
```
