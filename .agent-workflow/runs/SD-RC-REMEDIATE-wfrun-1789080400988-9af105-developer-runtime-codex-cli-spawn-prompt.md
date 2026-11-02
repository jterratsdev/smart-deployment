# Runtime Child Prompt: SD-RC-REMEDIATE

- Runtime: codex-cli
- Task id: SD-RC-REMEDIATE
- Phase: developer
- Role: developer
- Session id: SD-RC-REMEDIATE:wfrun-1789080400988-9af105:developer:codex-cli
- Direct provider API calls: forbidden

## Goal

Resolve runtime audit findings, establish one 1.6.0-compatible release authority, correct repository metadata, integrate the accepted RC fixes, and produce a merge-ready release candidate without publishing

## Acceptance Criteria

- none declared

## Ownership Paths

- package.json
- npm-shrinkwrap.json
- yarn.lock
- .github/workflows/publish-npm.yml
- .releaserc.json

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
- qa-playwright-plan
  - commandId: playwright-plan
  - executable: orchestra
  - argsTemplate: ["playwright","plan","--task","<task-id>","--json"]
  - purpose: Plan Playwright scenarios for browser-based E2E, smoke, and regression validation.
  - allowedRoles: qa, developer
  - requiredContext: task id, acceptance criteria
  - outputContract: JSON scenario plan mapped to task acceptance criteria and target surfaces.
  - evidenceType: report
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches
- qa-evidence-check
  - commandId: qa-evidence-check
  - executable: orchestra
  - argsTemplate: ["qa","evidence-check","--surface","<surface>","--type","<type>","--path","<file>","--json"]
  - purpose: Validate observable QA evidence shape before recording or handing it off.
  - allowedRoles: qa, developer, release_manager
  - requiredContext: surface, evidence type, artifact path or command result
  - outputContract: JSON evidence validation status with missing fields and deferred evidence guidance.
  - evidenceType: report
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches
- qa-playwright-evidence
  - commandId: playwright-evidence
  - executable: orchestra
  - argsTemplate: ["playwright","evidence","--task","<task-id>","--kind","<kind>","--path","<file>","--summary","<summary>"]
  - purpose: Attach screenshots, traces, videos, or reports from Playwright validation to the workflow evidence stream.
  - allowedRoles: qa, developer
  - requiredContext: task id, artifact kind, artifact path, evidence summary
  - outputContract: Recorded workflow evidence artifact reference for browser validation evidence.
  - evidenceType: screenshot
  - riskLevel: low
  - approvalPolicy: none
  - reason: exposed: role allowed and phase matches
- release-check
  - commandId: release-check
  - executable: orchestra
  - argsTemplate: ["release","check","--json"]
  - purpose: Check current release readiness gates before a release decision.
  - allowedRoles: release_manager, qa, developer
  - requiredContext: workspace release state, recorded evidence and reviews
  - outputContract: JSON release readiness status with blockers, warnings, and checked gates.
  - evidenceType: command
  - riskLevel: medium
  - approvalPolicy: workflow-gate
  - reason: exposed: role allowed and task signals match

### Omitted

- architect-diagram-generate (diagrams-generate): omitted: role developer is not allowed
- release-readiness (release-readiness): omitted: role developer is not allowed
- release-benchmark-task (benchmark-task): omitted: role developer is not allowed

## Context Loading Policy

- Use the Preprocessed Runtime Context bundle by default.
- Cite full source paths from the bundle when deeper inspection is required; do not load raw files unless the reduced bundle is insufficient for the assigned work.
- Preserve omitted content warnings in the handoff when they affect confidence or verification scope.

## Required Context Files

- .agent-workflow/playbooks/developer.md
  - source: phase-playbook
  - loadMode: full
  - required: true
  - sha256: 7f1dcd3f8e0977f6051151616d71d7fddfed953c6d1372ac3069d17454767a40
  - reason: Required developer phase playbook for developer runtime work.
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
  - reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.
- rules/development-engineering.mdc
  - source: rule
  - loadMode: excerpt
  - required: true
  - sha256: 9d774d70cd61c71590fd24143b776012a381c6041a60ab6523ceba74969f2b90
  - reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.
- rules/dry-clean-code.mdc
  - source: rule
  - loadMode: full
  - required: true
  - sha256: 72ca6b2c89b8254cc8c8d02733e6c2810508a90687b9eed7bf0cb4052093c68d
  - reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.
