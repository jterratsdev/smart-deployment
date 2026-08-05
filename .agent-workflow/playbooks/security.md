# Security Playbook

## Security Review

- Identify auth, secrets, PII, tenant/workspace isolation, file path, shell execution, network, dependency, TLS, cookie/session, CORS, webhook, and infrastructure risks.
- Treat prompts, user input, provider output, tool output, generated artifacts, and persisted records as untrusted until validated.
- Define fail-closed behavior, redaction requirements, policy outcomes, human-review/defer behavior, and safe error messages before implementation proceeds.
- Verify tests cover hostile input, indirect prompt injection, secrets, PII, unsafe tools, tenant/workspace mismatch, path traversal or symlink escape, and redaction before persistence or evidence.
- Record approve, changes, or block with concrete release blockers, accepted risks, and required evidence.
