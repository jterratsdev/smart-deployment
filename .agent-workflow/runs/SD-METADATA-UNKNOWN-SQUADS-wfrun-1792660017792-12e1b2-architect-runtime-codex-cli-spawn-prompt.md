# Runtime Child Prompt: SD-METADATA-UNKNOWN-SQUADS

- Runtime: codex-cli
- Task id: SD-METADATA-UNKNOWN-SQUADS
- Phase: architect
- Role: architect
- Session id: SD-METADATA-UNKNOWN-SQUADS:wfrun-1792660017792-12e1b2:architect:codex-cli
- Direct provider API calls: forbidden

## Goal

Coordinate seven read-only architect reviews by canonical C1-C7 metadata cluster, correlate actual plan unknowns with vendor/source/channel mappings, and produce an evidence-ranked dependency investigation backlog without deploying or editing external projects

## Acceptance Criteria

- Each C1-C7 squad reviews only its canonical candidate rows and reports exact vendor identity, source ownership, channel, dependency/barrier semantics and confidence with evidence
- Use the ~/dev project inventory as demand signal; distinguish local unresolved, verified external, target-org unknown, unsupported format and parser false positive without silently equating them
- Cross-cluster references have one canonical owner and explicit handoff, with conflicts escalated to integration architect
- Produce prioritized P0/P1/P2 mapping backlog with acceptance tests and no executable support claims without deterministic and relevant live evidence
- Read-only external projects, no org deployment, no edits to current blocked staged executor

## Ownership Paths

- docs/research/metadata-catalog

## Delegation Intent

- Intent: execute

## Allowed Commands

- bash(orchestra \*)
- npm run format
- npm run build
- npm run precommit

## Scoped CLI Capabilities

- Guidance: if an official Orchestra command applies, use the exposed capability and structured argv array before creating ad hoc scripts.
- Command construction contract: pass executable and args as separate argv entries; do not build shell strings with interpolation.

### Exposed

- architect-diagram-generate
  - commandId: diagrams-generate
  - executable: orchestra
  - argsTemplate: ["diagrams","generate","--input","<model.json>","--output","<diagram.svg>","--task","<task-id>","--retain-iterations","--json"]
  - purpose: Generate deterministic SVG diagrams from typed architecture model payloads.
  - allowedRoles: architect, technical_writer, qa
  - requiredContext: diagram model JSON path, workspace-relative SVG output path, task id when recording evidence
  - outputContract: JSON model path, SVG path, validation findings, iteration count, retained iteration artifacts, and optional evidence metadata.
  - evidenceType: file
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches
- architect-diagram-lint
  - commandId: diagrams-lint
  - executable: orchestra
  - argsTemplate: ["diagrams","lint","--file","<file>","--task","<task-id>","--json"]
  - purpose: Validate Mermaid architecture, workflow, and sequence diagrams before handoff.
  - allowedRoles: architect, developer, technical_writer
  - requiredContext: diagram artifact path, task id when recording evidence
  - outputContract: JSON lint result with validity, diagnostics, optional install hint, and evidence metadata when task is supplied.
  - evidenceType: command
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches
- architect-workflow-template-render
  - commandId: workflow-render
  - executable: orchestra
  - argsTemplate: ["workflow","render","--task","<task-id>","--phase","<phase>","--target","<runtime-target>","--json"]
  - purpose: Render official workflow template guidance for the current task and phase.
  - allowedRoles: architect, product_owner, product_manager, developer, qa
  - requiredContext: task id, phase, runtime target
  - outputContract: JSON workflow template selection and rendered guidance for scoped agent consumption.
  - evidenceType: report
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and task signals match
- release-benchmark-task
  - commandId: benchmark-task
  - executable: orchestra
  - argsTemplate: ["benchmark","--task","<task-id>","--json"]
  - purpose: Benchmark completed task effort and quality signals after delivery evidence exists.
  - allowedRoles: release_manager, qa, architect
  - requiredContext: task id, completed workflow evidence
  - outputContract: JSON benchmark result with task sizing, quality signals, and calibration data.
  - evidenceType: report
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches

### Omitted

