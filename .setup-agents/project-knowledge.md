# Project Knowledge

This file is the single source of truth for architecture decisions, naming conventions,
and codebase structure. It is maintained by the architect role and consumed by all agents.

## Architecture Decisions

<!-- Record key decisions: data layer strategy, trigger pattern, async approach, sharing model -->
<!-- Example: "Data layer: Custom DynamicQueries utility class with inherited sharing" -->

## Naming Conventions

<!-- Record confirmed naming patterns for each artifact type -->
<!-- If not yet decided, the agent MUST ask the user before creating new artifacts -->

| Artifact        | Convention | Example |
| --------------- | ---------- | ------- |
| Apex class      |            |         |
| Test class      |            |         |
| Trigger         |            |         |
| Trigger handler |            |         |
| LWC             |            |         |
| Custom object   |            |         |
| Custom field    |            |         |
| Flow            |            |         |
| Permission set  |            |         |

## Label Language

<!-- Which language to use for metadata labels and descriptions -->
<!-- Example: "Spanish for labels and descriptions, English for API names" -->

## Codebase Map

<!-- Key directories and what they contain -->
<!-- Entry points, service classes, utility classes, test helpers -->

## Search Hints

<!-- Patterns and keywords to help agents find relevant files -->
<!-- Example: "Trigger handlers are in force-app/main/default/classes/*TriggerHandler.cls" -->

<!-- setup-agents:block:start id="project-knowledge-derived" -->

## Derived Repository Evidence

This block contains observed evidence only. It does not record decisions or conventions.

### Source Roots

- `force-app`

- Source digest: `b0efc774e2538e3c05636e4befb387f38ec2e675222a81146aea9d811a5dd335`

### Observed Artifact Counts

| Artifact            | Observed count |
| ------------------- | -------------- |
| Apex classes        | 0              |
| Apex triggers       | 0              |
| LWC components      | 0              |
| Documentation files | 57             |

### Naming Candidates (observed, not accepted)

- Insufficient repeated naming evidence.

These candidates are observations, not accepted conventions. Human review is required before recording a convention.

### Label-Language Evidence

- State: **insufficient**
- Evidence: 0 metadata label(s) observed; at least 3 required.
- This evidence is not a language decision.

### Codebase Map

| Path                             | Observed purpose                          |
| -------------------------------- | ----------------------------------------- |
| `force-app`                      | Salesforce source root                    |
| `.setup-agents/class-catalog.md` | Complete Apex, trigger, and LWC inventory |
| `.setup-agents/doc-index.md`     | Repository documentation inventory        |

### Search Hints

- Apex classes: `<source-root>/**/classes/*.cls`
- Apex triggers: `<source-root>/**/triggers/*.trigger`
- LWC bundles: `<source-root>/**/lwc/<component>/`
- Project docs: root README/CHANGELOG/CONTRIBUTING and docs/ADR/runbook trees
<!-- setup-agents:block:end id="project-knowledge-derived" -->
