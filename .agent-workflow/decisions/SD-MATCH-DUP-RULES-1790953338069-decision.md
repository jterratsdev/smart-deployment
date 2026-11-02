# Decision SD-MATCH-DUP-RULES: Implementation story points

- Status: accepted
- Owner: developer

## Context

developer completed developer

## Decision

3 points

## Consequences

Consumed context files recorded. Changed files recorded. Changed-file traceability recorded. Simplicity review recorded. Goal-to-verification map recorded. Architectural concerns recorded. Handoff summary ready. AC1 verification pending: Run parser/scanner tests that produce canonical MatchingRules and DuplicateRule nodes with typed object, field and matching-rule dependencies -> requires an observable artifact, executed command, and explicit assertion. AC2 verification pending: Run wave tests that assert CustomObject and CustomField precede MatchingRules and DuplicateRule follows MatchingRules -> requires an observable artifact, executed command, and explicit assertion. AC3 verification pending: Run execution tests that assert active matching rules with dependent duplicate rules pause at a resumable readiness checkpoint before DuplicateRule deployment -> requires an observable artifact, executed command, and explicit assertion. AC4 verification pending: Run manifest tests for exact MatchingRules and DuplicateRule transport identities and destructive guards -> requires an observable artifact, executed command, and explicit assertion. AC5 verification pending: Run yarn compile, yarn lint and yarn test:only successfully -> requires an observable artifact, executed command, and explicit assertion.
