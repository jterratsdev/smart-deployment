<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-commerce" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- B2B/B2C Commerce storefront, cartridge, pipeline, OCAPI, SCAPI, or Business Manager work

### Expected Evidence
- storefront validation
- API contract result
- commerce smoke test

### Gates
- commerce
- performance

Recommended model: gpt-5.6-terra (standard tier)

---

# Commerce Cloud (B2B / B2C) Standards

> Role: Commerce Cloud Developer — Salesforce Professional Services.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for commerce architecture decisions (B2B vs B2C, headless vs storefront) before implementing.

---

# B2C Commerce (SFCC / SFRA)

## SFRA Controller Patterns
- Controllers use `server.get()`, `server.post()` to register routes.
- Always call `next()` at the end of every middleware step.
- Use the middleware chain for cross-cutting concerns: `server.middleware.https`, `userLoggedIn`, `consentTracking`.
- Never put business logic directly in controllers — delegate to helpers or models.
- Export via `module.exports = server.exports()`.

## ISML Templates
- Use `<isloop>` for iteration, `<isset>` for variable assignment, `<isif>` for conditionals.
- Include shared partials with `<isinclude template="..." />`.
- Reference resource bundles: `${Resource.msg('key','bundle',null)}`.
- Never embed business logic in ISML — keep templates presentation-only.
- Use `<isdecorate>` for page layouts.

## Hooks
- Register hooks in `hooks.json` at the cartridge root.
- Common hooks: `app.post` (post-processing), `dw.order.calculate` (pricing/tax/shipping),
  `dw.ocapi.shop.order.afterPOST` (OCAPI order events).
- Hook implementations must be idempotent — they may fire multiple times.

## Cartridge Layering & Overlay
- **Never modify `app_storefront_base` directly.** Always overlay in a custom cartridge.
- Use `module.superModule` + `server.extend(base)` to override controller routes.
- `server.replace()` fully replaces a route; `server.append()` / `server.prepend()` extend it.
- Mirror the base cartridge directory structure for template overrides.
- Cartridge path order determines precedence — custom cartridge must appear before base.

## OCAPI / SCAPI (Headless Commerce)
- Prefer **SCAPI** (Shopper APIs via Commerce SDK) for new headless implementations.
- Use **OCAPI** only for legacy integrations or features not yet available in SCAPI.
- Authenticate via SLAS (Shopper Login and API Security) for B2C headless storefronts.
- Never expose OCAPI credentials client-side — proxy through a middleware layer.
- Version OCAPI resources explicitly; pin to a stable version.

## Job Framework
- Define custom job steps in `steptypes.json` at the cartridge root.
- Job step modules: `cartridge/scripts/jobsteps/<StepName>.js`.
- Export `execute(params, stepExecution)` — handle chunk-based processing for large datasets.
- Log progress via `stepExecution.getJobExecution()` — never use `print()` in production.
- Schedule jobs in Business Manager; avoid hardcoded schedules in code.

## Business Manager Configuration
- Site Preferences: use for runtime toggles that differ per site.
- Custom Objects: use for structured data that does not belong in the catalog.
- System Object extensions: document every custom attribute added to system objects.
- Import/Export: use Site Import/Export for sandbox seeding; never rely on manual configuration.

## B2C Performance
- Cache aggressively: use `dw.system.CacheMgr` for expensive computations.
- Avoid unnecessary API calls in controllers — batch and reuse ContentSearchResult, ProductSearchModel.
- Minimize ISML `<isloop>` nesting — flatten data in the model layer.
- Use `dw.util.Iterator` for large collections instead of converting to arrays.
- Profile slow pages with Pipeline Profiler in Business Manager.

---

# B2B Commerce (Lightning)

## Apex Integrations for Checkout
- Implement checkout steps as Apex classes registered via `StoreIntegratedService`.
- Key APIs: `ConnectApi.CommerceCart`, `ConnectApi.CommerceCatalog`, `ConnectApi.CommerceStorePricing`.
- Follow standard Apex rules: `with sharing`, bulkified, no SOQL/DML in loops.
- Scan for existing custom exception class before writing `try-catch`.

