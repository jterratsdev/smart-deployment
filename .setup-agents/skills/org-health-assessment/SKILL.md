---
name: org-health-assessment
description: >-
  Assess the health of a Salesforce org across security, automation, permissions,
  data model, schema limits, license utilization, and large data volumes — grounded
  in a full metadata retrieve plus live-org queries, never in grep alone.
  USE FOR: org assessment, org health check, org audit, org review, brownfield
  onboarding, pre-go-live audit, implementation diagnostic, technical debt review,
  automation conflict, permission architecture, license utilization, LDV, data volume.
  Reusable by Security, Technical Architect, and Admin profiles.
---

# Salesforce Org Health Assessment

This skill carries the per-domain **criteria** for an org assessment. The method
**discipline** (grounding, grep-is-a-locator, declare-gaps, root-cause) lives in the
behavioral contract — this skill does not re-define it; it applies it per domain.

---

## 0. Declare the assessment PURPOSE first

State the purpose up front. It changes the OUTPUT framing only — the grounding
discipline is identical in every mode. **Default to neutral baseline reporting:** state
configuration as fact; flag a control as a risk only when the evidence shows it. A robust
password policy is "robust", not a finding. Do not hunt for fault, and do not presuppose
health either — a count is a locator, not a verdict.

| `purpose` | Output framing |
|-----------|----------------|
| `failed-diagnostic` | findings + severity + remediation; root-cause of degradation |
| `brownfield-onboarding` | baseline/orientation: what exists, current conventions, the automation/permission/data-model "lay of the land", and the constraints a new feature must respect (existing OWD, automation order on objects you will touch, headroom the feature consumes) |
| `pre-go-live` | release-readiness gate against the criteria below |

The domains and criteria stay the same across purposes; only the framing (findings vs
baseline vs readiness) changes.

---

## 1. Grounding precondition — TWO-PRONGED (do this before any domain analysis)

You cannot assess what you did not retrieve, and configuration alone cannot answer
runtime questions. Both prongs are mandatory; whatever a prong could not capture is a
**declared gap**, never an inference.

### Preflight — verify the connected user can actually read everything (BEFORE the retrieve)

A retrieve runs with the connected user's effective permissions and **silently omits any
metadata type that user cannot read** — the retrieve still "succeeds", so the gap is
invisible unless you check first. **System Administrator profile alone is NOT sufficient:**
several assessment-critical reads come from permission sets / permission-set groups, not the
profile. Verify access up front; if it is missing, STOP and request elevation rather than
producing an assessment over partial metadata.

Identify the connected user and check the permissions a full retrieve depends on:

```bash
# Who am I, and is this even the right org?
sf org display --json

# Effective permissions of the connected user (profile + all assigned permission sets)
sf data query --use-tooling-api --json --query "SELECT PermissionsModifyAllData, PermissionsViewAllData, PermissionsViewSetup, PermissionsAuthorApex, PermissionsViewAllProfiles, PermissionsManageRoles FROM PermissionSet WHERE Id IN (SELECT PermissionSetId FROM PermissionSetAssignment WHERE AssigneeId = '<connected-user-id>')"
```

Minimum permissions a complete assessment retrieve depends on (held by the profile OR an
assigned permission set / PSG — the effective union is what matters):
- **View Setup and Configuration** (`PermissionsViewSetup`) — read org-wide setup metadata.
- **Modify Metadata Through Metadata API Functions** (or **Modify All Data**) — Metadata API access.
- **View All Data** (`PermissionsViewAllData`) — read records across objects for the runtime queries.
- **Author Apex** (`PermissionsAuthorApex`) — retrieve Apex classes/triggers in full.
- **View All Profiles / Manage Roles** — read the permission-architecture domain.
- Feature-gated reads (e.g. Flows, Reports, Connected Apps) that require the corresponding
  permission set — a user without them yields a retrieve missing those types.

