# Decision SD-FLEXIPAGE-CG-DEMO-ACCOUNT: Disposable Account probe risk acceptance

- Status: accepted
- Owner: product_owner

## Context

QA previously blocked because full Account snapshot is not a proven rollback; user's latest instruction permits experimentation on disposable cg-demo but does not establish guaranteed restoration.

## Decision

User explicitly states cg-demo is a disposable demo org and requests the Account experiment. Accept bounded risk of a partial Account metadata deployment for this probe only, with before/after observations and restoration attempt if changed; no permission for other orgs or release.

## Consequences

An unexpected Account change might not be fully reversible. Preserve baseline and stop on unexpected state; do not infer production safety from this demo result.
