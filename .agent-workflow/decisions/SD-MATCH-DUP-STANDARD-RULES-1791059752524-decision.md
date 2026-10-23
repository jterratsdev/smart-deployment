# Decision SD-MATCH-DUP-STANDARD-RULES: Story sizing

- Status: accepted
- Owner: architect

## Context

One scanner contract change, synthetic regression tests, and live snapshot rerun.

## Decision

s [2 points]

## Consequences

Empty retrieved containers are omitted; non-empty local containers retain exact fail-closed reference validation.