Rule: **record the preflight result as evidence.** If the connected user is a System
Administrator but lacks a required permission set / PSG, that is a declared gap on every
domain that depends on the missing read — do not infer the missing metadata, and do not
present the assessment as complete.

### Prong A — Full metadata retrieve (configuration domains)

Generate the manifest FROM the org, then retrieve against it. **Default = full retrieve**
(all supported types) so every domain analyzes complete metadata.

```bash
sf project generate manifest --output-dir ./manifest --from-org <org-username-or-alias>
sf project retrieve start --manifest ./manifest/package.xml
```

Rules:
1. **Default is full**, never scoped. A scoped retrieve pre-decides what is irrelevant
   before the analysis exists — the same grounding failure, upstream.
2. **Any exclusion is explicit and declared** in the output (what was skipped and why).
   Reports/ListViews/EmailTemplates/Translations are assessment SIGNALS (report sprawl,
   non-selective filters, dead metadata, localization), not "noise" to filter out.
3. **Capture retrieve fidelity as evidence**: which types and counts came back, and any
   that FAILED (e.g. Flows not downloaded due to a missing permission — a finding in
   itself, and a silent gap if unrecorded).
4. **Volume runs on the durable background lane.** A full retrieve of a large org (a real
   manifest can be ~21k components) is long-running and must survive the chat turn. Do
   NOT narrow scope just to finish inside one turn.

### Prong B — Live-org queries (runtime domains)

Licenses and data volumes do NOT live in metadata. The retrieve brings *configuration*,
not *runtime state*. Use the read-only org queries for the runtime domains. **Every
number links to the exact query that produced it, persisted as evidence — the query is
the evidence, not the assertion.** Report as *used vs allocated (headroom)*, never a
bare number.

```bash
# Org allocations / headroom (storage, API, async, etc.)
sf org list limits --json

# User licenses — assigned vs available per type
sf data query --query "SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense" --json

# Permission-set licenses
sf data query --query "SELECT PermissionSetLicense.MasterLabel, AssigneeId FROM PermissionSetLicenseAssign" --json

# Managed-package licenses
sf data query --query "SELECT AllowedLicenses, UsedLicenses, NamespacePrefix FROM PackageLicense" --json

# Row counts per object (the LDV locator)
sf data query --query "SELECT COUNT() FROM <Object>" --json

# Ownership/lookup skew (a few owners holding >10k records)
sf data query --query "SELECT OwnerId, COUNT(Id) FROM <Object> GROUP BY OwnerId" --json
```

A domain that needs runtime data but had no org connection is a **declared gap**, not an
inference. Reference docs: `app_limits_cheatsheet`, `large_data_volumes_bp`.

---

## 2. Domain criteria — a domain is not "done" with whole classes uncovered

Each domain below is a minimum-criteria checklist. Cover the whole domain or declare the
gap; do not report a domain complete because a grep returned something.

### 2.1 Security & identity

Mirror the `security-review.md` identity/auth layer:
- Password policies (`Security.settings` / `passwordPolicies`) — strength, expiration, lockout.
- My Domain — `canOnlyLoginWithMyDomainUrl`, `doesApiLoginRequireOrgDomain`.
- MFA / session — `lockSessionsToIp`, session timeout, high-assurance for sensitive ops.
- OAuth / connected apps, IP relaxation, login IP ranges.
- SSO / SAML configuration.
> grep locates the setting; you must read its VALUE to conclude. A `userPermissions`
> match is not a `passwordPolicies` finding. Report a control as a risk only when its
> value shows one — a robust policy is "robust".

### 2.2 Permission architecture
- Permission-set / PSG adoption vs over-permissioned profiles.
- Profiles still carrying user/object perms that belong in permission sets (Salesforce is
  deprecating profile-based perms).
- Sharing model: OWD and the sharing rules' real effect, not just their presence.

### 2.3 Automation architecture & order of execution (top degradation cause)
- Per-object automation inventory across ALL tools: Workflow Rules, Process Builder,
  Flows, Apex triggers.
