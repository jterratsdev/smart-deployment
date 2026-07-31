![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C7 Communications and Media Metadata Catalog Research

- Task: `PLUGIN-METADATA-CATALOG-RESEARCH`
- Cluster: `C7 Communications and media`
- Profiles: `communications`, `media`
- Canonical cluster: `C7`
- Author: Salesforce Professional Services
- Report version: 1.0
- Vendor baseline: Salesforce Summer '26, API `67.0`
- Retrieved: `2026-07-23`
- Scope: research only; no source, test, org, package, or provider mutation

## Method and status contract

The stable catalog key is
`<apiVersion>|<deploymentChannel>|<vendorMetadataTypeOrArtifact>`. When an API
version does not apply, the version segment is `n/a`; the second segment always
preserves the actual deployment channel. Rows are ordered by priority and then
by implementation dependency.

Capability codes are:

- `P`: proven by an exact repository symbol and focused fixture/test evidence.
- `Pt`: partial behavior exists, but the capability is not end-to-end proven.
- `A`: absent.
- `NA`: not applicable to the deployment channel.

The compact support column is `D/P/X/O/L`: discovery, parsing, dependency
analysis, ordering, and post-deploy/provider lifecycle. Manifest discovery
alone is `Pt`, not support.

The setup-agents profiles are version `3.15.0-rc`. The local
`.setup-agents/references/` cache was empty, so current official Salesforce
documentation was used directly. The unversioned metadata-type index and API
`67.0` coverage report were both checked to avoid treating profile vocabulary
as vendor metadata names.

## Vendor sources

### Metadata API

- `[SF-COV-67]` [Metadata Coverage Report, API 67.0](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0)
- `[SF-TYPES]` [Current Metadata Types](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types)
- `[SF-COMMS-CONSOLE]` [CommsServiceConsoleSettings](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_commsserviceconsolesettings.htm)
- `[SF-TMF-OUT]` [TmfOutboundNotificationSettings](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_tmfoutboundnotificationsettings.htm)
- `[SF-MEDIA-ADS]` [MediaAdSalesSettings](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mediaadsalessettings.htm)
- `[SF-MEDIA-AGENT]` [MediaAgentSettings](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mediaagentsettings.htm)

API `67.0` reports Metadata API and source-tracking exposure for all four C7
settings types. It does not report package or change-set support for them.

### Communications and managed DataPacks

- `[SF-CME-API]` [Communications, Media, and Energy common APIs](https://developer.salesforce.com/docs/industries/cme/guide/get-started.html)
- `[SF-CME-CATALOG]` [Create products and a catalog](https://developer.salesforce.com/docs/industries/cme/guide/comms-t-create-products-and-a-catalog.html)
- `[SF-CME-DIGITAL]` [Digital Commerce](https://developer.salesforce.com/docs/industries/cme/guide/comms-t-digital-commerce.html)
- `[SF-CME-CACHE]` [Prerequisites to regenerate cache](https://developer.salesforce.com/docs/industries/cme/guide/comms-t-pre-requisites.html)
- `[SF-CME-POPULATE]` [Populate Cache APIs](https://developer.salesforce.com/docs/industries/cme/guide/comms-t-populate-cache-apis.html)
- `[SF-VBT]` [Vlocity Build manifest and DataPack keys](https://help.salesforce.com/s/articleView?id=000396629&language=en_US&type=1)
- `[SF-COMMS-DM]` [Communications product and catalog data model](https://developer.salesforce.com/docs/platform/data-models/guide/product-catalog-management.html)

### Media and external integrations

- `[SF-MEDIA-DM]` [Media data model gallery](https://developer.salesforce.com/docs/platform/data-models/guide/media-cloud-category.html)
- `[SF-MEDIA-ADS-DM]` [B2B ad sales data model](https://developer.salesforce.com/docs/platform/data-models/guide/b2b-ad-sales.html)
- `[SF-MEDIA-PLAN-DM]` [Advertising media plan data model](https://developer.salesforce.com/docs/platform/data-models/guide/advertising-media-plan.html)
- `[SF-MEDIA-PROPERTY-DM]` [Media property data model](https://developer.salesforce.com/docs/platform/data-models/guide/media-property.html)
- `[SF-MEDIA-MULE]` [MuleSoft Direct integrations for Media Cloud](https://developer.salesforce.com/docs/industries/media-cloud/guide/mulesoft-direct-integrations.html)
- `[SF-MEDIA-MULE-START]` [Get started with MuleSoft Direct for Media Cloud](https://developer.salesforce.com/docs/industries/media-cloud/guide/get-started.html)
- `[SF-DM-NOTATION]` [Salesforce data model notation](https://developer.salesforce.com/docs/platform/data-models/guide/salesforce-data-model-notation.html)

## Exact repository evidence

| Id  | Repository evidence                                                                                                                                                                                                                                                                            |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `src/types/metadata.ts:13-105` defines the internal metadata union. None of the four C7 native settings types is present.                                                                                                                                                                      |
| R2  | `src/constants/deployment-order.ts:40-143,161-162` has no C7-specific type; unknown types receive priority `99`.                                                                                                                                                                               |
| R3  | `src/analysis/metadata-gap-analysis-service.ts:76-105` has an independent 26-type support set with no C7 type.                                                                                                                                                                                 |
| R4  | `src/analysis/metadata-gap-analysis-service.ts:107-152,319-343` has no C7 directory or suffix mapping. Generic `*.settings-meta.xml` inference collapses to `Settings`; manifests can preserve an arbitrary vendor name but still report it unsupported.                                       |
| R5  | `src/services/metadata-scanner-service.ts:175-192,195-234` composes generic platform scanners and parses object schema/custom metadata, not Communications or Media product records.                                                                                                           |
| R6  | `src/deployment/special-deployment-plan.ts:16-27` permits only `sf` and `vlocity` commands and has no CME cache, TMF endpoint, MuleSoft, or ad-server lifecycle phase.                                                                                                                         |
| R7  | `src/deployment/special-deployment-plan.ts:269-294` detects any path under `vlocity` plus broad OmniStudio labels, then emits one placeholder `vlocity packDeploy` command. It does not identify a DataPack key, package namespace/version, dependencies, activation, cache jobs, or rollback. |
| R8  | Exact-token search across `src/` and `test/` finds no `CommsServiceConsoleSettings`, `TmfOutboundNotificationSettings`, `MediaAdSalesSettings`, `MediaAgentSettings`, CME product DataPack, Digital Commerce cache, or Media AdTech integration implementation/fixture.                        |
| R9  | `sfdx-project.json:11` pins repository source to API `61.0`, six versions behind this report.                                                                                                                                                                                                  |
| R10 | `docs/research/metadata-catalog/c1-core-crm-channels.md` owns shared platform metadata; `docs/research/metadata-catalog/c4-integration-industries.md` owns shared OmniStudio, Industries Order Management, document, decision, and Mule application mechanics.                                 |

## Deterministic candidate catalog

| Pri | catalogKey                                                       | Product        | Vendor metadata or artifact                                                                                                                  | Internal alias                                                          | Channel                | D/P/X/O/L       | Exact evidence and gap                                                                                                                                                                                                                                         | Risk / confidence                                                                                                            | Deterministic fixture                                                                                                                                                     | Required org/provider validation                                                                                                                                                                                     |
| --- | ---------------------------------------------------------------- | -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ---------------------- | --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | `67.0\|metadata-api\|CommsServiceConsoleSettings`                | Communications | Communications Service Console org settings                                                                                                  | none                                                                    | `metadata-api`         | `Pt/A/A/A/A`    | `[SF-COV-67]`, `[SF-COMMS-CONSOLE]`; R1-R5, R8-R9. Manifest discovery is possible, but source-path inference loses the vendor identity.                                                                                                                        | Settings can enable licensed org behavior and may not be safely reversible / high                                            | Retrieved XML plus package member; root-name detection, missing-feature case, stable JSON/human output                                                                    | Communications-enabled API 67 sandbox; retrieve, deploy validate, inspect console behavior, capture pre-state, and test rollback feasibility                                                                         |
| P0  | `67.0\|metadata-api\|TmfOutboundNotificationSettings`            | Communications | TMF outbound-notification settings                                                                                                           | none                                                                    | `metadata-api`         | `Pt/A/A/A/A`    | `[SF-COV-67]`, `[SF-TMF-OUT]`; R1-R6, R8-R9. No TMF endpoint or lifecycle model exists.                                                                                                                                                                        | Endpoint/auth/event side effects can outlive metadata deployment / high                                                      | Redacted settings XML with enabled/disabled variants and a package member; no credentials or URLs in snapshots                                                            | Licensed Communications org and non-production TMF listener; deploy, emit representative notification, verify retry/idempotency/audit, disable, and confirm rollback                                                 |
| P0  | `67.0\|metadata-api\|MediaAdSalesSettings`                       | Media          | Advertising Sales Management org settings                                                                                                    | none                                                                    | `metadata-api`         | `Pt/A/A/A/A`    | `[SF-COV-67]`, `[SF-MEDIA-ADS]`; R1-R5, R8-R9. API 67 shows Metadata API/source tracking only.                                                                                                                                                                 | Media license, org enablement, and downstream ad-sales behavior / high                                                       | Retrieved XML, disabled-feature negative fixture, manifest/source convergence, deterministic output                                                                       | Media/ASM sandbox; retrieve, deploy validate, create a minimal media-plan workflow, inspect behavior, and restore pre-state                                                                                          |
| P0  | `67.0\|metadata-api\|MediaAgentSettings`                         | Media          | Media agent org settings                                                                                                                     | none                                                                    | `metadata-api`         | `Pt/A/A/A/A`    | `[SF-COV-67]`, `[SF-MEDIA-AGENT]`; R1-R5, R8-R9. Name-based gap heuristics do not classify this as provider-owned even though runtime behavior may be agent-managed.                                                                                           | Media and agent licensing, generated/runtime state, activation semantics / medium-high                                       | Retrieved XML, feature-absent response, and explicit catalog channel; never synthesize unknown fields                                                                     | Media and applicable agent-enabled sandbox; deploy, inspect resulting agent capability and generated assets, exercise representative action, and verify disable/rollback                                             |
| P1  | `n/a\|managed-package-data\|CmeEnterpriseProductCatalogDataPack` | Communications | CME/Vlocity EPC DataPack graph, including `Product2/<GlobalKey>` and dependent attribute, pricing, rule, catalog, and calculation DataPacks  | `communications-epc-datapack`                                           | `managed-package-data` | `Pt/NA/A/A/Pt`  | `[SF-VBT]` proves DataPack keys and dependency export; `[SF-CME-CATALOG]`, `[SF-COMMS-DM]`; R5-R8. Existing planner sees only the root path and emits a placeholder job.                                                                                       | Global keys, package namespace/version, graph depth, active flags, managed triggers, and destructive overwrite / high        | Sanitized `Product2` bundle with stable global keys, attribute category, price, rule and calculation dependencies; generated export/deploy jobs and failed-result fixture | Matching CME package versions and licenses; `packExport`, semantic diff, `packDeploy`, Product Designer inspection, cart pricing/eligibility smoke, package-upgrade test, and rollback                               |
| P1  | `n/a\|managed-package-data\|CmeOrderDecompositionDataPack`       | Communications | Communications decomposition, orchestration-scenario, fulfillment, and fallout configuration DataPack graph                                  | `communications-order-datapack`                                         | `managed-package-data` | `Pt/NA/A/A/Pt`  | `.codex/communications.md` product evidence; `[SF-CME-API]`; R6-R8. Shared IOM metadata and OmniStudio mechanics remain C4-owned.                                                                                                                              | Runtime records versus deployable configuration, BSS/OSS references, activation, retries, compensating actions / medium-high | Sanitized decomposition/orchestration graph keyed by stable business/global keys, with parallel, failure, retry, and missing-dependency cases                             | Communications/IOM org with matching package; deploy, decompose a representative bundle, run fulfillment and fallout paths, inspect operational records, and prove compensation/rollback                             |
| P1  | `n/a\|managed-package-data\|MediaIndustriesCpqDataPack`          | Media          | Media proposal/catalog/rate-card Industries CPQ DataPack overlay                                                                             | `media-cpq-datapack`                                                    | `managed-package-data` | `Pt/NA/A/A/Pt`  | `.codex/media.md` requires Industries CPQ for proposals; `[SF-MEDIA-PROPERTY-DM]`; R6-R8. Shared DataRaptor, OmniScript, Integration Procedure, FlexCard, and VBT mechanics are C4-owned and are not duplicated here.                                          | CME/Media package compatibility, rate-card effective dates, catalog dependency depth, proposal calculations / medium         | Minimal channel, ad product, price/rate-card, daypart and audience overlay with stable keys; generated job references C4 provider contract                                | Matching Media/CME package org; export/deploy, generate proposal/IOP, validate rate calculation and effective dates, inspect package upgrade, and rollback                                                           |
| P1  | `n/a\|unknown\|CommunicationsCatalogAndOrderData`                | Communications | Product offering/specification/catalog, pricing, order, asset, network, billing, decomposition, orchestration, and runtime records           | object API names are data under C1 `CustomObject`, not metadata aliases | `unknown`              | `NA/NA/NA/NA/A` | `[SF-COMMS-DM]`, `[SF-DM-NOTATION]`; R5, R8, R10. This is a negative-boundary product-data row, not deployable metadata. Profile examples include managed namespace records, while the official ERD distinguishes objects, record types, and virtual entities. | Operational/customer data, referential integrity, PII, active orders/assets, environment IDs / high                          | Catalog-only schema describing external keys, object families, ownership, and explicit exclusions; no production-shaped data                                              | Licensed org describe and package-version mapping; migrate only approved configuration subsets, reconcile counts/keys, and prove no orders, assets, billing, or runtime state moved                                  |
| P1  | `n/a\|unknown\|MediaAdvertisingSalesData`                        | Media          | Media Channel, Ad Space/specification, ad product, quote/plan/order, targeting, inventory, and ad-server association records                 | object API names are data under C1 `CustomObject`, not metadata aliases | `unknown`              | `NA/NA/NA/NA/A` | `[SF-MEDIA-DM]`, `[SF-MEDIA-ADS-DM]`, `[SF-MEDIA-PLAN-DM]`; R5, R8, R10. This is a negative-boundary product-data row, not deployable metadata; the current official ERDs establish records, not Metadata API component types.                                 | Inventory and booking state, account data, date/effectivity, external ad-server IDs / high                                   | Synthetic publisher/channel/ad-space graph with stable external keys; exclude delivery, booking, impression, and customer records                                         | Media sandbox; load only approved reference/config data, create quote/media plan, reserve/release inventory, reconcile external IDs, and roll back                                                                   |
| P1  | `n/a\|provider-lifecycle\|CmeDigitalCommerceCache`               | Communications | Digital Commerce catalog profile, cache population/regeneration, maintenance jobs, and compatibility state                                   | `communications-digital-commerce-cache`                                 | `provider-lifecycle`   | `A/NA/A/NA/A`   | `[SF-CME-DIGITAL]`, `[SF-CME-CACHE]`, `[SF-CME-POPULATE]`; R6-R8. The official flow has ordered APIs and package-version-specific trigger/batch constraints.                                                                                                   | Mutable cache, package-specific limits, trigger state, partial runs, stale offers/prices / high                              | Read-only desired-state plan with ordered API steps, catalog code, redacted target, resumable checkpoint, failure and no-op cases                                         | Licensed CME org; run maintenance and populate APIs in documented order, compare offer/pricing output, resume a failed sequence, and rebuild/clear as rollback                                                       |
| P1  | `n/a\|external-provider\|CommunicationsBssOssTmfBinding`         | Communications | TMF-aligned product/service order endpoint plus billing, provisioning, inventory, and event bindings                                         | `communications-bss-oss-binding`                                        | `external-provider`    | `A/NA/A/NA/A`   | `.codex/communications.md`; `[SF-CME-API]`; R6, R8. Native credentials/events are C1-owned metadata dependencies, not this external lifecycle.                                                                                                                 | Credentials, at-least-once delivery, idempotency, compensation, schema/version drift, external ownership / high              | Redacted desired-state contract with TMF API/version, event schema checksum, endpoint alias, retry policy, and mock conformance responses                                 | Non-production BSS/OSS endpoints; contract tests, create/change/cancel order, duplicate/replay test, billing reconciliation, failure compensation, health, audit, and rollback                                       |
| P1  | `n/a\|external-provider\|MediaCloudAdTechIntegrationInstance`    | Media          | MuleSoft Direct Media Cloud integration instance and dependent Exchange apps for FreeWheel, Google Ad Manager, WideOrbit, Triton, or Imagine | `media-adtech-integration`                                              | `external-provider`    | `A/NA/A/NA/A`   | `[SF-MEDIA-MULE]`, `[SF-MEDIA-MULE-START]`; R6, R8. Salesforce states that a MuleSoft instance must be purchased and that enabling creates deployed app instances and a Named Credential. Generic Mule app/Exchange mechanics remain C4-owned.                 | Separate Mule license, Exchange dependencies, generated credentials, provider account IDs, mutable deployments / high        | Product overlay referencing C4 Mule coordinates, redacted connection fields, instance identity, semantic version, health contract, and failed-deploy fixture              | MuleSoft non-production environment plus Media org/ad-tech sandbox; accept terms, enable/deploy, inspect generated Named Credential, send plan/order, verify trafficking/report sync, health, undeploy, and rollback |
| P2  | `n/a\|unknown\|MediaSubscriptionProfileVocabulary`               | Media          | Profile terms `SubscriptionPlan` and `SubscriberProfile`                                                                                     | none; do not map to C3 Subscription Management without proof            | `unknown`              | `A/NA/NA/NA/A`  | `.codex/media.md` names these concepts, but current `[SF-MEDIA-DM]` does not list them. C3 owns `SubscriptionManagementSettings` and revenue subscription lifecycle.                                                                                           | Stale or conceptual profile vocabulary could create false metadata/object aliases / medium-low                               | Negative catalog fixture preserving the terms as unresolved and linking the source profile                                                                                | Licensed-org describe plus current Media product documentation; either map to exact objects/provider APIs or retire the terms. Never invent metadata types                                                           |
| P2  | `n/a\|provider-lifecycle\|MediaAdServerDesiredState`             | Media          | Ad-server account/mapping configuration and campaign trafficking/report synchronization                                                      | `media-ad-server-binding`                                               | `provider-lifecycle`   | `A/NA/A/NA/A`   | `[SF-MEDIA-ADS-DM]`, `[SF-MEDIA-MULE]`; R5-R8. Ad-server associations are records while credentials, remote IDs, and sync jobs are environment-owned.                                                                                                          | Secrets, advertiser/account matching, remote mutable state, duplicate orders, delivery/report lag / high                     | Redacted desired-state mapping with stable external keys, account/ad-space mappings, idempotency key, and mock provider responses                                         | Media and selected ad-server sandboxes; reconcile accounts/inventory, traffic one order, ingest delivery, replay safely, revoke credentials, and document rollback limits                                            |

## Ownership and channel rules

1. C1 owns `CustomObject`, fields, record types, validation, Flow, Apex, LWC,
   permission, credential, event, and Experience metadata. C7 records only the
   product-specific dependency profile and does not duplicate those rows.
2. C4 owns native and managed OmniStudio, shared VBT channel classification,
   Industries Order Management metadata, decision/document families, and
   generic Mule application/Exchange/API Manager lifecycle. C7 rows are
   product overlays that must depend on those contracts.
3. C3 owns `SubscriptionManagementSettings`, Revenue lifecycle, and shared
   product/configurator settings. Media profile terminology does not transfer
   that ownership.
4. `CommsServiceConsoleSettings`, `TmfOutboundNotificationSettings`,
   `MediaAdSalesSettings`, and `MediaAgentSettings` are native Metadata API
   rows. They must never be routed to Vlocity Build because the product also
   uses managed packages.
5. A DataPack key such as `Product2/<GlobalKey>` is managed-package data, not a
   `Product2` metadata type. Channel and package evidence must precede aliasing.
6. Product object API names and records are negative-boundary product data, not
   deployable metadata, so their catalog channel remains `unknown`. Schema
   customization is C1 `CustomObject`; approved configuration data requires a
   typed, package-aware data lifecycle; operational/customer data is excluded.
7. Digital Commerce cache jobs, TMF/BSS/OSS bindings, MuleSoft Direct
   instances, and ad-server synchronization are lifecycle operations. They
   must not enter Salesforce manifests or `DEPLOYMENT_ORDER`.

## Recommended implementation slices

1. **P0 catalog/channel guard.** Reuse the shared typed capability registry and
   channel classifier. Add the four C7 native rows and reject DataPack,
   product-data, and provider rows from core metadata plans.
2. **P0 settings discovery.** Add root-element-aware settings discovery so
   `*.settings-meta.xml` retains the exact vendor type. Start with the four C7
   rows, but keep lifecycle `absent` until licensed-org evidence exists.
3. **P1 C7 native settings strategy.** Parse only references proven in retrieved
   XML. Treat settings as feature-gated leaves initially; capture pre-state and
   require human review for enablement or irreversible effects.
4. **P1 managed overlays.** Build Communications EPC, order/decomposition, and
   Media CPQ adapters on C4's package-aware DataPack provider. Generate stable
   jobs from DataPack keys, preserve dependency depth, parse results, and
   expose activation/cache/rollback limitations.
5. **P1 product-data boundary.** Define an inventory/plan contract that
   classifies schema, configuration/reference data, and forbidden operational
   data. Do not implement generic DML migration from ERD or profile names.
6. **P1 provider overlays.** Add CME cache and C7 integration desired-state
   contracts on C4 external-provider primitives. Require plan/apply/verify,
   target identity, secret redaction, idempotency, polling, health, and
   rollback status.
7. **P2 profile reconciliation.** Resolve `SubscriptionPlan` and
   `SubscriberProfile` against a licensed current org and official product
   docs. Keep them `unknown` until exact vendor contracts are proven.

No slice should add branches to `metadata-scanner-service.ts`,
`metadata-gap-analysis-service.ts`, or the current broad Vlocity path regex.
Use focused registries, channel strategies, package-aware adapters, and stable
catalog contracts.

## Licensing and packaging constraints

- Communications Cloud/CME, Industries CPQ, Industries Order Management,
  OmniStudio, Media Cloud, Advertising Sales Management, Digital Commerce, and
  applicable agent capabilities are separately provisioned. Developer Edition
  fixtures cannot prove availability.
- Managed DataPack promotion requires matching source/target namespace,
  package version, global-key semantics, permission-set licenses, and package
  upgrade validation. `vlocity_cmt__`, `omnistudio__`, and no-namespace
  artifacts must not be mixed by assumption.
- API `67.0` exposes the four C7 settings through Metadata API and source
  tracking, but package/change-set support is not shown. This limits packaging
  claims even after deployment succeeds.
- MuleSoft Direct requires a purchased MuleSoft instance, accepted terms,
  Anypoint access, Exchange dependencies, and product/provider credentials.
- Ad-tech validation requires a non-production account for the selected
  provider. A mock proves parsing and idempotency contracts, not real
  trafficking or reporting.
- TMF/BSS/OSS and billing systems have independent API versions, credentials,
  availability, and rollback semantics. Salesforce deployment success does
  not prove external conformance.

## Limitations

- The setup-agents cache contained no references. Official URLs above are the
  sources actually used; no cache population command was run because this
  assignment permits only the report file to change.
- Metadata coverage proves exposure, not source filename, XML fields,
  deployment order, enablement safety, behavior, or rollback in a licensed org.
- Atlas type pages can be thin client-rendered shells. Exact XML shape and
  dependencies must come from API 67 org retrieval before implementation.
- No Salesforce org, CME/OmniStudio package, MuleSoft organization, Digital
  Commerce cache, TMF endpoint, BSS/OSS platform, billing system, or ad server
  was accessed.
- The report does not claim that every logical entity in a Salesforce ERD is a
  physical object. It follows Salesforce notation for objects, record types,
  managed namespace omission, and virtual entities.
- Communications order DataPack names and Media subscription vocabulary have
  lower confidence than the four native settings and EPC `Product2` DataPack
  key. They remain blocked pending package export/org describe evidence.
- Repository inspection was limited to metadata contracts, order, gap
  analysis, scanner composition, Vlocity planning, API version, tests by exact
  token, and C1/C3/C4 ownership reports.

## Architectural concerns

### Inherited

The architecture handoff correctly requires channel classification before
comparison. C7 reinforces that rule: a Communications or Media product label
does not identify native Metadata API, managed DataPack, product data, or
external lifecycle. The existing broad Vlocity path provider cannot safely
make that distinction.

The handoff also correctly assigns shared Industries mechanics to C4. Building
new C7 OmniStudio, IOM, or generic Mule rows would fragment ownership; C7
therefore records only product overlays and validation obligations.

### Self-imposed

None. This report proposes catalog, scanner, channel, fixture, and provider
contract slices only. It introduces no custom Salesforce metadata, objects,
fields, Flows, Apex, DataPacks, product records, or external configuration.
