# Metadata Wave Gap Review

- Task: `SD-PRODUCT-METADATA-AUDIT`
- Baseline: Salesforce API `67.0`
- Scope: missing metadata nodes, dependency edges, wave constraints, lifecycle phases, and validation
- Method: setup-agents product guidance fused into the selected `architect` role; no product profile was treated as an independent runtime role

## Executive finding

Adding a metadata type to `DEPLOYMENT_ORDER` does not create a deployment sequence. The current wave builder uses type priority only to sort components that are already topologically eligible. Independent components with different priorities can remain in the same deployment wave and manifest.

Safe product support therefore requires five separate contracts:

1. Exact vendor identity and deployment channel.
2. Source discovery and parser ownership.
3. Typed component dependency edges.
4. Wave constraints such as isolation, target prerequisites, and postconditions.
5. Provider lifecycle phases for activation, publication, execution, or external state.

Unknown metadata must not be authorized for deployment solely by fallback priority `99`.

## Engine gaps

| Priority | Gap                                                                  | Required change                                                                                 |
| -------- | -------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| P0       | Type order only sorts inside a wave                                  | Add explicit `before`, `after`, and `isolated` planning constraints that create wave boundaries |
| P0       | Unknown types receive executable priority `99`                       | Resolve through the capability registry and block unknown or lifecycle-unclassified artifacts   |
| P0       | Capability channels do not guard execution                           | Permit only `metadata-api` and proven source-format components in Salesforce manifests          |
| P0       | Provider and target prerequisites do not fit the component graph     | Add typed plan barriers rather than fake metadata nodes                                         |
| P0       | Circular hard dependencies can enter a fallback deployment wave      | Block hard cycles and distinguish missing external prerequisites from actual cycles             |
| P0       | Normal waves and special deployment phases are separate plans        | Build one ordered plan containing metadata waves, barriers, and provider operations             |
| P0       | Persisted graph and resume state lose lifecycle semantics            | Persist channel, relation, provenance, isolation, operation IDs, and postconditions             |
| P1       | Manifest generation uses internal component type names               | Map internal aliases to exact vendor manifest identities                                        |
| P1       | Wave validation checks size but not dependency direction or barriers | Validate relative order, channel ownership, isolation, and target readiness                     |
| P1       | Wave merging can erase required boundaries                           | Make merging graph-aware and prohibit merging isolated/provider waves                           |

## P0 metadata families

### C1 Core CRM and channels

- Canonical aliases: `ApexComponent`, `ApexPage`, `CustomApplication`, `CustomMetadata`, and `CustomPageWebLink`.
- Object children: `CustomField`, `BusinessProcess`, `RecordType`, `ValidationRule`, `CompactLayout`, `ListView`, and related source-owned child nodes.
- Rule containers: `MatchingRules`, `DuplicateRule`, `AssignmentRules`, `AutoResponseRules`, `EscalationRules`, and `Workflow`.
- Security: `SharingRules`, `PermissionSetGroup`, `MutingPermissionSet`, and `CustomPermission`.
- Experience: distinct `ExperienceBundle` and `DigitalExperienceBundle` identities plus publish completion.
- Licensed settings and products: `OrderManagementSettings`, `FieldServiceSettings`, `FieldServiceMobileConfig`, `FieldServiceMobileExtension`, and `AppointmentSchedulingPolicy`.
- Salesforce `SlackApp` must remain distinct from an external Slack app manifest and must reject masked secrets as deployment input.

Critical sequences:

```text
CustomObject OWD change
  -> internal sharing model readiness
  -> SharingRules

MatchingRules
  -> matching-rule readiness
  -> DuplicateRule

site/network foundation
  -> Experience metadata
  -> publish job
  -> publish completion
```

### C2 Data, analytics, and AI

- Agentforce: complete `AiAuthoringBundle`, `GenAiFunction`, `GenAiPlugin`, `GenAiPlannerBundle`, `GenAiPromptTemplate`, `GenAiPromptTemplateActv`, `AiEvaluationDefinition`, `Bot`, `BotVersion`, and `LightningTypeBundle` provenance and lifecycle.
- CRM Analytics: `WaveApplication`, `WaveDataset`, `WaveXmd`, `WaveDataflow`, `WaveRecipe`, `WaveLens`, and `WaveDashboard`.
- Data 360 foundation: `DataSource`, corrected `DataSourceObject`, `DataSourceBundleDefinition`, `DataStreamDefinition`, `MktDataTranObject`, `DataSrcDataModelFieldMap`, and `MktCalcInsightObjectDef`.
- Tableau Next: `AnalyticsWorkspace`, `AnalyticsDatasetDefinition`, `AnalyticsVisualization`, and `AnalyticsDashboard`.
- External Tableau workbooks, datasources, extracts, projects, permissions, and Prep flows remain provider artifacts.

Critical sequences:

```text
Agentforce dependencies
  -> authoring publish
  -> exact version activation
  -> evaluation definition
  -> evaluation execution

Data 360 source metadata
  -> connector completion
  -> stream readiness and ingestion
  -> insight execution
  -> segment or activation lifecycle

CRMA dataset
  -> XMD and transforms
  -> transform execution
  -> lens and dashboard
  -> application and sharing
```