- Flag **active automation in conflict**: multiple tools on the same object → recursion,
  clobbered field updates, unpredictable order. This is distinct from *dead* Flows
  (tech-debt, below).

### 2.4 Data-model integrity (beyond ERD shape)
- Duplicate rules and matching rules.
- Validation-rule coverage.
- Dangling references (e.g. the #543 evidence saw 83 dangling refs / 0 roles).
- Fields created-but-never-populated (a large field count is a locator — how many are
  actually used?). The ERD shows shape, not health.

### 2.5 Schema limits & headroom (report as headroom vs ceiling, never raw counts)
- Lookup / master-detail per object (max 40 relationships, 2 master-detail).
- Custom fields per object vs the 800/900 ceiling — which objects are near it?
- Formula complexity — compiled size (5,000-char / 4,000-byte), cross-object spans (10),
  formula-on-formula chains.
- Apex at the code level — class/trigger character size, and SOQL/DML/CPU governor
  headroom in hot paths (pairs with the `sf-code-analyzer` skill — use it to validate
  Apex/LWC/VF, do not re-derive its rules here).
- Picklist value counts, rollup summaries per object, indexes where relevant.

### 2.6 License utilization & LDV (runtime — Prong B)
- License headroom: used vs allocated per license type, traced to the query.
- LDV: row counts are the locator (>1M rows or steep growth). A high count is a finding
  only WITH context — query selectivity (are hot ListView/report filters on indexed
  fields?), data skew, skinny tables/archiving, storage headroom.
- Conclusion shape: not "X has 4M rows" but "X has 4M rows + a non-selective ListView
  filter on an unindexed field + no skinny table → query-timeout risk."

### 2.7 Metadata governance / drift
- Is metadata in version control? Is there a versioned source of truth?
- Org-vs-repo divergence (a frequent root cause of a failed implementation).

### 2.8 Managed packages / AppExchange
- Installed packages and version currency.
- Namespace-consumed limits (fields/objects a package burns against per-object ceilings).

### 2.9 Operational best-practice gaps
- Release/deploy hygiene, integration resilience, API/rate-limit headroom, async/batch
  monitoring, storage/capacity, data retention/archiving, backup/DR, technical-debt /
  unused metadata, test-coverage quality, PII / data classification.

### 2.10 Situational (include only when present; declare if skipped)
- Lightning adoption vs Classic / legacy Aura / Visualforce.
- Localization / multi-currency (translations are a signal here, not noise).
- Reporting health: folder sharing, report sprawl, non-selective filters.

---

## 3. Output

Frame per the declared `purpose` (section 0). In every mode:
- State configuration as fact, grounded in the retrieve / query evidence.
- Every limit/license/volume number reports as *used vs ceiling (headroom)* and links to
  its query or metadata source.
- Declare every coverage gap explicitly (type not retrieved, query not runnable, no org
  access). A domain with an uncovered class cannot be certified complete.
- In `brownfield-onboarding`, add the impact lens: for the objects/automation/permissions
  the new feature will touch, state the current order of execution, sharing model, and
  headroom it consumes.

---

## Quick Reference

| Step | Command |
|------|---------|
| Generate manifest from org | `sf project generate manifest --output-dir ./manifest --from-org <org>` |
| Full metadata retrieve | `sf project retrieve start --manifest ./manifest/package.xml` |
| Org limits / headroom | `sf org list limits --json` |
| User licenses | `sf data query --query "SELECT Name, TotalLicenses, UsedLicenses FROM UserLicense" --json` |
| Object row count (LDV) | `sf data query --query "SELECT COUNT() FROM <Object>" --json` |
| Ownership skew | `sf data query --query "SELECT OwnerId, COUNT(Id) FROM <Object> GROUP BY OwnerId" --json` |
| Validate Apex/LWC/VF | use the `sf-code-analyzer` skill |