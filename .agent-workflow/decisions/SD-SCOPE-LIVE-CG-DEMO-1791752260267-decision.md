# Decision SD-SCOPE-LIVE-CG-DEMO: Authorized isolated cg-demo SD fixtures

- Status: accepted
- Owner: product_owner

## Context

User explicitly answered apruebo to creating and deleting only isolated SD\_\* components in cg-demo with final absence verification, without modifying Case or existing metadata. This applies to live scope audit only, not release or other orgs.

## Decision

Permit bounded temporary SD\_\* metadata fixture in cg-demo for live validation, after exact-identity preflight and read-only/validate-only checks. Delete only exact owned fixtures after each run and independently verify absence; if cleanup is ambiguous retain workspace and report blocker. No existing metadata, Case, lockfile, publish or push changes.

## Consequences

Do not infer naturally delayed OWD propagation or issue 270-273 remediation from isolated result. Workflow human gates still require approval; this is mutation scope consent, not QA-to-release approval.
