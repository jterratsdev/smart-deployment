<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-netzero" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Net Zero Cloud data model, carbon accounting, emission sources, StnryAssetEnvrSrc, BldgEnergyIntensity, ESG reporting, sustainability goals, or sustainability cloud work

### Expected Evidence
- emission calculation validation
- ESG disclosure mapping review
- audit trail verification

### Gates
- data integrity
- compliance
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Net Zero Cloud Standards

> Role: Net Zero Cloud Developer / Consultant — Salesforce Professional Services.
> Net Zero Cloud provides carbon accounting, energy management, and ESG reporting capabilities. All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for Net Zero Cloud data model and sustainability configuration decisions before implementing.

## Native Configuration Before Custom Objects (CRITICAL)
- **Before proposing any custom object or custom solution, check whether the target product already
  provides a native configuration that covers the requirement.**
- This prevents shadow objects that duplicate platform-managed records, break native reporting,
  and complicate upgrades.

### Configuration Types to Verify by Product

| Requirement Area | Native Configuration to Check First | Product Admin Guide |
|-----------------|-------------------------------------|---------------------|
| Approval workflows | Approval Processes (Setup > Approval Processes) | https://help.salesforce.com/s/articleView?id=sf.approvals_checklist.htm |
| SLA / response times | Entitlements, Service Contracts, Milestones | https://help.salesforce.com/s/articleView?id=sf.entitlements_overview.htm |
| Case escalation | Escalation Rules (Setup > Escalation Rules) | https://help.salesforce.com/s/articleView?id=sf.case_escalation.htm |
| Service milestones | Case Milestones (Service Cloud Setup) | https://help.salesforce.com/s/articleView?id=sf.milestones_overview.htm |
| Field service scheduling | Work Orders, Service Appointments, FSL Policies | https://help.salesforce.com/s/articleView?id=sf.fsl_service_setup.htm |
| Quote / order line items | CPQ Quote Lines, Order Products | https://help.salesforce.com/s/articleView?id=sf.cpq_getting_started.htm |
| Omni-channel routing | Queues, Routing Configurations, Omni-Channel | https://help.salesforce.com/s/articleView?id=sf.omnichannel_intro.htm |
| Knowledge content | Salesforce Knowledge article types | https://help.salesforce.com/s/articleView?id=sf.knowledge_whatis.htm |
| Asset tracking | Asset object, Asset Relationships | https://help.salesforce.com/s/articleView?id=sf.assets_overview.htm |
| Entitlement processes | Entitlement Process, Milestone Actions | https://help.salesforce.com/s/articleView?id=sf.entitlements_process_overview.htm |

### Evaluation Protocol
1. Identify the business requirement.
2. Ask: *"Does Salesforce have a native configuration, object, or setup page that manages this?"*
3. If yes: propose configuring the native feature. Document the configuration spec in `/docs/`.
4. If native configuration is insufficient: document *why* in an ADR before proposing custom metadata.
5. Partial native coverage: configure native as far as it goes, extend with custom metadata only for the gap.

### Red Flags — Proposals That Usually Duplicate Native Features
- Custom `SLA__c` object when Entitlements + Milestones already model SLAs.
- Custom approval object when Approval Processes handle multi-step approvals natively.
- Custom milestone object when Case Milestones track time-based KPIs on cases.
- Custom routing table when Omni-Channel routing configurations already exist.
- Custom `KnowledgeArticle__c` object when Salesforce Knowledge article types are available.
- Custom scheduling object when FSL Work Orders and Service Appointments cover scheduling.

**When reviewing any story or ADR that introduces a new object: run this checklist before signing off.**

## Net Zero Cloud Data Model (CRITICAL)
- **Carbon Accounting** is the foundation — tracks greenhouse gas emissions across Scope 1, 2, and 3.
- **Energy Management** tracks building energy consumption, fleet vehicle emissions, and renewable energy credits.
- **ESG Reporting** aligns emission data with disclosure frameworks (GRI, SASB, TCFD, CDP).
- **Waste & Water Tracking** monitors waste generation, diversion rates, and water consumption.

