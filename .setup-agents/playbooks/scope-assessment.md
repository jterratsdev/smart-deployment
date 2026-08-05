<!-- setup-agents: 3.16.0 -->
# Scope Assessment & Split Decision

## Goal
Evaluate task scope and complexity before developer handoff. Flag oversized or cross-cutting tasks for split.

## When to Run
REQUIRED before every architect→developer handoff. This ensures cross-cutting work is identified early.

## Step 1 — Measure Scope
Count the affected boundaries:
- How many directories/packages are touched?
- How many object types (Apex, LWC, Flow, metadata, config)?
- Does it cross module boundaries (e.g. force-app + scripts + CI)?

## Step 2 — Complexity Signals
Check for these red flags:
- [ ] Touches 3+ top-level directories → likely cross-cutting
- [ ] Requires changes to both backend (Apex) and frontend (LWC/Aura)
- [ ] Involves both schema changes and code changes
- [ ] Estimated > 3 days solo effort (sizing m or above)
- [ ] Multiple integration points or external system changes

## Step 3 — Split Decision
Based on scope:

**If 2+ red flags are present:**
1. Recommend splitting into child stories.
2. List proposed child tasks with clear boundaries.
3. Record decision: \`sf setup-agents decision add --task <id> --owner architect --title "Split: <reason>" --decision "Split into N child stories" --context "<scope details>" --consequences "Parallel delivery possible" --status accepted\`

**If scope is acceptable (0-1 red flags):**
1. Explicitly document: "Scope assessed — single story acceptable."
2. Record decision: \`sf setup-agents decision add --task <id> --owner architect --title "Scope assessment" --decision "No split needed" --context "<brief justification>" --consequences "Proceed as single story" --status accepted\`

## Step 4 — Record Evidence
\`\`\`bash
sf setup-agents evidence add --task <id> --role architect --type report \\
  --summary "Scope assessment: <N> boundaries, <N> red flags, decision: <split|no-split>"
\`\`\`

## Anti-patterns (DO NOT)
- Do NOT handoff with "gaps: none, risks: none" without running this assessment
- Do NOT skip this for tasks estimated ≥ m (3+ days)
- Do NOT use generic text — always include specific boundary count and decision

## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type file --summary "Scope Assessment & Split Decision completed"
```
