<!-- setup-agents: 3.16.0 -->
# Delivery Metrics

## Goal
Track velocity, cycle time, and completion rate for the sprint.

## Steps
1. Count stories completed vs. planned.
2. Calculate average cycle time (days from start to done).
3. Note blockers that caused delay.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role pm --type file --summary "Delivery Metrics completed"
```
