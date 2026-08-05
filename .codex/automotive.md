<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-automotive" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Automotive Cloud data model, Vehicle lifecycle, VehicleDefinition, Vehicle, DealerPerformance, TestDrive, TradeIn, or automotive managed package work

### Expected Evidence
- vehicle data model validation
- dealer performance review
- DMS integration test result

### Gates
- data integrity
- integration
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Automotive Cloud Standards

> Role: Automotive Cloud Developer / Consultant — Salesforce Professional Services.
> Automotive Cloud is an industry solution on top of core Salesforce. All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for Automotive Cloud data model and configuration decisions before implementing.

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

## Automotive Cloud Data Model (CRITICAL)

### Vehicle Lifecycle
The Automotive Cloud data model tracks vehicles through their complete lifecycle:
```
VehicleDefinition (catalog) → Vehicle (physical unit) → Sale → Service → Trade-In
```

### Core Automotive Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Vehicle Definition | `VehicleDefinition__c` | Product catalog entry: Make, Model, Year, Trim, Engine, MSRP |
| Vehicle | `Vehicle__c` | Physical unit identified by VIN — inventory, ownership, status |
| Vehicle Asset | `VehicleAsset` | Post-sale asset record linking vehicle to owner Account |
| Test Drive | `TestDrive` | Scheduled and completed test drive records |
| Trade-In | `TradeIn` | Trade-in valuation linked to an Opportunity |
| Dealer Performance | `DealerPerformance` | Dealer KPI tracking: units sold, gross profit, CSI |

### Vehicle Definition (Catalog)
- Represents an abstract product definition — NOT a physical vehicle.
- Key fields: Make, Model, Year, Trim, Engine Type, Transmission, MSRP, Segment.
- Use Record Types by segment (Sedan, SUV, Truck, EV) if page layouts differ.
- One VehicleDefinition can have many Vehicle records (one-to-many).

### Vehicle (Physical Unit)
- Each record represents a single physical vehicle identified by a unique VIN.
- Key fields: VIN (17 chars, unique), Vehicle Definition (lookup), Status, Stock Number, Colors, Dealer, List Price.
- **VIN validation:** 17 alphanumeric characters excluding I, O, Q. Compute check digit at position 9.
- Status picklist lifecycle: `In Transit → In Stock → Reserved → Sold → Delivered`.
- Used vehicles re-enter inventory via Trade-In with status reset to "In Stock".

### Test Drive
- Links a Contact (prospect) to a Vehicle for a scheduled test drive.
- Key fields: Contact, Vehicle, Scheduled Date/Time, Status (Scheduled, Completed, Cancelled, No-Show), Notes.
- Use Record-Triggered Flows to create follow-up Tasks after completed test drives.

### Trade-In
- Captures vehicle valuation during a sale negotiation.
- Key fields: Vehicle (the trade-in unit), Opportunity (the new sale), Estimated Value, Appraised Value, Condition.
- On Opportunity close: update trade-in Vehicle status and optionally create a new inventory Vehicle record.

## Dealer Management

### Dealer Account Model
- Dealers are Account records with a dedicated `Dealer` Record Type.
- Key fields: Dealer Code (external ID for DMS integration), Brand Affiliation, Territory, Dealer Tier.
- Multi-rooftop dealers: use Account hierarchy (parent = dealer group, children = locations).

### Performance Tracking
- `DealerPerformance` records track KPIs per dealer per period.
- Metrics: Units Sold (New/Used), Gross Profit, CSI Score, Service Revenue, Parts Revenue.
- Automate tier calculation via Record-Triggered Flow on DealerPerformance insert/update.
- Generate monthly scorecards via Scheduled Flow or Apex Batch.

### Territory Assignment
- Use Enterprise Territory Management (Territory2) for complex, overlapping territory rules.
- For simpler models: custom `Territory__c` object with lookup on dealer Account.
- Sharing rules must align with territory model — dealers see only their territory data.

### Incentive Programs
- Model incentive programs with: Name, Type (Volume/Stair-Step/CSI-Based), Thresholds, Rewards, Eligible Tiers.
- Evaluate eligibility at period end via Scheduled Apex or Flow.
- Surface payouts on dealer Account page via related list.

## Lead Management (Automotive-Specific)

### Lead Scoring
- Extend standard Lead with automotive fields: Vehicle Interest (lookup to VehicleDefinition), Purchase Timeline, Trade-In Intent.
- Score leads based on: engagement recency, test drive completion, trade-in submission, finance pre-approval.
- Use Einstein Lead Scoring or a custom scoring Flow to prioritize dealer follow-up.

### Test Drive Scheduling
- Integrate test drive scheduling into the lead nurture flow.
- On Lead conversion: carry forward test drive history and vehicle interest to the new Opportunity.
- Automate reminder notifications to both prospect and dealer before scheduled test drives.

### Trade-In Valuations
- Allow prospects to submit trade-in details during the lead stage.
- Integrate with third-party valuation APIs (KBB, Black Book) via Named Credentials.
- Store valuations on the Trade-In object linked to the Lead or Opportunity.

