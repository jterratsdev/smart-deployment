<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-fsc" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Financial Services Cloud data model, FinServ objects, ARC, household, rollup, referral, or FSC managed package work

### Expected Evidence
- FSC object validation
- rollup result
- ARC or referral flow review

### Gates
- data integrity
- compliance
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Financial Services Cloud (FSC) Standards

> Role: FSC Developer / Consultant — Salesforce Professional Services.
> FSC is a managed package on top of core Salesforce. All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for FSC data model and configuration decisions before implementing.

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

## FSC Data Model (CRITICAL)
- **PersonAccount for individuals.** Enable PersonAccount in Setup → Account Settings.
  Use a dedicated Record Type (e.g., `Individual_Client`) — never share a Record Type between PersonAccount and Business Account.
- **Household Account** uses Record Type `IndustriesHousehold`. Link members via `FinServ__ContactContactRelation__c`.
  Set `FinServ__PrimaryGroup__c` on Contact → Household Account. One Contact may belong to multiple groups but only one primary.
- **Never create a custom "household" object.** The FSC household model is the system of record for group relationships.

### Core FSC Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Financial Account | `FinServ__FinancialAccount__c` | Client financial products (bank, investment, insurance, loan) |
| Financial Account Role | `FinServ__FinancialAccountRole__c` | Ownership roles: Primary Owner, Joint Owner, Beneficiary, PoA |
| Financial Account Transaction | `FinServ__FinancialAccountTransaction__c` | Transaction history linked to a Financial Account |
| Assets & Liabilities | `FinServ__AssetsAndLiabilities__c` | Non-product assets/liabilities for net worth calculation |
| Financial Goal | `FinServ__FinancialGoal__c` | Client goals: Retirement, Education, Emergency Fund |
| Referral | `FinServ__Referral__c` | Internal/external referral tracking with lifecycle stages |
| Contact Contact Relation | `FinServ__ContactContactRelation__c` | Reciprocal role relationships between Contacts |
| Lead (FSC extension) | `Lead` with FSC fields | Use standard Lead + FSC fields; do NOT create a custom lead object |

### Financial Account Record Types
- `BankAccount` — Checking / Savings
- `InvestmentAccount` — Brokerage / Portfolio
- `InsurancePolicy` — Life, Auto, Property
- `CreditFacility` — Mortgage, Loan, Line of Credit
- Match business product types to these Record Types before proposing custom objects.

## Managed Package Safety Rules
- **Do NOT add Apex triggers directly on FSC managed objects** (`FinServ__FinancialAccount__c`, `FinServ__Referral__c`, etc.).
  Use Record-Triggered Flows or a custom junction/extension object instead.
- **Do NOT delete or rename FSC managed fields.** Extend only — add custom fields with a project prefix.
- **Do NOT override FSC managed page layouts.** Clone them and assign the clone to your Record Type.
- Before each package upgrade, run `sf package version list --package <FSC_PACKAGE_ID>` and review the release notes for breaking changes.
- Test in a sandbox with a full package upgrade before promoting to production.

## Rollup Framework (FinServ__RollupByLookupConfig__mdt)
- FSC provides a rollup framework via Custom Metadata Type `FinServ__RollupByLookupConfig__mdt`.
  Use it for aggregating Financial Account values (balance, count) to Household or Contact.
- **Never build custom Apex rollup triggers on FSC objects** — they conflict with the managed rollup engine.
- Configuration fields:
  - `FinServ__SourceObject__c` — object being summarized (e.g., `FinServ__FinancialAccount__c`)
  - `FinServ__SourceField__c` — numeric field to aggregate (e.g., `FinServ__Balance__c`)
  - `FinServ__TargetObject__c` — parent object receiving the rollup (e.g., `Account`)
  - `FinServ__TargetField__c` — field on the parent receiving the result
  - `FinServ__LookupField__c` — relationship field (e.g., `FinServ__PrimaryGroup__c`)
  - `FinServ__Operation__c` — SUM, COUNT, MIN, MAX, AVERAGE
- Deploy `customMetadata/FinServ__RollupByLookupConfig__mdt/` with the rest of your metadata package.

## Actionable Relationship Center (ARC)
- ARC is the current FSC relationship visualization — it replaced the legacy Relationship Viewer.
- Configure in Setup → Financial Services → Actionable Relationship Center.
- Key concepts: Cards (nodes per object/record type), Groups (relationship sets), Display Categories (panel sections).
- Assign ARC config to Lightning pages via the **Actionable Relationship Center** standard component.
- Use **Reciprocal Roles** (Setup → Financial Services → Reciprocal Roles) to define bidirectional labels
  (e.g., Spouse ↔ Spouse, Parent ↔ Child). Instantiate via `FinServ__ContactContactRelation__c` records.
- Add card actions sparingly — each action should map to a specific Flow or quick action, not generic navigation.
- Test ARC with restricted profiles: Display Category visibility is not automatic — validate per role.

## Sharing & Security
- FSC uses **Account Team** sharing for advisor-level access to client records.
  Add advisors to the Account Team with appropriate Team Member Role and Account access level.
- **Advisor hierarchy sharing:** configure sharing rules or Apex managed sharing for org-wide defaults below Private.
- `FinServ__FinancialAccount__c` inherits sharing from the parent Account — do NOT set OWD to Public on Financial Accounts.
- For compliance use cases: use **Restriction Rules** (Setup → Security → Restriction Rules) to limit record visibility
  by segment or regulatory region without custom Apex sharing.
