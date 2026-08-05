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

<!-- open-orchestra:start block-id="runtime-bootstrap" generator="open-orchestra runtime bootstrap" version="2" target="codex" source-manifest="open-orchestra command-manifest,runtime-bootstrap" content-sha256="f3665a7a47a1843a99cb06af340419a8d9e91ccd050a0ee23cd6ce8470c4a8a9" updated-at="2026-08-05T17:15:17.236Z" -->
# Open Orchestra Runtime Bootstrap

Runtime target: Codex. Reference Open Orchestra from AGENTS.md so local CLI work follows workflow gates.

## Non-Negotiable Runtime Rules

These rules are non-negotiable. Follow them in every conversation and every work block:

- Use Orchestra for all project work: planning, implementation, fixes, reviews, QA, release, CI, research, and documentation.
- Do not edit files, run implementation work, or dispatch agents before a matching Orchestra task exists and a workflow run is active.
- Always run the runtime health preflight, inspect active tasks, and validate pre-run context before work.
- If a gate is paused, stop and wait for explicit user approval before continuing.
- Record real evidence: commands, files, outputs, logs, screenshots, traces, or explicit deferred-risk rationale.
- Never treat simulated handoffs, generated summaries, or workflow state alone as proof of completed QA.
- Never push, tag, publish, or deploy without explicit user instruction.

Use Open Orchestra as the local control plane when `.agent-workflow/` exists.
The active LLM runtime is the parent agent. Orchestra renders spawn requests and records lifecycle; it does not call provider APIs directly.

## Project Memory Sharing

LLM chat memory is not shared across Claude, Codex, Cursor, VS Code, Windsurf, OpenCode, or generic provider sessions. Treat every runtime as stateless unless the knowledge is written to the repository or `.agent-workflow/`.
The shared project memory is:
- `.agent-workflow/` — operational memory: tasks, workflow runs, events, decisions, handoffs, reviews, evidence, benchmarks, active runtime, context indexes, lessons, and prompt registry records.
- `rules/` — canonical cross-runtime engineering rules. Runtime files should reference these rules, not fork their content.
- `skills/` — canonical task-scoped capabilities. Use `orchestra skills plan --task <ID>` and `orchestra skills render --target <runtime>` to load the smallest relevant set.
- `docs/`, ADRs, tests, source files, and generated evidence artifacts — durable product and technical knowledge that survives model/session changes.
- Runtime entry files such as `AGENTS.md`, `CLAUDE.md`, `ORCHESTRA.md`, Cursor MDC, VS Code JSON/Markdown, and Windsurf rules — generated views over the same canonical memory, not independent sources of truth.

When handing work between runtimes, persist the transfer through Orchestra artifacts: task context, decisions, evidence, reviews, handoffs, context manifests, and spawn packets. Do not rely on a previous chat transcript unless it has been captured in those artifacts.

Codex consumes project memory through `AGENTS.md`, `orchestra context`, `orchestra skills plan/render --target codex`, and runtime context manifests. An empty `.codex/` directory is not drift by itself unless a future Codex-native skill surface is explicitly configured.

## Orchestra Workflow — Required for All Work

Every piece of work — feature, bug fix, architecture decision, stack definition, PO refinement, or research spike —
MUST go through the Orchestra workflow. Do not start any work without a registered task and a running workflow.

### Managed Work Routing for External Runtimes

