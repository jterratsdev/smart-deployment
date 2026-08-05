<!-- setup-agents: 3.16.0 -->
# Risk Register

## Goal
Document known risks and their mitigations.

## Format
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| ...  | High/Med/Low | High/Med/Low | ... |

## Steps
1. Identify risks from backlog items, dependencies, and team input.
2. Fill in the table above.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role pm --type file --summary "Risk Register completed"
```
