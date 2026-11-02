# Decision SD-MATCH-DUP-STANDARD-RULES: Implementation story points

- Status: accepted
- Owner: developer

## Context

developer completed developer

## Decision

3 points

## Consequences

Consumed context files recorded. Changed files recorded. Changed-file traceability recorded. Simplicity review recorded. Goal-to-verification map recorded. Architectural concerns recorded. Handoff summary ready. AC1 verification pending: Scanner omits an empty MatchingRules container -> requires an observable artifact, executed command, and explicit assertion. AC2 verification pending: A standard DuplicateRule reference without a local matching container remains target-owned and does not create a false dependency -> requires an observable artifact, executed command, and explicit assertion. AC3 verification pending: A missing rule in a non-empty local container remains a hard error -> requires an observable artifact, executed command, and explicit assertion. AC4 verification pending: Full cg-demo snapshot analysis advances past the standard matching-rule contract -> requires an observable artifact, executed command, and explicit assertion.
