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
  - parsers should not decide deployment order, state transitions, or CLI behavior

- `types/` define stable contracts.
  - avoid leaking tool-specific or transport-specific shapes into core types unless intentional

## SOLID Rules

### Single Responsibility

- A file should have one clear reason to change.
- If a module both:
  - interprets metadata
  - decides behavior
  - persists state
  - and formats output
    it is too broad and should be split.

### Open / Closed

- Prefer registries, strategy objects, factories, and helper modules over long branching edits.
- New metadata types or providers should usually extend an existing seam instead of modifying unrelated code paths.

### Liskov / Interface Discipline

- Keep subtype-specific behavior behind explicit contracts.
- Do not overload generic types with incompatible assumptions.

### Interface Segregation

- Prefer small option objects and focused interfaces.
- Avoid large “god” service APIs that force callers to depend on methods they do not use.

### Dependency Inversion

- High-level workflows should depend on abstractions or stable collaborators.
- Keep tool integrations such as CLI, filesystem, network, and AI provider access behind dedicated modules.

## Public API Discipline

- Avoid `any`, `object`, and `Record<string, unknown>` in stable public APIs unless there is a deliberate boundary reason.
- Prefer narrow types, discriminated unions, and focused option objects over ambiguous “bag of fields” shapes.
- Prefer static imports and explicit types over runtime-shaped module access.
- Treat CLI JSON output, persisted deployment state, report payloads, and provider adapters as product contracts.

## Separation of Concerns

- Do not mix these concerns in one module unless the module is explicitly an orchestrator:

  - CLI parsing
  - filesystem access
  - metadata parsing
  - dependency reasoning
  - deployment execution
  - state persistence
  - report rendering

- If orchestration is required, extract sub-steps into named collaborators.

## Complexity Guardrails

- Prefer extraction before adding more branches to already large files.
- Treat these thresholds as strong refactor signals, not vanity metrics:

  - file is growing past roughly 300 lines
  - file crossing 400 lines needs an explicit reason
  - function is growing past roughly 30 to 40 lines
  - function needs more than 5 parameters
  - branching logic is better represented as a registry, strategy, or handler map

- Treat these as refactor triggers:

  - file is approaching ~400 lines and still growing
  - method complexity exceeds lint threshold
  - one change requires touching unrelated parts of the same file
  - tests need heavy setup because responsibilities are tangled

- When a file becomes a hotspot:

  - extract pure helpers first
  - then extract focused services
  - then reduce the root orchestrator to composition

- Prefer registries, maps, and strategy objects over long switch or if/else ladders once a decision point exceeds about 5 cases.

## Delegation And Handoffs

- Before delegating work, define:
  - goal
  - owning files or module boundary
  - non-goals
  - required tests
  - expected artifact or commit slice
- Parallel work must be split by stable boundaries. Avoid concurrent edits to the same files unless one agent is clearly the integration owner.
- Every handoff should include:
  - what changed
  - files touched
  - risks
  - tests run
  - remaining gaps
- Do not delegate generic exploration when the immediate blocker is local and on the critical path.

## State and Side Effects

- Keep pure calculations pure when possible.
- Isolate side effects:

  - file writes
  - CLI execution
  - network calls
  - deployment state mutation

- Prefer returning structured results over logging-driven control flow.

## Clean Code Rules

- Use a single source of truth for config, constants, deployment rules, and type mappings.
- If two blocks share more than a few identical lines, extract them instead of duplicating them across commands or services.
- Names should reveal intent.
  - Prefer `buildDeploymentContext()` over `prepareStuff()`
  - Boolean names should start with `is`, `has`, `can`, or `should`
- Avoid hardcoded shared timeouts, repeated CLI commands, and repeated user-facing error strings when they represent stable concepts.
- Comments should explain why, constraints, or tradeoffs, not narrate obvious code.
- Do not leave dead code, debug logging debris, or lint suppressions without a deliberate reason.

## Security And Boundary Rules

- Do not build shell commands by interpolating untrusted strings.
- Validate filesystem paths before destructive or cross-project operations.
- Keep secrets, tokens, and provider credentials out of code and fixtures.
- Do not expose raw stack traces, local paths, or internal tool failures directly as user-facing output unless the command contract explicitly requires it.

## Testing Rules

- Test behavior at the correct level:

  - parsers: focused unit tests
  - orchestration: command or integration-style tests
  - domain logic: deterministic unit tests

- Add regression tests for:

  - refactor seams
  - bug fixes
  - non-obvious dependency semantics
  - cross-platform behavior

- Prefer deterministic tests.
  - Avoid clock, network, and randomness dependencies unless they are explicitly controlled.

## Delivery Gates

- Definition of Ready for non-trivial work:
  - scope is clear
  - target layer is identified
  - acceptance signal is known
  - likely hotspot files are named up front
- Definition of Done:
  - behavior lives in the correct layer
  - touched tests pass
  - docs/contracts are updated if the product surface changed
  - handoff includes evidence and residual risks

## Review Checklist

Before merging, ask:

1. Does this change put logic in the right layer?
2. Did this make a hotspot bigger when it should have been split?
3. Are side effects isolated?
4. Is the new behavior expressed through existing abstractions or by adding branching to a god file?
5. Would another engineer know where to extend this next?