- rules/module-boundaries.mdc
  - source: rule
  - loadMode: full
  - required: true
  - sha256: f39eeb5e20d6b8c990d60890a19efaaf2a019914f488a519ff12a38b28eeb9dd
  - reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.
- rules/testing-discipline.mdc
  - source: rule
  - loadMode: excerpt
  - required: true
  - sha256: d98d4409fb1eceb2dbffdd5d51b473d86514cb09473d360fc7a1aa8b3f4200b3
  - reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

## Generated Context Pack

- unavailable: context pack requires a fresh context index: context index has not been built

## Preprocessed Runtime Context

- config.maxLinesPerFile: 80
- config.totalLineBudget: 360
- original: 35468 lines / 1324326 bytes
- final: 360 lines / 15736 bytes
- omittedContentWarning: One or more context files were reduced; cite source paths when full files are needed.

### .agent-workflow/playbooks/developer.md

- sourcePath: .agent-workflow/playbooks/developer.md
- strategy: passthrough
- originalSize: 9 lines / 756 bytes
- finalSize: 9 lines / 756 bytes
- omittedContentWarning: none
- reason: Required developer phase playbook for developer runtime work.

```
# Developer Playbook

- Implement the smallest coherent change that satisfies acceptance criteria.
- Keep business logic typed, tested, and close to existing patterns.
- Always include `Architectural Concerns (inherited)` for upstream design drift; write `None` when empty.
- Always include `Architectural Concerns (self-imposed)` for new abstractions, files, metadata, APIs, config, scripts, or workflow changes; write `None` when empty.
- For every self-imposed concern, explain why existing project patterns or a simpler alternative are insufficient.
- Carry architectural concern findings in structured output as `architecturalConcerns.inherited` and `architecturalConcerns.selfImposed`.
- Record evidence, changed files, known gaps, and handoff notes.
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
- reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

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

### rules/development-engineering.mdc

- sourcePath: rules/development-engineering.mdc
- strategy: passthrough
- originalSize: 21 lines / 1600 bytes
- finalSize: 21 lines / 1600 bytes
- omittedContentWarning: none
- reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

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

### rules/dry-clean-code.mdc

- sourcePath: rules/dry-clean-code.mdc
- strategy: passthrough
- originalSize: 31 lines / 1870 bytes
- finalSize: 31 lines / 1870 bytes
- omittedContentWarning: none
- reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

```
---
description: DRY, naming, and clean code standards — stack-agnostic
alwaysApply: true
---

# DRY & Clean Code

## Don't Repeat Yourself
- **Single Source of Truth for data.** If a constant, type, or config exists in one place, every consumer must import or derive from it — never copy-paste.
- When work touches repeated collections, option sets, fixtures, matrices, or collection-processing complexity, load the `collection-standards` skill instead of embedding detailed collection rules here.
- When two blocks share >5 lines of identical structure, extract a reusable function.
- Cross-package type sharing: define once, import at build time, or add a sync test. Never maintain parallel copies.

## Naming
- Names must reveal intent. `processData()` is vague — `validateOrderItems()` is clear.
- Booleans: prefix with `is`, `has`, `can`, `should` (e.g., `isValid`, `hasPermission`).
- Functions that return a value: name by what they return. Functions that perform actions: name by the action.
- No abbreviations except universally known ones (`id`, `url`, `db`, `config`).

## Magic Values
- No hardcoded timeouts, CLI commands, path segments, or error messages scattered in code. Define named constants at module scope or in a shared constants file.
- Repeated inline styles or CSS values must be extracted to variables or design tokens.

## Dead Code
- Never commit commented-out code, `console.log` debris, or unused imports. Delete them — git preserves history.
- Never commit `eslint-disable`, `@SuppressWarnings`, or `// @ts-ignore` without a linked issue explaining why.

## Comments
- Code should be self-documenting. Comments explain **why**, not **what**.
- Delete obvious comments: `// increment counter`, `// return result`, `// handle error`.
- Acceptable: non-obvious business rules, performance trade-offs, workarounds with linked tickets.
```

### rules/module-boundaries.mdc

- sourcePath: rules/module-boundaries.mdc
- strategy: passthrough
- originalSize: 71 lines / 2932 bytes
- finalSize: 71 lines / 2932 bytes
- omittedContentWarning: none
- reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

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

### rules/testing-discipline.mdc

- sourcePath: rules/testing-discipline.mdc
- strategy: passthrough
- originalSize: 34 lines / 1616 bytes
- finalSize: 34 lines / 1616 bytes
- omittedContentWarning: none
- reason: Required developer rule selected from the neutral rule catalog for role-specific execution quality.

```
---
description: TDD, BDD, and testing best practices — stack-agnostic
alwaysApply: true
---