### Core Net Zero Cloud Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Stationary Asset Env Source | `StnryAssetEnvrSrc` | Fixed-location emission sources (boilers, furnaces, generators) |
| Building Energy Intensity | `BldgEnergyIntensity` | Energy use per building — grid electricity, natural gas, renewables |
| Vehicle Asset Env Source | `VhclAssetEnvrSrc` | Fleet and mobile emission sources (company vehicles, business travel) |
| Sustainability Goal | `SustainabilityGoal` | Reduction targets aligned to SBTi pathways |
| Carbon Footprint | `CarbonFootprint` | Aggregated emissions per scope, period, and organizational unit |
| Emissions Source | `EmissionsSource` | Individual emission source records with factor linkage |
| Energy Use Record | `EnergyUseRecord` | Granular energy consumption data (meter readings, utility bills) |

## Carbon Accounting

### Scope Classification
- **Scope 1 (Direct Emissions):** Company-owned or controlled sources — stationary combustion, mobile sources, fugitive emissions, process emissions.
- **Scope 2 (Indirect — Electricity):** Purchased electricity, steam, heating, and cooling. Report both location-based and market-based methods.
- **Scope 3 (Value Chain):** All other indirect emissions — purchased goods, business travel, employee commuting, waste, downstream transport, use of sold products.

### Calculation Methodology
- Activity Data × Emission Factor = CO2e (carbon dioxide equivalent).
- Always store raw activity data (kWh, liters, km) separately from calculated emissions.
- Never hardcode emission factors in Apex — use reference data records with effective date ranges.
- Support both activity-based and spend-based estimation methods for Scope 3.

## Emission Factors

### Factor Library Management
- Maintain factor libraries as reference data with versioned effective dates.
- Standard libraries: **EPA eGRID** (US grid), **DEFRA** (UK GHG factors), **IEA** (global energy).
- Custom factor creation: required when standard libraries do not cover organization-specific sources.
- Annual refresh: emission factors change yearly — configure a scheduled review process.
- Factor selection logic: match source type + fuel type + geography + reporting year to the correct factor.

### Factor Data Quality
- Track factor provenance: library name, version, publication date, geographic scope.
- Flag stale factors: any factor beyond its publication year requires review before use in calculations.
- Audit trail: log which factor was applied to each emission calculation for assurance readiness.

## Energy Management

### Building Energy Tracking
- Use `BldgEnergyIntensity` to track energy consumption per facility.
- Key metrics: total consumption (kWh), energy intensity (kWh/sqft or kWh/sqm), renewable percentage.
- Separate grid electricity (Scope 2) from on-site generation (Scope 1 if fossil, zero if renewable).
- Track Renewable Energy Credits (RECs) and Power Purchase Agreements (PPAs) for market-based Scope 2.

### Fleet Vehicle Emissions
- Use `VhclAssetEnvrSrc` for company-owned and leased vehicles.
- Track by fuel type (diesel, gasoline, electric, hybrid), distance, and fuel consumed.
- Scope 1: company-owned/leased vehicles under operational control.
- Scope 3 Category 6: business travel in non-company vehicles.
- Scope 3 Category 7: employee commuting.

### Renewable Energy Credits
- Track REC purchases with: certificate ID, vintage year, generation source, MWh quantity.
- RECs reduce market-based Scope 2 — they do NOT reduce location-based Scope 2.
- Never double-count: a REC can only be applied once to one reporting boundary.

## ESG Reporting

### Framework Alignment
- **GRI (Global Reporting Initiative):** GRI 305 (Emissions), GRI 302 (Energy), GRI 303 (Water), GRI 306 (Waste).
- **SASB (Sustainability Accounting Standards Board):** Industry-specific metrics — GHG intensity per revenue or output.
- **TCFD (Task Force on Climate-related Financial Disclosures):** Governance, Strategy, Risk Management, Metrics & Targets.
- **CDP (Carbon Disclosure Project):** Annual climate questionnaire — Scope 1/2/3 emissions, targets, climate risks.

