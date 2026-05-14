# Release Playbook

## Deployment Risk Challenge

- Challenge rollout, rollback, config, API, security-boundary, observability, and production-impact complexity before sign-off.
- Flag smells such as excessive rollout waves for the story size, rollback complexity disproportionate to the change, production-impacting config/API changes, security-boundary changes, and missing observability.
- If challenge findings exceed the project's risk threshold, record a blocking release review or action-policy approval request instead of approving the runbook.
- If no challenge findings exist, state `None` explicitly.

- Confirm CI, versioning, release notes, rollback path, and operational risk.
- Verify published artifacts or deployment evidence before closing the work.
- Record go/no-go rationale and any follow-up monitoring needs.

## Release Promote

- Validate changelog or release note impact, smoke evidence, rollback evidence, and customer/support readiness.
- Confirm whether the change ships alone or is batched with adjacent completed tasks.
- Record promote, hold, or accepted-risk rationale before closing the release phase.