- qa-playwright-plan (playwright-plan): omitted: role architect is not allowed
- qa-evidence-check (qa-evidence-check): omitted: role architect is not allowed
- qa-playwright-evidence (playwright-evidence): omitted: role architect is not allowed
- release-check (release-check): omitted: role architect is not allowed
- release-readiness (release-readiness): omitted: role architect is not allowed

## Context Loading Policy

- Use the Preprocessed Runtime Context bundle by default.
- Cite full source paths from the bundle when deeper inspection is required; do not load raw files unless the reduced bundle is insufficient for the assigned work.
- Preserve omitted content warnings in the handoff when they affect confidence or verification scope.

## Required Context Files

- .agent-workflow/playbooks/architect.md
  - source: phase-playbook
  - loadMode: full
  - required: true
  - sha256: 9b4bd19786c501ad458525b664167dc779d52402021fdf2be922c0f61c860225
  - reason: Required architect phase playbook for architect runtime work.
- AGENTS.md
  - source: runtime-instructions
  - loadMode: excerpt
  - required: true
  - sha256: f5eb4c28463c6b8d1f141990feca6b384e1564447103649e97d4a01b2d403441
  - reason: Required root runtime instructions for project-wide agent behavior.
- rules/development/semantic-code.md
  - source: rule
  - loadMode: full
  - required: true
  - sha256: fd93b7ee2fd98512a9aa14999b9bf5f970a245ebff153f9503821bc10fc7a7fe
  - reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.
- rules/architecture-decisions.mdc
  - source: rule
  - loadMode: full
  - required: true
  - sha256: cf81f453dda7f9614555c3a45fa039288a06d9dffd45caf5653fbea33e693897
  - reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.
- rules/module-boundaries.mdc
  - source: rule
  - loadMode: full
  - required: true
  - sha256: f39eeb5e20d6b8c990d60890a19efaaf2a019914f488a519ff12a38b28eeb9dd
  - reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.
- rules/development-engineering.mdc
  - source: rule
  - loadMode: excerpt
  - required: true
  - sha256: 9d774d70cd61c71590fd24143b776012a381c6041a60ab6523ceba74969f2b90
  - reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.

## Generated Context Pack

- unavailable: context pack requires a fresh context index: context index has not been built

## Preprocessed Runtime Context

- config.maxLinesPerFile: 80
- config.totalLineBudget: 360
- original: 194 lines / 9056 bytes
- final: 196 lines / 9220 bytes
- omittedContentWarning: One or more context files were reduced; cite source paths when full files are needed.

### .agent-workflow/playbooks/architect.md

- sourcePath: .agent-workflow/playbooks/architect.md
- strategy: passthrough
- originalSize: 5 lines / 234 bytes
- finalSize: 5 lines / 234 bytes
- omittedContentWarning: none
- reason: Required architect phase playbook for architect runtime work.

```
# Architect Playbook

- Define boundaries, data flow, integration contracts, and rollback risk.
- Prefer existing project patterns before adding abstractions.
- Record sizing and ADR-level decisions when the design has lasting impact.
```

### AGENTS.md

- sourcePath: AGENTS.md
- strategy: passthrough
- originalSize: 42 lines / 1600 bytes
- finalSize: 42 lines / 1600 bytes
- omittedContentWarning: none
- reason: Required root runtime instructions for project-wide agent behavior.

```
# Architecture Rules

This repository follows pragmatic Clean Architecture, SOLID, and separation-of-concerns rules.
These rules apply to all new code, refactors, and reviews.

## Source Of Truth

This file is the local engineering contract for agents in this repository.
Generic rule sets from other repositories can inform it, but local rules take precedence.

## Operating Mode

- Use this file as the baseline contract for all refactors, bug fixes, and delegated work in this repo.
- Load only the smallest relevant local context before changing code.
- Prefer small reviewable slices over broad cross-cutting rewrites.

## Core Principles

1. Prefer small, composable units over large multi-purpose files.
2. Keep orchestration separate from parsing, domain logic, persistence, and I/O.
3. Make dependencies point inward toward domain logic, not outward toward frameworks or CLI glue.
4. Favor explicit data flow over hidden mutation or implicit side effects.
5. Add behavior in the narrowest layer that can own it correctly.

## Layering

- `commands/` are orchestration adapters.

  - Parse flags
  - call services/pipelines
  - format user-facing output
  - do not embed domain rules, scanning logic, AI heuristics, or persistence-heavy workflows

- `services/`, `deployment/`, `dependencies/`, `waves/` contain application and domain behavior.

  - business rules belong here
  - keep files focused on one capability

- `parsers/` extract structured facts from source artifacts.

  - parsers should parse, normalize, and return structured information
  - parsers should not decide deployment
```