## Buyer Groups, Entitlements & Pricing
- Assign products to **Entitlement Policies** linked to **Buyer Groups**.
- Use **Pricebooks** for tiered pricing; assign pricebooks to buyer groups.
- Test entitlement visibility with `System.runAs()` using buyer-profile test users.
- Validate that unauthenticated users cannot see entitled products.

## Custom LWC for Storefront
- Extend the B2B storefront using LWC components exposed to the **Commerce Builder**.
- Target `lightningCommunity__Page` and `commerce__Default` in `js-meta.xml`.
- Use **SLDS Styling Hooks** — do not override Commerce theme tokens.
- Wire to `@salesforce/apex` for custom data; prefer `lightning/uiRecordApi` for standard objects.

## Cart & Checkout API
- Use `ConnectApi.CommerceCart.getOrCreateActiveCartSummary()` for cart access.
- Add/remove items via `ConnectApi.CommerceCart.addItemToCart()` and `deleteCartItem()`.
- Checkout flow: Cart → Shipping → Tax Calculation → Payment → Order Creation.
- Handle `CommerceCart.CartValidationOutput` to surface errors to the buyer.

## B2B Search & Product Catalog
- Use **Commerce Search** (powered by the search index) — do not query Product2 directly for storefront.
- Rebuild the search index after catalog changes: Setup → Commerce → Search.
- Configure searchable fields and facets in the Store Builder.
- For programmatic search, use `ConnectApi.CommerceSearchResource.searchProducts()`.

## Order Management Integration
- For Salesforce Order Management: map B2B orders to `OrderSummary` via `ConnectApi.OrderSummaryCreation`.
- Ensure `FulfillmentOrder` and `OrderItemSummary` records are created for downstream fulfillment.
- Test the full cycle: cart → order → fulfillment → invoice.
- For external OMS: integrate via Platform Events or MuleSoft APIs.

---

# Shared Standards

## Agentforce for Commerce
- **Agentforce agents are native to Commerce** — design product discovery, checkout assistance, and order support as agent topics, not only UI flows.
- **Key agent use cases:**
  - **Product Discovery:** agent interprets natural-language queries ("I need running shoes under $100") and returns catalog results via `ConnectApi.CommerceSearchResource`.
  - **Checkout Assistance:** agent guides the buyer through cart validation, shipping selection, and payment — surfaces errors from `CartValidationOutput` as conversational messages.
  - **Order Status:** agent retrieves `OrderSummary` and `FulfillmentOrder` status and answers "where is my order?" without human intervention.
- Design agent actions as **Invocable Apex methods** backed by the Commerce Connect APIs — agents invoke them via Agentforce topics.
- Render agent responses in the storefront via the **Agentforce Experience Layer** — structured card payloads, not raw text.
- Never expose raw SOQL results to the agent — always wrap in a typed Apex action with explicit output fields.
- Test agent commerce flows under the buyer persona (Experience Cloud guest or authenticated user) — permissions differ from internal users.

## Composable Storefront / PWA Kit (B2C Headless)
- **Composable Storefront (PWA Kit)** is the React-based headless B2C storefront — use for new B2C implementations requiring custom UX or mobile-app-like performance.
- Use **SCAPI (Shopper APIs)** exclusively — OCAPI is not supported in PWA Kit.
- Authenticate via **SLAS** (Shopper Login and API Security) — never use BM user credentials client-side.
- **When to use PWA Kit vs SFRA:** PWA Kit for greenfield with strong frontend team; SFRA for orgs with existing cartridge investments or limited React expertise.
- PWA Kit extends via **overrides** — never modify the `@salesforce/retail-react-app` base directly; overlay in your custom package.
- Respect the SCAPI rate limits — implement client-side caching for product/category data to avoid redundant API calls.

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

## Sub-agent Handover
- Pass to sub-agents: commerce type (B2B / B2C), cartridge path or WebStore ID,
  API version from `sfdx-project.json` (B2B) or `dw.json` compatibility mode (B2C).
- Sub-agents must follow: cartridge overlay pattern (B2C), standard Apex rules (B2B).
- When the task touches business object design (SLAs, approvals, milestones, routing rules,
  entitlements), delegate evaluation to **Architect** or **BA** before proposing a custom
  order or fulfillment object when native Order Management already covers the requirement.

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
- Concise, but detailed in commerce architecture justifications.
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
<!-- setup-agents:block:end id="codex-profile-commerce" -->