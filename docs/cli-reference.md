![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

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
- `--report-dir <path>`
- `--allow-cycle-remediation`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`

Behavior:

- scans metadata
- generates waves
- can execute real deployment through `SfCliIntegration`
- persists deployment state for `status` and `resume`
- writes deterministic JSON and HTML plan reports for `--dry-run` and `--validate-only`
- can attempt conservative cycle remediation for supported `ApexClass` cycles only
- `--dry-run` follows the real `start` orchestration path without executing the deploy, so it is the closest rehearsal of an actual deployment command run
- `--dry-run` writes `.smart-deployment/reports/start-dry-run/deployment-plan.json` and `.smart-deployment/reports/start-dry-run/deployment-plan.html` by default
- `--report-dir <path>` overrides the report output directory for CI artifact collection
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

## `sf smart-deployment ci preset`

Run the CI preset for deployment planning, validation-safe checks, deterministic report artifacts, and CI exit codes.

Supported flags:

- `--source-path <path>`
- `--target-org <alias-or-username>`
- `--report-dir <path>`
- `--validation-mode <strict|warn-only|local-only>`
- `--skip-tests`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`
- `--json`

Behavior:

- runs the same local scan and wave planning path used by `start --dry-run`
- never executes a real Salesforce deployment
- writes `deployment-plan.json` and `deployment-plan.html`
- defaults reports to `.smart-deployment/reports/start-dry-run` under the scanned project root
- writes GitHub Actions outputs when `GITHUB_OUTPUT` is available:
  `deployment_plan_json`, `deployment_plan_html`, `deployment_report_dir`, `deployment_status`, and `deployment_exit_code`
- `strict` exits with code `2` when plan blockers are present
- `warn-only` emits the same artifacts but exits `0` for plan blockers
- `local-only` exits `0` for local planning blockers and avoids org-dependent validation expectations

## `sf smart-deployment impact`

Analyze git changes and report transitive deployment/test impact without deploying.

Supported flags:

- `--source-path <path>`
- `--base <git-ref>`
- `--head <git-ref>`
- `--working-tree`
- `--max-depth <number>`
- `--json`

Behavior:

- maps git changed files to metadata components
- supports ref comparison with `--base` and `--head`
- defaults to working-tree mode when refs are omitted
- includes staged, unstaged, and untracked files in working-tree mode
- reports directly changed components, transitive dependents, affected components, planned waves, and suggested Apex tests
- returns CI-friendly JSON with a stable `summary`, `changedComponents`, `transitiveDependents`, `affectedComponents`, `plannedWaves`, and `suggestedApexTests` shape
- never executes a Salesforce deployment

## `sf smart-deployment graph export`

Export dependency and deployment wave graphs for review or CI artifacts.

Supported flags:

- `--source-path <path>`
- `--report-dir <path>`
- `--output <path>`
- `--format <mermaid|dot|json|html>`
- `--use-ai`
- `--org-type <Production|Sandbox|Developer>`
- `--industry <value>`
- `--json`

Behavior:

- scans metadata and builds the same dependency graph and ordered deployment waves used by local planning
- writes the selected graph artifact to `.smart-deployment/reports/graph-export` by default
- `--report-dir <path>` changes the output directory and keeps the default filename for the selected format
- `--output <path>` writes to an exact file path and takes precedence over `--report-dir`
- JSON exports include components, dependency edges, wave grouping, cycle markers, isolated components, and summary counts for CI artifact review
- HTML exports embed the review table plus Mermaid, DOT, and JSON representations

## Files Written By The CLI

- repo config: `.smart-deployment.json`
- saved plan: `.smart-deployment/deployment-plan.json`
- deployment runtime state: `.smart-deployment/deployment-state.json`
- CI preset reports: `.smart-deployment/reports/start-dry-run/deployment-plan.json` and `.smart-deployment/reports/start-dry-run/deployment-plan.html`
- graph exports: `.smart-deployment/reports/graph-export/dependency-graph.{mmd,dot,json,html}`
- temporary sanitized deploy project: operating-system temp directory, removed after the command finishes

The runtime state file is operational state, not source-of-truth configuration.