### rules/development/semantic-code.md

- sourcePath: rules/development/semantic-code.md
- strategy: passthrough
- originalSize: 28 lines / 1398 bytes
- finalSize: 28 lines / 1398 bytes
- omittedContentWarning: none
- reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.

```
# Semantic Code

Code must be readable by intent before it is explained by comments.

## Naming

- Use domain language for modules, functions, variables, types, and test names.
- Prefer names that reveal purpose and observable behavior, such as `validateReleaseGateEvidence`, not vague names such as `processData`.
- Boolean names must make the predicate clear: `isReady`, `hasEvidence`, `canRetry`, `shouldBlockRelease`.

## Structure

- Keep entry points thin. Move decisions and business rules into focused domain, service, or policy modules.
- Extract helpers when a reader needs comments to understand a block of code.
- Avoid generic containers in public APIs when narrow types or explicit models can describe the contract.
- Avoid hardcoded command lists, statuses, roles, labels, or fixture values when a typed registry or catalog can be the source of truth.

## Comments

- Comments explain why, trade-offs, invariants, or external constraints.
- Do not add comments that restate what the code already says.
- If a function needs line-by-line comments to be understandable, refactor the names, types, or helper boundaries.

## Review Checklist

- A reviewer can identify the domain intent from names and file boundaries without tracing every line.
- New code follows the existing project vocabulary and layering.
- Tests read like behavior specifications and use meaningful scenario names.
```

### rules/architecture-decisions.mdc

- sourcePath: rules/architecture-decisions.mdc
- strategy: passthrough
- originalSize: 27 lines / 1292 bytes
- finalSize: 27 lines / 1292 bytes
- omittedContentWarning: none
- reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.

```
---
description: Lightweight architecture decision records and design documentation
alwaysApply: true
---

# Architecture Decisions

Important architecture choices must be recorded briefly. The goal is traceability, not bureaucracy.

## When to Record an ADR
- Record an ADR when changing system boundaries, data ownership, integration contracts, authentication, authorization, infrastructure, deployment, or storage patterns.
- Record an ADR when choosing a new framework, library, cloud service, messaging pattern, database, or testing strategy.
- Record an ADR when a decision has meaningful trade-offs, migration cost, security impact, or rollback complexity.

## ADR Format
- Title: short decision name.
- Status: proposed, accepted, superseded, or rejected.
- Context: problem, constraints, and forces.
- Decision: chosen approach.
- Consequences: benefits, costs, risks, and follow-up work.
- Alternatives considered: at least one reasonable option and why it was not chosen.

## Decision Hygiene
- Keep ADRs concise and link them from PRs when relevant.
- Supersede old ADRs instead of rewriting history.
- If a decision is reversed, record why new information changed the outcome.
- Architecture decisions must align with security, testing, observability, and delivery quality gates.
```

### rules/module-boundaries.mdc

- sourcePath: rules/module-boundaries.mdc
- strategy: passthrough
- originalSize: 71 lines / 2932 bytes
- finalSize: 71 lines / 2932 bytes
- omittedContentWarning: none
- reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.

