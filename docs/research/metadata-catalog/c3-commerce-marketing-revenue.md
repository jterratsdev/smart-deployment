![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C3 Commerce, Marketing, and Revenue Metadata Catalog Research

- **Task:** `PLUGIN-METADATA-CATALOG-RESEARCH`
- **Cluster:** C3 Commerce, marketing, and revenue
- **Profiles:** `commerce`, `cpq`, `revenue`, `sfmc`, `loyalty`
- **Author:** Salesforce Professional Services
- **Report version:** 1.0
- **Vendor baseline:** Salesforce Metadata API v67.0 (Summer '26)
- **Retrieved:** 2026-07-23
- **Scope:** Research only. No metadata implementation or test changes.

## Baseline and Method

The deterministic catalog key is:

```text
<apiVersion>|<deploymentChannel>|<vendorMetadataTypeOrArtifact>
```

Rows are sorted by this key. Salesforce API `67.0` is the pinned comparison baseline. The current repository project still declares source API `61.0`, so every future implementation must test both the catalog baseline and the project's supported API range. Non-API rows use `n/a` for the API-version segment while retaining their exact architecture deployment channel.

Primary sources:

- [Salesforce Metadata Coverage Report v67.0](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0/metadata-coverage-report.html)
- [Salesforce Metadata Types v67.0](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html)
- [B2B and B2C Commerce Developer Guide](https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-dev-guide.html)
- [B2C Commerce code deployment](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-code-deployment.html)
- [Marketing Cloud Engagement REST API](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/rest-api-overview)
- [Loyalty Programs data model](https://developer.salesforce.com/docs/platform/data-models/guide/loyalty-programs.html)

`.setup-agents/references/` does not exist in this workspace, so no cached document was available. Official Salesforce documentation was used directly. Product guidance is pinned to setup-agents `3.15.0-rc` in `.codex/{commerce,cpq,revenue,sfmc,loyalty}.md`.

| Profile ID | setup-agents profile path |
| ---------- | ------------------------- |
| `commerce` | `.codex/commerce.md`      |
| `cpq`      | `.codex/cpq.md`           |
| `loyalty`  | `.codex/loyalty.md`       |
| `revenue`  | `.codex/revenue.md`       |
| `sfmc`     | `.codex/sfmc.md`          |

## Repository Evidence

Evidence identifiers below are exact and reusable in the candidate table.

| ID  | Repository evidence                                                | Finding                                                                                                                                                         |
| --- | ------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | `src/types/metadata.ts:13-105`                                     | The closed `MetadataType` union contains no C3-specific candidate in this report. Shared platform types are present.                                            |
| R2  | `src/constants/deployment-order.ts:40-143,161-162`                 | No C3-specific candidate has explicit ordering; unknown types fall back to priority `99`.                                                                       |
| R3  | `src/analysis/metadata-gap-analysis-service.ts:76-105`             | The independent 26-type support set contains no C3-specific candidate.                                                                                          |
| R4  | `src/analysis/metadata-gap-analysis-service.ts:107-152`            | No C3 source directory or suffix has an explicit mapping. Manifests can still report arbitrary names.                                                           |
| R5  | `src/analysis/metadata-gap-analysis-service.ts:320-343`            | Generic suffix inference can identify a distinctive suffix, but `*.settings-meta.xml` collapses to `Settings`; unregistered candidates remain `unsupported`.    |
| R6  | `src/services/metadata-scanner-service.ts:175-192,195-353`         | Scanner orchestration has focused code, data, security, experience, AI, and additional handlers, but no commerce, revenue, loyalty, CPQ, SFMC, or SFCC handler. |
| R7  | `src/services/scanners/additional-metadata-scanner.ts:21-62,68-80` | The extensible simple-file/bundle registry is the nearest implementation seam; its current entries are platform and Experience Cloud types only.                |
| R8  | `src/services/scanners/data-metadata-scanner.ts:13-43,46-105`      | `CustomObject` and `CustomMetadata` parsing covers schema metadata, not product configuration records.                                                          |
| R9  | `src/services/scanners/security-metadata-scanner.ts:12-77`         | `Profile` and `PermissionSet` references are shared platform capabilities, not product metadata ownership.                                                      |
| R10 | `src/dependencies/dependency-semantics.ts:48-88`                   | The graph can preserve hard/soft/inferred dependency semantics once a focused parser emits them.                                                                |
| R11 | `sfdx-project.json:10`                                             | Repository source API is `61.0`, six versions behind this catalog baseline.                                                                                     |
| R12 | Exact-token search across `src/`, `test/`, and `docs/`             | No candidate vendor type, `SBQQ__`, `blng__`, `mcdev`, or cartridge implementation/fixture exists.                                                              |

Capability values are `proven`, `partial`, `absent`, or `n/a`. The compact sequence is `D/P/X/O/L/F`: discovery, parsing, dependencies, ordering, lifecycle, fixtures. For a Metadata API row, `partial/absent/absent/absent/absent/absent` means manifest or generic gap discovery exists, but safe deploy support is not established. `n/a` is reserved for capabilities that do not apply to provider, external, or other non-API rows.

## Deterministic Candidate Catalog

| Catalog key                                              | Profile  | Vendor metadata type or artifact                                                                                                                                                                      | Alias                                        | Channel                | D/P/X/O/L/F                                | Exact repository evidence                    | Risk, confidence                                                                                                                                                         | Priority |
| -------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------- | ------------------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| `67.0\|metadata-api\|BenefitAction`                      | loyalty  | [`BenefitAction`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_benefitaction.htm)                                                                                    | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Coverage report proves API/package support; dependencies on loyalty definitions need org evidence. Medium confidence.                                                    | P2       |
| `67.0\|metadata-api\|BillingSettings`                    | revenue  | [`BillingSettings`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_billingsettings.htm)                                                                                | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Org setting, edition/license gated, and generic source inference becomes `Settings`. High confidence.                                                                    | P1       |
| `67.0\|metadata-api\|CommerceSettings`                   | commerce | [`CommerceSettings`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_commercesettings.htm)                                                                              | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Org setting and feature-gated; generic source inference becomes `Settings`. High confidence.                                                                             | P1       |
| `67.0\|metadata-api\|GatewayProviderPaymentMethodType`   | revenue  | [`GatewayProviderPaymentMethodType`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#gatewayproviderpaymentmethodtype)     | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Likely depends on a payment gateway provider and enabled payment methods. Medium confidence pending licensed-org retrieve.                                               | P2       |
| `67.0\|metadata-api\|IncludeEstTaxInQuoteCPQSettings`    | cpq      | [`IncludeEstTaxInQuoteCPQSettings`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#includeesttaxinquotecpqsettings)       | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | CPQ feature/package gated; source file is a settings container. High confidence.                                                                                         | P1       |
| `67.0\|metadata-api\|LargeQuotesandOrdersForRlmSettings` | revenue  | [`LargeQuotesandOrdersForRlmSettings`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#largequotesandordersforrlmsettings) | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | RLM license and feature activation required; exact casing must remain vendor-defined. High confidence.                                                                   | P1       |
| `67.0\|metadata-api\|LoyaltyProgramSetup`                | loyalty  | [`LoyaltyProgramSetup`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_loyaltyprogramsetup.htm)                                                                        | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Metadata API is proven, but API 67 lacks source tracking; program records remain separate. High confidence.                                                              | P1       |
| `67.0\|metadata-api\|MarketingAppExtActivity`            | sfmc     | [`MarketingAppExtActivity`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#marketingappextactivity)                       | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Core-org extension metadata is distinct from an SFMC Journey activity instance. Medium confidence.                                                                       | P2       |
| `67.0\|metadata-api\|MarketingAppExtension`              | sfmc     | [`MarketingAppExtension`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_marketingappextension.htm)                                                                    | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Core-org integration registration, not an SFMC asset deployment. High confidence.                                                                                        | P2       |
| `67.0\|metadata-api\|PaymentGatewayProvider`             | revenue  | [`PaymentGatewayProvider`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_paymentgatewayprovider.htm)                                                                  | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Provider registration can reference packaged adapters; credentials and gateway records are separate. High confidence.                                                    | P1       |
| `67.0\|metadata-api\|PaymentsSettings`                   | revenue  | [`PaymentsSettings`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_paymentssettings.htm)                                                                              | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Org setting; no secret or payment-method data may enter fixtures. High confidence.                                                                                       | P1       |
| `67.0\|metadata-api\|PricingActionParameters`            | revenue  | [`PricingActionParameters`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#pricingactionparameters)                       | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | RLM pricing dependency semantics are unproven locally. Medium confidence.                                                                                                | P2       |
| `67.0\|metadata-api\|PricingRecipe`                      | revenue  | [`PricingRecipe`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#pricingrecipe)                                           | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Likely references action parameters and catalog/pricing configuration; ordering requires org retrieval. Medium confidence.                                               | P2       |
| `67.0\|metadata-api\|ProductCatalogManagementSettings`   | revenue  | [`ProductCatalogManagementSettings`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#productcatalogmanagementsettings)     | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | RLM catalog setting; product/catalog records are data and stay out of this row. High confidence.                                                                         | P1       |
| `67.0\|metadata-api\|ProductConfiguratorSettings`        | revenue  | [`ProductConfiguratorSettings`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#productconfiguratorsettings)               | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Revenue product-configuration feature and license gated; generic source inference becomes `Settings`. High confidence.                                                   | P1       |
| `67.0\|metadata-api\|ProductDiscoverySettings`           | commerce | [`ProductDiscoverySettings`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#productdiscoverysettings)                     | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Search/index activation is an external post-deploy concern. High confidence.                                                                                             | P2       |
| `67.0\|metadata-api\|ReferralMarketingConfig`            | loyalty  | [`ReferralMarketingConfig`](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types/v67.0/metadata-types.html#referralmarketingconfig)                       | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Packagable metadata, but dependencies on loyalty/referral definitions need a licensed org. Medium confidence.                                                            | P2       |
| `67.0\|metadata-api\|RevenueManagementSettings`          | revenue  | [`RevenueManagementSettings`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_revenuemanagementsettings.htm)                                                            | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | RLM license/feature gated; generic source inference becomes `Settings`. High confidence.                                                                                 | P1       |
| `67.0\|metadata-api\|SubscriptionManagementSettings`     | revenue  | [`SubscriptionManagementSettings`](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_subscriptionmanagementsettings.htm)                                                  | none                                         | `metadata-api`         | partial/absent/absent/absent/absent/absent | R1-R7, R12                                   | Subscription Management license/feature gated; generic source inference becomes `Settings`. High confidence.                                                             | P1       |
| `n/a\|external-provider\|B2CCommerceSiteImportArchive`   | commerce | [B2C Commerce site data/preferences import archive](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/build-your-site.html)                                                           | `sfcc-site-archive` (artifact alias only)    | `external-provider`    | absent/absent/absent/n/a/absent/absent     | R1-R7, R12                                   | Not Metadata API; import schemas, instance state, and replication differ. High confidence.                                                                               | P2       |
| `n/a\|external-provider\|SFMCAsset`                      | sfmc     | [Content Builder asset](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/content-api.html)                                                                                       | `sfmc-content-asset` (artifact alias only)   | `external-provider`    | absent/absent/absent/n/a/absent/absent     | R1-R7, R12; `.codex/sfmc.md:129-132`         | REST asset hierarchy and publish behavior require BU-scoped credentials. High confidence.                                                                                | P2       |
| `n/a\|external-provider\|SFMCAutomation`                 | sfmc     | [Automation Studio automation/activity definitions](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/rest-api-overview)                                                          | `sfmc-automation` (artifact alias only)      | `external-provider`    | absent/absent/absent/n/a/absent/absent     | R1-R7, R12; `.codex/sfmc.md:95-102,129-132`  | Activity support and scheduling are provider-specific; retrieval is not uniformly lossless. High confidence.                                                             | P2       |
| `n/a\|external-provider\|SFMCDataExtension`              | sfmc     | [Data Extension definition](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/dataextension.htm), excluding rows                                                                  | `sfmc-data-extension` (artifact alias only)  | `external-provider`    | absent/absent/absent/n/a/absent/absent     | R1-R7, R12; `.codex/sfmc.md:104-115,129-132` | Schema, retention, sendability, and BU ownership are not Salesforce `CustomObject`. High confidence.                                                                     | P2       |
| `n/a\|external-provider\|SFMCJourney`                    | sfmc     | [Journey Builder journey specification](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/getting-started-spec.html)                                                              | `sfmc-journey` (artifact alias only)         | `external-provider`    | absent/absent/absent/n/a/absent/absent     | R1-R7, R12; `.codex/sfmc.md:46-54,129-132`   | Draft/publish/stop lifecycle is atomic and provider-owned. High confidence.                                                                                              | P2       |
| `n/a\|managed-package-data\|CPQConfigurationRecords`     | cpq      | [Salesforce CPQ](https://help.salesforce.com/s/articleView?id=sf.cpq_getting_started.htm) `SBQQ__*` configuration records                                                                             | `cpq-config-data` (artifact alias only)      | `managed-package-data` | absent/absent/absent/n/a/absent/absent     | R8, R12; `.codex/cpq.md:68-116`              | Product rules, price rules, bundles, schedules, and templates are records, not new metadata types. Package version and record IDs complicate migration. High confidence. | P1       |
| `n/a\|managed-package-data\|LoyaltyProgramRecords`       | loyalty  | [Loyalty program data-model records](https://developer.salesforce.com/docs/platform/data-models/guide/loyalty-programs.html)                                                                          | `loyalty-config-data` (artifact alias only)  | `managed-package-data` | absent/absent/absent/n/a/absent/absent     | R8, R12; `.codex/loyalty.md:73-94`           | Data-model objects must not be promoted as metadata types; transaction journals and balances are operational data. High confidence.                                      | P2       |
| `n/a\|managed-package-data\|RevenueBillingRecords`       | revenue  | [Salesforce Billing](https://developer.salesforce.com/docs/atlas.en-us.blng.meta/blng/) `blng__*` and related billing configuration records                                                           | `revenue-billing-data` (artifact alias only) | `managed-package-data` | absent/absent/absent/n/a/absent/absent     | R8, R12; `.codex/revenue.md:72-94,223-228`   | Managed triggers, upgrade safety, finance controls, and environment IDs make generic DML unsafe. High confidence.                                                        | P2       |
| `n/a\|provider-lifecycle\|B2CCommerceCartridge`          | commerce | [SFCC/SFRA cartridge and code version](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-code-deployment.html)                                                                    | `sfcc-cartridge` (artifact alias only)       | `provider-lifecycle`   | absent/absent/absent/n/a/absent/absent     | R1-R7, R12; `.codex/commerce.md:27-72`       | WebDAV/B2C CLI upload, code-version activation, compatibility mode, and staging replication are not Metadata API. High confidence.                                       | P2       |

## C1 Cross-References

C1 owns shared platform metadata. This report does not duplicate those rows:

- `CustomObject`, `CustomField`, `RecordType`, `ValidationRule`, `Flow`, `ApexClass`, `ApexTrigger`, `LightningComponentBundle`, `PermissionSet`, and `Profile` remain C1-owned even when they customize Commerce, CPQ, Revenue, SFMC integrations, or Loyalty.
- B2B Commerce storefront shell metadata such as `DigitalExperienceBundle`, `Network`, and `CustomSite` remains C1-owned. C3 owns only the commerce-specific dependency profile.
- `OrderManagementSettings` is C1-owned and is intentionally excluded from the C3 candidate table. C3 validation must still use an Order Management-licensed org, classify the retrieved settings root instead of the generic `Settings` suffix, deploy-validate at API `61.0` and `67.0`, verify disabled-feature behavior, and treat any activation or post-deploy order lifecycle as unproven until licensed-org evidence exists.
- Vendor/internal aliases remain C1-owned: `ApexPage` -> `VisualforcePage`, `ApexComponent` -> `VisualforceComponent`, and source-format `CustomMetadata` records -> internal `CustomMetadataRecord`.
- Product object API names such as `WebStore`, `LoyaltyProgram`, `TransactionJournal`, `SBQQ__Quote__c`, and `blng__Invoice__c` are object or record content, not new metadata types.

Canonical cross-reference: `docs/research/metadata-catalog/c1-core-crm-channels.md`. The architect handoff remains the ownership contract, and the C1 report is the canonical catalog location.

## Recommended Implementation Slices

1. **P0: typed catalog and channel guard**

   - Add one catalog registry keyed by API version, channel, and vendor type.
   - Keep aliases explicit and reject provider/managed-data rows from Metadata API plans.
   - Derive support from capability evidence; do not add C3 names to another binary set.

2. **P1: settings-family discovery**

   - Add a focused settings source mapper that reads the settings container/root element instead of classifying every `*.settings-meta.xml` as `Settings`.
   - Start with C3-owned `CommerceSettings`, `BillingSettings`, `RevenueManagementSettings`, `SubscriptionManagementSettings`, `PaymentsSettings`, and the CPQ/RLM settings rows; consume C1-owned `OrderManagementSettings` through the cross-reference above.
   - Treat these as configuration leaves until licensed-org retrieval proves dependencies and ordering.

3. **P1: discrete Metadata API components**

   - Extend the registry seam for `PaymentGatewayProvider`, `LoyaltyProgramSetup`, and then `GatewayProviderPaymentMethodType`.
   - Add focused parsers only where retrieved XML proves references. Emit structured dependency details through the existing R10 contract.

4. **P2: complex pricing, loyalty, and marketing extension metadata**

   - Add `PricingRecipe`, `PricingActionParameters`, `BenefitAction`, `ReferralMarketingConfig`, `MarketingAppExtension`, and `MarketingAppExtActivity` only after fixture capture from licensed orgs.
   - Avoid speculative dependency rules based on names.

5. **P2: dedicated provider adapters**
   - Define separate adapters for SFMC REST/SOAP or approved deployment tooling, SFCC code-version/site import lifecycle, CPQ configuration data, Revenue Billing data, and Loyalty program data.
   - Require plan/apply/verify contracts, environment identity, secret redaction, idempotency, rollback limits, and lifecycle status. Do not route these through `sf project deploy`.

## Fixtures and Org Validation

| Slice                | Deterministic fixture                                                                                                    | Required org/provider validation                                                                                                      |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Settings family      | `package.xml`, retrieved source file, root-element classification, absent-feature response, stable JSON/human gap output | Retrieve and deploy-validate in API 61 and API 67 projects with each licensed feature enabled; verify disabled-feature behavior.      |
| Payment metadata     | Provider plus supported payment-method type with redacted references                                                     | Licensed sandbox with a test gateway adapter; validate ordering, then confirm no credential or token enters source/evidence.          |
| Loyalty metadata     | Minimal `LoyaltyProgramSetup`, `BenefitAction`, and referral config                                                      | Loyalty-enabled sandbox; retrieve round trip, deploy validate, and verify program records are unchanged.                              |
| RLM pricing          | Minimal recipe and action parameters captured together and separately                                                    | Revenue Management sandbox; determine hard/soft references and activation/post-deploy steps.                                          |
| CPQ managed data     | Synthetic record graph with stable external keys, no managed IDs                                                         | Matching CPQ package versions and PSLs in source/target sandboxes; run quote calculation and rule validation.                         |
| Revenue Billing data | Synthetic billing setup only; no invoices, payments, or PAN/token values                                                 | Matching package versions; generate a billing schedule/invoice using test data and review managed-trigger effects.                    |
| SFMC                 | Sanitized asset, journey, automation, and DE-definition payloads per BU                                                  | Dev/stage BUs with least-privilege installed-package scopes; deploy, publish where applicable, retrieve, and compare semantic output. |
| SFCC                 | Minimal overlay cartridge and separate site-import archive                                                               | Sandbox -> staging upload, activate inactive code version, storefront smoke, rollback, and replication dry run.                       |

CLI verification for every implemented row must cover both deterministic JSON and human output. A row cannot move to `proven` from a fixture alone when licensing, activation, package version, BU, realm, or publish state affects behavior.

## Licensing and Packaging Constraints

- **Commerce:** [B2B/B2C Commerce](https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-dev-guide.html), Order Management, Product Discovery, and Payments capabilities are separately provisioned. A generic Developer Edition is insufficient evidence.
- **CPQ:** Salesforce CPQ is a managed package and [enforces Permission Set Licenses](https://help.salesforce.com/s/articleView?id=000380942&language=en_US&type=1). Source and target package versions must match before configuration-data migration.
- **Revenue:** Revenue Management, Product Catalog Management, Product Configurator, Subscription Management, Payments, and Salesforce Billing have separate entitlements and coexistence constraints. [Retain CPQ licensing during CPQ-to-Revenue migration](https://help.salesforce.com/s/articleView?id=ind.rev_migration_operational_considerations.htm&language=en_US&type=5) where rollback/reference is required.
- **Loyalty:** [Loyalty Management](https://developer.salesforce.com/docs/industries/loyalty/guide/get-started.html) license and permissions are required. API-visible program objects do not imply Metadata API deployability.
- **SFMC:** [Marketing Cloud Engagement installed packages](https://developer.salesforce.com/docs/marketing/marketing-cloud/guide/packages-overview) use tenant-specific endpoints and scopes. BU ownership and publish state are mandatory lifecycle inputs.
- **SFCC:** [B2C Commerce code deployment](https://developer.salesforce.com/docs/commerce/b2c-commerce/guide/b2c-code-deployment.html) requires realm/instance access, code-version compatibility mode, secure upload credentials/certificates, and staging-to-production replication. Production direct upload is not a Metadata API substitute.
- Packaging columns in the API 67 coverage report prove transport availability only. They do not prove scanner parsing, dependency safety, feature availability, or lifecycle completion.

## Limitations

- The catalog is intentionally selective: it includes high-value, officially documented C3 candidates, not every API 67 type whose name contains product-related terms.
- API 67 is newer than this repository's API 61 source baseline. Types introduced or changed after API 61 require explicit compatibility handling.
- Official coverage does not document every dependency, source path, activation step, or deletion behavior. Medium-confidence rows require licensed-org retrieval before implementation.
- SFMC and SFCC payloads can be retrievable without being round-trip safe. Semantic comparison and provider-specific rollback limits are required.
- CPQ, Billing, and Loyalty records can reference org-specific IDs and managed-package internals. External-key strategy and package-version checks are unresolved.
- No source fixtures, orgs, BUs, realms, payment gateways, or product licenses were available in this research phase.

## Architectural Concerns (inherited)

None identified. The architect proposal requires a channel-aware capability catalog and explicitly prevents product records or provider assets from being misrepresented as Metadata API types.

## Architectural Concerns (self-imposed)

None. This report proposes repository catalog entries and adapter boundaries only; it introduces no Salesforce custom objects, fields, picklists, Custom Metadata records, labels, permission entries, Apex classes, or Flows.
