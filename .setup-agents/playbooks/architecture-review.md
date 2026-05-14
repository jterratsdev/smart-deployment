<!-- setup-agents: 2.0.2 -->

# Architecture Review

## Goal

Validate that the proposed solution meets non-functional requirements and delegate implementation to the correct domain profile.

## Step 0 — Identify the implementor profile (CRITICAL)

Before closing this phase, read `.setup-agents/config.json` and identify which profile owns implementation:

```bash
cat .setup-agents/config.json | grep -A20 '"profiles"'
```

The implementor is the first active profile that is NOT `pm`, `ba`, `architect`, `qa`, or `devops`.
Common values: `cgcloud`, `admin`, `service`, `commerce`, `crma`, `developer`, etc.
Include the resolved profile in the handoff summary so the pipeline creates the task with the correct role.

## Checklist

- [ ] Scalability: handles expected load (1 to N records)
- [ ] Security: sharing model correct, no hardcoded credentials
- [ ] Maintainability: follows existing patterns, no mega-classes
- [ ] Testability: >90% coverage achievable
- [ ] Integration: no tight coupling to external systems
- [ ] Implementor profile identified and declared in handoff

## Steps

1. Read the story and proposed design.
2. Identify the implementor profile (Step 0 above).
3. Walk through the checklist.
4. List any blockers or required changes.
5. Declare delivery estimate (Step 6 below).
6. Record evidence: `sf setup-agents evidence add --task <id> --type review --summary "Architecture review complete — implementor: <profile>"`

## Step 6 — Declare T-Shirt Estimate (REQUIRED before handoff)

Before closing this phase, declare a delivery estimate so benchmarks can track actual vs. baseline:

```bash
# Check if an estimate already exists (idempotent — skip if found)
sf setup-agents workflow benchmark --story <storyId>

# If no estimate exists, declare one:
sf setup-agents workflow estimate \
  --story <storyId> \
  --sizing <xs|s|m|l|xl> \
  --solo-days <n> \
  --ai-unguided-days <n> \
  --confidence <low|medium|high> \
  --declared-by architect
```

**Sizing scale:**
| Label | Solo effort |
|-------|------------|
| xs | ≤ 0.5 days |
| s | ≤ 1 day |
| m | ≤ 3 days |
| l | ≤ 5 days |
| xl | > 5 days |

- `--solo-days`: how long a solo developer would take without AI assistance.
- `--ai-unguided-days`: how long with a generic AI assistant (no agent workflow).
- `--confidence`: your confidence in the estimate (low/medium/high).
