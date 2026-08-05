<!-- setup-agents: 3.16.0 -->
# Environment Variable Audit

## Goal
Document and audit all environment variables, secrets, and credentials used by the project.

## Location
Maintain this audit at `docs/strategy/env-audit.md` in the project root.

## Template

| Variable | Purpose | Storage | Rotation | Owner |
|----------|---------|---------|----------|-------|
| SF_TARGET_ORG | Deploy target | CI secret | Per sprint | DevOps |
| SLACK_WEBHOOK_URL | Notifications | Named Credential | Quarterly | Admin |

## Checklist
- [ ] Every `process.env.*` reference in source has a corresponding row
- [ ] No secrets stored in `.env` files committed to git
- [ ] All secrets use Named Credentials, Custom Metadata, or CI secret store
- [ ] Rotation schedule defined for each credential
- [ ] Stale/unused variables flagged for removal

## Security Cross-Reference
This playbook is referenced by the security-review phase. Any new environment variable introduced MUST be recorded here before the security gate passes.


## Evidence
```bash
sf setup-agents evidence add --task <id> --role security --type report --summary "Environment Variable Audit completed"
```
