# Smart Deployment

[![CI](https://img.shields.io/github/actions/workflow/status/jterrats/smart-deployment/test.yml?branch=main&label=CI&logo=github)](https://github.com/jterrats/smart-deployment/actions/workflows/test.yml)
[![License](https://img.shields.io/github/license/jterrats/smart-deployment)](https://github.com/jterrats/smart-deployment/blob/main/LICENSE)
[![Latest Release](https://img.shields.io/github/v/release/jterrats/smart-deployment?display_name=tag&label=latest%20release)](https://github.com/jterrats/smart-deployment/releases)
[![Node Version](https://img.shields.io/node/v/@jterrats/smart-deployment?logo=node.js)](https://www.npmjs.com/package/@jterrats/smart-deployment)
[![npm](https://img.shields.io/npm/v/@jterrats/smart-deployment?logo=npm&label=npm)](https://www.npmjs.com/package/@jterrats/smart-deployment)

Smart Deployment is a Salesforce CLI plugin that analyzes metadata, builds deployment waves, validates project state, and executes staged deployments with optional AI assistance.

The current codebase supports:

- metadata scanning and dependency graph generation
- wave generation with circular dependency detection
- conservative circular dependency remediation for supported `ApexClass` cycles
- real CLI flows for `start`, `analyze`, `validate`, `status`, `resume`, `retrieve`, and `config`
- AI-assisted dependency inference, priority weighting, and validation
- multiple LLM providers through a shared provider abstraction

## Current Status

This repository is in active development, but the command surface is now usable as a first working version.

What is working today:

- `sf smart-deployment analyze`
- `sf smart-deployment start`
- `sf smart-deployment validate`
- `sf smart-deployment status`
- `sf smart-deployment resume`
- `sf smart-deployment config`
- `sf smart-deployment ci-publish`
- `sf smart-deployment retrieve`
- JSON and HTML analysis reports
- release-owner CLI summaries and stable JSON release reports for `start`, `validate`, and `ci-publish`
- repo-level AI configuration via `.smart-deployment.json`

What is still partial:

- full live deployment validation against real Salesforce orgs across all flows
- broader automatic circular dependency remediation beyond simple supported cases
- richer deployment resume/polling semantics against remote deployment backends
- broader provider ecosystem beyond the currently implemented adapters

## Installation

```bash
sf plugins install @jterrats/smart-deployment
```

For local development:

```bash
yarn install
yarn build
sf plugins link .
```

## Quick Start

Analyze a project:

```bash
sf smart-deployment analyze --source-path force-app
```

Generate a saved plan and JSON report:

```bash
sf smart-deployment analyze \
  --source-path force-app \
  --use-ai \
  --save-plan \
  --output analysis.json \
  --format json
```

Run a dry deployment:

```bash
sf smart-deployment start \
  --source-path force-app \
  --dry-run
```

Run a destructive delete using the normal wave plan:

```bash
sf smart-deployment start \
  --source-path force-app \
  --target-org myorg \
  --destructive
```

Rollback a release by comparing release tags:

```bash
sf smart-deployment start \
  --source-path force-app \
  --target-org myorg \
  --rollback-from v1.2.0 \
  --rollback-to v1.2.1
```

Run with AI and allow conservative cycle remediation:

```bash
sf smart-deployment start \
  --source-path force-app \
  --target-org myorg \
  --use-ai \
  --allow-cycle-remediation
```

Validate the local wave plan:

```bash
sf smart-deployment validate \
  --source-path force-app \
  --use-ai
```

Generate a story scope manifest from reviewed commits, then use it as the CI release contract:

```bash
sf smart-deployment validate \
  --source-path . \
  --scope-commits abc123,def456 \
  --scope-manifest-output manifests/story-scope.generated.json

sf smart-deployment ci preset \
  --source-path . \
  --scope-manifest manifests/story-scope.generated.json \
  --validation-mode strict
```

Story scope manifests are JSON objects with `schemaVersion: 1`, top-level `commits`, optional `changes`, and a
`scope` object containing `changedComponents`, `dependencyComponents`, `explicitComponents`, `includedComponents`, and
`ignoredComponents`. CI treats `scope.includedComponents` as the deployment boundary; metadata outside that list is
ignored unless it is added through `includeComponents` or `stories[].includeComponents`.

When to use each:

- use `validate` for local wave plan readiness and risk checks
- use `start --dry-run` to rehearse the real deployment command flow without executing the deploy

Show persisted deployment state:

```bash
sf smart-deployment status --source-path force-app
```

Resume a failed deployment from local state:

```bash
sf smart-deployment resume \
  --source-path force-app \
  --retry-strategy standard
```

Configure the default AI provider for a repo:

```bash
sf smart-deployment config \
  --source-path . \
  --set-llm-provider openai \
  --set-llm-model gpt-4o-mini
```

Retrieve bundle metadata while enforcing `.forceignore` leaf paths:

```bash
sf smart-deployment retrieve \
  --metadata DigitalExperienceBundle:site/PHP_Portal1 \
  --strict-ignore \
  --normalize-meta
```

Build a coordinated CI publish plan for metadata, Agentforce authoring bundles, LWR publish, and optional activation:

```bash
sf smart-deployment ci-publish \
  --source-path force-app \
  --target-org release \
  --since origin/main \
  --dry-run
```

When executing deploy phases, Smart Deployment respects `.forceignore` by building from a temporary sanitized Salesforce project. Ignored files stay in the working tree but are not visible to package generation or `sf project deploy start`.
For retrieve flows, `sf smart-deployment retrieve` runs `sf project retrieve start`, detects touched paths, restores `.forceignore`-protected bundle sub-paths with `git checkout HEAD -- <path>` or untracked cleanup, and can fail the command with `--strict-ignore`. Use `--normalize-meta` to opt into deterministic formatting for DigitalExperience `*_meta.json` files.
When `--target-org` is provided, the coordinated publish flow also passes the org through to Salesforce CLI commands and checks AI evaluation subjects against source metadata or the target org before deploy.

### Release Report

`start`, `validate`, and `ci-publish` print a release-owner summary and write:

```text
.smart-deployment/reports/release-report.json
```

`start --report-dir <path>` relocates the report alongside the other requested report artifacts. The versioned
`schemaVersion: "1.0"` contract includes the command, target org when supplied, deterministic or AI-enriched analysis
mode, enrichment availability, overall outcome, totals, phases, metadata items, safe command evidence, and remediation.
Operations (`deploy`, `publish`, `activate`, `validate`) are separate from statuses (`succeeded`, `failed`, `skipped`,
`needs_review`) so CI can parse the artifact without scraping logs.

Report creation is advisory. A build, sanitization, serialization, persistence, or optional enrichment failure emits a
warning but does not replace the underlying command result or exit behavior. Evidence excludes raw arguments,
stdout/stderr, stack traces, credentials, and paths outside the Salesforce project.

## Commands

See:

- [CLI reference](docs/cli-reference.md)
- [AI configuration](docs/ai-configuration.md)
- [Known limitations](docs/known-limitations.md)
- [Release candidate checklist](docs/release-candidate-checklist.md)
- [Release workflow](docs/release-workflow.md)
- [Documentation index](docs/README.md)

## AI Providers

The AI layer is no longer Agentforce-only.

Current provider model:

- shared provider abstraction in `src/ai/llm-provider.ts`
- provider factory in `src/ai/llm-provider-factory.ts`
- concrete adapters currently implemented for:
  - `agentforce`
  - `openai`

AI is optional. When unavailable, supported flows fall back to deterministic heuristics where possible.

## Repo Configuration

Repo-scoped configuration is stored in:

```text
.smart-deployment.json
```

Example:

```json
{
  "llm": {
    "provider": "openai",
    "model": "gpt-4o-mini",
    "endpoint": "https://api.openai.com/v1/chat/completions",
    "timeout": 30000
  },
  "priorities": {
    "ApexClass:CriticalService": 100
  }
}
```

Deployment runtime state is stored separately under `.smart-deployment/` and should not be committed.

## Testing

Main commands:

```bash
yarn test
yarn test:compile
yarn test:only
yarn lint
```

The suite currently includes unit, integration-style, and NUT coverage for the main CLI flows.

## Documentation Policy

The repository contains both active documentation and historical design/planning material.

- active docs live in `docs/`
- archived historical docs live in `docs/archive/`

If a document describes flags or workflows that do not exist in the current command layer, treat the archived version as historical only.