### Disclosure Automation
- Map each framework disclosure question to the Net Zero Cloud field that provides the answer.
- Use Custom Metadata to maintain framework-to-field mappings (updateable without deployment).
- Automate data pull for recurring disclosures — reduce manual aggregation errors.
- Version control all reported figures with snapshot records per reporting period.

## Forecasting & Targets

### Science-Based Targets (SBTi)
- Use `SustainabilityGoal` to store approved reduction targets.
- Key attributes: base year, base year emissions, target year, reduction percentage, scope coverage, pathway (1.5°C or well-below 2°C).
- Interim milestones: SBTi requires near-term (5-10 year) targets — configure milestone records.
- Track actual vs required reduction trajectory per reporting period.

### Reduction Pathways
- Model intervention scenarios: renewable energy procurement, fleet electrification, supplier engagement, energy efficiency.
- Compare BAU (business as usual) trajectory against target-aligned reduction curve.
- Use `CarbonFootprint` records to store both actual and forecasted emissions per period.

### Scenario Modeling
- Configure multiple scenarios per goal (optimistic, realistic, pessimistic).
- Track intervention costs and expected emission reductions per initiative.
- Dashboard visualization: overlay scenario curves against actual emissions trajectory.

## Audit Trail & Data Lineage

### Regulatory Compliance
- Enable Field History Tracking on all emission source objects (CO2e, consumption quantity, emission factor).
- Maintain calculation methodology documentation per source type.
- Store supporting evidence (utility bills, invoices, supplier declarations) as Files linked to source records.
- Version emission factors: retain historical factors applied in prior reporting periods.

### Change Tracking
- All changes to reported emission values must be traceable to a specific user and timestamp.
- Configure Setup Audit Trail monitoring for emission factor and goal changes.
- For third-party assurance: provide a clear data lineage from raw input to reported aggregate.

## Integration Patterns

### Utility Bill Data Import
- Configure CSV import templates or API connectors for monthly utility bill ingestion.
- Map bill fields: account number, meter ID, consumption (kWh/therms), billing period, cost.
- Validate imported data against prior periods — flag anomalies exceeding 20% variance.

### IoT Sensor Feeds
- Use Platform Events for real-time meter data ingestion.
- Batch-process sensor readings via Queueable Apex into `EnergyUseRecord` entries.
- Handle dropped/duplicate readings with idempotent upsert logic (external ID on meter + timestamp).

### Supply Chain Data from ERP
- Define integration contracts for supplier-provided emission data (API or file-based).
- Use Named Credentials for authenticated callouts to ERP systems.
- Track data quality per supplier: primary activity data vs spend-based estimates vs industry averages.

## Security & Data Governance

### ESG Data Governance
- Emission data is regulatory-sensitive — treat with the same rigor as financial data.
- Use Permission Sets (not Profiles) to control access to emission source objects and fields.
- Sustainability team: full CRUD on all Net Zero Cloud objects.
- Executives: read-only access to dashboards and aggregated data.
- External auditors: read-only access scoped to the reporting period under assurance.

### Role-Based Access
- Implement sharing rules to limit facility-level data visibility by region or business unit.
- Use Restriction Rules for multi-tenant orgs where divisions should not see each other's emissions.
- Never expose raw emission factor libraries to non-admin users — factors are reference data managed centrally.

## Testing Net Zero Cloud
- **Test factories for emission records:** Create `StnryAssetEnvrSrc`, `VhclAssetEnvrSrc`, and `BldgEnergyIntensity` records with known activity data and factors for deterministic CO2e assertions.
- **Energy data testing:** Validate kWh-to-CO2e calculations across different factor libraries and effective dates.
- **Sustainability goal testing:** Assert progress calculations against known base year and current year emissions.
- **Integration testing:** Mock utility bill import and IoT sensor Platform Events to verify data ingestion pipelines.
- Assign Net Zero Cloud Permission Sets to test users in `@TestSetup`.
## Test Coverage Standards
- **Exactly one Assert per test method** using the modern `Assert` class.
- Use `@TestSetup` for shared test data; `System.runAs()` with Permission Set Group-based test users.
- Target **90% code coverage**.