## Integration Patterns

### DMS (Dealer Management System) Integration
- Connect to DMS (CDK, Reynolds & Reynolds, Dealertrack) via REST APIs and Named Credentials.
- Sync patterns:
  - **Inventory sync (inbound):** OEM/DMS pushes vehicle data → Platform Events → Apex subscriber creates/updates Vehicle records.
  - **Sale sync (outbound):** On Opportunity close → callout to DMS to register the sale.
  - **Performance sync (inbound):** Nightly batch pulls dealer KPIs from DMS into DealerPerformance records.
- Use Platform Events for real-time inventory updates; Apex Batch for bulk historical sync.

### OEM Inventory Sync
- OEM feeds typically arrive as flat files (CSV/XML) or API payloads.
- Ingest via Salesforce Data Loader (scheduled), MuleSoft, or custom Apex Batch.
- Map OEM vehicle codes to VehicleDefinition records using a Custom Metadata mapping table.
- Upsert Vehicle records by VIN to avoid duplicates.

### Named Credential Best Practices
- One Named Credential per external system (DMS, valuation API, OEM portal).
- Never hardcode API keys or credentials in Apex — always use Named Credentials or Custom Metadata.
- Use External Credentials (API v58+) for OAuth 2.0 client credentials flow.

## Managed Package Safety Rules
- **Do NOT add Apex triggers directly on Automotive Cloud managed objects.**
  Use Record-Triggered Flows or a custom extension object instead.
- **Do NOT delete or rename managed fields.** Extend only — add custom fields with a project prefix.
- **Do NOT override managed page layouts.** Clone them and assign the clone to your Record Type.
- Before each package upgrade, review release notes for breaking changes.
- Test in a sandbox with a full package upgrade before promoting to production.

## Sharing & Security

### Dealer-Level Sharing
- Set OWD for Vehicle to Private or Public Read Only depending on multi-dealer visibility requirements.
- Use Sharing Rules or Apex Managed Sharing to grant dealer-specific access to their inventory.
- Dealer users should only see vehicles assigned to their dealership Account.

### Territory-Based Access
- Align record access with territory assignments.
- Use Territory2 sharing rules or custom sharing rules keyed on the Territory field.
- Regional managers see all dealers in their territory; district managers see their district only.

### OWD Recommendations
| Object | Recommended OWD | Rationale |
|--------|----------------|-----------|
| Vehicle | Private | Dealers see only their inventory |
| VehicleDefinition | Public Read Only | Catalog is shared across all dealers |
| DealerPerformance | Private | Sensitive KPI data per dealer |
| TestDrive | Controlled by Parent (Account) | Inherits from dealer Account sharing |
| TradeIn | Controlled by Parent (Opportunity) | Inherits from Opportunity sharing |

### Permission Sets
- Create dedicated Permission Sets for Automotive Cloud access:
  - `AutomotiveCloud_Base` — read access to Vehicle, VehicleDefinition, TestDrive
  - `AutomotiveCloud_DealerManager` — full CRUD on DealerPerformance, Incentives
  - `AutomotiveCloud_Inventory` — create/edit Vehicle records, manage stock
- Assign via Permission Set Groups per dealer role.

## Testing Automotive Cloud

### Test Data Factory Pattern
- Create a `TestDataFactory` class with methods for generating Automotive test data.
- **VIN generation:** Use a utility method that produces valid 17-character VINs with correct check digit.
  ```apex
  public static String generateVIN() {
      // Generate valid VIN with check digit at position 9
      String base = '1HGCM82633A' + String.valueOf(Math.round(Math.random() * 99999)).leftPad(5, '0');
      return base.left(9) + computeCheckDigit(base) + base.substring(10);
  }
  ```
- **Vehicle Definition factory:** Create catalog entries with Make/Model/Year/Trim.
- **Vehicle factory:** Create inventory records linked to a VehicleDefinition with valid VIN.
- **Dealer factory:** Create dealer Accounts with Dealer Code and Territory assignment.

### Test Patterns
- Use `@TestSetup` for shared vehicle catalog and dealer data.
- Test VIN uniqueness enforcement with duplicate insert assertions.
- Test status transitions: verify Flow/trigger updates Vehicle status on Opportunity stage changes.
- Test sharing: use `System.runAs()` with dealer users to verify record visibility boundaries.
- Mock DMS callouts with `Test.setMock(HttpCalloutMock.class, ...)` for integration tests.
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

## Automotive Cloud References
- Automotive Cloud Get Started Guide: https://developer.salesforce.com/docs/industries/automotive/guide/get-started.html
- Automotive Cloud Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.automotive_cloud.meta/automotive_cloud/
- Automotive Cloud Object Reference: https://developer.salesforce.com/docs/atlas.en-us.automotive_cloud_object_reference.meta/automotive_cloud_object_reference/
- Dealer Management Guide: https://help.salesforce.com/s/articleView?id=sf.auto_dealer_mgmt.htm

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
- Concise, but detailed in Automotive Cloud configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-automotive" -->