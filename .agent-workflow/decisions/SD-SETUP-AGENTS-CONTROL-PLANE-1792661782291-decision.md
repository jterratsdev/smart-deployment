# Decision SD-SETUP-AGENTS-CONTROL-PLANE: Control plane migration scope

- Status: accepted
- Owner: architect

## Context

User explicitly approved one final Orchestra migration; sf setup-agents native orchestration is enabled in this checkout, while OpenCode cannot consume Codex spawn actions

## Decision

Replace active Orchestra bootstrap and rule references with sf setup-agents; retain historical .agent-workflow and generated optional integration artifacts

## Consequences

New work uses setup-agents task/workflow/evidence; historical records remain read-only; no deployments or releases
