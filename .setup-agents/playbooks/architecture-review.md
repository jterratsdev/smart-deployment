<!-- setup-agents: 3.16.0 -->
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
- [ ] Scope assessment: run `scope-assessment.md` playbook (REQUIRED for tasks ≥ m)
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

## Step 6 — Declare T-Shirt Estimate (REQUIRED before handoff)
Before closing this phase, declare a delivery estimate so benchmarks can track actual vs. baseline:

```bash
# Check if an estimate already exists (idempotent — skip if found)
sf setup-agents workflow benchmark --story <storyId>

# If no estimate exists, declare one:
sf setup-agents workflow estimate \
  --story <storyId> \
  --sizing <xxs|xs|s|m|l|xl|xxl> \
  --solo-days <n> \
  --ai-unguided-days <n> \
  --ai-guided-days <n> \
  --confidence <low|medium|high> \
  --declared-by architect
```

**Sizing scale** — human-equivalent effort days (GH-496):
| Label | Human effort |
|-------|--------------|
| xxs   | trivial, < 4 hours |
| xs    | half-day–1 day (4–8h) |
| s     | 1–2 days |
| m     | 3–5 days (≈ 1 week) |
| l     | 6–8 days |
| xl    | 9–11 days (≈ 1 sprint) |
| xxl   | 12+ days — **split gate** |

> **`xxl` is a split gate, not an estimate.** An XXL story MUST be broken into
> smaller stories (xl or below) before it can be estimated or enter a sprint.
> The estimate path refuses to budget an xxl and emits a "must split" outcome —
> never assign it a day value.

- `--solo-days`: how long a solo developer would take without AI assistance.
- `--ai-unguided-days`: how long with a generic AI assistant (no agent workflow).
- `--ai-guided-days`: how long expected with setup-agents guided workflow (profiles + orchestration). This is the ROI baseline — it becomes the denominator for `vsAiGuidedPct` in the benchmark.
- `--confidence`: your confidence in the estimate (low/medium/high).

> **Backfill:** if the estimate was already recorded without `--ai-guided-days`, re-run the command with only `--story`, `--sizing`, `--solo-days`, `--ai-unguided-days`, and `--ai-guided-days` to add the guided baseline. The log is append-only and the last record wins.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role architect --type report --summary "Architecture Review completed"
```