# Testing Discipline

## Test-Driven Development (TDD)

- Write the test **before** or **alongside** the implementation. At minimum, tests must exist before the PR.
- Red → Green → Refactor. Start with a failing test, make it pass with minimal code, then clean up.
- Every development task must include unit tests for new or changed business logic before it is handed to QA.

## Behavior-Driven Development (BDD)

- Test **behavior**, not implementation. Test what the function does, not how it does it.
- Name tests as specifications: `it('rejects orders with zero quantity')`, not `it('test1')`.
- One assertion per test method. If you need multiple, it's multiple behaviors — split them.

## Test Structure

- **Arrange → Act → Assert.** Separate setup, execution, and verification with blank lines.
- Use factory functions or builders for test data — never copy-paste fixtures across test files.
- QA automation, E2E suites, contract tests, and test scripts that repeat fixture collections, selectors, expected outputs, or command matrices must load the `collection-standards` skill.
- Tests must be deterministic. No reliance on system clock, network, or random values without seeding.

## Sync Tests

- If data is duplicated across packages (e.g., type definitions, config arrays), a test must assert both copies are identical.
- Schema changes in a source of truth must break a test somewhere — if they don't, add one.

## Coverage

- Target **90%+ line coverage** for business logic. Infrastructure
```

### package.json

- sourcePath: package.json
- strategy: head-tail-truncation
- originalSize: 245 lines / 6717 bytes
- finalSize: 49 lines / 1473 bytes
- omittedContentWarning: Reduced from 245 lines using head-tail-truncation; full source remains at package.json.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
{
  "name": "@jterrats/smart-deployment",
  "description": "Intelligent Salesforce metadata deployment plugin that automatically analyzes dependencies, generates optimal deployment",
  "version": "1.5.0",
  "dependencies": {
    "@oclif/core": "4.11.4",
    "@salesforce/core": "^8.31.0",
    "@salesforce/sf-plugins-core": "^12.2.24",
    "fast-xml-parser": "^5.8.0",
    "glob": "^11.0.0",
    "minimatch": "^10.2.6"
  },
  "devDependencies": {
    "@commitlint/cli": "^18.4.3",
    "@commitlint/config-conventional": "^18.4.3",
    "@cucumber/cucumber": "^12.9.0",
    "@oclif/plugin-command-snapshot": "^5.3.21",
    "@salesforce/cli-plugins-testkit": "^5.3.41",
    "@salesforce/dev-scripts": "^11.0.4",
    "@semantic-release/changelog": "^6.0.3",
    "@semantic-release/git": "^10.0.1",
    "@types/chai": "^5.2.2",
    "@types/cucumber": "^7.0.3",
    "@types/mocha": "^10.0.10",
[... omitted 197 lines; full source path available ...]
      "config": ".cz-config.js"
    }
  },
  "resolutions": {
    "@oclif/core": "4.11.4",
    "baseline-browser-mapping": "2.10.31",
    "**/jake": "12.10.1",
    "**/filelist": "2.0.2",
    "**/fast-uri": "3.1.5",
    "**/form-data": "4.0.6",
    "**/websocket-driver": "0.7.5",
    "**/socks/**/ip-address": "10.2.0"
  },
  "overrides": {
    "jake": "12.10.1",
    "filelist": "2.0.2",
    "fast-uri": "3.1.5",
    "form-data": "4.0.6",
    "websocket-driver": "0.7.5",
    "socks": {
      "ip-address": "10.2.0"
    }
  }
}
```

### npm-shrinkwrap.json

