# OWD Sharing Barrier

Smart Deployment treats a source `sharingModel` change followed by same-object `SharingRules` as an eventually consistent security transition.

- Standalone `*.sharingRules-meta.xml` files depend on their owning `CustomObject`, custom criteria fields, and deployable `Role`, `Group`, or `Queue` principals.
- `roleAndSubordinates` remains a structured parser fact because it has no safe standalone Metadata API node.
- Internal and external sharing-model transitions are reported independently. Only `EntityDefinition.InternalSharingModel` satisfies the executable barrier.
- The changed object is deployed alone. The runner polls with bounded exponential backoff before deploying dependent sharing rules.
- Timeout or an unavailable authentication/network/query observation creates an automatic resumable postcondition after the successful OWD wave. `resume` rechecks the postcondition without redeploying that wave.

Configure polling in `.smart-deployment.json`:

```json
{
  "owdBarrier": {
    "timeoutMs": 120000,
    "initialDelayMs": 1000,
    "maximumDelayMs": 10000
  }
}
```

## Disposable-org mutation harness

The live E2E is skipped unless `SMART_DEPLOYMENT_LIVE_OWD=1`. It refuses the `cg-demo` alias and fails closed before mutation unless all of these are supplied:

- `SMART_DEPLOYMENT_LIVE_ORG`: an explicit disposable-org alias
- `SMART_DEPLOYMENT_LIVE_OWD_ROLE`: an existing disposable role developer name used by the dependent Case sharing rule
- `SMART_DEPLOYMENT_LIVE_OWD_ALLOW_MUTATION=I_APPROVE_DISPOSABLE_ORG_MUTATION`
- `SMART_DEPLOYMENT_LIVE_OWD_ALLOW_RESTORE=I_APPROVE_AUTOMATED_BASELINE_RESTORE`

The harness first observes both Case sharing models, then retrieves and validates a source-format Salesforce project
containing `Case.object-meta.xml`. Either failure exits before any deploy. After mutation begins, restoration deploys the
validated source directory and polls both internal and external models to their original values with a bounded timeout.
Restoration or cleanup failure fails the test. Normal CI never opts into this mutation path.

## Release report compatibility

Release reports use schema 1.1. This is an additive migration from schema 1.0: all required 1.0 fields remain
present with unchanged names, types, and semantics, while the optional `postconditions` collection records pending
or satisfied OWD barriers. Existing 1.0 consumers remain compatible if they ignore unknown fields. No dual serializer
is provided because there is no identified consumer that requires 1.0 output.
