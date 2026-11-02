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

## Isolated cg-demo probe

`test/e2e/live-isolated-owd.e2e.test.ts` is a separate opt-in test for the explicitly approved
`cg-demo` demo org. Set `SMART_DEPLOYMENT_LIVE_ISOLATED_OWD=1` and
`SMART_DEPLOYMENT_LIVE_ISOLATED_OWD_APPROVAL=I_APPROVE_CG_DEMO_OBJECT_CREATE_DELETE` to run it.
It creates a uniquely named `SD_OwdProbe_*__c` object, deploys an OWD transition and a
dependent sharing rule using existing roles, then deletes only that object and verifies its
absence. It does not modify `Case`. If cleanup cannot be verified, the test fails and retains
its temporary project for diagnosis. This exercises Salesforce propagation and the poller with
direct `sf` deployments; it does not prove the plugin's `start`/`resume` orchestration.

The same opt-in test also exercises the locally linked `smart-deployment start` and `resume`:
it creates the isolated object at `ReadWrite`, validates the local plan, then submits the
`Private` object and its dependent sharing rule to the plugin with a 1 ms barrier timeout.
The test requires a persisted `timed-out` postcondition and completed OWD wave before it
rechecks propagation and resumes the dependent wave. It asserts a satisfied postcondition
in the completed resume result and deletes the isolated object afterward. This is a
deliberately forced timeout, not evidence of naturally slow propagation in the org.

## Release report compatibility

Release reports use schema 1.1. This is an additive migration from schema 1.0: all required 1.0 fields remain
present with unchanged names, types, and semantics, while the optional `postconditions` collection records pending
or satisfied OWD barriers. Existing 1.0 consumers remain compatible if they ignore unknown fields. No dual serializer
is provided because there is no identified consumer that requires 1.0 output.
