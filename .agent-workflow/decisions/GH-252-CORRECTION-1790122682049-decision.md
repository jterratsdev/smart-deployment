# Decision GH-252-CORRECTION: Implementation story points

- Status: accepted
- Owner: developer

## Context

developer completed developer

## Decision

3 points

## Consequences

Consumed context files recorded. Changed files recorded. Changed-file traceability recorded. Simplicity review recorded. Goal-to-verification map recorded. Architectural concerns recorded. Handoff summary ready. AC1 verification pending: Git-write detection safely tokenizes static shell strings and detects commit or push through exec, builtin, command, env, assignments, absolute paths, parentheses, and brace groups without false positives for status, log, diff, or prose. -> requires an observable artifact, executed command, and explicit assertion. AC2 verification pending: yarn.lock is cleanly regenerated with Node 24 and Yarn 1; ip-address@10.2.0 resolves exactly to 10.2.0 with valid resolved and integrity fields; npm-shrinkwrap remains consistent. -> requires an observable artifact, executed command, and explicit assertion. AC3 verification pending: Release-contract CI deterministically validates every versioned Yarn entry has version, resolved, and integrity and that package.json resolutions select the required versions. -> requires an observable artifact, executed command, and explicit assertion. AC4 verification pending: All QA probes, focused tests, actionlint, shellcheck, build, unit tests, NUTs, analyzer, clean install, and warranted act checks pass with lock hashes preserved across sequential checks. -> requires an observable artifact, executed command, and explicit assertion.
