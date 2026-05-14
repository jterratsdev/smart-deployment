<!-- open-orchestra:start block-id="runtime-bootstrap" generator="open-orchestra runtime bootstrap" version="1" target="generic" source-manifest="open-orchestra command-manifest,runtime-bootstrap" content-sha256="7b4f860739fd4cba1203c737fce547b5bc57a18e70f20f7805a63412d19241f9" updated-at="2026-05-11T23:39:31.217Z" -->

# Open Orchestra Runtime Bootstrap

Runtime target: Generic LLM. Use provider-agnostic Markdown when the runtime has no dedicated project memory format.

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