External runtimes and provider-backed agents — including Claude, Codex, Cursor, VS Code, Windsurf, OpenCode, and generic LLM runners — must infer managed work intent from natural language.
When the user asks to implement, fix, review, release, deploy, plan, research, investigate, spike, groom, estimate, validate, QA, or document work in a project with `.agent-workflow/`, route the request through Orchestra instead of executing ad hoc.
The required routing sequence is:
1. Load workspace state with `orchestra health --json` and `orchestra task list --json --status pending,blocked,in_progress`.
2. Reuse the matching active task when one exists; otherwise create or refine a task with `orchestra task add` before doing implementation, research, or provider calls.
3. Record the estimate and run `orchestra validate --pre-run --task <ID> --json`; if context is missing, resume or register the workflow before editing files.
4. Start or resume the workflow with `orchestra workflow run --task <ID> --gates phase` or `orchestra workflow run --task <ID> --resume <run-id>`.
5. If acceptance criteria, sizing, or gate approval is missing, stop and record clarification/review instead of bypassing the workflow.
This hardening is for external runtimes. The local provider/backbone path may stay tightly coupled to Orchestra internals, but it must not be used as a precedent for Claude, Codex, Cursor, VS Code, Windsurf, OpenCode, or generic provider behavior.

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
orchestra estimate --task <ID> --sizing <xs|s|m|l|xl> --solo-days <N> --ai-unguided-days <N> --ai-guided-days <N>
```
Do not run `orchestra workflow run` until this estimate is recorded; an unestimated task signals incomplete planning.

### Step 3 — Run the autonomous workflow
```
orchestra workflow run --task <ID> --gates phase
```
The workflow sequences PM → PO → Architect → Developer → QA → Release.
Execution mode is selected from sizing when no explicit `--phase-execution` is provided:
- `xs` (1 point): `single-agent` so all phases run inline without spawn overhead.
- `s` (2–3 points): `single-agent` by default; use `subagents` when the work is separable.
- `m`, `l`, `xl`: `subagents` so phase work is isolated and reviewable.
For xs/s tasks, prefer `orchestra workflow run --task <ID> --gates phase --phase-execution single-agent` when you need to be explicit. The parent agent still produces handoffs, evidence, and reviews for every phase.
The agent (Claude Code) is responsible for executing every phase in sequence — acting as PM, then PO, then Architect, then Developer, then QA, then Release — before marking work complete.
Never pass `--from-phase`, `--skip-phases`, or any phase-shortcut flag. If a phase seems irrelevant, record a bypass rationale with `orchestra validate --pre-run --task <ID> --bypass --bypass-rationale "..."` instead.
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
At a `po→architect` or `qa→release` gate, stop work, surface the handoff artifact to the user, and wait for explicit approval before resuming — do not self-approve or continue autonomously.
Gate approval is not automatic. Before approving `po→architect`, verify the GitHub issue or Orchestra task has user-validated acceptance criteria, non-goals, assumptions, priority, and sizing context.
Before approving `qa→release`, verify real implementation evidence exists: changed files, exact validation commands, test results, QA findings, BA/PO acceptance, and Architect review when technical contracts changed.
If a generated handoff says `Acceptance Criteria: none`, treat it as incomplete. Pull criteria from the linked issue/task, record a review finding, and do not approve release until the gap is fixed or explicitly risk-accepted.

### Step 6 — Benchmark after completion
```
orchestra benchmark --task <ID>
```
A task is not complete until `orchestra benchmark` has run. Do not close the task or mark it done beforehand.

## Active Work
- At session start, run `orchestra health --runtime codex-cli --json --updates` before implementation or file edits.
- Run `orchestra task list --json --status pending,blocked,in_progress` and identify resumable work before creating a new task.
- For the active task, run context, delegation, plan, skills, protocol, and workflow render commands.
- Run `orchestra validate --pre-run --task <ID> --json` before implementation; resolve missing estimate, workflow run, evidence, or review checks.
- Loading or estimating a task is not enough. If validation reports `workflowRun` missing, run `orchestra workflow run --task <ID> --gates phase` or resume the existing run before implementation, handoff, QA, or release work.
- If health reports `package-update` as warn, do not auto-update silently. Record the finding, ask the user for explicit approval, run `orchestra self update --json` to inspect install/rollback/smoke commands, then apply the approved install command and rerun the smoke commands.
- When the user approves or requests the next concrete action, such as "ok, generate them", "dale", or "continue", that action becomes current acceptance criteria for the loop. Continue until it is completed, blocked with evidence, or explicitly paused; do not hand it off as future work.
- If a user accepts a smaller/advisory path, record it with `orchestra validate --pre-run --task <ID> --bypass --bypass-rationale "..."`.
- After `orchestra workflow run` completes a phase or reports a pending action, immediately run `orchestra runtime parent-actions --task <ID> --json` and dispatch any actionable `claude-agent-request` items before continuing.
- Codex recurring preflight: before each new work block and after any context shift, compaction, resume, interruption, or role handoff, rerun `orchestra health --runtime codex-cli --json`, `orchestra task list --json --status pending,blocked,in_progress`, and `orchestra validate --pre-run --task <ID> --json`.
- Treat `activeOrchestraContext: false` or non-empty `missingActiveContext` from pre-run validation as a drift warning; reload the task context and resume/register the workflow before editing files.
- Codex has no native recurring hook in this project, so this managed guidance and validation command are the fallback enforcement mechanism; the `--runtime codex-cli` flag is what registers the active runtime in `.agent-workflow/active-runtime.json`.

## Runtime-Native Background Spawn
- When a workflow phase returns `completionMode=detached`, keep the parent conversation available and do not block on the child unless the user explicitly asks to wait.
- After `orchestra workflow run` reports a pending parent runtime action, immediately inspect `orchestra runtime parent-actions --task <ID> --json` and consume safe actions supported by the active runtime.
- Codex parent runtimes should call `spawn_agent` for `codex-spawn-agent` actions using the `promptArtifact`, then record `spawned` with the returned agent id.
- Do not auto-consume actions when the user explicitly asked to pause, when the action is queued, or when the runtime/tool is unavailable or unsafe.
- Use `orchestra runtime spawn-request --task <ID> --role <role> --phase <phase> --run-id <run-id>` to render the assignment packet.
- Record child state with `orchestra runtime spawn-lifecycle --session <session-id> --status <spawned|active|completed|failed> --agent-id <id>`.
- Resume the workflow after the child completes with `orchestra workflow run --task <ID> --resume <run-id>`.
- Codex parent runtimes should use `spawn_agent` for the rendered packet and avoid waiting by default.
- Apply no-progress handling to every delegated phase and role, including custom roles; it is not QA-specific.
- Treat lifecycle or expected-artifact changes as progress. Repeated waits, status checks, or reminder messages without either change are not progress.
- After repeated unchanged observations, send one explicit finalization request. If lifecycle and the expected artifact remain unchanged, record `runtime spawn-lifecycle --status failed` with agent id and a safe `no_progress` summary naming phase, role, and expected artifact before parent takeover.
- Parent takeover evidence must state that delegated execution failed to deliver and must attribute parent-run commands and results to `parent`; never claim the delegated phase passed.

## Task Loop
- `orchestra health` - Check local tools and workflow readiness. With --runtime, persists the active runtime so subsequent commands know who the parent is. Claude SessionStart hooks use --hook-session with JSON stdin.
- `orchestra task list` - List local workflow tasks. Workflow phase subtasks are hidden by default.
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
- **Never run `git push` without explicit user instruction.** Completing a task, finishing QA, or closing a workflow run does not authorize a push.

## Command Discovery
- Use `orchestra commands manifest --json` for command metadata.
- Use `orchestra --help` for human-readable help.
<!-- open-orchestra:end block-id="runtime-bootstrap" -->
