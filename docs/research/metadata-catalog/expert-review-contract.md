# Product Expert Metadata Review Contract

Product experts review documentation and repository evidence. They do not change runtime behavior directly.

For every reviewed metadata type, report:

| Field             | Requirement                                                                               |
| ----------------- | ----------------------------------------------------------------------------------------- | ------------------- | ------------- |
| `catalogKey`      | `<apiVersion>                                                                             | <deploymentChannel> | <vendorType>` |
| Product owner     | Applicable setup-agents profile(s) and one canonical cluster owner                        |
| Vendor identity   | Exact Metadata API or provider artifact name; aliases listed separately                   |
| Source format     | Canonical directory, filename, bundle/container ownership, and decomposition              |
| Discovery         | Current repository evidence and exact gap                                                 |
| Parser            | Fields required to establish identity and dependencies                                    |
| Dependencies      | Typed hard, soft, inferred, target-org, or provider dependencies                          |
| Execution order   | Prerequisites, dependents, barriers, activation, and eventual consistency                 |
| Lifecycle         | Metadata API, provider command, managed-package data, activation, publish, or manual step |
| Failure semantics | Expected Salesforce/provider failures and resume/rollback behavior                        |
| Security          | Secrets, principals, licenses, data-vs-metadata, and customer-org restrictions            |
| Evidence          | Authoritative documentation URL plus repository symbol/test or explicit missing evidence  |
| Confidence        | `proven`, `partial`, `absent`, or `not-applicable` for D/P/X/O/L                          |
| Tests             | Deterministic fixtures and any opt-in disposable-org proof required                       |

Rules:

- Documentation alone can establish vendor identity and candidate behavior, but cannot mark repository support `proven`.
- A deployment-order number without discovery, parsing, dependencies, and tests is not support.
- Product-specific guidance cannot override a shared canonical type without a documented conflict decision.
- Operational records and managed-package configuration data are not Metadata API types.
- Unknown auth, network, license, or permission failures are not proof that metadata is absent.
- Live validation must use disposable or explicitly approved non-customer orgs and store sanitized evidence only.