- FSC Permission Sets to assign (do not create duplicates):
  - `FinancialServicesCloud` — base FSC access
  - `FinancialServicesCloudExtension` — advanced features (ARC, Goals, Referrals)
  - `FSCInsurance` / `FSCMortgage` / `FSCWealth` — industry-specific feature sets

## Referral Management
- Use `FinServ__Referral__c` for all referral tracking — internal advisor-to-advisor and external client referrals.
- Key fields: `FinServ__ReferredBy__c` (User), `FinServ__ReferredTo__c` (User), `FinServ__Account__c` (Account),
  `FinServ__Status__c` (picklist), `FinServ__ConvertedOpportunity__c` (Opportunity).
- Automate lifecycle via Record-Triggered Flow (not triggers on the managed object).
- On conversion: populate `FinServ__ConvertedOpportunity__c` and log a completed Activity.

## Financial Goals
- Use `FinServ__FinancialGoal__c` for client planning goals (Retirement, Education, Emergency Fund).
- Key fields: `FinServ__ActualValue__c`, `FinServ__TargetValue__c`, `FinServ__TargetDate__c`, `FinServ__GoalType__c`.
- Track progress via the `FinServ__Progress__c` formula or a custom Apex scheduled job that updates it nightly.
- Display goals on the client 360 page using the **Financial Goals** standard FSC component.

## Einstein Next Best Action for FSC
- Use Einstein Next Best Action (NBA) to surface referral and product recommendations on advisor pages.
- Define Recommendation Strategies using Flow to evaluate client attributes (AUM, product gaps, life events).
- Populate the **Einstein Next Best Action** component on the Account/Contact Lightning page.
- For advanced scoring: connect Data Cloud Unified Profiles to feed real-time propensity scores into NBA strategies.
- Gate all NBA-triggered actions behind human confirmation — never auto-execute DML from a recommendation.

## CRM Analytics (Tableau CRM) for FSC
- FSC ships with pre-built CRM Analytics apps: **FSC Analytics**, **Advisor Analytics**, **Insurance Analytics**.
- Before building custom lenses, explore whether the default apps cover the requirement.
- Data sync: FSC objects sync to CRM Analytics via the standard connector — add `FinServ__FinancialAccount__c`,
  `FinServ__FinancialGoal__c`, and `FinServ__Referral__c` to the dataflow.
- Use **Interaction Studio** (now Marketing Cloud Personalization) for behavioral data — not CRM Analytics.

## Industry-Specific Overlays
### Wealth Management
- Use `InvestmentAccount` Record Type. Key fields: `FinServ__AUM__c`, `FinServ__PortfolioStrategy__c`.
- Model advisor books of business via Account Team or custom junction object.

### Retail Banking
- Use `BankAccount` Record Type. `FinServ__Balance__c` drives household rollups.
- Integrate core banking via MuleSoft or Named Credential callouts — never embed account numbers in Apex.

### Insurance
- Use `InsurancePolicy` Record Type. Enable FSCInsurance permission set.
- Key objects: `InsurancePolicy`, `InsurancePolicyParticipant`, `InsurancePolicyCoverage`, `Claim`, `ClaimParticipant`.
- Integrate with policy administration systems via Platform Events or Apex callouts.

### Mortgage / Lending
- Use `CreditFacility` Record Type. Track loan applications via standard `Opportunity` with FSC fields.
- Enable FSCMortgage permission set for the Mortgage loan origination UI components.

## Data Quality & Deduplication
- Enable **Duplicate Management** for Account and Contact — FSC clients generate duplicates via advisor imports.
- Define Matching Rules based on Tax ID, email, or name + DOB for PersonAccounts.
- Run `Duplicate Jobs` (Setup → Duplicate Jobs) periodically on the full org to surface merge candidates.
- Never merge PersonAccounts with Business Accounts — the merge engine does not handle mixed account models.

## Testing FSC
- **Use TestDataFactory** to create PersonAccounts, Household Accounts, and Financial Accounts in test setup.
  PersonAccount creation requires inserting an Account with a PersonAccount Record Type Id.
- FSC rollup triggers fire in test context — always query the target rollup field after the insert in the same transaction.
- Assign FSC Permission Sets to test users in `@TestSetup` — `FinancialServicesCloud` is required for FSC object access.
- Mock managed package callouts where present using `Test.setMock(HttpCalloutMock.class, ...)` pattern.
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

## FSC References
- Financial Services Cloud Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.financial_services_cloud_developer_guide.meta/financial_services_cloud_developer_guide/
- FSC Object Reference: https://developer.salesforce.com/docs/atlas.en-us.financial_services_cloud_object_reference.meta/financial_services_cloud_object_reference/
- Rollup By Lookup Configuration: https://help.salesforce.com/s/articleView?id=sf.fsc_rollup_by_lookup.htm
- ARC Setup Guide: https://help.salesforce.com/s/articleView?id=sf.fsc_arc_setup.htm
- FSC Release Notes: https://help.salesforce.com/s/articleView?id=release-notes.rn_fsc.htm

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
- Concise, but detailed in FSC configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-fsc" -->