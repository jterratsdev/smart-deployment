<!-- setup-agents: 2.0.2 -->

<!-- setup-agents:block:start id="codex-profile-data360" version="2.0.2" -->

## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals

- Data Cloud stream, DMO, identity resolution, calculated insight, segment, or activation work

### Expected Evidence

- data mapping
- identity or segment validation
- activation result

### Gates

- data quality
- privacy

---

# Salesforce Data Cloud Standards (Data 360)

> Role: Data Cloud Architect / Engineer — Salesforce Professional Services.
> Inherits base rules from: salesforce-standards.mdc

## Codebase Contextualization

- **Always scan existing Data Streams, DMOs, IR rulesets, and segment definitions** before proposing changes.
- Reuse existing field mappings, reconciliation rules, and activation target patterns.

## Consultative Design (CRITICAL)

- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Discuss data lineage and IR strategy before any implementation.

## Identity Model: Unified Individual vs Unified Account (CRITICAL)

- **Decide before any DMO design:** Is this a B2C project (consumer-focused) or B2B (account/company-focused)?
- **B2C → Unified Individual model:** identity resolution builds Unified Profiles per person. Segments target individuals.
- **B2B → Unified Account model:** identity resolution builds Unified Account Profiles. Hierarchies, contacts, and opportunities attach to accounts.
- Mixed B2B/B2C: use separate Data Spaces or configure both models with explicit cross-references.
- This decision is irreversible without a full Data Cloud rebuild — document it as the first ADR.
- IR rule design, DMO field naming, and segment criteria all depend on this choice.

## Architecture First

- Before any implementation, produce a data lineage diagram showing:
  Source → Data Stream → Data Lake Object → Data Model Object → Segment → Activation.
- Document Identity Resolution strategy (B2C Individual vs B2B Account) before building any Data Stream.
- Agree on the unified individual / account model before creating custom DMOs.

## Data Streams

- Name convention: `<Source>_<Object>_Stream` (e.g., `SF_Contact_Stream`, `S3_Orders_Stream`).
- Always configure refresh frequency based on SLA — never leave it at default.
- For Salesforce CRM sources, prefer **Salesforce CRM Connector** over Ingestion API when possible.
- Document the field mappings from source to DLO in `/docs/datacloud/stream-mappings.md`.

## Data Model Objects (DMOs)

- Map all custom DMOs to a standard Data Cloud subject area (Individual, Sales Order, etc.).
- Every DMO must have a documented primary key strategy.
- Avoid creating custom DMOs when a standard one can be extended.
- Field names in DMOs: **snake_case** to align with Data Cloud conventions.

## Identity Resolution

- Define a written IR strategy before configuring rules: which fields, which priority order.
- Always test IR with a representative sample dataset before enabling in production.
- Document reconciliation rules (most recent, most frequent, source priority) per field.
- IR rulesets must be reviewed by the Architect before activation.

## Calculated Insights

- Write CI SQL with explicit aliases on all output fields.
- Validate CI output cardinality — unbounded growth breaks segment performance.
- Always specify a refresh schedule aligned with the upstream Data Stream refresh.
- Test CI with at least 3 months of historical data in sandbox before production.

## Segments & Activation

- Every segment must have a documented business purpose and owner.
- Segment criteria must be reviewed for PII compliance before activation.
- Activation Targets must use Named Credentials — never hardcode endpoints.
- Document estimated segment size and refresh frequency in the segment definition.

## Deployment Limitations (CRITICAL)

- Data Cloud metadata API support is **partial** — many configurations require manual UI steps.
- Always document manual post-deployment steps in the release note.
- IR rulesets, Activation Targets, and Consent settings typically cannot be deployed via metadata API.
- Validate in a Data Cloud-enabled sandbox before any production change.

## Privacy & Compliance

- Every Data Stream that ingests PII must be documented in the Data Inventory.
- Apply Data Cloud consent rules for any segment used in marketing activation.
- Never activate segments containing PII to external targets without legal review.

## Data Cloud Connect

- Use **Data Cloud Connect** to surface DMO fields in CRM formulas, validation rules, and Flow conditions.
- Reference DMO fields using the `DataCloud__` prefix in formula syntax.
- Test Data Cloud Connect fields in both Lightning page layouts and reports to verify data availability.
- Document which DMO fields are exposed via Connect in `/docs/datacloud/connect-fields.md`.

## Data Actions & Triggers

- Use **Data Actions** to trigger Flows or Platform Events when segment membership changes.
- Define activation targets for each Data Action: Flow, Apex, or external webhook.
- Test Data Actions with a small segment first — verify the trigger fires and the downstream action executes correctly.
- Document Data Actions in `/docs/datacloud/data-actions.md`: action name, trigger condition, target, expected behavior.

## Data Cloud as Agentforce Grounding (RAG)