```
---
description: Module boundaries, god-file prevention, and thin adapter standards
alwaysApply: true
---

# Module Boundaries

Every code change must preserve clear ownership boundaries. Before adding code
to an existing file, check whether the file is already large, multi-purpose, or
adapter-shaped. If the change would make the file harder to review, create or
reuse the correct domain, model, service, repository, or adapter module instead.

## Pre-Write Check

- Inspect the target file's current responsibility, exported surface, and size
  before editing.
- Treat files over 300 lines, functions over 30 lines, and command/controller
  files with business logic as god-file risk.
- A large existing file is not a reason to keep adding to it. If the new change
  is separable, extract the new behavior into a focused module and wire it from
  the existing entry point.
- If extraction is unsafe in the current task, record a follow-up debt task with
  the reason, affected file, and proposed boundary.

## Expected Layers

- `model` or `types`: narrow public data contracts, discriminated unions,
  schemas, and DTOs.
- `domain`: pure invariants, policy decisions, validation rules, state
  transitions, and calculations.
- `service` or `use-case`: orchestration of domain logic, repositories, clients,
  and side effects for one workflow.
- `repository`, `store`, or `gateway`: persistence, file I/O, network I/O, and
  external system adapters.
- `commands`: CLI adapter only. Parse arguments, call services, format output,
  and convert errors to user-safe messages.
- `web` or `api`: HTTP/UI adapter only. Parse requests, call services, serialize
  responses, and map errors.

## Logicless Commands

Command modules must remain nearly logicless. They may:

- parse flags and positional arguments;
- choose output format;
- call one service/use-case function;
- map expected errors to CLI messages and exit codes.

Command modules must not:

- own business rules or workflow policy;
- perform direct persistence when a repository/service should own it;
- contain repeated hardcoded registries, option lists, status sets, or provider
  matrices;
- implement complex loops, joins, retries, or batching;
- become the primary test target for domain behavior.

## Hardcoded Collections

Repeated hardcoded values must move to a typed source of truth. This applies to
roles, statuses, providers, commands, option lists, validators, selectors,
fixtures, CI matrices, and any key/value collection reused by more than one
consumer. Load `collection-standards` when this risk appears.

## Review Checklist

- Did the author check target file size and responsibility before writing?
- Did new logic land in the correct layer?
- Is the command/controller/route still a thin adapter?
- Are repeated hardcoded collections extracted to a typed source of truth?
- Is there a follow-up debt task when extraction was intentionally deferred?
```

### rules/development-engineering.mdc

- sourcePath: rules/development-engineering.mdc
- strategy: passthrough
- originalSize: 21 lines / 1600 bytes
- finalSize: 21 lines / 1600 bytes
- omittedContentWarning: none
- reason: Required architect rule selected from the neutral rule catalog for role-specific execution quality.

```
---
description: Stack-agnostic developer implementation standards across common application stacks
alwaysApply: true
---

# Development Engineering

Developer work must start from the existing project shape, preserve the local architecture, and leave verifiable evidence that the changed production artifact works.

## Project Context First
- Read the project manifest, build files, framework config, and existing module boundaries before generating code.
- Infer naming, layering, dependency direction, error style, logging style, and test conventions from nearby code.
- Do not introduce a new framework pattern, repository style, package layout, or dependency injection approach without a recorded architecture decision.
- Keep framework-specific adapters at the boundary. Domain and service code should remain portable where the product permits it.
- Before writing to an existing file, run a module-boundary check: current file size, responsibility, exported surface, and whether the new behavior belongs in domain, model, service, repository, or adapter code.
- Do not increase god-file risk. If a file is already large, multi-purpose, or adapter-shaped, prefer adding a focused module and wiring it from the existing entry point instead of adding more logic.

## Entry Points And Layers
- Controllers, routes, commands, triggers, handlers, jobs, and webhooks must stay thin.
- Delegate business rules to services or domain modules, and delegate I/O to repositories, clients, gateways, or data-access modules.
- Keep request parsing, authorization, validation, orchestration, and persistence r
```

### docs/research/metadata-catalog

- sourcePath: docs/research/metadata-catalog
- strategy: directory-reference
- originalSize: 0 lines / 0 bytes
- finalSize: 2 lines / 164 bytes
- omittedContentWarning: Directory source was referenced without reading raw directory contents.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
Directory reference: docs/research/metadata-catalog
Raw directory contents were not loaded into runtime context. Inspect targeted files under this path when needed.
```

## Loaded Context Excerpts

### .agent-workflow/playbooks/architect.md

```md
# Architect Playbook

- Define boundaries, data flow, integration contracts, and rollback risk.
- Prefer existing project patterns before adding abstractions.
- Record sizing and ADR-level decisions when the design has lasting impact.
```

### AGENTS.md

```md
# Architecture Rules

This repository follows pragmatic Clean Architecture, SOLID, and separation-of-concerns rules.
These rules apply to all new code, refactors, and reviews.

## Source Of Truth

