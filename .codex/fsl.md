<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-fsl" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Field Service appointment, scheduling, mobile worker, territory, or optimization work

### Expected Evidence
- scheduling validation
- mobile flow review
- territory model note

### Gates
- field operations
- mobile

Recommended model: gpt-5.6-terra (standard tier)

---

# Field Service (FSL) Standards

> Role: Field Service Developer — Salesforce Professional Services.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for FSL scheduling and work order decisions before implementing.

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

## Native Scheduling Objects First (CRITICAL)
- Before proposing custom scheduling or work objects, evaluate whether these native FSL objects cover the requirement:
  Work Orders, Work Order Line Items, Service Appointments, Scheduling Policies, Service Resources.
- Reference: https://help.salesforce.com/s/articleView?id=sf.fsl_service_setup.htm
- If native FSL configuration is insufficient, document the gap in an ADR.

## Work Order Lifecycle
- **Status stages:** New → In Progress → Completed → Closed. Block invalid backward transitions using a Record-Triggered Flow (After Save).
- **Work Order Line Items:** track parts consumed, services rendered, and labor. Link each line item to a Product record for inventory reconciliation.
- **Required vs. optional skills:** define required skills on the Work Type. Optional/preferred skills can be added at the work order level for scheduling preference.
- **Work Type configuration:** set Estimated Duration on Work Types — the scheduling engine uses this to calculate appointment slots. Enable Auto-Create Service Appointment if appointments should generate on work order creation.
- **SLA tracking:** configure Milestones on Work Orders (e.g., First Response, Resolution Time). Use Entitlements if SLA terms vary by account or contract.
- **Status transitions via flows:** use Record-Triggered Flows (not Apex triggers) for declarative status enforcement. Escalate to Apex only when governor limits or complex logic require it.

## Service Appointments
- **Creation triggers:** manual (dispatcher), automated via Record-Triggered Flow on Work Order creation, or Apex for bulk/programmatic scenarios.
- **Scheduling status lifecycle:** None → Scheduled → Dispatched → Completed → Cannot Complete. Each transition can trigger downstream automation.
- **Arrival window:** configure the Arrival Window Start/End fields to give customers a time range rather than a fixed appointment time.
- **Multi-resource appointments:** use the Service Appointment to Required Service Resource junction object to assign multiple technicians to a single appointment.
- **Service duration estimation:** pull Estimated Duration from the Work Type. Allow dispatchers to override on individual appointments when scope is known to differ.

## Scheduling Policies
- **Soft constraints (service objectives):** preferred skills, preferred resources, travel time minimization — violations are penalized but the appointment can still be scheduled.
- **Hard constraints (work rules):** required skills, working hours, resource capacity — violations must never result in a scheduled appointment.
- **Optimization objectives (ranked by weight):**
  1. Minimize Travel (reduces cost and improves customer density)
  2. Minimize Overtime (respects working hours boundaries)
  3. Maximize Skills Match (assigns the best-qualified technician)
- **Policy weighting:** adjust Service Objective weights in Setup → Scheduling Policies to reflect business priority. Document the rationale for each weight.
- Assign policies to Service Territories — use different policies for territories with different staffing models (e.g., urban vs. rural).

## Territory & Service Resource Management
- **Territory hierarchy:** root territory → parent territories → child (leaf) territories. Assign resources to the lowest-level territory where they work.
- **Operating hours:** set per territory and per resource. The scheduling engine respects operating hours for appointment slot availability.
- **Resource types:** Technician (individual person), Vehicle (asset assigned to appointments), Crew (group of resources acting as a unit).
- **Skill types and levels:** define Skill Types (e.g., Electrical, HVAC) and Skill Levels (e.g., Beginner, Intermediate, Expert) in Field Service Settings. Assign skills to resources with an effective date range.
- **Absences:** record resource absences (vacation, training) as Service Resource Absence records so the scheduler excludes those time slots.
- **Territory member assignment:** a resource can be a member of multiple territories. Set one territory as primary for optimization and reporting.

## Mobile App Configuration
- **FSL Mobile page layouts:** create dedicated mobile layouts for Work Order and Service Appointment — separate from desktop layouts to reduce field clutter.
- **Quick actions on mobile:** configure quick actions for status transitions (Start Travel, Mark Arrived, Complete) directly on the mobile layout.
- **Offline sync configuration:** enable offline sync for Work Order, Service Appointment, Work Order Line Item, and related assets. Define priming rules to pre-fetch records the technician will need.
- **Mobile flows for status updates:** build Screen Flows launched from quick actions to guide technicians through status transitions, enforce required fields, and capture completion data (signature, photos, notes).
- **Required fields for mobile form submission:** define which fields must be filled before a technician can mark a work order Complete. Enforce via validation rules or flow decision elements — never rely on page layout required-field markers alone (they can be bypassed by API).

