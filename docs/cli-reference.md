# CLI Reference

This reference describes the commands and flags currently implemented in the repository.

## `sf smart-deployment analyze`

Analyze metadata without deploying.

Supported flags:

- `--source-path <path>`
- `--save-plan`
- `--plan-path <path>`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`
- `--output <path>`
- `--format <json|html>`

Behavior:

- scans metadata and dependencies
- generates deployment waves
- can save a deployment plan to `.smart-deployment/deployment-plan.json`
- can write analysis reports in JSON or HTML
- when `--use-ai` is enabled, can apply inferred dependencies and AI priority weighting

## `sf smart-deployment start`

Analyze, build waves, and execute deployment.

Supported flags:

- `--target-org <org>`
- `--dry-run`
- `--validate-only`
- `--skip-tests`
- `--source-path <path>`
- `--allow-cycle-remediation`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`

Behavior:

- scans metadata
- generates waves
- can execute real deployment through `SfCliIntegration`
- persists deployment state for `status` and `resume`
- can attempt conservative cycle remediation for supported `ApexClass` cycles only
- `--dry-run` follows the real `start` orchestration path without executing the deploy, so it is the closest rehearsal of an actual deployment command run
- `--validate-only` keeps the command in the `start` command family, but stops short of real deployment execution

Important:

- a real deployment still requires `--target-org`
- `--allow-cycle-remediation` does not enable arbitrary source rewriting
- unsupported cycles still fail closed and require manual resolution

## `sf smart-deployment validate`

Validate the local wave plan without deploying.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`
- `--use-ai`

Behavior:

- validates the scanned project structure and generated waves
- reports issues and summary data
- can enrich validation with AI wave analysis
- does not execute Salesforce deployment validation
- focuses on deployment readiness and risk reporting, not on rehearsing the full `start` command flow

Difference from `start --dry-run`:

- use `validate` when you want a diagnostic readiness check
- use `start --dry-run` when you want to exercise the real deployment command path without sending a deploy

## `sf smart-deployment status`

Show persisted deployment status.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`

Behavior:

- reads local deployment state
- reports current wave, completed waves, remaining waves, and resumability
- includes AI metadata when present in state

## `sf smart-deployment resume`

Resume a failed deployment from persisted local state.

Supported flags:

- `--target-org <org>`
- `--source-path <path>`
- `--retry-strategy <standard|quick|validate-only>`

Behavior:

- loads failed deployment state
- rewrites state into a resumed form
- prepares the deployment to continue from the failed wave

## `sf smart-deployment config`

Manage repo-level Smart Deployment configuration.

Supported flags:

- `--source-path <path>`
- `--set <key=value>`
- `--get <key>`
- `--get-priority <MetadataType:Name>`
- `--set-priority <MetadataType:Name=priority>`
- `--set-llm-provider <agentforce|openai>`
- `--set-llm-model <name>`
- `--set-llm-endpoint <url>`
- `--set-llm-timeout <ms>`
- `--get-llm`
- `--list`

Behavior:

- reads and writes `.smart-deployment.json`
- stores metadata priority overrides
- stores default provider, model, endpoint, and timeout for AI services

## `sf smart-deployment ci-publish`

Build and optionally execute a coordinated CI publish plan for regular metadata, Agentforce authoring bundles, AI evaluations, Experience Cloud LWR sites, and OmniStudio DataPacks.

Supported flags:

- `--source-path <path>`
- `--since <git-ref>`
- `--target-org <alias-or-username>`
- `--dry-run`
- `--no-dry-run`
- `--auto-activate`
- `--json`

Behavior:

- phase 1 deploys regular metadata with `sf project deploy start`
- phase 1 excludes lifecycle-owned `Bot`, `BotVersion`, and `AiAuthoringBundle` metadata
- `GenAiPlannerBundle` remains in the regular metadata deploy path for employee-agent planner bundles
- phase 2 publishes changed `aiAuthoringBundles/<name>/` directories with `sf agent publish authoring-bundle -n <name> --skip-retrieve`
- phase 3 optionally emits activation commands only when `--auto-activate` is enabled
- phase 3 resolves the published Agentforce version from the preceding publish command before activation
- phase 4 deploys changed `AiEvaluationDefinition` files after source and target-org subject prechecks
- phase 5 publishes changed LWR sites with `sf community publish -n <site>`
- metadata deploy phases run from a temporary sanitized Salesforce project when `.forceignore` excludes files under package directories
- `--target-org` is passed through to Salesforce CLI commands and enables target-org subject lookup for AI evaluations
- `--dry-run` is enabled by default and prints/returns the plan without executing commands
- `--no-dry-run` executes non-skipped phase commands sequentially and stops at the first failed phase

## Files Written By The CLI

- repo config: `.smart-deployment.json`
- saved plan: `.smart-deployment/deployment-plan.json`
- deployment runtime state: `.smart-deployment/deployment-state.json`
- temporary sanitized deploy project: operating-system temp directory, removed after the command finishes

The runtime state file is operational state, not source-of-truth configuration.
