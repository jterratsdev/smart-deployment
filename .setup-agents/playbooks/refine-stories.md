<!-- setup-agents: 3.16.0 -->
# Refine Stories

## Goal
Ensure stories have clear acceptance criteria before entering development.

## Steps
1. Read each story in scope.
2. Verify: title, description, acceptance criteria, and out-of-scope section are present.
3. Add missing acceptance criteria using Gherkin: `Given / When / Then`.
4. Flag stories that need Product Owner clarification.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role ba --type file --summary "Refine Stories completed"
```
