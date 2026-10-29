<!-- setup-agents: 3.23.1 -->
# Update Jira Ticket

## Goal
Keep the Jira ticket synchronized with the current state of the story.

## Steps
1. Read the story context from `.setup-agents/state/`.
2. Update the Jira ticket: status, assignee, description, and acceptance criteria.
3. Add a comment summarizing what was done in this phase.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role sa --type command --summary "Update Jira Ticket completed"
```