This file is the local engineering contract for agents in this repository.
Generic rule sets from other repositories can inform it, but local rules take precedence.

## Operating Mode

- Use this file as the baseline contract for all refactors, bug fixes, and delegated work in this repo.
- Load only the smallest relevant local context before changing code.
- Prefer small reviewable slices over broad cross-cutting rewrites.

## Core Principles

1. Prefer small, composable units over large multi-purpose files.
2. Keep orchestration separate from parsing, domain logic, persistence, and I/O.
3. Make dependencies point inward toward domain logic, not outward toward frameworks or CLI glue.
4. Favor explicit data flow over hidden mutation or implicit side effects.
5. Add behavior in the narrowest layer that can own it correctly.

## Layering

- `commands/` are orchestration adapters.

  - Parse flags
  - call services/pipelines
  - format user-facing output
  - do not embed domain rules, scanning logic, AI heuristics, or persistence-heavy workflows

- `services/`, `deployment/`, `dependencies/`, `waves/` contain application and domain behavior.

  - business rules belong here
  - keep files focused on one capability

- `parsers/` extract structured facts from source artifacts.

  - parsers should parse, normalize, and return structured information
  - parsers should not decide deployment
```

### rules/development/semantic-code.md

```md
# Semantic Code

Code must be readable by intent before it is explained by comments.

## Naming

- Use domain language for modules, functions, variables, types, and test names.
- Prefer names that reveal purpose and observable behavior, such as `validateReleaseGateEvidence`, not vague names such as `processData`.
- Boolean names must make the predicate clear: `isReady`, `hasEvidence`, `canRetry`, `shouldBlockRelease`.

## Structure

- Keep entry points thin. Move decisions and business rules into focused domain, service, or policy modules.
- Extract helpers when a reader needs comments to understand a block of code.
- Avoid generic containers in public APIs when narrow types or explicit models can describe the contract.
- Avoid hardcoded command lists, statuses, roles, labels, or fixture values when a typed registry or catalog can be the source of truth.

## Comments

- Comments explain why, trade-offs, invariants, or external constraints.
- Do not add comments that restate what the code already says.
- If a function needs line-by-line comments to be understandable, refactor the names, types, or helper boundaries.

## Review Checklist

- A reviewer can identify the domain intent from names and file boundaries without tracing every line.
- New code follows the existing project vocabulary and layering.
- Tests read like behavior specifications and use meaningful scenario names.
```

### rules/architecture-decisions.mdc

```md
---
description: Lightweight architecture decision records and design documentation
alwaysApply: true
---

# Architecture Decisions

Important architecture choices must be recorded briefly. The goal is traceability, not bureaucracy.

## When to Record an ADR

- Record an ADR when changing system boundaries, data ownership, integration contracts, authentication, authorization, infrastructure, deployment, or storage patterns.
- Record an ADR when choosing a new framework, library, cloud service, messaging pattern, database, or testing strategy.
- Record an ADR when a decision has meaningful trade-offs, migration cost, security impact, or rollback complexity.

## ADR Format

- Title: short decision name.
- Status: proposed, accepted, superseded, or rejected.
- Context: problem, constraints, and forces.
- Decision: chosen approach.
- Consequences: benefits, costs, risks, and follow-up work.
- Alternatives considered: at least one reasonable option and why it was not chosen.

## Decision Hygiene

- Keep ADRs concise and link them from PRs when relevant.
- Supersede old ADRs instead of rewriting history.
- If a decision is reversed, record why new information changed the outcome.
- Architecture decisions must align with security, testing, observability, and delivery quality gates.
```

### rules/module-boundaries.mdc

```md
---
description: Module boundaries, god-file prevention, and thin adapter standards
alwaysApply: true
---

# Module Boundaries

Every code change must preserve clear ownership boundaries. Before adding code
to an existing file, check whether the file is already large, multi-purpose, or
adapter-shaped. If the change would make the file harder to review, create or
reuse the correct domain, model, service, repository, or adapter module instead.

## Pre-Write Check

- Inspect the target file's current responsibility, exported surface, and size
  before editing.
- Treat files over 300 lines, functions over 30 lines, and command/controller
  files with business logic as god-file risk.
- A large existing file is not a reason to keep adding to it. If the new change
  is separable, extract the new behavior into a focused module and wire it from
  the existing entry point.
