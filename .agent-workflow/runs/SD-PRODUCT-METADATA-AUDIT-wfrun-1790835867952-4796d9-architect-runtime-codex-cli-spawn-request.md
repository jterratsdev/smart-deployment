# Runtime Spawn Request: SD-PRODUCT-METADATA-AUDIT

- Task id: SD-PRODUCT-METADATA-AUDIT
- Runtime: Codex CLI (codex-cli)
- Phase: architect
- Role: architect
- Session id: SD-PRODUCT-METADATA-AUDIT:wfrun-1790835867952-4796d9:architect:codex-cli
- Status: requested
- Async mode: full-async
- Default parent wait: false
- Completion: lifecycle-event-or-explicit-poll
- Spawn bridge mode: parent-tool
- Parent runtime tool: spawn_agent
- Direct provider API calls: forbidden
- directProviderApiAllowed=false
- Context tokens: 5037/3000

## Parent Runtime Action

- Action kind: codex-spawn-agent
- Native tool: spawn_agent
- Runtime bridge guidance: Render a spawn request artifact that the parent Codex runtime can execute with its spawn_agent tool.
- Parent runtime should call spawn_agent with the assignment below.
- Orchestra only rendered this request and recorded provenance.
- Call spawn_agent from the active Codex parent runtime with the prompt artifact as the child assignment.
- Prefer background execution and avoid waiting unless the next parent step is blocked.
- Record spawned and terminal lifecycle states with the returned agent id.
- Spawn lifecycle: orchestra runtime spawn-lifecycle --session SD-PRODUCT-METADATA-AUDIT:wfrun-1790835867952-4796d9:architect:codex-cli --status spawned --agent-id <agent-id>
- Complete lifecycle: orchestra runtime spawn-lifecycle --session SD-PRODUCT-METADATA-AUDIT:wfrun-1790835867952-4796d9:architect:codex-cli --status completed --agent-id <agent-id> --artifact .agent-workflow/handoffs/SD-PRODUCT-METADATA-AUDIT-wfrun-1790835867952-4796d9-architect-architect-runtime-handoff.md
- Failure lifecycle: orchestra runtime spawn-lifecycle --session SD-PRODUCT-METADATA-AUDIT:wfrun-1790835867952-4796d9:architect:codex-cli --status failed --agent-id <agent-id> --summary "<safe failure summary>"
- Parent should return control immediately after launching or recording the request.
- Parent should reconcile completion through lifecycle notification or explicit later polling.

## Assignment

- Ownership paths: docs/research/metadata-catalog, src/analysis/metadata-capability-definitions.ts, src/constants/deployment-order.ts
- Delegation intent: execute
- Allowed commands: bash(orchestra \*), npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Prompt artifact: .agent-workflow/runs/SD-PRODUCT-METADATA-AUDIT-wfrun-1790835867952-4796d9-architect-runtime-codex-cli-spawn-prompt.md
- Context manifest artifact: .agent-workflow/runs/SD-PRODUCT-METADATA-AUDIT-wfrun-1790835867952-4796d9-architect-runtime-codex-cli-context-manifest.json
- Expected result artifact: .agent-workflow/handoffs/SD-PRODUCT-METADATA-AUDIT-wfrun-1790835867952-4796d9-architect-architect-runtime-handoff.md

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
  - reason: exposed: role allowed and phase matches
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
- original: 727 lines / 34150 bytes
- final: 294 lines / 13403 bytes
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

### src/analysis/metadata-capability-definitions.ts

- sourcePath: src/analysis/metadata-capability-definitions.ts
- strategy: schema-extraction
- originalSize: 353 lines / 17676 bytes
- finalSize: 19 lines / 766 bytes
- omittedContentWarning: Reduced from 353 lines using schema-extraction; full source remains at src/analysis/metadata-capability-definitions.ts.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
import { DEPLOYMENT_ORDER } from '../constants/deployment-order.js';
import type {
  MetadataCapabilities,
  MetadataCapabilityDefinition,
  MetadataCapabilityEvidence,
  MetadataCapabilityEvidenceSource,
  MetadataCanonicalOwner,
  MetadataDeploymentChannel,
} from '../types/metadata-capability.js';

export const METADATA_CAPABILITY_DEFINITIONS: readonly MetadataCapabilityDefinition[] = [
  ...Object.keys(DEPLOYMENT_ORDER)
    .filter((metadataType) => !isExplicitlyDefined(metadataType) && !isLegacyScannerType(metadataType))
    .map((metadataType) => orderedDefinition(metadataType)),
  ...LEGACY_SCANNER_TYPES.filter((metadataType) => !isExplicitlyDefined(metadataType)).map((metadataType) =>
    scannerDefinition(metadataType)
  ),
  ...P0_DEFINITIONS,
];
```

### src/constants/deployment-order.ts

- sourcePath: src/constants/deployment-order.ts
- strategy: schema-extraction
- originalSize: 180 lines / 7418 bytes
- finalSize: 79 lines / 3417 bytes
- omittedContentWarning: Reduced from 180 lines using schema-extraction; full source remains at src/constants/deployment-order.ts.
- reason: Delegated ownership path; cite this path instead of loading raw file content by default.

```
import type { MetadataType } from '../types/metadata.js';