## Git And Change Discipline

- Each commit should keep the repo compiling and the touched tests passing.
- Prefer one logical change per commit.
- Keep refactor slices small enough to review without reconstructing intent from unrelated edits.
- Review your own diff before pushing large structural changes.

## Current Refactor Bias

When in doubt, prefer reducing responsibility in:

- `src/commands/start.ts`
- `src/services/metadata-scanner-service.ts`
- `src/dependencies/dependency-merger.ts`
- `src/parsers/email-template-parser.ts`

New work should avoid making these files broader unless the change is explicitly a cleanup or extraction.

<!-- open-orchestra:start block-id="runtime-bootstrap" generator="open-orchestra runtime bootstrap" version="1" target="codex" source-manifest="open-orchestra command-manifest,runtime-bootstrap" content-sha256="d178c80135edb9ad2161e8c20eb2cfbf8cbca8ce189150886428b024389525d0" updated-at="2026-05-11T23:39:31.217Z" -->

# Open Orchestra Runtime Bootstrap

Runtime target: Codex. Reference Open Orchestra from AGENTS.md so local CLI work follows workflow gates.

Use Open Orchestra as the local control plane when `.agent-workflow/` exists.
The active LLM runtime is the parent agent. Do not assume automatic real subagent spawning or real provider execution.

## Orchestra Workflow — Required for All Work

Every piece of work — feature, bug fix, architecture decision, stack definition, PO refinement, or research spike —
MUST go through the Orchestra workflow. Do not start any work without a registered task and a running workflow.

### Step 1 — Register the task

```
orchestra task add --id <ID> --title "<title>" --owner <role> --paths "<files>" --goal "<goal>"
```

Use the correct owner role for the type of work:

- Architecture / stack decisions → `architect`
- Product strategy / roadmap → `product_manager`
- Backlog refinement / acceptance criteria → `product_owner`
- Implementation → `developer`
- Verification / QA → `qa`
- Release / deploy → `release_manager`

### Step 2 — Declare effort baseline

```
orchestra estimate --task <ID> --sizing <xs|s|m|l|xl> --solo-days <N> --ai-unguided-days <N>
```

### Step 3 — Run the autonomous workflow

```
orchestra workflow run --task <ID> --gates phase
```

The workflow sequences PM → PO → Architect → Developer → QA → Release.
Gates pause at `po→architect` and `qa→release` for human review.
The architect phase requires a sizing decision before proceeding:

```
orchestra decision add --task <ID> --owner architect --title "Story sizing" \
  --decision "<xs|s|m|l|xl> [N points]" --context "..." --consequences "..." --status accepted
```

### Step 4 — Collaborate through the phases

Each phase routes work to the right role. Pass your comments, requirements, or context via:

- `orchestra decision add` — architecture decisions, stack choices, accepted trade-offs
- `orchestra review` — review findings from any role
- `orchestra workflow clarify` — blocking questions from developer/QA to PO or architect
- `orchestra evidence add` — artifacts, commands run, test results

### Step 5 — Resume after gates

```
orchestra workflow run --task <ID> --resume <run-id>
```

### Step 6 — Benchmark after completion

```
orchestra benchmark --task <ID>
```

## Active Work

- At session start, run `orchestra health --json` before implementation or file edits.
- Run `orchestra task list --json --status pending,blocked,in_progress` and identify resumable work before creating a new task.
- For the active task, run context, delegation, plan, skills, protocol, and workflow render commands.
- Run `orchestra validate --pre-run --task <ID> --json` before implementation; resolve missing estimate, workflow run, evidence, or review checks.
- If a user accepts a smaller/advisory path, record it with `orchestra validate --pre-run --task <ID> --bypass --bypass-rationale "..."`.

## Task Loop

- `orchestra health` - Check local tools and workflow readiness.
- `orchestra task list` - List local workflow tasks.
- `orchestra delegation decide --task <id>` - Decide whether to delegate.
- `orchestra skills plan --task <id>` - Select task-scoped skills.
- `orchestra skills render --target <generic|claude|cursor|codex|vscode|windsurf>` - Render skills for a runtime.
- `orchestra protocol render` - Render subagent protocol.
- `orchestra workflow render --task <id>` - Render workflow templates.
- `orchestra summary` - Summarize workspace state.
- `orchestra context --task <id>` - Read task context bundle.
- `orchestra plan --task <id>` - Render role execution plan.
- `orchestra gate --gate <architecture> --task <id>` - Evaluate workflow gate.
- `orchestra review --task <id> --role <role> --result <approve|block|changes> --findings <text> --recommendation <text>` - Record reviewer outcome.
- `orchestra evidence add --task <id> --role <role> --type <command|file|screenshot|trace|video|log|report> --summary <text>` - Record delivery evidence.

## Completion

- Run the project validation gate.
- Record command/file/browser evidence with `orchestra evidence add`.
- Record review outcome with `orchestra review`.
- Update task status only after evidence and review are present.

## Command Discovery

- Use `orchestra commands manifest --json` for command metadata.
- Use `orchestra --help` for human-readable help.
<!-- open-orchestra:end block-id="runtime-bootstrap" -->