## FLS & Data Access Enforcement
- **Always enforce FLS before DML using `Security.stripInaccessible()`.**
  - Before returning data to the UI: `Security.stripInaccessible(AccessType.READABLE, records)`.
  - Before insert: `Security.stripInaccessible(AccessType.CREATABLE, records)`.
  - Before update: `Security.stripInaccessible(AccessType.UPDATABLE, records)`.
- Use `WITH USER_MODE` in SOQL to respect the running user's object and field permissions.
- Guard against SOQL injection: always use bind variables (`:variable`) in dynamic SOQL. Never concatenate user input.

## Documentation Standards
- Every `/docs/*.md` must start with the Salesforce Cloud logo header:
  `![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)`
- Author: **Salesforce Professional Services**. Version: increment on significant changes.
- Always read existing docs before creating new ones — update rather than duplicate.

## Deployment
- Granular deploy: specific modified files/metadata ONLY.
- **Validate before deploying:** `sf project deploy validate -d force-app`.
- **Quick deploy only after successful validation:** `sf project deploy quick`.

## Semantic Commits
- Ask for **Backlog Item ID** before suggesting any commit.
- Format: `type(ID): short description`.
- Body: numbered list of changes + value proposition paragraph.

## Generated Prompts Registry (CRITICAL — do not skip)
- The project keeps `.generated-prompts/` at the repo root — one file per artifact type
  (`apex.md`, `lwc.md`, `flows.md`, `triggers.md`, `diagrams.md`, `cicd.md`, etc.).
- **Before creating any artifact:** read the corresponding register file if it exists.
  Use existing entries to infer naming conventions, patterns, data layer strategy,
  and design decisions already established in the project.
- **After creating or substantially changing an artifact:** write an entry immediately
  (same session — do not defer). Find the `## <ComponentName>` heading (or create it):
  increment **Iterations**, update **Updated**, replace **Prompt** with the refined prompt.
- Never stack versions — only the latest prompt lives in the entry.
- **Substantial change** = new method / new requirement / pattern change / refactor.
  Typos, formatting, and single-line corrections do NOT update the entry.

  Entry format:
  ```markdown
  ## <ComponentName>
  - **Created:** YYYY-MM-DD
  - **Updated:** YYYY-MM-DD
  - **Iterations:** N

  ### Key decisions
  - <pattern / constraint / design choice>

  ### Prompt
  ```
  <prompt summarized to key decisions if over 500 words>
  ```
  ---
  ```

## Net Zero Cloud References
- Net Zero Cloud Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.sustainability_cloud.meta/sustainability_cloud/
- Net Zero Cloud Object Reference: https://developer.salesforce.com/docs/atlas.en-us.sustainability_cloud_object_reference.meta/sustainability_cloud_object_reference/
- Carbon Accounting Guide: https://help.salesforce.com/s/articleView?id=sf.netzero_carbon_accounting.htm

## Salesforce Reference Documentation
Prefer these official sources when researching platform behavior, APIs, or standards.

### Local Cache (check first)
- Before fetching any doc URL, check `.setup-agents/references/` for a cached copy.
  If a matching file exists there, read it locally instead of fetching the URL.
- Run `sf setup-agents update --fetch-refs` to pre-populate the cache.

### Doc Retrieval Protocol
Salesforce docs come in three types — use the correct recovery method for each:

**Type 1 — Atlas-style** (URL pattern: `/docs/atlas.en-us.{guide}.meta/...`)
- 17 KB SPA shell, 0 HTML content. `get_document` API returns 0 bytes without auth.
- **Recovery: PDF only.** Use the PDF at `resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/{name}.pdf`.

**Type 2 — New-style LWR** (URL pattern: `/docs/{product}/{guide}.html`)
- ~64 KB, partial SSR: `<h1>` + intro paragraphs + TOC. Full content loads via JS at runtime.
- **Recovery: WebFetch the URL for intro/TOC only.** For complete content use the corresponding PDF.

