<!-- setup-agents: 2.0.2 -->

# Architecture Decision Record (ADR)

## Goal

Document a significant architectural decision.

## ADR Template

```markdown
# ADR-NNN: <Title>

## Status

Proposed | Accepted | Deprecated

## Context

<What is the issue motivating this decision?>

## Decision

<What is the change being made?>

## Consequences

<What are the trade-offs and downstream impacts?>
```

## Steps

1. Identify the decision to record.
2. Fill in the ADR template above.
3. Write to `docs/adr/ADR-NNN-<slug>.md`.
4. Record evidence: `sf setup-agents evidence add --task <id> --type file --summary "ADR written: docs/adr/ADR-NNN.md"`
