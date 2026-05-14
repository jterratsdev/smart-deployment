<!-- setup-agents: 2.0.2 -->

# Update Jira Ticket

## Goal

Keep the Jira ticket synchronized with the current state of the story.

## Steps

1. Read the story context from `.setup-agents/state/`.
2. Update the Jira ticket: status, assignee, description, and acceptance criteria.
3. Add a comment summarizing what was done in this phase.
4. Record evidence: `sf setup-agents evidence add --task <id> --type deploy --summary "Jira ticket updated"`