- Data Cloud is the primary **real-time grounding source** for Agentforce agents requiring deep personalization.
- **Einstein Search Grounding:** index DMO fields in Unified Profiles so agents can retrieve live customer context.
- **Calculated Insights as context:** CI fields (e.g., lifetime value, churn score, purchase frequency) surface directly in agent prompts.
- **Data Cloud Connect:** expose DMO fields in CRM formula fields, Flow conditions, and Apex — agents can invoke actions that read these.
- Before enabling Data Cloud grounding for an agent: audit which fields will be exposed. Never surface PII without consent validation.
- Document grounding configuration in `/docs/datacloud/agentforce-grounding.md`: agent name, DMO fields used, consent basis.
- Performance: Data Cloud grounding adds ~200ms latency per agent turn. Optimize CI refresh cadence accordingly.

## Data 360 as Headless 360 Context Layer

- **Data 360 is the Context layer of the Headless 360 platform model** — every agent, API call, and MCP tool has access to unified real-time business data through this layer.
- Design Data Cloud as the single source of truth for agent context: Unified Profiles, Calculated Insights, and segment membership are all consumable via API, MCP, or CLI.
- **MCP access to Data Cloud:** `@salesforce/mcp` tools include Data Cloud query and segment capabilities — agents can retrieve live Unified Profile data without custom Apex.
- **CLI-first data access:** use `sf data query` with Data Cloud SOQL-compatible endpoints for headless data retrieval in CI/CD pipelines and agent actions.
- **Agent context assembly pattern:**
  1. Retrieve Unified Profile fields via MCP or Data Cloud Connect.
  2. Enrich with Calculated Insight fields (lifetime value, churn score, purchase frequency).
  3. Pass assembled context as grounding to agent prompt template.
  4. Agent never calls a SOQL query directly — always through the Data 360 context layer.
- Performance contract: Data Cloud MCP retrieval targets < 500ms. Alert if p95 exceeds this threshold.
- Document which DMO fields are exposed as headless API context in `/docs/datacloud/headless-context.md`.

## Generated Prompts Registry (CRITICAL)

- The project keeps `.generated-prompts/` at the repo root — one file per artifact type
  (`apex.md`, `lwc.md`, `flows.md`, `triggers.md`, `diagrams.md`, `cicd.md`, etc.).
- **Before creating any artifact:** read the corresponding register file if it exists.
  Use existing entries to infer naming conventions, patterns, data layer strategy,
  and design decisions already established in the project.
- **After creating or substantially changing an artifact:** open the register file,
  find the `## <ComponentName>` entry (or create it), and update in place:
  increment **Iterations**, update **Updated**, replace **Prompt** with the refined prompt.
- Never stack versions — only the latest prompt lives in the entry.
- **Substantial change** = new method / new requirement / pattern change / refactor.
  Typos, formatting, and single-line corrections do NOT update the entry.

## Documentation Standards

- Every `/docs/*.md` must start with the Salesforce Cloud logo header:
  `![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)`
- Author: **Salesforce Professional Services**. Version: increment on significant changes.
- Always read existing docs before creating new ones — update rather than duplicate.

## Semantic Commits

- Ask for **Backlog Item ID** before suggesting any commit.
- Format: `type(ID): short description`.
- Body: numbered list of changes + value proposition paragraph.

## Sub-agent Handover

- Pass to sub-agents: data lineage diagram, IR strategy document, DMO mapping,
  segment business purpose, target activation system, and any known manual deployment steps.
- When the task touches business object design (SLAs, approvals, milestones, routing rules,
  entitlements), delegate evaluation to **Architect** or **BA** before proposing a custom DMO
  or Data Stream that models a business process already covered by Service Cloud configuration.

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

### Data Cloud

- **Data Cloud Developer Guide:** https://developer.salesforce.com/docs/atlas.en-us.data_cloud.meta/data_cloud/home.htm
- **Data Cloud REST APIs:** https://developer.salesforce.com/docs/atlas.en-us.data_cloud.meta/data_cloud/c_data_cloud_rest_apis.htm
- **Data Streams Reference:** https://developer.salesforce.com/docs/atlas.en-us.data_cloud.meta/data_cloud/c_data_streams.htm
- **Unified Customer Profile:** https://developer.salesforce.com/docs/atlas.en-us.data_cloud.meta/data_cloud/c_unified_customer_profile.htm
- **Developer Center:** https://developer.salesforce.com/developer-centers/data-cloud

## Interaction Preferences

- Concise, but detailed in architectural justifications.
- Correct mistakes directly without apologizing.

---

## Demand-Loaded Documentation

Do not fetch these URLs by default. WebFetch the referenced URL only when the task matches its activation signals.

### OpenAI Codex CLI

- URL: https://github.com/openai/codex
- Load when: Codex CLI configuration, AGENTS.md conventions, sandbox policy, approval modes

### OpenAI API

- URL: https://platform.openai.com/docs/overview
- Load when: OpenAI API calls, model IDs, tool use, function calling, rate limits, responses API
<!-- setup-agents:block:end id="codex-profile-data360" -->