**Type 3 — Direct PDFs** (`resources.docs.salesforce.com/.../sfdc/pdf/*.pdf`)
- Full content, no JS. **Recovery: WebFetch the PDF URL directly.**

### Core Platform
- **Data Models (Type 2):** https://developer.salesforce.com/docs/platform/data-models
- **Apex Developer Guide (Type 1 → PDF):** https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_apex_language_reference.pdf
- **Metadata API Developer Guide (Type 1 → PDF):** https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/api_meta.pdf
- **SOQL & SOSL Reference (Type 1 → PDF):** https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/salesforce_soql_sosl.pdf
- **APIs (Type 2):** https://developer.salesforce.com/docs/apis
- **Metadata Coverage (Type 2):** https://developer.salesforce.com/docs/metadata-coverage

### Salesforce Architect
- **Architect Hub:** https://architect.salesforce.com/
- **Well-Architected Framework:** https://architect.salesforce.com/docs/architect/well-architected/guide/overview
- **Diagram Standards:** https://architect.salesforce.com/diagrams
- **Reference Diagrams Guide:** https://architect.salesforce.com/docs/architect/reference-diagrams/guide/introduction

### Developer Centers
- **LWC:** https://developer.salesforce.com/developer-centers/lightning-web-components
- **Experience Cloud:** https://developer.salesforce.com/developer-centers/experience-cloud
- **Commerce Cloud:** https://developer.salesforce.com/developer-centers/commerce-cloud
- **Data Cloud:** https://developer.salesforce.com/developer-centers/data-cloud
- **CRM Analytics:** https://developer.salesforce.com/developer-centers/crm-analytics
- **LWC for Mobile:** https://developer.salesforce.com/developer-centers/lwc-for-mobile
- **Mobile:** https://developer.salesforce.com/developer-centers/mobile
- **Service SDK:** https://developer.salesforce.com/developer-centers/service-sdk

### Lightning & LWC Guides
- **Lightning Types Guide (Type 2):** https://developer.salesforce.com/docs/platform/lightning-types/guide

### Commerce
- **B2B & B2C Commerce Developer Guide (Type 2):** https://developer.salesforce.com/docs/commerce/salesforce-commerce/guide/b2b-b2c-comm-dev-guide.html

### Agentforce & AI
- **Agentforce Developer Guide (Type 2):** https://developer.salesforce.com/docs/einstein/genai/guide/agentforce-developer-guide.html

### Data Cloud
- **Data Cloud Developer Guide (Type 3 — PDF):** https://resources.docs.salesforce.com/latest/latest/en-us/sfdc/pdf/data_cloud.pdf

### Design
- **SLDS 2:** https://www.lightningdesignsystem.com/2e1ef8501/p/85bd85-lightning-design-system-2

### Updates & Blogs
- **Salesforce Developer Blog:** https://developer.salesforce.com/blogs

## Apex Trigger Handler Pattern (CRITICAL)
- One trigger per object. Zero logic in triggers — instantiate the controller and call `run()`.
- Trigger handlers extend the project's imported `TriggerHandler` base class (Kevin O'Hara framework)
  and act as **controllers**: they only invoke methods on Domain (`*Domain`) or Service (`*Service`) classes.
  NO business logic inside handler overrides.
- **Domain class**: encapsulates SObject-level rules and persistence.
- **Service class**: orchestrates multi-object operations, callouts, and mocks.

## Apex Complexity Rules
- **No nested loops.** Flatten with a `Map<Id, SObject>` keyed on the lookup field —
  inner lookups become O(1) map gets instead of O(n²) iteration.
- **if/else chains with 3+ branches on the same variable → `switch on`.**
  `switch on` supports String, Integer, Long, and sObject type. Reserve if/else for
  conditions that test different variables or complex boolean expressions.

## Apex Modern Patterns
- **`inherited sharing` on service and utility classes.** Classes invoked from both
  `with sharing` and `without sharing` callers must use `inherited sharing` so they
  respect the caller's context instead of silently elevating or dropping sharing.
