<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-loyalty" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Loyalty Management data model, LoyaltyProgram, LoyaltyProgramMember, TransactionJournal, tiers, promotions, vouchers, earn/redeem rules, or loyalty platform work

### Expected Evidence
- program configuration validation
- earn/redeem calculation result
- fraud detection review

### Gates
- data integrity
- financial compliance
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Loyalty Management Standards

> Role: Loyalty Management Developer / Consultant — Salesforce Professional Services.
> Loyalty Management is a Salesforce industry solution for designing, managing, and optimizing loyalty programs. All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for Loyalty program design and configuration decisions before implementing.

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

## Loyalty Management Data Model (CRITICAL)

### Core Concepts
- **Programs:** Top-level loyalty program definitions with branding, rules, and tier structures.
- **Tiers:** Membership levels with qualification criteria, benefits, and transition rules.
- **Members:** Individual participants enrolled in a loyalty program with tier status and currency balances.
- **Points/Currency:** Loyalty currencies (points, miles, credits) earned and redeemed by members.
- **Promotions:** Targeted campaigns that award bonus points, multipliers, or special benefits.
- **Vouchers:** Redeemable certificates issued to members as rewards or promotional incentives.

### Key Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Loyalty Program | `LoyaltyProgram` | Program definition with name, status, and configuration |
| Loyalty Program Member | `LoyaltyProgramMember` | Member enrollment linking Contact/Account to a program |
| Loyalty Member Tier | `LoyaltyMemberTier` | Current and historical tier assignments for a member |
| Loyalty Member Currency | `LoyaltyMemberCurrency` | Point/currency balances (earned, redeemed, expired, available) |
| Transaction Journal | `TransactionJournal` | Master transaction record (earn, redeem, transfer, expire) |
| Transaction Journal Entry | `TransactionJournalEntry` | Line-item detail within a transaction (per currency/product) |
| Loyalty Promotion | `LoyaltyPromotion` | Promotion campaign with eligibility rules and reward actions |
| Voucher | `Voucher` | Issued voucher instance with status, expiration, and redemption tracking |
| Voucher Definition | `VoucherDefinition` | Template for voucher issuance (value, validity, terms) |
| Benefit Type | `BenefitType` | Catalog of available benefits (discounts, upgrades, access) |
| Benefit Action | `BenefitAction` | Concrete benefit assignment triggered by tier or promotion |

## Program Design
- **Point-Based Programs:** Members earn and redeem a single currency (e.g., "Reward Points").
- **Tier-Based Programs:** Members progress through tiers (Bronze → Silver → Gold → Platinum) based on activity.
- **Multi-Currency Programs:** Support multiple currencies (points + miles + credits) with independent earn/redeem rules.
- **Partner Programs:** Allow earning/redemption across partner brands via shared program or coalition model.
- **Hybrid Programs:** Combine tier progression with multi-currency earning for complex loyalty ecosystems.
- Define program structure in Setup → Loyalty Management → Loyalty Programs before writing any code.

## Tier Management
- **Qualification Rules:** Define tier qualification based on earn-based (points earned in period) or spend-based (transaction value) criteria.
- **Tier Transitions:** Configure upgrade thresholds and downgrade rules (immediate vs. period-end evaluation).
- **Grace Periods:** Allow members to retain tier status for a configurable period after falling below threshold.
- **Tier Benefits:** Assign benefit actions per tier (e.g., Gold members get 2x multiplier, free shipping).
- **Tier Periods:** Define qualification periods (calendar year, rolling 12 months, custom period).
- Use `LoyaltyMemberTier` records to track current and historical tier assignments.

## Earning Rules
- **Accrual Events:** Define which transactions trigger point earning (purchase, referral, engagement, check-in).
- **Multipliers:** Configure tier-based or promotion-based earn multipliers (e.g., Gold = 1.5x base points).
- **Bonus Point Campaigns:** Time-limited campaigns that award extra points on qualifying transactions.
- **Partner Earn Rules:** Define earn rates for partner transactions with conversion ratios.
- **Earn Caps:** Set maximum earning limits per transaction, per day, or per period to prevent gaming.
- Process earning via `TransactionJournal` records — never manipulate `LoyaltyMemberCurrency` directly.

