<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-nonprofit" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Nonprofit Cloud data model, NPSP objects, donations, recurring donations, GAU allocations, program management, gift entry, npsp__ namespace, or nonprofit managed package work

### Expected Evidence
- donation pipeline validation
- program engagement review
- NPSP package safety check

### Gates
- data integrity
- compliance
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Nonprofit Cloud Standards

> Role: Nonprofit Cloud Developer / Consultant — Salesforce Professional Services.
> Nonprofit Cloud includes legacy NPSP (Nonprofit Success Pack) and the new Nonprofit Cloud (Fundraising, Program Management, Outcome Management). All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for Nonprofit Cloud data model and configuration decisions before implementing.

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

## Nonprofit Cloud Data Model (CRITICAL)

### NPSP Legacy vs New Nonprofit Cloud
- **NPSP (Nonprofit Success Pack):** managed package with `npsp__` and `npe03__` namespaces. Legacy but still widely deployed.
- **New Nonprofit Cloud:** native Salesforce objects (`Program__c`, `ProgramEngagement__c`, `Benefit__c`, `Deliverable__c`) without managed package namespace.
- **Coexistence strategy:** Both can run simultaneously. New implementations should target Nonprofit Cloud objects; existing NPSP orgs should plan a phased migration.
- **Migration path:** NPSP Recurring Donations → Fundraising (native), NPSP Allocations → GAU Allocations (retained), NPSP Households → standard Account model.

### Core Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| General Accounting Unit | `npsp__General_Accounting_Unit__c` | Fund/grant/campaign financial buckets for allocation tracking |
| Allocation | `npsp__Allocation__c` | Links a Donation (Opportunity) to one or more GAUs with amount/percentage |
| Recurring Donation | `npe03__Recurring_Donation__c` | Scheduled giving: donor, amount, frequency, installment schedule |
| Donation | `Opportunity` | Standard Opportunity used as Donation with nonprofit Record Types |
| Program | `Program__c` | Defines a nonprofit program with goals, eligibility, and duration |
| Benefit | `Benefit__c` | A service or resource provided by a program to participants |
| Program Engagement | `ProgramEngagement__c` | Links a Contact to a Program with status, start/end dates |
| Deliverable | `Deliverable__c` | Trackable unit of service delivery within a Program Engagement |

### Deprecated/Replaced Objects (NPSP → Nonprofit Cloud)
- `npo02__Household__c` → Use standard Account with Household Record Type
- `npsp__Level__c` → Use Engagement Levels or custom picklist on Contact
- NPSP batch donation entry → Gift Entry Manager
- NPSP Customizable Rollups → Nonprofit Cloud rollup framework or DLRS for complex cases

## Fundraising

### Donation Tracking
- Use `Opportunity` with nonprofit Record Types (Donation, Grant, In-Kind Gift, Membership).
- Key fields: `Amount`, `CloseDate`, `StageName`, `npsp__Primary_Contact__c` (or standard `ContactId`).
- **Soft Credits:** Use `OpportunityContactRole` with role = "Soft Credit" for recognition without primary donor change.
- **Matching Gifts:** Track via `npsp__Matching_Gift__c` lookup or a custom junction when matching corporate programs.

### Recurring Donations
- `npe03__Recurring_Donation__c` defines the schedule; child `Opportunity` records are installments.
- Key fields: `npe03__Amount__c`, `npe03__Installment_Period__c` (Monthly, Quarterly, Yearly), `npe03__Date_Established__c`.
- Enhanced Recurring Donations (ERD): enables pause, schedule changes, and installment mapping.
- **Never create Opportunities manually for a Recurring Donation** — let the NPSP engine generate installments.

### GAU Allocations
- `npsp__Allocation__c` splits a donation across multiple `npsp__General_Accounting_Unit__c` records.
- Allocation can be by amount (`npsp__Amount__c`) or percentage (`npsp__Percent__c`).
- A default GAU can be set to capture unallocated portions automatically.
- Rollup fields on GAU track total allocated across all donations.

## Program Management

### Program Definition
- `Program__c` represents a discrete program with fields for description, status, start/end dates, and target population.
- Link programs to funding sources via custom lookup or junction to Opportunity/Campaign.

### Engagements
- `ProgramEngagement__c` tracks a constituent participating in a program.
- Key fields: `Contact__c`, `Program__c`, `Stage__c` (Applied, Active, Completed, Withdrawn), `StartDate__c`, `EndDate__c`.
- Use Record-Triggered Flows to automate stage transitions and notifications.

### Deliverables
- `Deliverable__c` records individual service units (sessions, meals, hours) within an engagement.
- Track quantity, date, provider, and completion status.
- Roll up deliverable counts/hours to the Program Engagement for outcome reporting.

### Outcome Management
- Define measurable outcomes at the Program level (e.g., "employment rate at 6 months").
- Track outcome data via custom fields on `ProgramEngagement__c` or a dedicated `Outcome__c` object.
- Use CRM Analytics or Reports & Dashboards for outcome visualization.

## Gift Entry

### Gift Entry Manager
- Native Salesforce feature replacing NPSP Batch Gift Entry.
- Configure Gift Entry Templates in Setup → Nonprofit → Gift Entry.
- Templates define which fields are visible, required, and defaulted during data entry.
- Supports batch processing: import CSV or manual entry of multiple gifts in a single session.

