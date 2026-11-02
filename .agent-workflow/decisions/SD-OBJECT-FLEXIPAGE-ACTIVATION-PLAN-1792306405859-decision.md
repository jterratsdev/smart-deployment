# Decision SD-OBJECT-FLEXIPAGE-ACTIVATION-PLAN: Staged FlexiPage override plan

- Status: accepted
- Owner: architect

## Context

WaveBuilder rejects CustomObject stage 1 -> FlexiPage stage 6, while manifests deploy original object XML including overrides. A single object node cannot represent creation and later activation.

## Decision

Use distinct object-foundation, page, and object-activation operations with generated source overlays; keep execution blocked until verified org and resume contracts exist

## Consequences

Read-only architecture is recorded; no deployment is enabled. Must verify Salesforce partial-object update semantics, implement operation-level fingerprint and no-replay resume, and independently test in approved disposable org before allowing execution.
