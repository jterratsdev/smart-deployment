<!-- setup-agents: 3.16.0 -->
# Security Review Playbook

## Goal
Perform a security assessment of the deliverable before it proceeds to QA.

## Cross-References
- **env-audit.md**: If new environment variables or secrets were introduced, ensure they are documented in `docs/strategy/env-audit.md` and follow the Named Credentials pattern.
- **Security Profile**: Review `.cursor/rules/security-standards.mdc` for project-specific security gates.

## Checklist
- [ ] No hardcoded credentials, tokens, or secrets in source code
- [ ] New environment variables documented in `docs/strategy/env-audit.md`
- [ ] CRUD/FLS enforcement: all DML uses `Security.stripInaccessible()` or `WITH USER_MODE`
- [ ] No SOQL injection: all dynamic queries use bind variables
- [ ] XSS prevention: all user input rendered via `lightning:formattedText` or encoded
- [ ] CSRF tokens present on all state-changing Visualforce pages
- [ ] Connected Apps use minimal OAuth scopes
- [ ] Sharing model respected: no `without sharing` unless documented
- [ ] `sf code-analyzer run --target force-app` passes with no high-severity findings (run the analyzer; do not hand-review)

## Checklist — Identity & Authentication (org assessments)
> When assessing an ORG (not just a code change), the identity/auth layer is in scope and
> is usually already in the retrieved metadata — do NOT skip it. Answer each item by
> READING the named metadata, not by asserting the control exists.
- [ ] Password policies (`Security.settings` → `passwordPolicies`): complexity, expiration, lockout, history
- [ ] My Domain / login enforcement (`MyDomain.settings`, `Security.settings`): `canOnlyLoginWithMyDomainUrl`, `doesApiLoginRequireOrgDomain` — is raw `login.salesforce.com` still allowed?
- [ ] MFA / session security (`Security.settings`): session timeout, `lockSessionsToIp`, high-assurance for sensitive operations
- [ ] OAuth scopes & IP relaxation on Connected / External Client Apps
- [ ] SSO / SAML / external identity providers — configured and enforced?
- [ ] If any of the above metadata was NOT retrieved, declare it a coverage gap — do not report the domain "clean".

## Grounding & evidence discipline
- A finding from a `grep`/file COUNT is a LOCATOR, not evidence. Before publishing it, READ
  the matched metadata and interpret it — e.g. 335 `sharingRules` files → how many hold real
  rules vs empty shells, and are they inert under a public OWD?
- VERIFY every match to avoid false positives (a `passwordPolicies` grep that actually matched
  `userPermissions` is a false finding, not a finding).
- Declare missing metadata as a gap: a sharing model with 0 roles / 0 groups retrieved cannot
  be certified — say so, do not infer.


## Evidence
```bash
sf setup-agents evidence add --task <id> --role security --type report --summary "Security Review Playbook completed"
```
