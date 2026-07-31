![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C6 Industrial, Asset, and Location Metadata Catalog Research

Author: Salesforce Professional Services
Version: 1.0
Research date: 2026-07-23
Salesforce Metadata API baseline: 67.0
setup-agents profile baseline: 3.15.0-rc

## Scope and decision

This report owns the C6 profiles `cgcloud`, `manufacturing`, `automotive`,
`energy`, `maps`, and `netzero`. It follows the architecture handoff's
deterministic key:

```text
<apiVersion>|<deploymentChannel>|<vendorMetadataType>
```

When an API version does not apply, the first segment is `n/a`; the second
segment remains the actual deployment channel.

Capabilities are recorded as `P` (proven), `Pt` (partial), `A` (absent), or
`NA` (not applicable), in this order:

```text
discovery / parsing / dependency / ordering / lifecycle
```

The report deliberately does not promote product object API names to metadata
types. Salesforce's data-model notation says ERD entities normally map to
database objects and that managed-package diagrams can omit the namespace.
Therefore `SalesAgreement`, `Vehicle`, `ServicePoint`,
`StnryAssetEnvrSrc`, `maps__Location__c`, and similar names are object contents
or records under the C1-owned `CustomObject` boundary, not new catalog types.

## Sources

No `.setup-agents/references/` directory or cached Salesforce reference was
present. The six complete rendered profiles were read first, then current
official Salesforce sources were used directly:

- [Current Metadata Coverage Report][SF-COV]
- [Metadata type documentation index][SF-TYPES]
- [Salesforce data-model notation][SF-NOTATION]
- [Consumer Goods retail execution model][SF-CG]
- [Manufacturing data models][SF-MFG]
- [Automotive overview model][SF-AUTO]
- [Energy and Utilities data models][SF-ENERGY]
- [Net Zero overview model][SF-NZ]
- [Salesforce Maps setup reference][SF-MAPS-SETUP]
- [Maps Territory Planning setup and provider prerequisites][SF-MAPS-TP]
- [Maps package sandbox portability limits][SF-MAPS-SBX]
- [Maps alignment publish lifecycle][SF-MAPS-PUBLISH]

The coverage report is treated as exposure evidence only. It does not prove
that a licensed org can retrieve a type, that deployment preserves behavior,
or that post-deploy activation and provider state are complete.

## Exact repository baseline

| Evidence id | Exact repository evidence                                                                                                                                                                                                                | Consequence                                                                                                            |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `R-TYPE`    | `src/types/metadata.ts:13-105` defines 81 internal names; none of the C6-specific candidates below is present.                                                                                                                           | C6 names are unsupported public-contract additions, not aliases already recognized by the plugin.                      |
| `R-ORDER`   | `src/constants/deployment-order.ts:40-142` orders the same fixed union; `getDeploymentPriority()` returns fallback `99` at lines 148-162.                                                                                                | Unknown C6 types deploy last without product dependency semantics.                                                     |
| `R-SCAN`    | `src/services/scanners/additional-metadata-scanner.ts:21-62` has six simple/bundle registrations, all unrelated to C6.                                                                                                                   | No C6 settings or definition file is converted into a graph component.                                                 |
| `R-DATA`    | `src/services/metadata-scanner-service.ts:206-234` scans only `objects/*` and `customMetadata/*` in the data path.                                                                                                                       | Customer-owned object schema and CMDT can be seen generically; product records and provider configuration cannot.      |
| `R-GAP`     | `src/analysis/metadata-gap-analysis-service.ts:76-103` hardcodes 26 supported types; lines 107-150 contain no C6 directory or suffix mapping.                                                                                            | A manifest can reveal an unknown name, but source discovery cannot classify these files deterministically.             |
| `R-LIFE`    | `src/deployment/special-deployment-plan.ts:104-110` registers only core metadata, Agentforce publish/activation, AI evaluation, Experience publish, and OmniStudio/Vlocity.                                                              | There is no Maps, industrial package-data, reference-data, or external-asset lifecycle provider.                       |
| `R-OBJECT`  | `src/parsers/custom-object-parser.ts:64-116,167-170,249-254` parses fields, record types, validation rules, list views, and web links under one object; `src/services/scanners/data-metadata-scanner.ts:13-38` emits one `CustomObject`. | Product object customizations inherit the C1 composite-child gaps and must not become product-specific metadata types. |
| `R-SEARCH`  | A case-insensitive search of `src` and focused tests for C6 product names, namespaces, geospatial terms, and industrial settings found no implementation references.                                                                     | There is no hidden C6 parser, dependency policy, fixture, or provider adapter.                                         |

## Deterministic candidate catalog

Rows are sorted by priority and catalog key. `Internal alias` is the current
repository name, not a proposed display label. `none` means the vendor name is
absent from the internal union.

| Priority | Catalog key                                                      | Product                                    | Vendor metadata or artifact                                                              | Internal alias                                                       | Deployment channel     | Capabilities   | Exact repo evidence                                                            | Risk / confidence                                                               | Fixture and org/provider validation                                                                                                                          |
| -------- | ---------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------- | -------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| P0       | `67.0\|metadata-api\|IndustriesAutomotiveSettings`               | automotive                                 | [`IndustriesAutomotiveSettings`][MT-AUTO]                                                | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Licensed feature settings and enablement / high                                 | Minimal settings XML; retrieve/deploy in Automotive-enabled org, compare setup flags, and run vehicle/dealer smoke.                                          |
| P0       | `67.0\|metadata-api\|IndustriesEnergyUtilitiesMultiSiteSettings` | energy                                     | [`IndustriesEnergyUtilitiesMultiSiteSettings`][MT-EU-MULTI]                              | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Multi-site feature and package/runtime version / high                           | Minimal settings XML; validate in Energy and Utilities org with multi-site enabled and verify premise/service-point behavior.                                |
| P0       | `67.0\|metadata-api\|IndustriesManufacturingSettings`            | manufacturing                              | [`IndustriesManufacturingSettings`][MT-MFG]                                              | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Broad product enablement and edition gate / high                                | Retrieve from licensed org; deploy before dependent definitions/data and verify enabled Manufacturing setup.                                                 |
| P0       | `67.0\|metadata-api\|MapsAndLocationSettings`                    | maps                                       | [`MapsAndLocationSettings`][MT-MAPS]                                                     | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Core location settings do not provision the Maps package/provider / high        | Minimal settings XML; retrieve/deploy in Maps-enabled org, then separately verify package and provider readiness.                                            |
| P0       | `67.0\|metadata-api\|RetailExecutionSettings`                    | cgcloud                                    | [`RetailExecutionSettings`][MT-RETAIL]                                                   | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Product variant, license, and offline/mobile enablement / high                  | Retrieve/deploy in Retail Execution org; verify visit execution and mobile/offline behavior.                                                                 |
| P0       | `67.0\|metadata-api\|StnryAssetEnvSrcCnfg`                       | netzero                                    | [`StnryAssetEnvSrcCnfg`][MT-STATIONARY]                                                  | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Abbreviated vendor identity and record-type/config dependencies / high          | One configuration with referenced record type and units; org round-trip plus deterministic emissions calculation.                                            |
| P0       | `67.0\|metadata-api\|VehicleAssetEmssnSrcCnfg`                   | netzero                                    | [`VehicleAssetEmssnSrcCnfg`][MT-VEHICLE-EMISSION]                                        | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Abbreviated vendor identity and fuel/unit dependencies / high                   | One vehicle-source configuration; org round-trip and known fuel-to-CO2e calculation.                                                                         |
| P0       | `n/a\|external-provider\|GeospatialProviderAssets`               | maps, energy                               | Boundaries, traffic/routes, geocode datasets, GIS network layers, fleet telemetry        | none                                                                 | `external-provider`    | `A/NA/NA/NA/A` | `R-LIFE`; no external asset registry                                           | Provider terms, regional coverage, credentials, coordinate/version drift / high | Hash/version manifest without secrets; provider sandbox, license/terms, sample geocode/route/boundary validation, rollback to prior dataset.                 |
| P0       | `n/a\|external-provider\|IndustrialReferenceAndEvidenceAssets`   | manufacturing, automotive, energy, netzero | ERP/DMS/AMI/MDMS/OMS feeds, emission-factor libraries, utility bills, assurance evidence | none                                                                 | `external-provider`    | `A/NA/NA/NA/A` | `R-LIFE`; only generic `NamedCredential` ordering exists in `R-TYPE`/`R-ORDER` | Credentials, regulated data, lineage, retention, source version / high          | Redacted contract and checksum fixture; provider authentication, schema/version, consent/retention, idempotency, reconciliation, and rollback.               |
| P0       | `n/a\|managed-package-data\|CGCloudModelerConfiguration`         | cgcloud                                    | Modeler promotion/activity/KPI/hierarchy configuration records                           | `CustomMetadata` only for customer-owned CMDT; no product-data alias | `managed-package-data` | `A/NA/NA/NA/A` | `R-DATA`, `R-LIFE`; `.codex/cgcloud.md` Modeler and managed-package rules      | Package namespace/version, read-only managed records, data ordering / high      | Redacted export fixture only after vendor-supported export is identified; licensed CGCloud org, exact package version, Modeler diff, mobile smoke, rollback. |
| P0       | `n/a\|managed-package-data\|IndustrialOperationalRecords`        | manufacturing, automotive, energy, netzero | Agreements, forecasts, vehicles, meters/readings, emissions, factors, goals              | `CustomObject` contents, not metadata aliases                        | `managed-package-data` | `A/NA/NA/NA/A` | `R-OBJECT`, `R-LIFE`; all four product profiles identify these as records      | Data/metadata confusion, referential order, privacy and audit / high            | Synthetic record graph per product; licensed org/package, supported data loader/provider, volume/idempotency, audit, and rollback validation.                |
| P0       | `n/a\|managed-package-data\|SalesforceMapsConfiguration`         | maps                                       | Base objects, button sets, permission groups, layers, markers, routes, assignments       | none                                                                 | `managed-package-data` | `A/NA/NA/NA/A` | `R-DATA`, `R-LIFE`; no `maps__` support                                        | Salesforce states sandbox configurations cannot be moved to production / high   | Read-only inventory fixture; full-copy sandbox, package version/license, vendor-supported transfer mechanism, privacy review, and provider smoke.            |
| P0       | `n/a\|provider-lifecycle\|SalesforceMapsTerritoryAlignment`      | maps                                       | Alignment, optimization, approval, and publish state                                     | none                                                                 | `provider-lifecycle`   | `A/NA/NA/NA/A` | `R-LIFE`; no Maps provider                                                     | OAuth/MAIO dependency, destructive publish, no portable sandbox config / high   | Deterministic dry-run plan fixture; Maps Territory Planning license, OAuth user, approval, optimization, export-before-publish, and rollback proof.          |
| P1       | `67.0\|metadata-api\|AccountForecastSettings`                    | manufacturing                              | [`AccountForecastSettings`][MT-ACCOUNT-FORECAST]                                         | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Forecasting feature state and calculation semantics / high                      | Settings XML; forecast-enabled org, retrieve/deploy, recalculate a known account forecast.                                                                   |
| P1       | `67.0\|metadata-api\|AdvAccountForecastSet`                      | manufacturing                              | [`AdvAccountForecastSet`][MT-ADV-FORECAST]                                               | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Object/dimension/period dependencies and packaging / high                       | Set plus dimension/period fixtures; licensed org round-trip and deterministic rollup.                                                                        |
| P1       | `67.0\|metadata-api\|AdvAcctForecastDimSource`                   | manufacturing                              | [`AdvAcctForecastDimSource`][MT-ADV-DIM]                                                 | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Source object/field dependency / high                                           | Fixture referencing known object fields; reject missing field locally and verify org deploy.                                                                 |
| P1       | `67.0\|metadata-api\|AdvAcctForecastPeriodGroup`                 | manufacturing                              | [`AdvAcctForecastPeriodGroup`][MT-ADV-PERIOD]                                            | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Fiscal/calendar and effective-period ordering / high                            | Fixed calendar fixture; org validation across known periods and locale/time-zone boundary.                                                                   |
| P1       | `67.0\|metadata-api\|BldgEnrgyIntensityCnfg`                     | netzero                                    | [`BldgEnrgyIntensityCnfg`][MT-BUILDING]                                                  | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Abbreviated identity, units, record-type configuration / high                   | Building config with units and record type; round-trip and known intensity calculation.                                                                      |
| P1       | `67.0\|metadata-api\|IndustriesConnectedServiceSettings`         | automotive                                 | [`IndustriesConnectedServiceSettings`][MT-CONNECTED]                                     | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Telematics/provider setup is not completed by metadata / medium-high            | Settings fixture; connected-services org, provider registration, sample telemetry, and credential-redaction check.                                           |
| P1       | `67.0\|metadata-api\|IndustriesMfgSampleManagementSettings`      | manufacturing                              | [`IndustriesMfgSampleManagementSettings`][MT-MFG-SAMPLE]                                 | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Optional feature/license and sample workflow / medium-high                      | Settings XML; feature-enabled org and sample-request lifecycle smoke.                                                                                        |
| P1       | `67.0\|metadata-api\|MfgProgramTemplate`                         | manufacturing                              | [`MfgProgramTemplate`][MT-MFG-PROGRAM]                                                   | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Template versus `MfgProgram` data records / high                                | Template fixture with no production data; licensed org round-trip and program creation from template.                                                        |
| P1       | `67.0\|metadata-api\|SalesAgreementSettings`                     | manufacturing                              | [`SalesAgreementSettings`][MT-SALES-AGREEMENT]                                           | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Calculation mode and activation ordering / high                                 | Settings fixture; deploy before agreement records and validate known actuals calculation.                                                                    |
| P1       | `67.0\|metadata-api\|SustainabilityUom`                          | netzero                                    | [`SustainabilityUom`][MT-SUST-UOM]                                                       | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Unit identity and downstream calculation blast radius / high                    | Base-unit fixture; round-trip and known conversion/calculation.                                                                                              |
| P1       | `67.0\|metadata-api\|SustnUomConversion`                         | netzero                                    | [`SustnUomConversion`][MT-SUST-CONV]                                                     | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Must depend on source/target units; numerical precision / high                  | Sorted conversion fixture; reject missing units/cycles, org round-trip, precision assertion.                                                                 |
| P2       | `67.0\|metadata-api\|FuelType`                                   | netzero                                    | [`FuelType`][MT-FUEL]                                                                    | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Reference identity and emission-factor linkage / medium-high                    | Minimal fuel fixture; org round-trip and linked factor validation.                                                                                           |
| P2       | `67.0\|metadata-api\|FuelTypeSustnUom`                           | netzero                                    | [`FuelTypeSustnUom`][MT-FUEL-UOM]                                                        | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Fuel/UOM join ordering / high                                                   | Fixture depends on both rows; deterministic missing-reference failure and org deploy.                                                                        |
| P2       | `67.0\|metadata-api\|GeocodeSettings`                            | maps                                       | [`GeocodeSettings`][MT-GEOCODE]                                                          | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Core geocoding versus Maps provider conflation / medium-high                    | Settings XML; core org round-trip, then separate provider coverage and consent check.                                                                        |
| P2       | `67.0\|metadata-api\|LocationUse`                                | maps                                       | [`LocationUse`][MT-LOCATION-USE]                                                         | none                                                                 | `metadata-api`         | `Pt/A/A/A/NA`  | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Location/object dependency and feature availability / medium                    | One location-use definition; retrieve/list/deploy and verify target object/location behavior.                                                                |
| P2       | `67.0\|metadata-api\|MapReportSettings`                          | maps                                       | [`MapReportSettings`][MT-MAP-REPORT]                                                     | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Core map-report settings may not represent managed Maps layers / medium         | Settings XML; org round-trip and report-map smoke without claiming package-layer support.                                                                    |
| P2       | `67.0\|metadata-api\|MfgServiceConsoleSettings`                  | manufacturing                              | [`MfgServiceConsoleSettings`][MT-MFG-CONSOLE]                                            | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Console feature and app dependencies / medium                                   | Settings fixture; licensed org and console navigation smoke.                                                                                                 |
| P2       | `67.0\|metadata-api\|RebateAndAccrualMgmtAdvncdSettings`         | manufacturing                              | [`RebateAndAccrualMgmtAdvncdSettings`][MT-REBATE]                                        | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Finance-sensitive calculations and edition gate / high                          | Settings fixture; licensed org, known rebate/accrual calculation, approval and rollback evidence.                                                            |
| P2       | `67.0\|metadata-api\|StockRotationSettings`                      | cgcloud                                    | [`StockRotationSettings`][MT-STOCK]                                                      | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Retail execution variant and mobile behavior / medium-high                      | Settings XML; CGCloud retail org, stock-rotation visit task and offline/mobile smoke.                                                                        |
| P2       | `67.0\|metadata-api\|WarrantyLifecycleMgmtSettings`              | automotive                                 | [`WarrantyLifecycleMgmtSettings`][MT-WARRANTY]                                           | none                                                                 | `metadata-api`         | `Pt/A/A/A/A`   | `R-TYPE`, `R-SCAN`, `R-GAP`, `R-ORDER`                                         | Cross-product ownership and feature licensing / medium                          | Automotive ownership is provisional; validate availability, retrieve/deploy, and run warranty lifecycle smoke before promotion.                              |

## C1 shared-platform references

The following are dependencies, not C6-owned candidate rows:

| C6 concern                                                       | Canonical C1 type/channel                                                                   | C6 interpretation                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Product objects, fields, record types, validation rules, layouts | `CustomObject` and source-format composite children                                         | Product API names are contents. Reuse C1 discovery, child expansion, graph normalization, and deployment ownership.              |
| Customer-owned Modeler or mapping CMDT                           | `CustomMetadata` / `CustomMetadataRecord`                                                   | Reuse C1 aliases and parser. Do not assume managed/protected package records are writable.                                       |
| Industrial automation                                            | `Flow`, `ApexClass`, `ApexTrigger`                                                          | Reuse C1 nodes. Add C6 edges only when a C6 metadata parser proves a reference.                                                  |
| Permissions, sharing, restriction, credentials                   | `PermissionSet`, `PermissionSetGroup`, `SharingRules`, `RestrictionRule`, `NamedCredential` | Reuse C1 security ownership; license assignments and secrets remain environment data.                                            |
| Automotive and Maps territory models                             | `Territory2`, `Territory2Model`, `Territory2Rule`, `Territory2Type`                         | C1 owns the Metadata API types and activation ordering. Maps Territory Planning alignments remain a separate provider lifecycle. |
| External files stored in Salesforce                              | `ContentAsset`, `Document`, `StaticResource` where applicable                               | A file becoming Salesforce metadata does not make its upstream provider dataset or legal license deployable.                     |

## Channel boundaries

### Metadata API

The API 67 rows above are vendor metadata types exposed by the current coverage
report. They should enter the core deploy only after exact source shape,
scanner, dependency, ordering, and licensed-org evidence exists. Settings rows
must not be treated as complete product activation.

### Managed-package data

CGCloud Modeler records, industrial operational/reference records, and Maps
package configuration are data with package-owned schema and lifecycle. The
generic `CustomObject` scanner sees schema source, not records. A supported
provider export, stable natural keys, reference ordering, version checks,
idempotent upsert, reconciliation, and rollback are prerequisites. No generic
SOQL export should be presented as a supported deployment mechanism.

### Mapping and geospatial provider lifecycle

Maps Territory Planning requires a permission-set license and OAuth user for
the Maps Input Output system. Alignment approval and publish are provider
operations. Publishing can write Salesforce fields, create/overwrite shape
layers, and create auto-assignment rules; Salesforce warns that auto assignment
cannot be undone. This belongs in a dedicated dry-run-first provider, not the
Metadata API executor.

### External assets

Route/traffic/geocode/boundary data, GIS topology, telemetry, ERP/DMS/AMI/OMS
feeds, emission-factor libraries, utility bills, and audit evidence remain
external assets until an explicit product contract says otherwise. Catalog
entries should retain provider, region, version/checksum, license/terms,
credential reference, PII classification, retention, and rollback pointer.
Binary or regulated evidence must not be copied into fixtures.

## Recommended implementation slices

1. **P0 catalog-only registration.** Add API-versioned rows and explicit
   channel ownership without changing `MetadataType` blindly. Derive gap output
   from the catalog and prove byte-stable key sorting.
2. **P0 licensed settings scanner.** Add a focused settings scanner registry
   for the six P0 Metadata API types. Parse settings into narrow contracts,
   retain unknown XML, and order product settings before definitions. Do not
   add branches to `metadata-scanner-service.ts`.
3. **P1 Manufacturing and Net Zero definitions.** Add focused parsers for
   advanced forecast sets/dimensions/periods, program templates, asset-source
   configurations, and sustainability units/conversions. Emit typed
   dependencies to C1 object/field/record-type nodes.
4. **P1 package-data detection only.** Detect namespaces, package versions, and
   configured artifact families; report them as blocked unless a
   vendor-supported export/import contract and rollback proof are attached.
5. **P1 Maps provider contract.** Add read-only inventory and dry-run planning
   for alignments, layers, rules, and provider prerequisites. Require explicit
   approval for publish and preserve an export-before-change rollback artifact.
6. **P2 external-asset registry.** Track checksums and provider contracts, not
   secrets or protected data. Keep transfer execution outside the core
   Metadata API phase.
7. **P2 nearby settings.** Add lower-priority settings only after the relevant
   feature-enabled org demonstrates retrieval, deploy, behavior, and rollback.

Each slice needs deterministic JSON/human CLI fixtures, exact vendor-name
round-trips, and a negative test proving that product object API names do not
become metadata types.

## Licensing and packaging constraints

- Every C6 product requires edition, feature, permission-set license, or package
  validation; source exposure in the coverage report is not entitlement.
- Managed package components are immutable. Customer extensions must use
  supported extension points and a customer namespace/prefix.
- Package namespace and exact package version are artifact attributes and must
  be present in evidence. They are not aliases or catalog types.
- CGCloud has distinct TPM, Retail Execution, and Route Optimization variants;
  fixtures cannot claim cross-variant support.
- Manufacturing forecasting, sales agreements, rebates, sample management, and
  service console can have independent feature gates.
- Automotive connected services and Energy/Utilities integrations require
  external provider setup and credentials not represented by metadata.
- Salesforce Maps states that sandbox-created configurations cannot be moved to
  production and recommends full-copy sandboxes for support. Provider
  portability must therefore remain blocked until a supported transfer path is
  proven.
- Net Zero unit/factor changes affect audited calculations. Promotion requires
  effective dating, provenance, deterministic recalculation, and historical
  result protection.

## Validation matrix

| Target                    | Deterministic local fixture                                                     | Required licensed org/provider evidence                                             |
| ------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Catalog contract          | Key-sorted rows, exact vendor spelling, unique channel ownership, C1 references | `sf org list metadata-types --api-version 67.0` in each enabled product org         |
| Settings                  | Minimal XML plus unknown-element preservation and stable JSON output            | Retrieve/deploy/round-trip, setup-state comparison, product smoke, rollback         |
| Manufacturing definitions | Forecast set/dimension/period and program-template graph                        | Licensed forecasting/program org; rollup/calculation and template creation          |
| Net Zero definitions      | Asset configs and UOM conversion DAG with fixed decimal values                  | Licensed Net Zero org; known CO2e/intensity results and audit history               |
| Product object schema     | Representative standard and namespaced product object customizations            | Reuse C1 CustomObject validation; verify package upgrade compatibility              |
| Managed-package data      | Redacted natural-key graph; dry-run reports blocked by default                  | Supported vendor tool, exact package version, idempotency, reconciliation, rollback |
| Maps package data         | Read-only inventory with stable IDs and no coordinates from real users          | Full-copy sandbox and documented transfer support                                   |
| Maps alignment            | Synthetic polygon/alignment plan and byte-stable dry run                        | PSL, OAuth/MAIO, approval, optimization, export, publish, assignment rollback       |
| External assets           | Provider/version/checksum manifest with fake credential references              | Terms/license, regional coverage, privacy/retention, provider sandbox, rollback     |
| Negative boundary         | Product object names and namespaces never appear as metadata types              | None; org listing is supporting evidence only                                       |

## Limitations

- No Salesforce org, managed package, Maps provider, industrial integration, or
  external dataset was accessed or mutated.
- Official Atlas detail pages are SPA shells in this environment. Exact vendor
  names and channel exposure come from the current official coverage report and
  metadata-type index; field-level XML contracts still require PDF or org
  retrieval before implementation.
- The current coverage report is unversioned in its URL. This report pins the
  comparison contract to API 67.0 and the retrieval date, but availability can
  still vary by org.
- Product profiles contain several API-name simplifications and custom-object
  examples. The official data-model gallery and org describe/retrieval must
  arbitrate exact physical API names.
- Repository inspection was intentionally limited to metadata contracts,
  scanners, the gap analyzer, object parsing, ordering, lifecycle providers,
  and focused tests. No source or test file was changed.
- The repository is configured as `core.bare=true`, so normal `git status` and
  worktree diff commands are unavailable. File-scope validation is used below.

## Architectural concerns

### Inherited

The handoff recommendation to add a versioned capability catalog is sound.
However, its broad phrase "process Industries candidates" must not imply one
Industries deployment channel. C6 contains ordinary Metadata API settings,
managed-package data, provider lifecycle, and external assets. These require
separate ownership and validation gates.

### Self-imposed

None. This research proposes plugin catalog/scanner/provider contracts only. It
does not introduce Salesforce custom objects, fields, CMDT records, labels,
permission sets, Apex, or Flows.

[SF-COV]: https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report
[SF-TYPES]: https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types
[SF-NOTATION]: https://developer.salesforce.com/docs/platform/data-models/guide/salesforce-data-model-notation.html
[SF-CG]: https://developer.salesforce.com/docs/platform/data-models/guide/retail-execution.html
[SF-MFG]: https://developer.salesforce.com/docs/platform/data-models/guide/manufacturing-cloud-category.html
[SF-AUTO]: https://developer.salesforce.com/docs/platform/data-models/guide/automotive-cloud-overview.html
[SF-ENERGY]: https://developer.salesforce.com/docs/platform/data-models/guide/energy-and-utilities-cloud-category.html
[SF-NZ]: https://developer.salesforce.com/docs/platform/data-models/guide/net-zero-cloud-overview.html
[SF-MAPS-SETUP]: https://help.salesforce.com/s/articleView?id=sales.salesforce_maps_setup_reference.htm&type=5
[SF-MAPS-TP]: https://help.salesforce.com/s/articleView?id=000389064&type=1
[SF-MAPS-SBX]: https://help.salesforce.com/s/articleView?id=000389804&type=1
[SF-MAPS-PUBLISH]: https://help.salesforce.com/s/articleView?id=Publish-to-Salesforce-Maps-in-Salesforce-Maps-Territory-Planning&type=1
[MT-ACCOUNT-FORECAST]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_accountforecastsettings.htm
[MT-ADV-FORECAST]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_advaccountforecastset.htm
[MT-ADV-DIM]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_advacctforecastdimsource.htm
[MT-ADV-PERIOD]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_advacctforecastperiodgroup.htm
[MT-AUTO]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_industriesautomotivesettings.htm
[MT-BUILDING]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_bldgenrgyintensitycnfg.htm
[MT-CONNECTED]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_industriesconnectedservicesettings.htm
[MT-EU-MULTI]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_industriesenergyutilitiesmultisitesettings.htm
[MT-FUEL]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_fueltype.htm
[MT-FUEL-UOM]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_fueltypesustnuom.htm
[MT-GEOCODE]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_geocodesettings.htm
[MT-LOCATION-USE]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_locationuse.htm
[MT-MAP-REPORT]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mapreportsettings.htm
[MT-MAPS]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mapsandlocationsettings.htm
[MT-MFG]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_industriesmanufacturingsettings.htm
[MT-MFG-CONSOLE]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mfgserviceconsolesettings.htm
[MT-MFG-PROGRAM]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_mfgprogramtemplate.htm
[MT-MFG-SAMPLE]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_industriesmfgsamplemanagementsettings.htm
[MT-REBATE]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_rebateandaccrualmgmtadvncdsettings.htm
[MT-RETAIL]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_retailexecutionsettings.htm
[MT-SALES-AGREEMENT]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_salesagreementsettings.htm
[MT-STATIONARY]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_stnryassetenvsrccnfg.htm
[MT-STOCK]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_stockrotationsettings.htm
[MT-SUST-CONV]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_sustnuomconversion.htm
[MT-SUST-UOM]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_sustainabilityuom.htm
[MT-VEHICLE-EMISSION]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_vehicleassetemssnsrccnfg.htm
[MT-WARRANTY]: https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_warrantylifecyclemgmtsettings.htm
