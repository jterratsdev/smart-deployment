# Decision SD-ACCOUNT-OMISSION-DEMO-EXPERIMENT: Disposable cg-demo Account risk boundary

- Status: accepted
- Owner: product_owner

## Context

Previous QA block reflects lack of guaranteed rollback; user accepts demo-org test risk. Use only unchanged setting to avoid deliberate non-override changes; if any drift, attempt only bounded restoration and report it.

## Decision

User explicitly identified cg-demo as a disposable demo org after approving Account. Authorize exactly one minimal Account deploy omitting actionOverrides after dry-run, with enableHistory=true unchanged, fresh full metadata and REST describe before/after; no blanket authorization of executor or production path.

## Consequences

This probe cannot prove all standard-object partial-update semantics, and a successful deploy without a changed setting only establishes omission behavior for this payload. Unexpected target drift may be difficult to restore completely.