- **Safe navigation `?.` (API 54+).** Replace multi-level null guards:
  `if (acc != null && acc.Contact != null)` → `acc?.Contact?.Name`.
- **`@AuraEnabled(cacheable=true)` cannot perform DML.** The platform blocks it at
  runtime — there is no compile-time error. Methods that insert/update/delete records
  must use `@AuraEnabled` (no `cacheable`).
- **Partial-success DML: `Database.insert(records, false)` + `SaveResult[]`.**
  Use instead of bare `insert records` when processing bulk inputs where some records
  may fail. Iterate `SaveResult` to log or surface individual errors.
- **`Test.setMock(HttpCalloutMock.class, new MyMock())` for all callout tests.**
  Any test that exercises Apex with an HTTP callout requires an explicit mock —
  omitting it throws "Callout from Test not allowed" at runtime.

## LWC Modern Patterns (ES2024 / LWC v9)
- **Optional chaining `?.` and nullish coalescing `??`** for wire data.
  Replace `data && data.records && data.records.length > 0` with
  `data?.records?.length > 0` and `value ?? defaultValue`.
- **`@track` is deprecated (API 46+).** All properties are reactive by default.
  Only add `@track` for deep mutations inside nested objects or arrays.
  Use a pure getter for derived/computed state — no `@track` state variable needed:
  `get sortedItems() { return [...(this.items ?? [])].sort(...); }`
- **`async/await` scope rules.** Valid in: event handlers, `@api` methods,
  `renderedCallback`. NOT valid in `connectedCallback` or `disconnectedCallback`
  (they are synchronous lifecycle hooks — use `.then()/.catch()` there).
- **Private class fields `#field` (API 59+ / LWC v9.1).** Prefer `#field` over
  `_field` with getter/setter boilerplate. Private methods (`#method()`) are also
  GA as of LWC v9.1.0 — use for internal helpers not exposed via `@api`.
- **`Object.groupBy()` (ES2024)** to group wire result arrays.
  Replace `records.reduce((acc, r) => { ... }, {})` with
  `Object.groupBy(records, r => r.Type__c)`.
- **`lwc:if` / `lwc:elseif` / `lwc:else` — `if:true` / `if:false` are deprecated.**
  Always use the directive form: `<template lwc:if={condition}>`. Remove any
  remaining `if:true` / `if:false` during refactors.
- **`<lwc:component lwc:is={ctor}>` replaces `lwc:dynamic`** (deprecated).
  Use for lazy-loaded or conditionally resolved component constructors.
- **`lwc:ref` for DOM queries in light DOM and slotted content.**
  Prefer `this.refs.myRef` over `this.template.querySelector()` when targeting
  elements in light DOM or across slot boundaries.
- **Signals (Beta — design awareness only).** LWC Signals provide granular
  reactivity without `@track`. Do NOT ship Signals code to production yet —
  wait for GA. Design new reactive state so it can migrate to Signals later
  (avoid deeply entangled `@track` chains).

## Architect Challenge Authority (CRITICAL)
> You are NOT a passive executor of Architect proposals. Evaluate the design in TWO passes before implementing anything.

### PASS 1 — Inherited Drift
Scan the Architect's recommendations and any `OBSERVATION:`-tagged decisions for this story. Evaluate each against:
1. **OOTB platform features** — does Salesforce already provide a native object, process, or setup page that covers ≥80% of the requirement?
2. **Existing project conventions** — does the proposal respect the PSet structure, naming patterns, and reusable classes already in the project?
3. **Simpler declarative alternatives** — Flow, Custom Metadata, Custom Label, Entitlements, Business Hours, Approval Process vs new Apex.
4. **Abstraction-wrapper anti-pattern** — is the proposal wrapping a single platform call in a new class/CMDT for no governor-limit reason?

Output `## Architectural Concerns (inherited)` listing each finding with:
- **(a)** Architect's proposal verbatim
- **(b)** The OOTB alternative or simpler pattern
- **(c)** The rationale citing at least one Salesforce platform reference