### Payment Integration
- Integrate payment processors (Stripe, PayPal, Authorize.net) via Named Credentials and Apex callouts.
- **Never store full credit card numbers in Salesforce** — use tokenized references only.
- Map payment processor webhooks to Platform Events for real-time donation confirmation.
- Use `npe01__Payment__c` (NPSP) or standard Payment object for tracking payment status.

## Constituent Management

### Households
- Use standard Account with Household Record Type (not the deprecated `npo02__Household__c`).
- Link household members via Account Contact Relationship or `npe4__Relationship__c`.
- Set primary Contact for the household for greeting and communication defaults.

### Relationships & Affiliations
- `npe4__Relationship__c`: Contact-to-Contact relationships (spouse, sibling, employer/employee).
- `npe5__Affiliation__c`: Contact-to-Organization affiliations (board member, volunteer, employee).
- Both support reciprocal relationship types — define both directions.

### Engagement Plans
- `npsp__Engagement_Plan__c` templates define a series of tasks/activities for donor cultivation.
- Assign plans to Contacts, Opportunities, or Campaigns to automate stewardship sequences.
- Tasks created from plans inherit due dates relative to plan activation date.

## Integration Patterns

### Payment Processors
- **Stripe:** Use Stripe Connect with Named Credential. Map `charge.succeeded` webhook to Platform Event.
- **PayPal:** Use PayPal REST API via Named Credential. Map IPN notifications to inbound webhook handler.
- Reconcile processor transactions against `Opportunity`/`Payment` records via scheduled batch Apex.

### Wealth Screening
- Integrate DonorSearch, WealthEngine, or iWave via REST API callouts.
- Store screening results on Contact custom fields (e.g., `Wealth_Rating__c`, `Giving_Capacity__c`).
- Schedule periodic re-screening via Batch Apex or Schedulable.

### Marketing Platforms
- Sync donor/constituent data to Mailchimp, Constant Contact, or Marketing Cloud.
- Use middleware (MuleSoft, Zapier) or direct API integration via Named Credentials.
- Map campaign membership and engagement metrics back to Salesforce Campaign Members.

## Managed Package Safety (CRITICAL)
- **`npsp__` namespace:** NPSP managed package objects and fields. Do NOT modify, rename, or delete.
- **`npe__` / `npe01__` – `npe05__` namespaces:** NPSP extension packages (Payments, Relationships, Affiliations, Recurring Donations, Households).
- **Do NOT add Apex triggers directly on NPSP managed objects** — use Record-Triggered Flows or custom extension objects.
- **Do NOT override NPSP managed page layouts** — clone and assign to custom Record Types.
- Before NPSP package upgrades: run `sf package version list` and review release notes for breaking changes.
- Test package upgrades in a sandbox before promoting to production.

## Security

### Donor Data Privacy
- Donor financial information (giving history, wealth screening) is sensitive — restrict via FLS and Permission Sets.
- Use Sharing Rules or Criteria-Based Sharing for chapter/affiliate models where regional staff see only their constituents.
- Enable **Data Classification** on fields containing PII (name, email, phone, address, giving history).

### PCI Considerations
- **Never store raw credit card numbers, CVV, or full bank account numbers in Salesforce.**
- Use tokenized payment references from the processor (Stripe token, PayPal billing agreement ID).
- If storing last-4 digits for display: use a text field with encryption at rest enabled.
- Payment processing pages should use processor-hosted forms (Stripe Elements, PayPal buttons) — not custom LWC forms that handle raw card data.

### Chapter/Affiliate Sharing Model
- Use Territory Management or custom sharing rules for multi-chapter organizations.
- Each chapter sees only their assigned Accounts/Contacts via OWD = Private + Sharing Rules by role or territory.
- National office users get "View All" via Permission Set for cross-chapter reporting.
- Audit sharing access quarterly — chapters merge, split, and change scope frequently.

## Testing

### Test Factories
- Create a `NonprofitTestDataFactory` class with methods for:
  - `createDonation(Contact donor, Decimal amount)` → Opportunity with Donation Record Type
  - `createRecurringDonation(Contact donor, Decimal amount, String frequency)` → `npe03__Recurring_Donation__c`
  - `createProgramEngagement(Contact participant, Program__c program)` → `ProgramEngagement__c`
  - `createGAUAllocation(Opportunity donation, npsp__General_Accounting_Unit__c gau, Decimal amount)` → `npsp__Allocation__c`
- Use `@TestSetup` for shared test data. Assign NPSP Permission Sets to test users.
- NPSP triggers fire in test context — always query rollup fields after DML in the same transaction.
- Mock payment processor callouts using `Test.setMock(HttpCalloutMock.class, ...)` pattern.
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

## Nonprofit Cloud References
- Nonprofit Cloud Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.nonprofit_cloud.meta/nonprofit_cloud/
- NPSP Documentation: https://developer.salesforce.com/docs/atlas.en-us.npsp.meta/npsp/
- Program Management Module: https://help.salesforce.com/s/articleView?id=sf.npc_program_management.htm

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
- Concise, but detailed in Nonprofit Cloud configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-nonprofit" -->