export const DEPLOYMENT_ORDER: Readonly<Record<MetadataType, number>> = Object.freeze({
  // ========== Tier 0: Global Configuration (1-5) ==========
  GlobalValueSet: 1, // Global value sets used by picklists
  StandardValueSet: 2, // Standard value sets
  CustomLabels: 3, // Custom labels
  Translations: 4, // Translation files
  StandardValueSetTranslation: 5, // Standard value set translations

  // ========== Tier 1: Foundation - Objects & Fields (6-15) ==========
  CustomObject: 6, // Core data model - must be early
  CustomSetting: 7, // Custom settings (like custom objects)
  DataCategoryGroup: 8, // Data category groups
  CustomMetadata: 9, // Custom metadata types
  CustomMetadataRecord: 10, // Custom metadata records
  CustomField: 11, // Fields depend on objects
  ObjectTranslation: 12, // Object translations
  RecordType: 13, // Record types depend on objects/fields
  BusinessProcess: 14, // Business processes depend on record types
  ValidationRule: 15, // Validation rules depend on fields
  WorkflowRule: 16, // Workflow rules

  // ========== Tier 2: Security Foundation (17-23) ==========
  OrgSettings: 17, // Org-wide settings
  CorsWhitelistOrigin: 18, // CORS settings
  CspTrustedSite: 19, // CSP trusted sites
  Role: 20, // Role hierarchy
  DelegateGroup: 21, // Delegate groups
  Group: 22, // Public groups
  CustomPermission: 23, // Custom permissions
  ExternalCredential: 24, // External credentials
  NamedCredential: 25, // Named credentials for callouts
  DataSourceObject: 26, // Data source objects

  // ========== Tier 3: Code & Resources (27-36) ==========
  StaticResource: 27, // Static resources
  Document: 28, // Documents
  ContentAsset: 29, // Content assets
  EmailTemplate: 30, // Email templates
  ApexClass: 31, // Apex classes - deploy before triggers
  VisualforceComponent: 32, // VF components
  VisualforcePage: 33, // VF pages
  LightningComponentBundle: 34, // LWC
  AuraDefinitionBundle: 35, // Aura components
  ApexTrigger: 36, // Triggers after classes

  // ========== Tier 4: Service Cloud (37-42) ==========
  ServicePresenceStatus: 37, // Service presence
  PresenceUserConfig: 38, // Presence config
  Queue: 39, // Queues
  ServiceChannel: 40, // Service channels
  QueueRoutingConfig: 41, // Queue routing
  ChannelLayout: 42, // Channel layouts

  // ========== Tier 5: Business Logic & AI (43-49) ==========
  MilestoneType: 43, // Milestone types
  EntitlementProcess: 44, // Entitlement processes
  GenAiFunction: 45, // Einstein AI functions
  GenAiPromptTemplate: 46, // Einstein prompts
  GenAiPlannerBundle: 47, // Einstein planners
  Flow: 48, // Flows (after Apex classes)
  PathAssistant: 49, // Path assistant

  // ========== Tier 6: UI Components (50-59) ==========
  Layout: 50, // Page layouts
  Bot: 51, // Einstein Bots
  BotVersion: 52, // Bot versions
  AiAuthoringBundle: 53, // Agentforce authoring bundles
  AiEvaluationDefinition: 54, // AI evaluations deploy in the special phase after agent publish
  GenAiPlugin: 53, // Einstein plugins
  FlexiPage: 54, // Lightning pages
  QuickAction: 55, // Quick actions
  CompactLayout: 56, // Compact layouts
  ListView: 57, // List views
  WebLink: 58, // Web links
  LightningApp: 59, // Lightning apps
  SearchCustomization: 60, // Search customizations
  CustomNotificationType: 61, // Custom notifications
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

## Selected Skills

- source-of-truth: eligible task roles: architect, qa; task text matches triggers: source, documentation, docs
- prompt-registry: eligible task roles: qa; task text matches triggers: ui, docs; task touches files, so prompt registry can preserve artifact intent
- doc-sync: eligible task roles: architect, product_owner; task text matches triggers: documentation, docs
- pr-review: eligible task roles: qa, architect; task text matches triggers: pr, review
- backlog-sync: eligible task roles: product_owner; task text matches triggers: backlog
- playwright-evidence: eligible task roles: qa; task text matches triggers: ui
- static-analysis: eligible task roles: qa; task text matches triggers: test
- release-readiness: task text matches triggers: deploy

## Guardrails

- Execute only through the active parent runtime, not through direct vendor APIs.
- Do not include secrets, full transcripts, or unrelated workspace context in the child prompt.
- Respect ownership paths and active locks before editing.
- Return a concise handoff with touched files, test evidence, risks, and close status.
- Handoff must include `Consumed Context Files` with required files read, rules applied, and non-applicable required rules with reasons.
- Close or mark the delegated session failed if the parent tool cannot create a child agent.
- Guardrail status: allow
- Requested spawns: 1/3
- Active delegates: 0/3
- Delegation depth: 0/1
- Context budget: 3000/3000
- Spawn budget: 6000
- Timeout ms: 600000
- Stale claim TTL ms: 1800000
- Nested delegation allowed: false
- Handoff max chars: 4000
- Guardrail reasons: none

## Quality Warnings

- context token estimate 5037 exceeds budget 3000

## Phase Playbook: architect

Source: .agent-workflow/playbooks/architect.md

# Architect Playbook

- Define boundaries, data flow, integration contracts, and rollback risk.
- Prefer existing project patterns before adding abstractions.
- Record sizing and ADR-level decisions when the design has lasting impact.

## Tool Permission Policy

- Mode: runtime-managed
- Explicit opt-in required: false
- Read-only tools: none
- Write tools: none
- Shell tools: none
- Autonomous flags: none
- Gated flags: none
- Warning: Codex permission flags are managed by the active Codex CLI/session; Orchestra renders briefs and does not inject direct execution flags.