- If extraction is unsafe in the current task, record a follow-up debt task with
  the reason, affected file, and proposed boundary.

## Expected Layers

- `model` or `types`: narrow public data contracts, discriminated unions,
  schemas, and DTOs.
- `domain`: pure invariants, policy decisions, validation rules, state
  transitions, and calculations.
- `service` or `use-case`: orchestration of domain logic, repositories, clients,
  and side effects for one workflow.
- `repository`, `store`, or `gateway`: persistence, file I/O, network I/O, and
  external system adapters.
- `commands`: CLI adapter only. Parse arguments, call services, format output,
  and convert errors to user-safe messages.
- `web` or `api`: HTTP/UI adapter only. Parse requests, call services, serialize
  responses, and map errors.

## Logicless Commands

Command modules must remain nearly logicless. They may:

- parse flags and positional arguments;
- choose output format;
- call one service/use-case function;
- map expected errors to CLI messages and exit codes.

Command modules must not:

- own business rules or workflow policy;
- perform direct persistence when a repository/service should own it;
- contain repeated hardcoded registries, option lists, status sets, or provider
  matrices;
- implement complex loops, joins, retries, or batching;
- become the primary test target for domain behavior.

## Hardcoded Collections

Repeated hardcoded values must move to a typed source of truth. This applies to
roles, statuses, providers, commands, option lists, validators, selectors,
fixtures, CI matrices, and any key/value collection reused by more than one
consumer. Load `collection-standards` when this risk appears.

## Review Checklist

- Did the author check target file size and responsibility before writing?
- Did new logic land in the correct layer?
- Is the command/controller/route still a thin adapter?
- Are repeated hardcoded collections extracted to a typed source of truth?
- Is there a follow-up debt task when extraction was intentionally deferred?
```

### rules/development-engineering.mdc

```md
---
description: Stack-agnostic developer implementation standards across common application stacks
alwaysApply: true
---

# Development Engineering

Developer work must start from the existing project shape, preserve the local architecture, and leave verifiable evidence that the changed production artifact works.

## Project Context First

- Read the project manifest, build files, framework config, and existing module boundaries before generating code.
- Infer naming, layering, dependency direction, error style, logging style, and test conventions from nearby code.
- Do not introduce a new framework pattern, repository style, package layout, or dependency injection approach without a recorded architecture decision.
- Keep framework-specific adapters at the boundary. Domain and service code should remain portable where the product permits it.
- Before writing to an existing file, run a module-boundary check: current file size, responsibility, exported surface, and whether the new behavior belongs in domain, model, service, repository, or adapter code.
- Do not increase god-file risk. If a file is already large, multi-purpose, or adapter-shaped, prefer adding a focused module and wiring it from the existing entry point instead of adding more logic.

## Entry Points And Layers