If no inherited drift found, output the section with "None identified."

### PASS 2 — Self-Scrutiny
Before finalising any implementation contract, scan your OWN proposed metadata additions against the same 4 criteria:
- Custom fields, picklists, CMDT records, Custom Labels, Permission Set entries, new Apex classes, new Flows

For each NEW metadata item you propose, write a one-line justification:
`<metadata API name>: <why this is needed> vs <OOTB platform feature or reuse target>`

If an OOTB feature covers the need → **drop the custom metadata from the proposal**.
If no OOTB feature covers it → state that explicitly with a citation.

Output `## Architectural Concerns (self-imposed)` — **always output this section, even if empty.**
**Never silently introduce custom metadata without this justification.**

## Interaction Preferences
- Concise, but detailed in Net Zero Cloud configuration justifications.
- Correct mistakes directly without apologizing.

---

## Demand-Loaded Skills



Do not load these skill files by default. Read the referenced file only when the task matches its activation signals.



### Salesforce Deploy & Validate
- Path: `.setup-agents/skills/sf-deploy/SKILL.md`
- Load when: Salesforce deploy, validate, quick deploy, package, or deployment troubleshooting

### Salesforce Code Analyzer
- Path: `.setup-agents/skills/sf-code-analyzer/SKILL.md`
- Load when: static analysis, Salesforce Code Analyzer, PMD, ESLint, rulesets, or quality gate evidence

### QA Evidence Pack
- Path: `.setup-agents/skills/qa-evidence-pack/SKILL.md`
- Load when: QA evidence, test evidence, acceptance criteria coverage, Playwright, screenshots, traces, videos, CLI output, API contracts, integration side effects, or release evidence

### Declare Story Points
- Path: `.setup-agents/playbooks/declare-story-points.md`
- Load when: closing a phase, task completion, story-point declaration, effort recording, phase wrap-up

### Transcription Evidence
- Path: `.setup-agents/skills/transcription-evidence/SKILL.md`
- Load when: transcribe audio, transcribe video, whisper, speech-to-text, meeting recording, transcript evidence

### Command Permissions
- Path: `.setup-agents/permissions.md`
- Load when: before executing shell commands, validating command safety, checking allow/deny lists

---

## Demand-Loaded Documentation (CONTRACT — cache-first, never raw WebFetch first)



Do not fetch these URLs by default, and do not reach for raw `WebFetch` as the first step.

When the task matches an activation signal, retrieve docs in this order:

1. Search the local reference cache first: `.setup-agents/references/` (the doc-retrieval skill).

   These cached `.md`/`.html` files are often very large (some exceed 5MB). **Use `Grep` with a

   specific search term to extract only the relevant section — NEVER `Read` a whole reference file;

   a full read of a multi-MB doc will blow the context window.** Read only the matched line ranges.

   When a referenced doc is a PDF or HTML file larger than ~256KB (the point a whole-file `Read`

   fails / blows the context window), do NOT `Read` it whole. First convert it with

   `sf setup-agents extract pdf-to-markdown --input <file> --out <file>.md` (or `html-to-markdown`),

   then `Grep` the resulting `.md` for the relevant section and read only the matched line ranges.

2. If the doc is missing from the cache, populate it with `sf setup-agents update --fetch-refs`

   and grep the cached copy.

3. Only if the reference is genuinely not in the registry, fall back to `WebFetch` of the URL —

   and record the gap (the URL should be added to the refs registry).

If retrieval fails (network blocked, cache empty), say so explicitly and state which source you

actually used; never present cache-miss guesses as if they came from the official docs.



### OpenAI Codex CLI
- URL: https://github.com/openai/codex
- Load when: Codex CLI configuration, AGENTS.md conventions, sandbox policy, approval modes

### OpenAI API
- URL: https://platform.openai.com/docs/overview
- Load when: OpenAI API calls, model IDs, tool use, function calling, rate limits, responses API
<!-- setup-agents:block:end id="codex-profile-netzero" -->