- sourcePath: npm-shrinkwrap.json
- strategy: head-tail-truncation
- originalSize: 23527 lines / 850492 bytes
- finalSize: 49 lines / 1566 bytes
- omittedContentWarning: Reduced from 23527 lines using head-tail-truncation; full source remains at npm-shrinkwrap.json.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
{
  "name": "@jterrats/smart-deployment",
  "version": "1.5.0",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "@jterrats/smart-deployment",
      "version": "1.5.0",
      "hasInstallScript": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "@oclif/core": "4.11.4",
        "@salesforce/core": "^8.31.0",
        "@salesforce/sf-plugins-core": "^12.2.24",
        "fast-xml-parser": "^5.8.0",
        "glob": "^11.0.0",
        "minimatch": "^10.2.6"
      },
      "devDependencies": {
        "@commitlint/cli": "^18.4.3",
        "@commitlint/config-conventional": "^18.4.3",
        "@cucumber/cucumber": "^12.9.0",
        "@oclif/plugin-command-snapshot": "^5.3.21",
[... omitted 23479 lines; full source path available ...]
      }
    },
    "node_modules/zod": {
      "version": "4.1.13",
      "resolved": "https://registry.npmjs.org/zod/-/zod-4.1.13.tgz",
      "integrity": "sha512-AvvthqfqrAhNH9dnfmrfKzX5upOdjUVJYFqNSlkmGf64gRaTzlPwz99IHYnVs28qYAybvAlBV+H7pn0saFY4Ig==",
      "license": "MIT",
      "funding": {
        "url": "https://github.com/sponsors/colinhacks"
      }
    },
    "node_modules/zwitch": {
      "version": "2.0.4",
      "resolved": "https://registry.npmjs.org/zwitch/-/zwitch-2.0.4.tgz",
      "integrity": "sha512-bXE4cR/kVZhKZX/RjPEflHaKVhUVl85noU3v6b8apfQEc1x4A+zBxjZ4lN8LqGd6WZ3dl98pY4o717VFmoPp+A==",
      "dev": true,
      "license": "MIT",
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/wooorm"
      }
    }
  }
}
```

### yarn.lock

- sourcePath: yarn.lock
- strategy: head-tail-truncation
- originalSize: 11460 lines / 455345 bytes
- finalSize: 26 lines / 925 bytes
- omittedContentWarning: Reduced from 11460 lines using head-tail-truncation; full source remains at yarn.lock.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
# THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
# yarn lockfile v1


"@actions/core@^3.0.0":
  version "3.0.1"
  resolved "https://registry.npmjs.org/@actions/core/-/core-3.0.1.tgz"
  integrity sha512-a6d/Nwahm9fliVGRhdhofo40HjHQasUPusmc7vBfyky+7Z+P2A1J68zyFVaNcEclc/Se+eO595oAr5nwEIoIUA==
  dependencies:
    "@actions/exec" "^3.0.0"
    "@actions/http-client" "^4.0.0"

[... omitted 11435 lines; full source path available ...]
    tiny-case "^1.0.3"
    toposort "^2.0.2"
    type-fest "^2.19.0"

zod@^4.1.12:
  version "4.1.13"
  resolved "https://registry.npmjs.org/zod/-/zod-4.1.13.tgz"
  integrity sha512-AvvthqfqrAhNH9dnfmrfKzX5upOdjUVJYFqNSlkmGf64gRaTzlPwz99IHYnVs28qYAybvAlBV+H7pn0saFY4Ig==

zwitch@^2.0.4:
  version "2.0.4"
  resolved "https://registry.npmjs.org/zwitch/-/zwitch-2.0.4.tgz"
  integrity sha512-bXE4cR/kVZhKZX/RjPEflHaKVhUVl85noU3v6b8apfQEc1x4A+zBxjZ4lN8LqGd6WZ3dl98pY4o717VFmoPp+A==
```

## Loaded Context Excerpts

### .agent-workflow/playbooks/developer.md

```md
# Developer Playbook

- Implement the smallest coherent change that satisfies acceptance criteria.
- Keep business logic typed, tested, and close to existing patterns.
- Always include `Architectural Concerns (inherited)` for upstream design drift; write `None` when empty.
- Always include `Architectural Concerns (self-imposed)` for new abstractions, files, metadata, APIs, config, scripts, or workflow changes; write `None` when empty.
- For every self-imposed concern, explain why existing project patterns or a simpler alternative are insufficient.
- Carry architectural concern findings in structured output as `architecturalConcerns.inherited` and `architecturalConcerns.selfImposed`.
- Record evidence, changed files, known gaps, and handoff notes.
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

### rules/dry-clean-code.mdc

```md
---
description: DRY, naming, and clean code standards — stack-agnostic
alwaysApply: true
---

# DRY & Clean Code

## Don't Repeat Yourself

- **Single Source of Truth for data.** If a constant, type, or config exists in one place, every consumer must import or derive from it — never copy-paste.
- When work touches repeated collections, option sets, fixtures, matrices, or collection-processing complexity, load the `collection-standards` skill instead of embedding detailed collection rules here.
- When two blocks share >5 lines of identical structure, extract a reusable function.
- Cross-package type sharing: define once, import at build time, or add a sync test. Never maintain parallel copies.

