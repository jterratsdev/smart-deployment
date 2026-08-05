<!-- setup-agents: 3.16.0 -->
# Threat Model Playbook

## Goal
Create or update a STRIDE-based threat model for the feature under review.

## When to Run
- New external integrations or APIs
- New user roles or permission changes
- Data model changes involving PII or sensitive fields

## Steps
1. Identify trust boundaries (org boundary, API gateway, external system).
2. Apply STRIDE categories:
   - **S**poofing — authentication controls
   - **T**ampering — data integrity, FLS/CRUD
   - **R**epudiation — audit trail, Event Monitoring
   - **I**nformation Disclosure — encryption, sharing rules
   - **D**enial of Service — governor limits, API rate limits
   - **E**levation of Privilege — permission sets, sharing model
3. Document findings in `docs/strategy/threat-model-<feature>.md`.
4. Cross-reference `docs/strategy/env-audit.md` for any secrets or credentials.
5. Record mitigations as decisions.


## Evidence
```bash
sf setup-agents evidence add --task <id> --role security --type report --summary "Threat Model Playbook completed"
```