### C3 Commerce, marketing, and revenue

Initial Metadata API inventory includes:

- Settings: `CommerceSettings`, `ProductDiscoverySettings`, `IncludeEstTaxInQuoteCPQSettings`, `BillingSettings`, `LargeQuotesandOrdersForRlmSettings`, `PaymentsSettings`, `ProductCatalogManagementSettings`, `ProductConfiguratorSettings`, `RevenueManagementSettings`, and `SubscriptionManagementSettings`.
- Definitions: `PaymentGatewayProvider`, `GatewayProviderPaymentMethodType`, `PricingActionParameters`, `PricingRecipe`, `LoyaltyProgramSetup`, `BenefitAction`, `ReferralMarketingConfig`, `MarketingAppExtension`, and `MarketingAppExtActivity`.

Settings require a separate deploy and readiness barrier before dependent definitions. CPQ and Billing `SBQQ__*` or `blng__*` records remain managed-package data. SFMC and SFCC require independent provider lifecycles.

### C4 Integration and Industries platform

Native OmniStudio API 67 types:

- `OmniDataTransform`
- `OmniIntegrationProcedure`
- `OmniScript`
- `OmniUiCard`

The planner must classify native metadata, managed DataPacks, and generated components before scanning. Directory spelling is not authoritative. A logical component cannot belong to both native and managed deployment channels.

Critical sequence:

```text
core prerequisites
  -> data transforms
  -> nested integration procedures
  -> callers, scripts, and cards by parsed references
  -> selected version activation
  -> generated-LWC readiness
  -> page or site consumers
  -> community publish
```

### C5 Regulated and social sectors

The first implementable native families are:

- Assessments: `AssessmentQuestion`, `AssessmentQuestionSet`, and `AssessmentConfiguration`.
- Action Plans: `ActionPlanTemplate` as one composite node.
- Health scoring: `ScoreCategory` with owned children and optional Data 360 mappings.
- Nonprofit: `FundraisingConfig` and `GiftEntryGridTemplate`.
- Care configuration: `CareBenefitVerifySettings`, `CareLimitType`, `CareProviderAfflRoleConfig`, `CareProviderSearchConfig`, `CareRequestConfiguration`, and `CareSystemFieldMapping`.

Managed-package configuration records and regulated operational records must not become metadata wave nodes. Types without exact retrieved source contracts remain catalog-only.

### C6 Industrial, asset, and location

Primary settings candidates:

- `RetailExecutionSettings`
- `IndustriesManufacturingSettings`
- `IndustriesAutomotiveSettings`
- `IndustriesEnergyUtilitiesMultiSiteSettings`
- `MapsAndLocationSettings`

Definition families include Manufacturing forecast metadata and Net Zero units, conversions, fuel mappings, and source configurations. `RetailExecutionSettings` is the first CGCloud implementation slice. Modeler configuration, Mobile Sync records, Maps alignments, operational records, and external geospatial assets remain separate channels.

Settings deploy success is not product readiness. Manufacturing, Net Zero, Maps, and Retail Execution need explicit recalculation, privacy, mobile, or provider verification barriers.

### C7 Communications and media

Native API 67 settings candidates:

- `CommsServiceConsoleSettings`
- `TmfOutboundNotificationSettings`
- `MediaAdSalesSettings`
- `MediaAgentSettings`

Managed EPC, decomposition, and Media CPQ configuration requires exact package-qualified DataPack identities. Digital Commerce cache, TMF bindings, Mule deployments, and ad-server state are provider operations with durable resume and compensation semantics.

## Dependency contract

Component edges retain hard, soft, or inferred strength. Execution planning additionally needs relationship and barrier semantics:

```text
references
contains
generated-from
settings-prerequisite
target-org-prerequisite
package-prerequisite
activation
publication
execution
postcondition
manual-approval
```

Licenses, credentials, provider jobs, readiness checks, and human approvals are not Salesforce metadata nodes.

## Delivery order

1. Make capability channel and vendor identity authoritative for deployment admission.
2. Replace executable unknown fallback with fail-closed planning.
3. Add explicit wave constraints, isolation, barriers, and graph-aware validation/merging.
4. Unify metadata waves and provider lifecycle phases in one persisted deployment plan.
5. Complete C1 aliases, object-child projection, Flow edges, OWD barrier, and CRM rules.
6. Correct Agentforce composites/provenance and add Data 360 foundation nodes.
7. Add a registry-driven settings scanner beginning with `RetailExecutionSettings` and other primary product settings.
8. Add native OmniStudio classification and dependency parsing before any managed DataPack expansion.
9. Implement CRMA, Tableau Next, assessments, Action Plans, Net Zero, Manufacturing, and C7 settings in focused families.
10. Add managed-package and provider adapters only after exact artifact identity, idempotency, resume, verification, and rollback contracts exist.

## Evidence gates

- Documentation and API coverage prove candidate identity, not runtime support.
- Scanner and parser fixtures prove deterministic local behavior, not target availability.
- Lifecycle support remains partial until a licensed disposable or explicitly approved non-customer org proves retrieve, deploy, readiness, behavior, and restoration.
- Provider support remains partial until operation IDs, polling, idempotent resume, verification, redaction, and compensation are tested.
