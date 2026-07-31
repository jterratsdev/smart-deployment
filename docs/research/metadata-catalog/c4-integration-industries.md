![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C4 Integration and Industries Platform Metadata Catalog Research

- Task: `PLUGIN-METADATA-CATALOG-RESEARCH`
- Cluster: `C4 Integration and Industries platform`
- Profiles: `mulesoft`, `omnistudio`, `industries`
- Canonical cluster: `C4`
- Author: Salesforce Professional Services
- Report version: 1.0
- Vendor baseline: Salesforce Summer '26, API `67.0`; current MuleSoft documentation
- Retrieved: `2026-07-23`
- Scope: research only; no source, test, org, or provider mutation

## Method and status contract

Rows are ordered by priority and then implementation dependency within each
priority. The stable key is
`<apiVersion>|<deploymentChannel>|<vendorType>`. Setup-agents profile evidence
is version `3.15.0-rc` from `.codex/mulesoft.md`, `.codex/omnistudio.md`, and
`.codex/industries.md`. When an API version does not apply, the first segment
is `n/a`; the second segment remains the actual deployment channel.

Capability codes are:

- `P`: proven by an exact repository symbol and focused fixture/test evidence.
- `Pt`: partial; detection or planning exists, but end-to-end behavior is not proven.
- `A`: absent.
- `NA`: not applicable to the deployment channel.

The compact support column is `D/P/X/O/L`: discovery, parser, dependency,
ordering, and post-deploy/provider lifecycle. Manifest-only detection is `Pt`,
not scanner support. A type is not supported merely because a package manifest
can name it.

C1 is the canonical owner for shared platform types, including `CustomObject`,
`Flow`, `PermissionSet`, `LightningComponentBundle`, `NamedCredential`,
`ExternalCredential`, and `OmniSupervisorConfig`. This report references, and
does not duplicate, those rows in
[`c1-core-crm-channels.md`](./c1-core-crm-channels.md).

## Vendor sources

### Salesforce and OmniStudio

- `[SF-COV-67]` [Salesforce Metadata Coverage Report v67.0](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/coverage-report/v67.0)
- `[SF-TYPES]` [Salesforce Metadata Types index](https://developer.salesforce.com/docs/success/metadata-coverage-report/references/metadata-types)
- `[SF-ODT]` [OmniDataTransform](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_omnidatatransform.htm)
- `[SF-OIP]` [OmniIntegrationProcedure](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_omniintegrationprocedure.htm)
- `[SF-OS]` [OmniScript](https://developer.salesforce.com/docs/atlas.en-us.industries_reference.meta/industries_reference/meta_omniscript.htm)
- `[SF-OUC]` [OmniUiCard](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_omniuicard.htm)
- `[SF-OMNI-MP]` [Deploy OmniStudio for Managed Packages components](https://help.salesforce.com/s/articleView?id=sf.os_deploy.htm&language=en_US&type=5)
- `[SF-DATAPACK]` [Data Deployment with Data Packs](https://help.salesforce.com/s/articleView?id=sf.os_data_deployment_with_datapacks.htm&language=en_US&type=5)
- `[SF-VBT]` [Export and deploy with an OmniStudio Build Tool job](https://help.salesforce.com/s/articleView?id=xcloud.os_build_tool_job_file.htm&language=en_US&type=5)

### Industries

- `[SF-DM]` [DecisionMatrixDefinition](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_decisionmatrixdefinition.htm)
- `[SF-DMV]` [DecisionMatrixDefinitionVersion](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_decisionmatrixdefinitionversion.htm)
- `[SF-DT]` [DecisionTable](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_decisiontable.htm)
- `[SF-DTL]` [DecisionTableDatasetLink](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_decisiontabledatasetlink.htm)
- `[SF-OPCM]` [OrchestrationPlanCtxMapping](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_orchestrationplanctxmapping.htm)
- `[SF-OMS]` [OrderManagementSettings](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_ordermanagementsettings.htm)
- `[SF-DGS]` [DocumentGenerationSetting](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_documentgenerationsetting.htm)
- `[SF-DOC-TPL]` [DocumentTemplate](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_documenttemplate.htm)

### MuleSoft

- `[MULE-APP]` [Mule application structure](https://docs.mulesoft.com/mule-runtime/latest/package-a-mule-application)
- `[MULE-CH2]` [Deploy to CloudHub 2.0 with Mule Maven Plugin](https://docs.mulesoft.com/cloudhub-2/ch2-deploy-maven)
- `[MULE-EXCHANGE]` [Publish API specifications to Anypoint Exchange](https://docs.mulesoft.com/design-center/design-publish)
- `[MULE-MUNIT]` [MUnit Maven Plugin](https://docs.mulesoft.com/munit/latest/munit-maven-plugin)
- `[MULE-POLICY]` [Mule Gateway policies](https://docs.mulesoft.com/mule-gateway/policies-policy-types)
- `[MULE-API-MGR]` [API Manager overview](https://docs.mulesoft.com/api-manager/latest/latest-overview-concept)

API `67.0` is pinned to match C1 and the Summer '26 repository research
baseline. The v67 report is the authority for Metadata API exposure; product
availability still depends on runtime, license, package, namespace, and org
feature settings.

## Deterministic candidate catalog

| Pri | catalogKey                                                 | Product                     | Vendor type or artifact                                                                     | Internal alias                                                    | Channel                | D/P/X/O/L      | Exact repository evidence and gap                                                                                                                                                                                                                                                                                     | Risk / confidence                                                                            | Deterministic fixture                                                                                                                                 | Required org/provider validation                                                                                                         |
| --- | ---------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ---------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| P0  | `n/a\|managed-package-data\|OmniStudioDataPackClassifier`  | OmniStudio                  | Managed-package DataPack path classifier                                                    | `OmniStudioVlocityProvider`                                       | `managed-package-data` | `P/NA/A/A/Pt`  | `special-deployment-plan.ts:269-294` detects both `vlocity` and standard-looking `omniScripts`, `dataRaptors`, `integrationProcedures`, `flexCards`; test `special-deployment-plan.test.ts:79-132` proves only `vlocity/OmniScript/...` planning. It does not inspect runtime, namespace, JSON shape, or job content. | Standard source can be misrouted to VBT; placeholder job is not executable / high            | Positive managed path, negative standard source path, namespace/runtime manifest, stable generated job, and unknown-path blocked case                 | Standard and managed org pair; package/runtime detection; `packDeploy`, activation, dependency, rollback, and generated LWC checks       |
| P0  | `67.0\|metadata-api\|OmniDataTransform`                    | OmniStudio Standard         | Data Mapper/DataRaptor definition                                                           | `DataRaptor` is product terminology, not a second type            | `metadata-api`         | `Pt/A/A/A/NA`  | `[SF-COV-67]`, `[SF-ODT]`; absent from `MetadataType`, `DEPLOYMENT_ORDER`, scanner registries, and gap source-directory/suffix maps. Package manifests are generically collected by `metadata-gap-analysis-service.ts:197-219`, so discovery is manifest-only.                                                        | Alias and runtime confusion / high                                                           | One source-format component with object, field, named credential, and nested transform references; manifest/source discovery must converge on one row | Standard-runtime org retrieval/deploy; validate referenced object separately as required by Salesforce; execute representative transform |
| P0  | `67.0\|metadata-api\|OmniIntegrationProcedure`             | OmniStudio Standard         | Integration Procedure                                                                       | `IntegrationProcedure`                                            | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-OIP]`; no repository symbol. The current provider path regex instead sends `integrationProcedures/` to VBT (`special-deployment-plan.ts:269-287`).                                                                                                                                                | Wrong deployment channel; callout and activation semantics / high                            | Procedure with OmniDataTransform, Apex, HTTP/named credential, and child procedure references; assert typed graph edges and no VBT phase              | Standard-runtime licensed org; deploy inactive version, test procedure, activate, and verify rollback/version behavior                   |
| P0  | `67.0\|metadata-api\|OmniScript`                           | OmniStudio Standard         | OmniScript                                                                                  | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-OS]`; no union/scanner/order symbol. `omniScripts/` is currently classified as managed-package data (`special-deployment-plan.ts:269-287`).                                                                                                                                                       | Standard/managed collision; version and generated LWC lifecycle / high                       | Script referencing Integration Procedure, Data Transform, FlexCard/LWC, Apex, and another script; stable type/subtype/language identity               | Standard-runtime org; deploy/version/activate; preview and generated component smoke; rollback active version                            |
| P0  | `67.0\|metadata-api\|OmniUiCard`                           | OmniStudio Standard         | FlexCard                                                                                    | `FlexCard`                                                        | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-OUC]`; no repository symbol. `flexCards/` currently triggers VBT (`special-deployment-plan.ts:269-287`).                                                                                                                                                                                          | Alias collision and activation/generated LWC lifecycle / high                                | Card with OmniDataTransform, Integration Procedure, Apex, child card, LWC, and navigation references                                                  | Standard-runtime org; deploy, activate, preview responsive states, generated LWC smoke, rollback                                         |
| P0  | `n/a\|external-provider\|MuleApplication`                  | MuleSoft                    | Mule application: `pom.xml`, `mule-artifact.json`, `src/main/mule`, resources and DataWeave | none                                                              | `external-provider`    | `A/A/A/A/A`    | `[MULE-APP]`, `[MULE-CH2]`; repository has no Mule project scanner, parser, Maven adapter, `mule-artifact.json`, DataWeave, or MUnit symbol. `SpecialDeploymentCommand.tool` only allows `sf` or `vlocity` (`special-deployment-plan.ts:24-27`).                                                                      | Credentials, target/environment, runtime/plugin compatibility, mutable provider state / high | Minimal Mule app with flow/subflow, connector config, externalized DataWeave, secure-property placeholders, POM dependency graph, and MUnit report    | Anypoint business group/environment; Exchange publish, `mvn clean deploy -DmuleDeploy`, health endpoint, monitoring, rollback/redeploy   |
| P0  | `n/a\|external-provider\|AnypointExchangeApiSpecification` | MuleSoft                    | RAML/OAS API specification and fragments as versioned Exchange assets                       | none                                                              | `external-provider`    | `A/A/A/A/A`    | `[MULE-EXCHANGE]`; no Exchange asset model, RAML/OAS parser, semantic-version contract, or provider phase exists.                                                                                                                                                                                                     | Asset identity/version, transitive fragments, breaking contracts / high                      | RAML and OAS roots with libraries/fragments/examples; deterministic Exchange coordinate and semantic-version change classification                    | Publish to non-production Exchange; resolve dependencies; contract test; lifecycle state/deprecation and rollback/version policy         |
| P0  | `n/a\|provider-lifecycle\|AnypointApiManagerPolicyBinding` | MuleSoft                    | API instance, policy application, SLA/client contract                                       | none                                                              | `provider-lifecycle`   | `A/NA/A/A/A`   | `[MULE-POLICY]`, `[MULE-API-MGR]`; no API Manager adapter or lifecycle state. Do not represent a provider binding as Salesforce metadata or Mule source XML.                                                                                                                                                          | Security and traffic policy side effects; environment IDs and secrets / high                 | Read-only desired-state fixture with API instance coordinate, policy version/config, and redacted secrets; byte-stable diff                           | Apply/remove in test environment; gateway synchronization, policy enforcement, client contract, audit, and rollback                      |
| P1  | `n/a\|managed-package-data\|DataRaptorDataPack`            | OmniStudio Managed          | `DataRaptor` DataPack records                                                               | none; do not alias to `OmniDataTransform` across channels         | `managed-package-data` | `P/NA/A/A/Pt`  | `[SF-OMNI-MP]`, `[SF-DATAPACK]`, `[SF-VBT]`; current path planner and placeholder `vlocity packDeploy` are at `special-deployment-plan.ts:269-294`. No DataPack key, dependency, diff, activation, or result parser exists.                                                                                           | Namespace/package version, data ordering, overwrite behavior / high                          | Expanded DataPack JSON, deterministic key, generated job, dependency depth, redacted auth, and failed-result fixture                                  | Same managed runtime/package version; `packExport`/diff/`packDeploy`; execute Data Mapper and rollback                                   |
| P1  | `n/a\|managed-package-data\|IntegrationProcedureDataPack`  | OmniStudio Managed          | `IntegrationProcedure` DataPack records                                                     | none; distinct from native type                                   | `managed-package-data` | `P/NA/A/A/Pt`  | Same provider evidence as above; only path presence is planned, with no component identity or dependencies.                                                                                                                                                                                                           | Version/activation and external callout behavior / high                                      | DataPack with DataRaptor, Apex, HTTP, and nested procedure dependencies plus generated job                                                            | Managed org; deploy dependencies, test procedure, activation, package compatibility, rollback                                            |
| P1  | `n/a\|managed-package-data\|OmniScriptDataPack`            | OmniStudio Managed          | `OmniScript` DataPack records                                                               | none; channel distinguishes it from native `OmniScript`           | `managed-package-data` | `P/NA/A/A/Pt`  | Test fixture proves a `vlocity/OmniScript/...` path creates a VBT command (`special-deployment-plan.test.ts:79-132`), but no job generation or activation result is proven.                                                                                                                                           | Version creation, activation, generated LWC / high                                           | Versioned OmniScript DataPack and dependencies; stable key and job; activation disabled/enabled cases                                                 | Managed org; deploy, activate, generated LWC completion, preview, rollback                                                               |
| P1  | `n/a\|managed-package-data\|FlexCardDataPack`              | OmniStudio Managed          | Card/FlexCard DataPack records                                                              | none; distinct from native `OmniUiCard`                           | `managed-package-data` | `P/NA/A/A/Pt`  | Current regex recognizes `flexCards/`, but no focused test or DataPack semantics exist (`special-deployment-plan.ts:269-294`). Salesforce documents that Cards cannot be moved between standard and managed runtimes (`[SF-DATAPACK]`).                                                                               | Cross-runtime incompatibility and generated LWC / high                                       | Managed Card DataPack, child-card and data-source dependencies, standard-runtime negative case                                                        | Managed org only; deploy/activate/preview/generated LWC/package-upgrade smoke                                                            |
| P1  | `67.0\|metadata-api\|DecisionMatrixDefinition`             | Industries platform         | Decision Matrix definition                                                                  | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-DM]`; absent from union, order, scanner, and parser surfaces.                                                                                                                                                                                                                                     | Definition/version activation and rule correctness / high                                    | Definition plus multiple versions, input/output object-field references, stable active-version edge                                                   | Licensed Industries org; deploy versions, run representative matrix, activate new version, rollback                                      |
| P1  | `67.0\|metadata-api\|DecisionMatrixDefinitionVersion`      | Industries platform         | Decision Matrix version                                                                     | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-DMV]`; no repository support. Must depend on the definition rather than be inferred by filename title-casing.                                                                                                                                                                                     | Parent/version ordering / high                                                               | Two versions with explicit parent and data references; definition sorts first                                                                         | Licensed org; deploy inactive version, test, activate, and verify old active version handling                                            |
| P1  | `67.0\|metadata-api\|DecisionTable`                        | Industries platform         | Decision Table                                                                              | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-DT]`; no repository symbol. `src/types/salesforce/parser-types.ts:87` contains the unrelated Flow action string `ActionPlan`, not Decision Table support.                                                                                                                                         | Dataset/object-field dependencies and published state / high                                 | Table with inputs, outputs, dataset link, and version/state variants                                                                                  | Licensed org; deploy, run representative inputs, publish/activate if required, rollback                                                  |
| P1  | `67.0\|metadata-api\|DecisionTableDatasetLink`             | Industries platform         | Decision Table dataset link                                                                 | same                                                              | `metadata-api`         | `Pt/A/A/A/NA`  | `[SF-COV-67]`, `[SF-DTL]`; no repository support.                                                                                                                                                                                                                                                                     | Referential ordering and data availability / high                                            | Link fixture depends on table and dataset with deterministic node IDs                                                                                 | Licensed org with representative dataset; deploy/retrieve and execute linked table                                                       |
| P1  | `67.0\|metadata-api\|OmniscriptDefinition`                 | Industries platform         | Industries OmniScript definition metadata                                                   | preserve vendor spelling; do not silently merge with `OmniScript` | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]` exposes both `OmniScript` and `OmniscriptDefinition`; repository has neither and no alias contract.                                                                                                                                                                                                     | Similar vendor names can be incorrectly deduplicated / medium                                | Separate manifest/source fixtures proving vendor identity and relationship, or an org-backed accepted alias decision                                  | `sf org list metadata-types --api-version 67.0`, retrieve both types where enabled, and establish version/activation relationship        |
| P2  | `67.0\|metadata-api\|DocumentGenerationSetting`            | Industries platform         | Document generation setting                                                                 | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-DGS]`; no repository symbol. `Document` in `MetadataType` is a different core content type (`metadata.ts:45`).                                                                                                                                                                                    | Feature enablement and template/provider prerequisites / high                                | Setting fixture plus references to template/data transform; ensure no alias to `Document`                                                             | Licensed org; deploy settings, generate representative output, verify rollback and sensitive data handling                               |
| P2  | `67.0\|metadata-api\|DocumentTemplate`                     | Industries platform         | Document template metadata                                                                  | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-DOC-TPL]`; absent from repository support.                                                                                                                                                                                                                                                        | Binary/template payload, merge fields, package availability / medium-high                    | Template with OmniDataTransform and object-field merge dependencies, checksum-stable binary/resource handling                                         | Licensed org; retrieve/deploy and render representative document; inspect output and rollback                                            |
| P2  | `67.0\|metadata-api\|OrchestrationPlanCtxMapping`          | Industries Order Management | Orchestration plan context mapping                                                          | same                                                              | `metadata-api`         | `Pt/A/A/A/A`   | `[SF-COV-67]`, `[SF-OPCM]`; no repository symbol.                                                                                                                                                                                                                                                                     | Fulfillment model dependencies and runtime behavior / high                                   | Mapping with object/field, plan/context, and flow/action references                                                                                   | Industries Order Management org; deploy and run representative decomposition/orchestration including fallout path                        |
| P2  | `n/a\|external-provider\|MuleComposerFlow`                 | MuleSoft Composer           | No-code Composer flow                                                                       | none                                                              | `external-provider`    | `A/NA/NA/NA/A` | `.codex/mulesoft.md` states Composer flows cannot be version-controlled in Git; no repository/provider adapter exists.                                                                                                                                                                                                | Provider-only configuration, credentials, connectors, weak source traceability / medium-high | Documentation inventory schema and redacted field-mapping export only; never claim deployable source                                                  | Composer sandbox/workspace; manual export/import or provider-supported lifecycle, connector auth, run history, rollback                  |

`OrderManagementSettings` is a shared platform setting canonically owned by C1
at `67.0\|metadata-api\|OrderManagementSettings`. C4 references that C1 row for
Industries Order Management and does not duplicate it in this candidate table.

## Ownership and channel rules

1. `OmniDataTransform`, `OmniIntegrationProcedure`, `OmniScript`, and
   `OmniUiCard` are Salesforce Metadata API types in API 67. Product labels
   such as DataRaptor/Data Mapper, Integration Procedure, OmniScript, and
   FlexCard are aliases, not managed DataPack evidence.
2. Managed-package DataPacks remain separate rows because they are JSON record
   graphs deployed with OmniStudio Build Tool. Their namespace, identity,
   versioning, dependency traversal, activation, and rollback differ from
   source-format Metadata API components.
3. The current `OmniStudioVlocityProvider` must not route by directory spelling
   alone. Runtime/package/namespace and artifact-shape detection must select the
   channel before any command is planned.
4. Mule applications, RAML/OAS assets, Exchange versions, CloudHub/Runtime
   Fabric deployments, API Manager bindings, and Composer flows are external
   provider artifacts. They must never enter `MetadataType`,
   `DEPLOYMENT_ORDER`, Salesforce manifests, or the Salesforce dependency graph.
5. Industries object API names and records, including product catalog,
   orchestration operational records, `ActionPlanTemplate`, and
   `ActionPlanTemplateItem`, are not new metadata types. Schema customizations
   belong to C1 `CustomObject`; configuration/data migration requires a
   separately validated data/provider lifecycle.
6. `DecisionMatrixDefinition`, `DecisionMatrixDefinitionVersion`,
   `DecisionTable`, and `DecisionTableDatasetLink` are separate vendor types.
   Do not flatten definition, version, and dataset ownership into one inferred
   filename type.
7. `Document`, `DocumentTemplate`, and `DocumentGenerationSetting` are distinct
   types. The repository's existing `Document` ordering does not prove
   Industries document-generation support.

## Exact cross-cutting gaps

- The production scanner has focused registries for core Salesforce files and
  bundles, but no standard OmniStudio or Industries candidate in this report.
  `MetadataFormatScanner` is test-isolated and is not invoked by
  `MetadataScannerService`.
- The gap analyzer can read any manifest type, but its 26-name
  `SCANNER_SUPPORTED_TYPES`, source-directory map, suffix map, and heuristic
  title-casing contain no C4 standard type. Provider classification is a name
  regex, not deployment-channel evidence.
- The provider planner detects managed OmniStudio work only from changed path
  strings and emits `<generated-vlocity-job.yaml>`. It does not generate the
  job, identify DataPack keys, resolve dependencies, authenticate a source and
  target, parse VBT results, activate selectively, or plan rollback.
- Core metadata deployment excludes only `Bot`, `BotVersion`, and
  `AiAuthoringBundle`. If standard OmniStudio components were added to the
  scanner without first fixing channel classification, they could be included
  in core metadata and simultaneously trigger the VBT phase.
- CI publish execution is generic enough to invoke `sf` or `vlocity`, but there
  is no Mule/Maven/Anypoint command type, provider state contract, credential
  boundary, or health/rollback phase.
- No dependency rules model OmniStudio version parents, component-to-component
  references, Decision Matrix/Table definitions and datasets, document
  transforms/templates, or Industries order orchestration mappings.
- There is no catalog alias mechanism. DataRaptor versus
  `OmniDataTransform`, FlexCard versus `OmniUiCard`, and the simultaneous
  `OmniScript`/`OmniscriptDefinition` vendor names would otherwise create false
  gaps or unsafe merges.

## Recommended implementation slices

1. **P0 channel classifier and catalog aliases.** Add a typed classifier using
   API version, source shape, package/runtime evidence, namespace, and provider.
   Seed aliases for DataRaptor/Data Mapper, Integration Procedure, FlexCard, and
   the unresolved `OmniScript`/`OmniscriptDefinition` relationship. Replace the
   Omni provider's broad path regex with channel-qualified strategies.
2. **P0 standard OmniStudio scanner family.** Add focused scanners and parsers
   for `OmniDataTransform`, `OmniIntegrationProcedure`, `OmniScript`, and
   `OmniUiCard`. Emit typed component/version identities and preserve
   object/field, Apex, Flow, LWC, named credential, child component, and
   activation references.
3. **P0 external-provider boundary.** Define an adapter contract separate from
   Salesforce metadata for Mule application build/test/Exchange/deploy/health
   and API Manager lifecycle. Keep credentials and target IDs out of catalog
   fixtures and CLI JSON.
4. **P1 managed DataPack provider.** Detect package/runtime explicitly,
   generate deterministic VBT jobs from DataPack keys, resolve dependencies,
   parse results, and model activation and rollback. Keep each DataPack family
   separate from the native Metadata API row.
5. **P1 Industries rules.** Add definition/version-aware scanners for Decision
   Matrix and Decision Table families, then prove deterministic ordering and
   execution against licensed org fixtures.
6. **P2 Industries lifecycle.** Add document-generation and order-orchestration
   candidates only after feature/package preflight, human-reviewed settings
   handling, and representative runtime tests are available.
7. **P2 gap/report integration.** Derive support from the capability catalog;
   expose channel, alias, confidence, fixture, org/provider evidence, and
   blocked lifecycle reasons in stable JSON and human output.

No slice should add more branches to `metadata-scanner-service.ts` or
`metadata-gap-analysis-service.ts`. Use focused scanner registries, channel
strategies, provider adapters, and stable catalog contracts.

## Validation matrix

| Boundary                       | Local evidence                                                                                                 | External evidence required before promotion                                                                                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Standard OmniStudio            | Source and manifest converge on one vendor type; typed dependencies; standard paths never produce VBT commands | API 67 enabled-type inventory, retrieve/deploy, designer test, version activation, generated LWC where applicable, rollback |
| Managed OmniStudio             | Runtime/namespace detection, expanded DataPack fixtures, generated VBT job, dependency and result parsing      | Matching package versions, export/diff/deploy, activation, generated LWC, package-upgrade and rollback smoke                |
| Standard-to-managed separation | Same product label in two channels yields two catalog rows and exactly one deployment strategy                 | Standard and managed org pair; unsupported Card and reverse-import paths remain blocked                                     |
| Industries decisions           | Definition/version/table/dataset fixtures sort deterministically and preserve dependencies                     | Licensed org execution with representative inputs, activation/publish semantics, rollback                                   |
| Industries document/order      | Settings, templates, transforms, and orchestration mappings remain feature-gated                               | Licensed org generated document and order decomposition/orchestration/fallout smoke                                         |
| Mule application               | Parse POM, descriptor, Mule XML, DataWeave imports, connector configs, and MUnit reports without secrets       | MUnit, Exchange publish, CloudHub 2.0 or Runtime Fabric deployment, health/monitoring, rollback                             |
| Mule API lifecycle             | RAML/OAS/fragment graph and Exchange coordinate are deterministic; policy desired state is redacted            | Exchange contract resolution, API Manager instance/policy/SLA validation, gateway enforcement, audit and rollback           |
| Gap CLI                        | Byte-stable key-sorted JSON; aliases and channels cannot collapse; blocked evidence is explicit                | External evidence is linked, never simulated by local status                                                                |

## Limitations

- `.setup-agents/references/` exists but contains no cached references. The
  report therefore uses the current official URLs listed above and records the
  cache miss.
- Official documentation establishes product vocabulary and API/provider
  exposure. It does not prove source-directory spelling in every Salesforce
  CLI version, org-specific availability, retrieval completeness, deployment
  order, activation, generated LWC completion, or rollback.
- No Salesforce org, OmniStudio managed package, Industries package, Anypoint
  organization, CloudHub target, Runtime Fabric, Exchange asset, API Manager
  instance, or Composer workspace was accessed or changed.
- The report does not claim that Action Plans, product catalog records,
  orchestration runtime records, or managed-package object API names are
  Metadata API types.
- MuleSoft documentation is current and unversioned by Salesforce API. Mule
  runtime, Java, Mule Maven Plugin, connector, and control-plane compatibility
  must be pinned by a future provider implementation.
- Repository inspection was limited to metadata contracts, scanners, parsers,
  dependency/order logic, gap analysis, special deployment planning/execution,
  CI publish command/tests, and the three C4 profiles. No source or test file
  was changed.

## Architectural concerns

### Inherited

The architecture handoff correctly requires deployment-channel classification
before comparison. The concrete C4 correction is that the existing
`OmniStudioVlocityProvider` violates that boundary by matching standard product
directory labels and routing them to managed-package VBT without runtime or
artifact evidence. A future catalog must represent native and managed
OmniStudio artifacts as separate rows and strategies.

The handoff also correctly blocks MuleSoft behind a dedicated adapter. Mule
source and Anypoint provider resources cannot be modeled as unknown Salesforce
metadata with fallback priority 99; doing so would generate invalid manifests
and omit build, test, publish, deploy, health, and policy lifecycle.

### Self-imposed

None. This report proposes repository catalog, scanner, dependency, ordering,
and provider-adapter slices only. It introduces no Salesforce custom objects,
fields, labels, permission sets, Flows, OmniStudio components, Mule assets, or
provider configuration.
