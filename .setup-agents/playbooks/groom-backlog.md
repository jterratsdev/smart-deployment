<!-- setup-agents: 3.16.0 -->
# Groom Backlog

## Goal
Order and prioritize backlog items by business value and technical dependency.

## Steps
1. List all open backlog items.
2. Sort by: business priority > technical dependency > effort.
3. Remove duplicates and merge overlapping stories.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ba --type file --summary "Groom Backlog completed"
```
