<!-- setup-agents: 2.0.2 -->

# Declare Story Points

## Goal

Record the actual effort for this implementation phase so delivery benchmarks stay accurate.

## When to run

At the end of your implementation phase, before closing the task — after the work is done
and you have a clear picture of actual complexity.

## Steps

1. Assess the actual effort spent on this story:
   ```
   1 — trivial (< 1 hour, no surprises)
   2 — small   (half a day, straightforward)
   3 — medium  (1 day, some complexity)
   5 — large   (2–3 days, significant work)
   8 — very large (> 3 days — consider splitting next time)
   ```
2. Record via evidence:
   ```bash
   sf setup-agents evidence add \
     --task <id> \
     --type metric \
     --summary "story-points: <n>"
   ```
3. If the story took significantly more or less than the architect's t-shirt estimate,
   add a note explaining the delta:
   ```bash
   sf setup-agents evidence add \
     --task <id> \
     --type metric \
     --summary "story-points: <n> — delta: <reason>"
   ```
