# Decision NEXT-003-PROVIDER-RESEARCH: Special deployment provider architecture

- Status: accepted
- Owner: architect

## Context

Issue #221 spans Salesforce metadata, Agentforce, LWR, OmniStudio managed package, and other product-specific deployment lifecycles. The first testable slice should validate provider planning before live execution.

## Decision

Use a provider registry shape where each provider owns detection, core-deploy exclusions, preflight/execution command planning, warnings/errors, and rollback reporting. Immediate providers: core metadata, Agentforce publish/activation, AI evaluations, LWR community publish, and OmniStudio vlocity. Future providers remain backlog candidates: SFMC, Data Cloud/Data 360, CRM Analytics/Tableau, security-sensitive credentials/auth/certs, and Service Cloud/Omni-Channel.

## Consequences

The alternate-project test can validate dry-run/json phase plans without org-side mutation. Live execution adapters and product-specific APIs can be added incrementally behind the same provider boundary.