## Redemption
- **Redemption Catalog:** Define available rewards with point costs (products, discounts, experiences).
- **Point Values:** Set monetary value per point for flexible redemption (e.g., 100 points = $1).
- **Partial Redemption:** Allow members to use points + cash for purchases above their balance.
- **Expiration Policies:** Configure point expiration rules (rolling expiration, fixed date, activity-based refresh).
- **Redemption Locks:** Prevent redemption of points earned in the current qualifying period if needed for tier status.
- All redemptions must create `TransactionJournal` entries with type "Redeem" for audit trail.

## Promotions
- **Targeted Promotions:** Define member segments eligible for promotion (by tier, activity, demographics).
- **Member Segments:** Use Data Cloud or SOQL-based segments to target promotion audiences.
- **Double-Point Events:** Time-limited promotions that multiply base earn rate across all transactions.
- **Gamification:** Badge awards, streak bonuses, and challenge completions as promotion mechanics.
- **Promotion Stacking:** Define whether promotions can combine (additive vs. best-offer-wins).
- Configure promotions via `LoyaltyPromotion` with start/end dates and eligibility criteria.

## Voucher Management
- **Voucher Definitions:** Template records defining voucher value, validity period, redemption rules, and terms.
- **Issuance Rules:** Automatic issuance on tier upgrade, promotion trigger, or manual award by agent.
- **Redemption Tracking:** Track voucher usage with status transitions (Issued → Redeemed → Expired).
- **Expiration:** Configure voucher validity periods with automatic expiration processing.
- **Partial Use:** Define whether vouchers support partial redemption or are single-use only.
- Link vouchers to members via the `Voucher` object with `VoucherDefinition` as the template.

## Integration Patterns
- **POS Systems:** Real-time earn/redeem via REST API or Platform Events for in-store transactions.
- **E-Commerce Platforms:** Webhook-based integration for online purchase earning and cart-level redemption.
- **Partner Loyalty Networks:** API-based point transfer and earn/redeem across partner programs.
- **CDP for Segmentation:** Connect Data Cloud unified profiles for promotion targeting and personalization.
- **Marketing Cloud:** Trigger journey entries on tier changes, point milestones, or voucher issuance.
- **Financial Systems:** Reconcile point liability with finance via scheduled batch exports.
- Use Named Credentials for all external system authentication — never hardcode API keys.

## Security & Privacy
- **Member Data Privacy:** Loyalty member data is PII — apply appropriate FLS and sharing rules.
- **PII Protection:** Mask member identifiers in logs and external API payloads.
- **Fraud Detection:** Monitor for gaming patterns — rapid point accumulation, suspicious redemption velocity, account cycling.
- **Point Hoarding Detection:** Alert on members accumulating abnormal balances without redemption activity.
- **Access Controls:** Restrict point adjustment capabilities to authorized roles via Permission Sets.
- **Audit Trail:** All point balance changes must flow through `TransactionJournal` — never update currency records directly.

## Testing
- **Test Factories:** Create reusable factories for `LoyaltyProgram`, `LoyaltyProgramMember`, `LoyaltyMemberCurrency`, and `TransactionJournal`.
- **Tier Qualification Tests:** Verify tier upgrade/downgrade logic with boundary values (exactly at threshold, one point below).
- **Earn/Redeem Tests:** Validate point calculations with multipliers, caps, and promotion stacking.
- **Expiration Tests:** Test point expiration batch processing with known dates and balances.
- **Voucher Lifecycle Tests:** Cover issuance, redemption, partial use, and expiration scenarios.
- **Fraud Scenario Tests:** Verify detection logic triggers on known gaming patterns.
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

## Loyalty Management References
- Loyalty Management Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.loyalty.meta/loyalty/
- Loyalty Management Overview: https://help.salesforce.com/s/articleView?id=sf.loyalty_management.htm
- Loyalty Management Data Model: https://developer.salesforce.com/docs/atlas.en-us.loyalty.meta/loyalty/loyalty_data_model.htm

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
- Concise, but detailed in Loyalty program configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-loyalty" -->