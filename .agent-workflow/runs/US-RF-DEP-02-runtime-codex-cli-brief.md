# Runtime Execution Brief: US-RF-DEP-02

- Runtime: Codex CLI (codex-cli)
- Owner role: architect
- Mode: brief-only
- Direct provider API calls: forbidden
- Context tokens: 4351/2500
- Context trimmed: true

## Goal

Split dependency-resolver into staged resolution, optional dependency handling, managed package handling, validation/classification, and topological ordering.

## Scope

Owning files: src/dependencies/dependency-resolver.ts and test/unit/dependencies/dependency-resolver.test.ts. Non-goals: no graph format changes and no behavior change in optional or managed dependency semantics.

## Paths

- src/dependencies/dependency-resolver.ts
- test/unit/dependencies/dependency-resolver.test.ts

## Acceptance Criteria

- Resolver reads as a staged pipeline; includeOptional and skipManaged behavior stays stable; output contract remains unchanged.

## Required Workflow

- Load Orchestra context before editing.
- Respect locks and file ownership.
- Make code changes locally in this workspace.
- Run focused tests first, then `npm run precommit` before handoff.
- Record evidence and handoff back to Orchestra.
- Use `orchestra commands manifest --json` for supported commands and flags.

## Selected Skills

- static-analysis: task text matches triggers: dependency, test
- diagram-export: owner role matches architect
- doc-sync: owner role matches architect
- model-evaluation: owner role matches architect
- pr-review: owner role matches architect
- proactive-orchestra: owner role matches architect
- prompt-registry: task text matches triggers: ui; task touches files, so prompt registry can preserve artifact intent
- source-of-truth: owner role matches architect
- playwright-evidence: task text matches triggers: ui

## Compact Memory

- Hook: before_implementation
- Role: architect
- Estimated tokens: 202/900
- Sections: lessons kept=0 omitted=0; prompts kept=0 omitted=0

### Relevant Lessons

- none

### Prompt Registry

- none

## Active Locks

- none active

## Delegation Decision

- Recommendation: single_delegate
- Disjoint write scopes: true
- architect: execute over src/dependencies/dependency-resolver.ts, test/unit/dependencies/dependency-resolver.test.ts

## Runtime Guidance

Render a task brief or delegation packet for Codex to execute locally without vendor API keys in Orchestra.