- Controllers, routes, commands, triggers, handlers, jobs, and webhooks must stay thin.
- Delegate business rules to services or domain modules, and delegate I/O to repositories, clients, gateways, or data-access modules.
- Keep request parsing, authorization, validation, orchestration, and persistence r
```

## Primary Skill Context

### PR Review

- ID: pr-review
- Entry: skills/pr-review/SKILL.md
- Load budget: normal
- Rationale: eligible task roles: architect; task text matches triggers: pr, review
- Instructions:
  - Review behavior, tests, risks, rollout, rollback, and missing evidence before summaries.
  - Lead with findings and blockers, then summarize changes.
  - Reference local files, task context, reviews, and evidence rather than generated claims.
- Evidence:
  - file
  - report

### Proactive Orchestra

- ID: proactive-orchestra
- Entry: skills/proactive-orchestra/SKILL.md
- Load budget: small
- Rationale: eligible task roles: architect; task text matches triggers: handoff, evidence
- Instructions:
  - Start with health and task list before implementation when .agent-workflow exists.
  - Run pre-run validation before coding and resolve missing estimate, workflow, evidence, or review checks.
  - Record user-accepted deviations as decisions instead of silently skipping workflow steps.
- Evidence:
  - command
  - report
  - file

### Source of Truth

- ID: source-of-truth
- Entry: skills/source-of-truth/SKILL.md
- Load budget: small
- Rationale: eligible task roles: architect; task text matches triggers: source, docs
- Instructions:
  - Select source groups before acting and load only sources relevant to the task.
  - Prefer local project sources first and official vendor docs for current APIs or tools.
  - If sources conflict, record the conflict as a blocker or decision.
- Evidence:
  - file
  - report

### Doc Sync

- ID: doc-sync
- Entry: skills/doc-sync/SKILL.md
- Load budget: normal
- Rationale: eligible task roles: architect; task text matches triggers: docs
- Instructions:
  - Identify changed behavior, architecture, release surface, workflows, commands, and user-facing copy from the task, issue, diff, and evidence.
  - Update the smallest authoritative documentation surfaces for the audience: README, CHANGELOG, docs, prompt registers, and public site.
  - Update .generated-prompts/code.md or .generated-prompts/services.md after substantial class, model, service, controller, or module changes.
  - Update .generated-prompts/docs.md or .generated-prompts/diagrams.md after substantial docs, architecture, ADR, runbook, changelog, or Mermaid changes.
  - Run `orchestra doc-sync audit --task <id>` before handoff to detect missing documentation prompt registry entries and lesson capture opportunities.
  - Validate command examples against the command manifest, help output, or repo-local CLI before publishing documentation.
- Evidence:
  - file
  - report
  - command

### Prompt Registry

- ID: prompt-registry
- Entry: skills/prompt-registry/SKILL.md
- Load budget: small
- Rationale: task text matches triggers: ui, docs; task touches files, so prompt registry can preserve artifact intent
- Instructions:
  - Before substantial generation, read the relevant .generated-prompts register.
  - After substantial changes, update one entry with task, role, decisions, evidence, and prompt summary.
  - Do not update the register for typo-only, formatting-only, or single-line mechanical fixes.
- Evidence:
  - file

### QA Evidence Pack

- ID: qa-evidence-pack
- Entry: skills/qa-evidence-pack/SKILL.md
- Load budget: normal
- Rationale: eligible task roles: architect; task text matches triggers: integration
- Instructions:
  - Map every acceptance criterion to automated, manual, contract/mock, external verification, or deferred evidence with owner and rationale.
  - Capture observable outcomes: web visible state and artifacts, CLI exit/stdout/stderr/final state, API contracts and side effects, and integration receiver evidence.
  - For E2E work, validate the complete functional and integration journey instead of isolated command success; include setup, execution, state transition, final artifact, and acceptance-criteria mapping.
  - For generated skills, rules, runtime guidance, or Markdown artifacts, assert the runtime context, generated file paths, managed metadata, target-specific content, refresh/drift behavior, user-content preservation, and absence of wrong-target content.
  - For visual defects, attach source or expected image, actual image, diff when practical, and an annotated screenshot with concise overlays that identify the defect.
  - Store large evidence artifacts as files and reference paths from a compact report instead of pasting raw logs into agent context.
- Evidence:
  - command
  - file
  - screenshot
  - trace
  - video
  - log
  - report

### Static Analysis

- ID: static-analysis
- Entry: skills/static-analysis/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: dependency, test
- Instructions:
  - Inspect configured local checks before inventing commands.
  - Run the smallest relevant check first, then the full gate before handoff or commit.
  - Record command evidence and treat failed required checks as blockers unless explicitly deferred.
- Evidence:
  - command
  - report

### Backlog Sync

- ID: backlog-sync
- Entry: skills/backlog-sync/SKILL.md
- Load budget: small
- Rationale: task text matches triggers: backlog
- Instructions:
  - Confirm backlog IDs and acceptance criteria before implementation.
  - Keep local tasks, docs, and GitHub issues aligned when one changes.
  - Surface missing refinement as a blocker instead of guessing scope.
- Evidence:
  - file
  - report

### Collection Standards

- ID: collection-standards
- Entry: skills/collection-standards/SKILL.md
- Load budget: small
- Rationale: task text matches triggers: map
- Instructions:
  - If the same collection, mapping, option list, fixture set, command matrix, provider list, role/status list, selector list, or validator set appears in more than one place, replace duplicates with a typed source of truth.
  - Choose the smallest source-of-truth shape that fits the codebase: exported constant, enum-like union, registry, builder, factory, fixture helper, page object, or config-derived adapter.
  - Derive arrays, maps, dropdown options, validators, test fixtures, script arguments, CI matrices, and docs/examples from that source instead of maintaining parallel hardcoded lists.
  - For joins, lookups, assertions, log scans, API payload checks, and command matrices, prefer O(n) or bounded processing by building lookup maps or indexes once; avoid nested scans, repeated full-list filters, N+1 calls, and unbounded synchronous work.
  - If higher complexity is intentional, document the input bound or measured trade-off and include regression evidence with representative multi-item data.
- Evidence:
  - file
  - command
  - report

### Playwright Evidence

- ID: playwright-evidence
- Entry: skills/playwright-evidence/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: ui
- Instructions:
  - Plan user-value scenarios from acceptance criteria before writing tests.
  - Use resilient locators and page objects for repeated flows.
  - Attach screenshots, traces, videos, or reports as evidence for release decisions.
- Evidence:
  - screenshot
  - trace
  - video
  - report

### Release Readiness

- ID: release-readiness
- Entry: skills/release-readiness/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: deploy
- Instructions:
  - Validate gates, evidence, locks, reviews, rollback, observability, and support readiness.
  - Treat missing rollback or unresolved critical QA/security/SRE findings as blockers.
  - Record release evidence and accepted residual risks explicitly.
- Evidence:
  - command
  - report
  - file

## Workflow Template Guidance

### Architecture Decision

Discuss and record architecture before substantial work.

- Roles: architect, tech_lead, product_owner
- Inputs: context, constraints, options
- Outputs: ADR, decision, tradeoff analysis
- Evidence: file
- Gates: architecture
- Missing evidence: file

Steps:

- Compare options and record the approved ADR.

## Phase Playbook: architect

Source: .agent-workflow/playbooks/architect.md

# Architect Playbook

- Define boundaries, data flow, integration contracts, and rollback risk.
- Prefer existing project patterns before adding abstractions.
- Record sizing and ADR-level decisions when the design has lasting impact.

## Return Contract

- Write or summarize result evidence for .agent-workflow/handoffs/SD-METADATA-UNKNOWN-SQUADS-wfrun-1792660017792-12e1b2-architect-architect-runtime-handoff.md.
- Start the result artifact with these exact metadata lines:
  - Task id: SD-METADATA-UNKNOWN-SQUADS
  - Phase: architect
  - Role: architect
  - Runtime: codex-cli
  - Session id: SD-METADATA-UNKNOWN-SQUADS:wfrun-1792660017792-12e1b2:architect:codex-cli
- Include touched files, commands run, pass/fail result, risks, and close status.
- Include a `Consumed Context Files` section listing required files read, applied rules, and required rules that were not applicable with reasons.
- Include a `Test Scenarios and Expected Results` section with the target surface or environment (cloud, database, CLI, API, web app, mobile app, desktop app, workflow/runtime, integration, generated artifact, or local sandbox), the expected observable result for each scenario, and how the result was obtained.
- Critically state whether the produced evidence satisfies each acceptance criterion; mark gaps, weak evidence, or environment limitations as release-blocking unless the Product Owner explicitly accepts the risk.
- If a required context file was missing or not used, mark the handoff as changes/block with concrete impact.

## Lifecycle Self-Report

- After writing .agent-workflow/handoffs/SD-METADATA-UNKNOWN-SQUADS-wfrun-1792660017792-12e1b2-architect-architect-runtime-handoff.md, run: orchestra runtime spawn-lifecycle --session SD-METADATA-UNKNOWN-SQUADS:wfrun-1792660017792-12e1b2:architect:codex-cli --status completed --agent-id codex-cli:child --artifact .agent-workflow/handoffs/SD-METADATA-UNKNOWN-SQUADS-wfrun-1792660017792-12e1b2-architect-architect-runtime-handoff.md
- If blocked or failed before completion, run: orchestra runtime spawn-lifecycle --session SD-METADATA-UNKNOWN-SQUADS:wfrun-1792660017792-12e1b2:architect:codex-cli --status failed --agent-id codex-cli:child --summary "<safe failure summary>"
- If this runtime cannot execute shell commands, include the exact lifecycle command in the final runtime notification so the parent or watcher can reconcile it.