## Naming

- Names must reveal intent. `processData()` is vague — `validateOrderItems()` is clear.
- Booleans: prefix with `is`, `has`, `can`, `should` (e.g., `isValid`, `hasPermission`).
- Functions that return a value: name by what they return. Functions that perform actions: name by the action.
- No abbreviations except universally known ones (`id`, `url`, `db`, `config`).

## Magic Values

- No hardcoded timeouts, CLI commands, path segments, or error messages scattered in code. Define named constants at module scope or in a shared constants file.
- Repeated inline styles or CSS values must be extracted to variables or design tokens.

## Dead Code

- Never commit commented-out code, `console.log` debris, or unused imports. Delete them — git preserves history.
- Never commit `eslint-disable`, `@SuppressWarnings`, or `// @ts-ignore` without a linked issue explaining why.

## Comments

- Code should be self-documenting. Comments explain **why**, not **what**.
- Delete obvious comments: `// increment counter`, `// return result`, `// handle error`.
- Acceptable: non-obvious business rules, performance trade-offs, workarounds with linked tickets.
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

### rules/testing-discipline.mdc

```md
---
description: TDD, BDD, and testing best practices — stack-agnostic
alwaysApply: true
---

# Testing Discipline

## Test-Driven Development (TDD)

- Write the test **before** or **alongside** the implementation. At minimum, tests must exist before the PR.
- Red → Green → Refactor. Start with a failing test, make it pass with minimal code, then clean up.
- Every development task must include unit tests for new or changed business logic before it is handed to QA.

## Behavior-Driven Development (BDD)

- Test **behavior**, not implementation. Test what the function does, not how it does it.
- Name tests as specifications: `it('rejects orders with zero quantity')`, not `it('test1')`.
- One assertion per test method. If you need multiple, it's multiple behaviors — split them.

## Test Structure

- **Arrange → Act → Assert.** Separate setup, execution, and verification with blank lines.
- Use factory functions or builders for test data — never copy-paste fixtures across test files.
- QA automation, E2E suites, contract tests, and test scripts that repeat fixture collections, selectors, expected outputs, or command matrices must load the `collection-standards` skill.
- Tests must be deterministic. No reliance on system clock, network, or random values without seeding.

## Sync Tests

- If data is duplicated across packages (e.g., type definitions, config arrays), a test must assert both copies are identical.
- Schema changes in a source of truth must break a test somewhere — if they don't, add one.

## Coverage

- Target **90%+ line coverage** for business logic. Infrastructure
```

## Primary Skill Context

### Proactive Orchestra

- ID: proactive-orchestra
- Entry: skills/proactive-orchestra/SKILL.md
- Load budget: small
- Rationale: eligible task roles: developer; task text matches triggers: workflow
- Instructions:
  - Start with health and task list before implementation when .agent-workflow exists.
  - Run pre-run validation before coding and resolve missing estimate, workflow, evidence, or review checks.
  - Record user-accepted deviations as decisions instead of silently skipping workflow steps.
- Evidence:
  - command
  - report
  - file

### PR Review

- ID: pr-review
- Entry: skills/pr-review/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: pr, merge
- Instructions:
  - Review behavior, tests, risks, rollout, rollback, and missing evidence before summaries.
  - Lead with findings and blockers, then summarize changes.
  - Reference local files, task context, reviews, and evidence rather than generated claims.
- Evidence:
  - file
  - report

### Prompt Registry

- ID: prompt-registry
- Entry: skills/prompt-registry/SKILL.md
- Load budget: small
- Rationale: eligible task roles: developer; task touches files, so prompt registry can preserve artifact intent
- Instructions:
  - Before substantial generation, read the relevant .generated-prompts register.
  - After substantial changes, update one entry with task, role, decisions, evidence, and prompt summary.
  - Do not update the register for typo-only, formatting-only, or single-line mechanical fixes.
- Evidence:
  - file

### Backlog Sync

- ID: backlog-sync
- Entry: skills/backlog-sync/SKILL.md
- Load budget: small
- Rationale: task text matches triggers: github
- Instructions:
  - Confirm backlog IDs and acceptance criteria before implementation.
  - Keep local tasks, docs, and GitHub issues aligned when one changes.
  - Surface missing refinement as a blocker instead of guessing scope.
- Evidence:
  - file
  - report

### Diagram Export

