![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C5 Regulated and Social Sectors Metadata Catalog Research

- Task: `PLUGIN-METADATA-CATALOG-RESEARCH`
- Cluster: `C5 Regulated and social sectors`
- Profiles: `fsc`, `health`, `education`, `nonprofit`, `public-sector`
- Canonical cluster: `C5`
- Author: Salesforce Professional Services
- Report version: 1.0
- Vendor baseline: Salesforce Summer '26, API `67.0`
- Retrieved: `2026-07-23`
- Scope: research only; no metadata implementation, package installation, data load, or org mutation

## Method and status contract

The table is sorted by priority and then `catalogKey`. A catalog key is
`<apiVersion>|<deploymentChannel>|<vendorType>`. Product attribution comes from
the setup-agents `3.15.0-rc` profiles in `.codex/`, then current official
Salesforce documentation. When an API version does not apply, the first segment
is `n/a`; the second segment remains the actual deployment channel. The local
`.setup-agents/references/` cache was empty.

Capability codes are:

- `P`: proven by an exact repository symbol and focused fixture/test evidence.
- `Pt`: partial; some behavior exists, but the row is not end-to-end proven.
- `A`: absent.
- `NA`: not applicable to the deployment channel.

The compact support column is `D/P/X/O/L`: discovery, parser, dependency,
ordering, and post-deploy/provider lifecycle. Metadata API exposure is vendor
evidence, not proof that this repository supports the type.

Vendor sources:

- `[SF-COV]` [Salesforce Metadata Coverage Report, API 67.0](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0)
- `[SF-APT]` [ActionPlanTemplate Metadata API reference](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_actionplantemplate.htm)
- `[SF-HS]` [Unified Health Scoring metadata and license requirements](https://developer.salesforce.com/docs/atlas.en-us.health_cloud.meta/admin_unified_health_scoring.htm/admin_unified_health_score_data_model.htm)
- `[SF-HC-CMDT]` [Health Cloud custom metadata configuration](https://developer.salesforce.com/docs/atlas.en-us.health_cloud.meta/null/admin_custom_metadata.htm)
- `[SF-HC-PKG]` [Health Cloud managed-package considerations](https://developer.salesforce.com/docs/atlas.en-us.health_cloud.meta/null/prerequisites_before_installation.htm)
- `[SF-FSC]` [Financial Services data models and managed-package category](https://developer.salesforce.com/docs/platform/data-models/guide/financial-services-cloud-category.html)
- `[SF-FSC-DM]` [Financial Services managed-package data model](https://developer.salesforce.com/docs/platform/data-models/guide/managed-package.html)
- `[SF-EDU]` [Education Cloud data models](https://developer.salesforce.com/docs/platform/data-models/guide/education-cloud-category.html)
- `[SF-EDA]` [EDA and K-12 managed-package data model](https://developer.salesforce.com/docs/platform/data-models/guide/eda-k12-managed-package.html)
- `[SF-NPC]` [Nonprofit Cloud fundraising data model](https://developer.salesforce.com/docs/platform/data-models/guide/fundraising.html)
- `[SF-NPSP]` [NPSP managed-package data model](https://developer.salesforce.com/docs/platform/data-models/guide/nonprofit-success-pack.html)
- `[SF-PSS]` [Public Sector data model category](https://developer.salesforce.com/docs/platform/data-models/guide/public-sector-solutions-category.html)
- `[SF-PSS-ASMT]` [Public Sector visits, inspections, and dynamic assessments](https://developer.salesforce.com/docs/platform/data-models/guide/visits-inspections-dynamic-assessments.html)
- `[SF-DM-NOTATION]` [Salesforce data model notation](https://developer.salesforce.com/docs/platform/data-models/guide/salesforce-data-model-notation.html)

The profile files are candidate signals, not vendor contracts. In particular,
several profile statements describe records, setup screens, or historical
managed-package models. The catalog promotes only names present in the current
Metadata Coverage Report as metadata types.

## Repository evidence baseline

The exact support baseline used by every row is:

- `src/types/metadata.ts:MetadataType` contains 81 internal names and none of
  the C5-owned vendor types below.
- `src/constants/deployment-order.ts:DEPLOYMENT_ORDER` orders the same 81 names
  and contains none of the C5-owned vendor types below.
- `src/analysis/metadata-gap-analysis-service.ts:SCANNER_SUPPORTED_TYPES`
  claims support for 26 types and contains none of the C5-owned types.
- `src/analysis/metadata-gap-analysis-service.ts:SOURCE_DIRECTORY_TYPES` and
  `FILE_SUFFIX_TYPES` have no explicit C5 source mapping. Generic suffix
  title-casing can report a name but is not scanner, parser, or graph support.
- `src/services/metadata-scanner-service.ts:scanPackageDirectory` composes
  code, automation, data, security, experience, AI, and additional scanners;
  no C5 scanner family is registered.
- `src/services/scanners/additional-metadata-scanner.ts:SIMPLE_FILE_SCANNERS`
  and `BUNDLE_SCANNERS` contain no C5-owned type.
- A repository search across `src/` and `test/` for all vendor names in the
  candidate table returned no matches.

Thus `A/A/A/A` is exact repository evidence, not an inference from missing test
fixtures alone.

## Deterministic candidate catalog

| Pri | catalogKey                                                   | Profile                                       | Vendor metadata / artifact                                                                                 | Internal type / alias                    | Channel                | D/P/X/O/L and exact repo evidence                                     | License, security, and package risk                                                                                             | Confidence  | Fixture and org validation                                                                                                                                                              |
| --- | ------------------------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------- | ---------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | `67.0\|metadata-api\|ActionPlanTemplate`                     | `fsc`, `health`, `education`, `public-sector` | `ActionPlanTemplate` (`.apt`, `actionPlanTemplates/`)                                                      | none                                     | `metadata-api`         | `A/A/A/A/A`; absent from every baseline symbol above; `[SF-APT]`      | `IndustriesActionPlans` license; target entities and item values can expose regulated process design                            | high        | Local: tasks, dependencies, target entity, formula, and stable sort. Org: retrieve/deploy with the license, activate/use a template, verify target-object access and rollback.          |
| P0  | `67.0\|metadata-api\|AssessmentConfiguration`                | `health`, `education`, `public-sector`        | Dynamic assessment configuration                                                                           | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-PSS-ASMT]`            | Health/Public Sector/education feature entitlement; assessment contents can encode clinical, student, or citizen decision logic | medium-high | Local: configuration plus question/set references. Org: licensed retrieval, deploy, run an assessment, verify inactive/draft behavior and least privilege.                              |
| P0  | `67.0\|metadata-api\|AssessmentQuestion`                     | `health`, `education`, `public-sector`        | Assessment question definition                                                                             | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-PSS-ASMT]`            | Questions may reveal PHI, FERPA data categories, eligibility, or enforcement policy                                             | high        | Local: question versions, option sources, namespace, deterministic redaction checks. Org: deploy/publish and verify response rendering, versioning, and restricted-user access.         |
| P0  | `67.0\|metadata-api\|AssessmentQuestionSet`                  | `health`, `education`, `public-sector`        | Assessment question set                                                                                    | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Feature/license gated; ordering with questions, versions, and OmniStudio assets                                                 | high        | Local: set-to-question dependency fixture. Org: deploy complete set, publish associated assessment, test missing-question failure and rollback.                                         |
| P0  | `67.0\|metadata-api\|FundraisingConfig`                      | `nonprofit`                                   | Nonprofit fundraising configuration                                                                        | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-NPC]`                 | New Nonprofit Cloud license; payment, gift, and designation defaults are financially sensitive                                  | high        | Local: references to gift/payment/designation schema and secret scan. Org: licensed retrieve/deploy, enter and reverse a synthetic gift, verify accounting defaults and access.         |
| P0  | `67.0\|metadata-api\|GiftEntryGridTemplate`                  | `nonprofit`                                   | Gift Entry grid template                                                                                   | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-NPC]`                 | New Nonprofit Cloud versus NPSP version drift; donor/payment fields can be PCI/PII sensitive                                    | high        | Local: field/default/required-column dependencies. Org: open template, enter synthetic batch, reject raw payment credentials, verify permissions and rollback.                          |
| P0  | `67.0\|metadata-api\|ScoreCategory`                          | `health`                                      | Unified Health Scoring category with range and calculated-insight children                                 | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-HS]`                  | Separate Unified Health Scoring license; score design can create clinical bias and Data 360 coupling                            | high        | Local: parent/child category, range, and calculated-insight references. Org: licensed deploy, score sync with synthetic patients, bias review, FLS/sharing review, deactivate/rollback. |
| P0  | `n/a\|managed-package-data\|EDAManagedConfiguration`         | `education`                                   | `hed__*` object records, record types, affiliations, terms, courses, program plans, trigger/config records | none; not metadata aliases               | `managed-package-data` | `NA/NA/NA/NA/A`; no package-data adapter; `[SF-EDA]`                  | EDA package version/namespace, FERPA, upgrade ownership, record-ID ordering                                                     | high        | Local: classifier must keep `hed__*` records out of metadata catalog. Org: pinned EDA sandbox, synthetic hierarchy/enrollment data, package-upgrade and rollback rehearsal.             |
| P0  | `n/a\|managed-package-data\|FSCManagedConfiguration`         | `fsc`                                         | `FinServ__*` operational/config records other than explicit Custom Metadata records                        | none; not metadata aliases               | `managed-package-data` | `NA/NA/NA/NA/A`; no package-data adapter; `[SF-FSC]`, `[SF-FSC-DM]`   | Mixed standard-platform and legacy package models, package push upgrades, financial PII, regulatory retention                   | high        | Local: namespace/channel classifier. Org: exact FSC package and licenses, synthetic household/accounts/referrals, rollup and ARC smoke, upgrade and rollback rehearsal.                 |
| P0  | `n/a\|managed-package-data\|HealthCloudManagedConfiguration` | `health`                                      | `HealthCloudGA__*` records and package-owned setup data                                                    | none; not metadata aliases               | `managed-package-data` | `NA/NA/NA/NA/A`; no package-data adapter; `[SF-HC-PKG]`               | Package is auto-updated and one API version behind core for packaged components; HIPAA/PHI and consent controls                 | high        | Local: package-data classification and PHI fixture prohibition. Org: exact package/license sandbox, synthetic patients only, care workflow/sharing/audit/upgrade/rollback validation.   |
| P0  | `n/a\|managed-package-data\|NPSPManagedConfiguration`        | `nonprofit`                                   | `npsp__*`, `npe01__*`-`npe05__*` records and package-owned settings                                        | none; not metadata aliases               | `managed-package-data` | `NA/NA/NA/NA/A`; no package-data adapter; `[SF-NPSP]`                 | NPSP versus new Nonprofit Cloud model drift, package automation, donor PII, PCI boundaries                                      | high        | Local: namespace/channel classifier and token-only payment fixture. Org: pinned NPSP sandbox, synthetic recurring gift/GAU allocation, rollup/trigger/upgrade/rollback validation.      |
| P1  | `67.0\|metadata-api\|AccountingModelConfig`                  | `fsc`                                         | Accounting model configuration                                                                             | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Financial Services feature/edition; accounting mapping and effective-state risk                                                 | medium-high | Local: model/field mapping references and deterministic order. Org: licensed retrieve/deploy, reconcile synthetic balances, review segregation of duties, and rollback.                 |
| P1  | `67.0\|metadata-api\|ActionableListDefinition`               | `fsc`, `health`                               | Actionable list definition                                                                                 | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Product license and list-assignment semantics; filters can expose financial or health records                                   | medium-high | Local: object, field, filter, assignee, and KPI dependencies. Org: restricted-user list execution, sharing/FLS review, package/source availability, rollback.                           |
| P1  | `67.0\|metadata-api\|ApplicationRecordTypeConfig`            | `public-sector`                               | Application record-type configuration                                                                      | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-PSS]`                 | Public Sector license; application routing and eligibility behavior; object/record-type drift                                   | medium      | Local: application object and `RecordType` references. Org: licensed permitting/grants fixture, submit synthetic application, verify routing/accessibility and rollback.                |
| P1  | `67.0\|metadata-api\|ApplicationSubtypeDefinition`           | `public-sector`                               | Application subtype definition                                                                             | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-PSS]`                 | Product entitlement; subtype changes can alter intake, fees, approvals, and public-facing forms                                 | medium      | Local: subtype/application/form dependencies. Org: end-to-end intake with keyboard/screen-reader check, approval/fee validation, rollback.                                              |
| P1  | `67.0\|metadata-api\|BusinessProcessGroup`                   | `public-sector`, `education`                  | Industry business-process group                                                                            | none; distinct from C1 `BusinessProcess` | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Industries feature/license; must not be aliased to CustomObject child `BusinessProcess`                                         | medium      | Local: type-definition/process membership and alias-negative fixture. Org: licensed process execution, version/activation check, rollback.                                              |
| P1  | `67.0\|metadata-api\|BusinessProcessTypeDefinition`          | `public-sector`, `education`                  | Industry business-process type definition                                                                  | none; distinct from C1 `BusinessProcess` | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Industries feature/license and activation; process decisions may encode eligibility or enforcement policy                       | medium      | Local: group, target object, stage, and dependency fixture. Org: execute synthetic process with least privilege, audit decision path, rollback.                                         |
| P1  | `67.0\|metadata-api\|CareBenefitVerifySettings`              | `health`                                      | Benefit verification settings                                                                              | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Health Cloud payer feature, PHI, external eligibility service, org settings lifecycle                                           | high        | Local: settings and credential reference redaction. Org: licensed payer org, synthetic eligibility request, no-secret round trip, audit and rollback.                                   |
| P1  | `67.0\|metadata-api\|CareLimitType`                          | `health`                                      | Care/coverage limit type                                                                                   | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Health license; benefit limits affect care authorization and require compliance review                                          | high        | Local: unit/product/coverage dependencies. Org: licensed deploy, synthetic authorization boundary tests, versioning and rollback.                                                       |
| P1  | `67.0\|metadata-api\|CareProviderAfflRoleConfig`             | `health`                                      | Provider-affiliation role configuration                                                                    | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Provider Management entitlement; role changes affect network visibility and access                                              | high        | Local: role/object references. Org: licensed provider network, restricted-role search/access tests, audit and rollback.                                                                 |
| P1  | `67.0\|metadata-api\|CareProviderSearchConfig`               | `health`                                      | Provider search configuration                                                                              | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Provider Management license; searchable fields can expose sensitive provider/member data and affect network adequacy            | high        | Local: searchable object/field/filter dependencies. Org: licensed search, FLS/restriction-rule tests, deterministic results and rollback.                                               |
| P1  | `67.0\|metadata-api\|CareRequestConfiguration`               | `health`                                      | Care request / authorization configuration                                                                 | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Utilization Management entitlement, PHI, authorization decision and audit obligations                                           | high        | Local: request/item/status/Flow dependencies. Org: synthetic prior authorization lifecycle, segregation of duties, audit and rollback.                                                  |
| P1  | `67.0\|metadata-api\|CareSystemFieldMapping`                 | `health`                                      | Health system field mapping                                                                                | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | EHR/FHIR mapping, PHI, source-system identifiers, data-integrity and rollback risk                                              | high        | Local: source/target object-field typed edges and invalid-map fixture. Org: synthetic FHIR payload round trip, reconciliation, audit and rollback.                                      |
| P1  | `67.0\|metadata-api\|CourseWaitlistConfig`                   | `education`                                   | Course waitlist configuration                                                                              | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-EDU]`                 | Education Cloud edition and Academic Operations entitlement; FERPA and enrollment fairness                                      | medium      | Local: course/offering/term/policy dependencies. Org: licensed Academic Operations org, synthetic capacity/waitlist promotion, fairness/access review, rollback.                        |
| P1  | `67.0\|metadata-api\|FinancialPortfolioUiConfig`             | `fsc`                                         | Financial portfolio UI configuration                                                                       | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`                             | Financial Services license; field visibility can expose balances, holdings, and suitability data                                | medium-high | Local: object/field/layout dependencies. Org: advisor versus restricted-user rendering, FLS/sharing review, package-version check, rollback.                                            |
| P1  | `67.0\|metadata-api\|LearningAchievementConfig`              | `education`                                   | Learning achievement configuration                                                                         | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-EDU]`                 | Education/learning entitlement; credentials and student outcomes are FERPA-sensitive                                            | medium      | Local: learning item, achievement, object/field dependencies. Org: issue/revoke synthetic achievement, sharing/audit/accessibility review, rollback.                                    |
| P1  | `67.0\|metadata-api\|LearningItemType`                       | `education`                                   | Learning item type                                                                                         | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `[SF-EDU]`                 | Education/learning feature; taxonomy and lifecycle can vary by release                                                          | medium      | Local: item type and related schema fixture. Org: create/use synthetic learning item and program, verify package/license availability and rollback.                                     |
| P1  | `67.0\|metadata-api\|RelationshipGraphDefinition`            | `fsc`                                         | Relationship graph / ARC definition candidate                                                              | none                                     | `metadata-api`         | `A/A/A/A/A`; baseline absence; `[SF-COV]`, `.codex/fsc.md` ARC signal | ARC feature/license; graph visibility is not automatically equivalent to record sharing                                         | medium      | Local: object, relationship, card/action, Flow/QuickAction dependencies. Org: licensed ARC retrieve/deploy, restricted-profile visibility, action execution, rollback.                  |

## C1 shared-type references

C1 remains canonical owner for shared platform metadata. C5 must reference,
not duplicate, those rows:

| C5 artifact                                                                                              | C1 vendor type                                                                           | C5-specific validation                                                                                                             |
| -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| FSC `FinServ__RollupByLookupConfig__mdt` records and Health Cloud settings such as Care Plan Record Type | `CustomMetadata`                                                                         | Namespace/package version, active-record semantics, clone/deactivate behavior, synthetic rollup or care-plan smoke; `[SF-HC-CMDT]` |
| Sector schema extensions, record types, field sets, layouts, validation rules, restriction/sharing rules | `CustomObject` and its source-format children, `Layout`, `SharingRules`, `PermissionSet` | FSC financial privacy; HIPAA/PHI; FERPA; donor/PCI; government PII/FedRAMP and Section 508                                         |
| Care, student-success, donor, permitting, inspection, referral, and authorization automation             | `Flow`                                                                                   | Synthetic data only, explicit human decision gates, auditability, package-owned object restrictions                                |
| Experience portals and public intake                                                                     | C1 Experience types                                                                      | Guest-user access, consent, WCAG/Section 508, publish lifecycle, no PHI/FERPA/PII leakage                                          |
| Permission grants supplied by licensed products                                                          | `PermissionSet`                                                                          | Do not duplicate vendor permission sets; validate permission-set licenses and least privilege in target org                        |

The current C1 report records partial support and exact gaps for these shared
types. A C5 implementation must consume the future shared capability registry
and attach sector validation requirements rather than create parallel aliases.

## Object and data boundary

Salesforce product ERDs describe database entities, not Metadata API type
names. `[SF-DM-NOTATION]` explicitly says ERD entities typically map to objects
and that managed object API names may carry namespaces and `__c`/`__mdt`
suffixes. Therefore:

- FSC names such as `FinServ__FinancialAccount__c`,
  `FinServ__Referral__c`, and `FinServ__ContactContactRelation__c` are
  managed-package objects/records or `CustomObject` contents.
- Health names such as `CarePlan`, `ClinicalEncounter`, `HealthCondition`,
  `MedicationStatement`, and `DiagnosticSummary` are standard/product objects
  and operational data.
- Education names such as `hed__Course__c`,
  `hed__Course_Enrollment__c`, `ProgramEnrollment`, and
  `hed__Affiliation__c` are managed or standard objects/records.
- Nonprofit names such as `npsp__Allocation__c`,
  `npe03__Recurring_Donation__c`, `ProgramEngagement__c`, and
  `Deliverable__c` are managed, standard, or product objects/records.
- Public Sector names such as `BusinessLicenseApplication`, `Inspection`,
  `Visit`, `PublicComplaint`, and `RegulatoryCodeViolation` are product objects
  and operational records.

None is a new `MetadataType`. Their schema customization belongs to the C1
`CustomObject` family. Their records require a separate, package-aware data
lifecycle and are intentionally excluded from metadata deployment support.

`AssessmentQuestion`, `CareLimitType`, `LearningItemType`, and similar names
appear in both product data models and the Metadata Coverage Report. The table
includes only the vendor metadata component represented by the API 67 coverage
entry. It does not imply that same-named runtime records are metadata or that
record migration is handled.

## Exact cross-cutting gaps

- C5 types are absent from the stable union, scanner registries, parsers,
  dependency graph rules, ordering map, gap analyzer's explicit maps, fixtures,
  and lifecycle providers.
- Generic gap-analysis title-casing can detect a suffix without proving the
  source folder, compound shape, canonical vendor name, or parse behavior.
- Current scanners cannot attach package namespace, product profile, license,
  compliance regime, feature setting, or minimum API version to a component.
- There is no package-aware data channel for FSC, Health Cloud, EDA, or NPSP.
  Treating their records as metadata would bypass data ordering, validation,
  masking, audit, and rollback requirements.
- C5 configuration frequently crosses C1 and C4 types: CustomObject children,
  Flow, PermissionSet, Experience, OmniStudio, and Industries decision assets.
  The catalog needs cross-cluster references and one canonical owner per key.
- A successful Metadata API deploy cannot prove activation, package behavior,
  user access, accessibility, clinical/financial correctness, or rollback.

## Prioritized implementation slices

1. **P0 registry and negative boundaries.** Implement the shared typed
   capability registry from the architecture handoff. Seed C5 keys, profile
   ownership, API version, explicit source shape, license/compliance tags, and
   the four `managed-package-data` blockers. Add negative fixtures proving
   sector object API names never become metadata types.
2. **P0 regulated shared families.** Reuse C1 node IDs and aliases for
   `CustomMetadata`, `CustomObject`, `Flow`, `PermissionSet`, and Experience
   metadata. Add sector validation policy as catalog data, not branches in
   `metadata-scanner-service.ts`.
3. **P0 assessments and action plans.** Add focused scanners/parsers for
   `ActionPlanTemplate`, `AssessmentConfiguration`, `AssessmentQuestion`, and
   `AssessmentQuestionSet`. Preserve version/status and typed links to target
   objects, questions, OmniStudio assets, Flow, and actions.
4. **P0 nonprofit and health scoring.** Add `FundraisingConfig`,
   `GiftEntryGridTemplate`, and `ScoreCategory` with secret/PII-safe fixtures,
   child ordering, lifecycle state, and mandatory licensed-org evidence.
5. **P1 Health configuration family.** Add the six `Care*` types as one
   registry-backed family but separate parser modules where schemas differ.
   Require synthetic FHIR/authorization/provider-search evidence and prohibit
   PHI fixtures.
6. **P1 FSC, Education, and Public Sector families.** Add small scanners for
   accounting/portfolio/relationship graph, course/learning, and
   application/business-process types. Keep activation and product behavior
   blocked until the matching licensed-org matrix passes.
7. **Provider-data discovery only.** Add read-only detection/reporting for
   managed package records after a package-data contract exists. Do not add
   deployment execution, and never infer channel from namespace alone without
   catalog evidence.

No slice should add C5 branches to `src/services/metadata-scanner-service.ts` or
expand the hardcoded support set in isolation. Extend focused scanner
registries and derive gap status from the capability catalog.

## Regulated-sector validation constraints

| Profile         | Mandatory validation boundary                                                                                                                                                                            |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fsc`           | Licensed org and exact package version; synthetic financial accounts only; household/rollup/ARC behavior; least privilege, segregation of duties, audit, upgrade, and rollback evidence.                 |
| `health`        | Licensed Health Cloud features and package version; synthetic PHI only; consent, care-team sharing, Shield/audit configuration, FHIR reconciliation, clinical safety and bias review, rollback evidence. |
| `education`     | Education/EDA version pin; synthetic students only; FERPA access, institutional hierarchy, enrollment fairness, SIS/LMS reconciliation, accessibility, upgrade and rollback evidence.                    |
| `nonprofit`     | Explicit NPSP versus new Nonprofit Cloud target; synthetic donors/gifts; tokenized payment data only; PCI/PII review, rollup/accounting reconciliation, package upgrade and rollback evidence.           |
| `public-sector` | Public Sector/Government Cloud target and residency/FedRAMP requirements; synthetic constituents; WCAG 2.1 AA/Section 508, guest access, approvals/fees/inspections, audit and rollback evidence.        |

Fixtures prove deterministic parsing only. They must contain no real financial,
clinical, student, donor, payment, or constituent data. Org evidence must record
edition, licenses, feature settings, namespace/package versions, API version,
principal model, validation command, behavior result, and rollback result.

## Limitations

- `.setup-agents/references/` contained no cached references. Current official
  Salesforce pages were used directly and the cache miss is recorded here.
- API `67.0` coverage establishes exposure, not availability in every org.
  Edition, permission-set license, feature setting, package version, namespace,
  and migration history remain target-org facts.
- Several API 67 metadata reference pages expose little descriptive text.
  Product ownership for lower-confidence rows is based on the profile signal,
  vendor type name, coverage entry, and related official product data model.
  Licensed-org retrieval is required before implementation promotion.
- No Salesforce org, package, payment provider, EHR, SIS/LMS, Experience site,
  or Government Cloud environment was queried or changed.
- No attempt was made to catalog all cross-industry C4 assets used by these
  products. OmniStudio and Industries decision/process metadata retain their
  C4 owner and should be referenced by catalog key.
- Repository inspection was intentionally limited to metadata contracts,
  scanner registries/orchestration, gap analysis, ordering, and C1 ownership.
  No source or test file was changed.

## Architectural concerns

### Inherited

The architecture handoff's typed capability registry and channel split are
required here. One correction is important: not every sector artifact is
managed-package data. API 67 exposes product configuration such as
`FundraisingConfig`, `GiftEntryGridTemplate`, the Health `Care*` family, and
`ScoreCategory` through Metadata API. Those need metadata scanners plus
license/lifecycle gates. The managed package's operational records remain a
separate blocked channel.

### Self-imposed

None. This report proposes repository catalog/scanner/parser/dependency and
validation slices only. It introduces no Salesforce custom objects, fields,
labels, permission sets, Flows, package records, or production data.
