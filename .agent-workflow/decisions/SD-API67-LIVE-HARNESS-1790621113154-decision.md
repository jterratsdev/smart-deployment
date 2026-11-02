# Decision SD-API67-LIVE-HARNESS: Implementation story points

- Status: accepted
- Owner: developer

## Context

developer completed developer

## Decision

3 points

## Consequences

Consumed context files recorded. Changed files recorded. Changed-file traceability recorded. Simplicity review recorded. Goal-to-verification map recorded. Architectural concerns recorded. Handoff summary ready. AC1 verification pending: API 67 is the single recommended and maximum tested API version -> requires an observable artifact, executed command, and explicit assertion. AC2 verification pending: API 67 metadata validation emits no newer-than-tested warning while API 68 still does -> requires an observable artifact, executed command, and explicit assertion. AC3 verification pending: An opt-in live harness links a clean plugin, validates, dry-runs, deploys and executes uniquely named Apex metadata, cleans it in all paths, and restores the prior plugin -> requires an observable artifact, executed command, and explicit assertion. AC4 verification pending: Normal CI and tests require no org credentials -> requires an observable artifact, executed command, and explicit assertion.