- ID: diagram-export
- Entry: skills/diagram-export/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: flow
- Instructions:
  - Identify the diagram purpose and authoritative architecture sources before drawing.
  - Choose the diagram style from the decision matrix before drafting.
  - Prefer text-native diagrams such as Mermaid unless the project requires another format.
  - Run orchestra diagrams lint --file <diagram.mmd> before sharing Mermaid diagrams.
  - Attach lint evidence to the workflow when the diagram supports delivery.
- Evidence:
  - file
  - report

### Release Readiness

- ID: release-readiness
- Entry: skills/release-readiness/SKILL.md
- Load budget: normal
- Rationale: task text matches triggers: release
- Instructions:
  - Validate gates, evidence, locks, reviews, rollback, observability, and support readiness.
  - Treat missing rollback or unresolved critical QA/security/SRE findings as blockers.
  - Record release evidence and accepted residual risks explicitly.
- Evidence:
  - command
  - report
  - file

### Source of Truth

- ID: source-of-truth
- Entry: skills/source-of-truth/SKILL.md
- Load budget: small
- Rationale: eligible task roles: developer; baseline source selection should run for every task
- Instructions:
  - Select source groups before acting and load only sources relevant to the task.
  - Prefer local project sources first and official vendor docs for current APIs or tools.
  - If sources conflict, record the conflict as a blocker or decision.
- Evidence:
  - file
  - report

## Workflow Template Guidance

### Implementation

Implement a scoped code change with unit tests and review handoff.

- Roles: developer, tech_lead, qa
- Inputs: goal, scope, acceptance criteria, changed paths
- Outputs: code diff, unit tests, developer handoff
- Evidence: command, file
- Gates: architecture, qa-release
- Missing evidence: command, file

Steps:

- Implement, unit test, validate, and hand off to QA.

## Phase Playbook: developer

Source: .agent-workflow/playbooks/developer.md

# Developer Playbook

- Implement the smallest coherent change that satisfies acceptance criteria.
- Keep business logic typed, tested, and close to existing patterns.
- Always include `Architectural Concerns (inherited)` for upstream design drift; write `None` when empty.
- Always include `Architectural Concerns (self-imposed)` for new abstractions, files, metadata, APIs, config, scripts, or workflow changes; write `None` when empty.
- For every self-imposed concern, explain why existing project patterns or a simpler alternative are insufficient.
- Carry architectural concern findings in structured output as `architecturalConcerns.inherited` and `architecturalConcerns.selfImposed`.
- Record evidence, changed files, known gaps, and handoff notes.

## Return Contract

- Write or summarize result evidence for .agent-workflow/handoffs/SD-RC-REMEDIATE-wfrun-1789080400988-9af105-developer-developer-runtime-handoff.md.
- Start the result artifact with these exact metadata lines:
  - Task id: SD-RC-REMEDIATE
  - Phase: developer
  - Role: developer
  - Runtime: codex-cli
  - Session id: SD-RC-REMEDIATE:wfrun-1789080400988-9af105:developer:codex-cli
- Include touched files, commands run, pass/fail result, risks, and close status.
- Include a `Consumed Context Files` section listing required files read, applied rules, and required rules that were not applicable with reasons.
- Include a `Test Scenarios and Expected Results` section with the target surface or environment (cloud, database, CLI, API, web app, mobile app, desktop app, workflow/runtime, integration, generated artifact, or local sandbox), the expected observable result for each scenario, and how the result was obtained.
- Critically state whether the produced evidence satisfies each acceptance criterion; mark gaps, weak evidence, or environment limitations as release-blocking unless the Product Owner explicitly accepts the risk.
- If a required context file was missing or not used, mark the handoff as changes/block with concrete impact.

## Lifecycle Self-Report

- After writing .agent-workflow/handoffs/SD-RC-REMEDIATE-wfrun-1789080400988-9af105-developer-developer-runtime-handoff.md, run: orchestra runtime spawn-lifecycle --session SD-RC-REMEDIATE:wfrun-1789080400988-9af105:developer:codex-cli --status completed --agent-id codex-cli:child --artifact .agent-workflow/handoffs/SD-RC-REMEDIATE-wfrun-1789080400988-9af105-developer-developer-runtime-handoff.md
- If blocked or failed before completion, run: orchestra runtime spawn-lifecycle --session SD-RC-REMEDIATE:wfrun-1789080400988-9af105:developer:codex-cli --status failed --agent-id codex-cli:child --summary "<safe failure summary>"
- If this runtime cannot execute shell commands, include the exact lifecycle command in the final runtime notification so the parent or watcher can reconcile it.