## Parts & Inventory Management
- **Products Consumed:** use Work Order Line Items with the Products Consumed related list to record parts used during a job. Each line item links to a Product2 record.
- **Inventory locations:** configure Location records (warehouse, van stock, service center) and link products to locations via Product Item records.
- **Van stock:** assign Product Items to a technician's van Location so the scheduling engine can factor parts availability into resource selection.
- **Return Merchandise Authorization (RMA):** use Return Orders to track parts returned from the field. Link Return Order Line Items to the originating Work Order Line Item for traceability.
- **Product transfers:** use Product Transfer records to move inventory between locations (warehouse to van, van to warehouse after job completion).

## Crew & Complex Resource Scheduling
- **Crew formation rules:** define crews as Service Resource records of type Crew. Use Crew Members (Resource Crew junction object) to assign individual technicians.
- **Crew leader designation:** designate one crew member as leader on the Resource Crew record. The leader's schedule drives the crew's availability.
- **Same-appointment multi-resource booking:** add multiple Required Service Resources to a single Service Appointment when the job requires concurrent technicians (not a crew).
- **Resource sharing across territories:** a resource can be a member of multiple territories. Use the Service Territory Member record to define date-effective territory assignments.

## Maintenance Plans
- **Preventive maintenance templates:** create Maintenance Plans linked to an Asset or Account to schedule recurring work orders automatically.
- **Maintenance work rules:** define frequency (daily, weekly, monthly, by meter reading) and the Work Type to use for auto-generated work orders.
- **Auto-generation of work orders:** the FSL managed package generates work orders on schedule. Configure the Maintenance Plan's Start Date and Next Suggested Maintenance Date.
- **Recurrence patterns:** supported patterns include daily, weekly (by day of week), monthly (by date or day of month), and asset-usage-based (by meter value increment).

## Dispatcher Console Tips
- **Gantt chart view:** configure visible columns (resource name, territory, utilization) and time scale (day/week/month) per dispatcher preference via FSL Console Settings.
- **Map view:** use the map to identify geographic clusters of appointments. Color-code by status to quickly spot unscheduled or overdue appointments.
- **Appointment booking API:** use the `FSL.ScheduleService` Apex class for programmatic self-scheduling in Experience Cloud or Apex triggers. It respects the configured scheduling policy.
- **Resource utilization monitoring:** use the Utilization report in the Dispatcher Console to identify over- and under-utilized resources and rebalance workload proactively.

## Self-Scheduling via Experience Cloud
- Use **`FSL.ScheduleService`** Apex class for customer-facing self-scheduling in Experience Cloud portals.
- Key methods:
  - `FSL.ScheduleService.getSlots(WorkOrderId, StartDate, EndDate)` — returns available appointment windows.
  - `FSL.ScheduleService.scheduleExtended(ServiceAppointmentId, SlotStartDate, SlotEndDate)` — books the slot respecting the scheduling policy.
- **Portal flow pattern:** Work Order created → customer selects slot from `getSlots()` result → `scheduleExtended()` books it → confirmation screen.
- Always pass a **Scheduling Policy** to `getSlots()` — never use the default policy for customer-facing booking.
- Guest user permissions: grant access to `ServiceAppointment`, `WorkOrder`, and `FSL__Scheduling_Policy__c` via the Experience Cloud guest profile.
- **Cancellation:** update `ServiceAppointment.Status` to `Canceled` via Flow or Apex. Trigger a notification to the dispatcher.
- **Rescheduling:** cancel the existing appointment, then call `getSlots()` + `scheduleExtended()` again. Never update slot fields directly.
- Test the self-scheduling flow under the Experience Cloud guest user profile — permissions that work for internal users often fail for guests.
- Document the scheduling policy used for self-scheduling separately from the dispatcher policy — they often have different constraints.

## Deployment
- Granular deploy: specific modified files/metadata ONLY.
- **Validate before deploying:** `sf project deploy validate -d force-app`.
- **Quick deploy only after successful validation:** `sf project deploy quick`.

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

## Semantic Commits
- Ask for **Backlog Item ID** before suggesting any commit.
- Format: `type(ID): short description`.
- Body: numbered list of changes + value proposition paragraph.

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
- Concise, but detailed in Field Service configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-fsl" -->