<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-health" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Health Cloud data model, patient records, care plans, clinical data model, or health managed package work

### Expected Evidence
- health object validation
- care plan review
- HIPAA compliance check

### Gates
- data integrity
- compliance
- package-safety

Recommended model: gpt-5.6-terra (standard tier)

---

# Health Cloud Standards

> Role: Health Cloud Developer / Consultant — Salesforce Professional Services.
> Health Cloud is a managed package on top of core Salesforce. All standards here apply **in addition to** general Apex and LWC rules.

## Consultative Design (CRITICAL)
- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for Health Cloud data model and clinical configuration decisions before implementing.

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

## Health Cloud Data Model (CRITICAL)

### Patient / Member Model
- **PersonAccount for patients/members.** Enable PersonAccount in Setup → Account Settings.
  Use a dedicated Record Type (e.g., `Patient`, `Member`) — never share a Record Type between patient and provider accounts.
- **Provider accounts** use Business Account Record Types (e.g., `Health_Care_Provider`, `Health_Care_Facility`).
- **Never create a custom "patient" object.** The Health Cloud patient model uses PersonAccount as the system of record.

### Core Health Cloud Objects
| Object | API Name | Purpose |
|--------|----------|---------|
| Account (Patient) | `Account` (PersonAccount) | Patient/Member demographic record |
| Care Plan | `CarePlan` | Treatment plan linking goals, activities, and care team |
| Care Plan Goal | `CarePlanGoal` | Clinical/behavioral target within a care plan |
| Care Plan Activity | `CarePlanActivity` | Task or intervention to achieve a goal |
| Care Program | `CareProgram` | Structured program (e.g., Chronic Disease Management) |
| Care Program Enrollee | `CareProgramEnrollee` | Patient enrollment in a care program |
| Clinical Encounter | `ClinicalEncounter` | Patient visit or interaction record |
| Health Condition | `HealthCondition` | Diagnosis, allergy, or clinical condition |
| Medication Statement | `MedicationStatement` | Active/historical medication record |
| Diagnostic Summary | `DiagnosticSummary` | Lab results, vital signs, observations |

## Patient 360
- **Timeline components:** Use the Health Cloud Patient Timeline component to display clinical encounters,
  conditions, medications, and care plan activities in chronological order.
- **Care team composition:** Display care team members (PCP, specialist, coordinator, caregiver) on the
  patient record using the Care Team related list and Care Team Member object.
- **Social determinants:** Track social determinants of health (SDOH) using `HealthCondition` records
  with appropriate category coding (Z-codes from ICD-10) or dedicated SDOH assessment objects.
- Configure the Patient Card (compact layout) to show: MRN, DOB, Primary Condition, Care Program enrollment status.

## Care Management

### Care Plan Templates
- Define reusable care plan templates with pre-configured goals and activities per condition or program.
- Use Record Types on `CarePlan` to distinguish plan categories (Chronic, Post-Acute, Behavioral, Preventive).
- Templates should include default care team roles, goal targets, and activity schedules.

### Goals and Activities Tracking
- Goals track clinical outcomes with target values and dates (`CarePlanGoal`).
- Activities represent discrete interventions: appointments, assessments, education, medication tasks (`CarePlanActivity`).
- Automate activity creation from goal templates using Record-Triggered Flows.
- Status progression: Not Started → In Progress → Achieved/Not Achieved (goals), Scheduled → Completed → Cancelled (activities).

### Program Enrollment and Milestones
- `CareProgram` defines the program structure (eligibility criteria, duration, milestones).
- `CareProgramEnrollee` tracks individual patient enrollment, start date, and status.
- Define program milestones (e.g., 30-day check-in, 90-day reassessment) as activities or custom milestone records.
- Trigger graduation or escalation flows based on milestone completion or missed targets.

## EHR Integration

### FHIR R4 Data Model Alignment
- Health Cloud Clinical Data Model (CDM) aligns with HL7 FHIR R4 resource types.
- Map FHIR resources to Health Cloud objects: Patient → Account, Encounter → ClinicalEncounter,
  Condition → HealthCondition, MedicationRequest → MedicationStatement, Observation → DiagnosticSummary.
- Preserve source system identifiers for reconciliation and bidirectional sync.

### HL7 Integration Patterns
- **Real-time:** FHIR REST APIs via Named Credentials; Apex REST endpoints for inbound bundles.
- **Batch:** Scheduled jobs polling EHR bulk export (`$export`) endpoints.
- **Event-driven:** Platform Events for HL7 v2 ADT/ORU messages; Flow subscribers update patient records.
- Use MuleSoft Healthcare Accelerator for complex transformation and routing scenarios.

### Clinical Data Model (CDM)
- CDM objects are the canonical store for clinical data in Health Cloud.
- Map coding systems: ICD-10 (conditions), LOINC (observations), CPT (procedures), RxNorm (medications).
- Never create custom clinical objects that duplicate CDM coverage — extend CDM objects with custom fields if gaps exist.

## Utilization Management
- **Prior authorization:** Use `CareRequest` and `CareRequestItem` for authorization workflows.
- **Service requests:** Track requested services, approvals, and denials with status lifecycle.
- **Review workflows:** Implement clinical review decision trees using Flows or OmniStudio guided processes.
- Automate authorization expiration alerts and renewal reminders.

## Provider Management
- **Provider search:** Use provider Account records with specialties, locations, and network participation.
- **Referral management:** Track referrals between providers using standard referral objects or custom processes.
- **Network adequacy:** Monitor provider availability by specialty, geography, and language to meet regulatory requirements.
- Link providers to care teams via `CareTeamMember` with defined roles.

## HIPAA Compliance (CRITICAL)

### PHI Protection
- **Field-level encryption:** Enable Shield Platform Encryption for all PHI fields
  (SSN, MRN, DOB, clinical notes, diagnosis codes, medication details).
- **Audit trail:** Enable Field Audit Trail on all CDM objects and patient Account fields.
  Retain audit data for minimum 6 years per HIPAA requirements.
- **Minimum necessary access:** Grant access to clinical data only to users who need it for their role.
  Use Permission Sets scoped to care team membership, not broad profiles.

### Access Controls
- **Role-based access:** Care coordinators see care plans; billing staff see claims but not clinical notes;
  providers see full clinical records only for their assigned patients.
- **Consent management:** Track patient consent for data sharing using consent records.
  Enforce consent-based visibility rules in sharing logic.
- **Break-the-glass:** Implement emergency access with mandatory justification logging for restricted PHI.

### Audit Requirements
- Log all PHI access (view, create, update, export) in a HIPAA-compliant audit object.
- Enable Login History and Setup Audit Trail retention.
- Implement automated alerts for unusual access patterns (bulk exports, off-hours access).

## Managed Package Safety (HealthCloudGA Namespace)
- **Do NOT add Apex triggers directly on Health Cloud managed objects** (`HealthCloudGA__*`).
  Use Record-Triggered Flows or a custom extension object instead.
- **Do NOT delete or rename Health Cloud managed fields.** Extend only — add custom fields with a project prefix.
- **Do NOT override Health Cloud managed page layouts.** Clone them and assign the clone to your Record Type.
- Before each package upgrade, review the release notes for breaking changes to CDM objects.
- Test in a sandbox with a full package upgrade before promoting to production.

## Security: Patient Data Sharing Model
- Health Cloud uses **Care Team-based sharing** for patient record access.
  Add providers and coordinators to the patient care team with appropriate roles and access levels.
- **OWD for clinical objects:** Set to Private. Share via care team membership or sharing rules scoped to programs.
- **Restriction Rules:** Use to limit record visibility by care program, facility, or department
  without custom Apex sharing.
- Health Cloud Permission Sets to assign (do not create duplicates):
  - `HealthCloud` — base Health Cloud access
  - `HealthCloudAdmin` — administrative features (templates, program configuration)
  - `HealthCloudApi` — API access for integration users

## Testing Health Cloud
- **Use TestDataFactory** to create patient PersonAccounts, CarePlans, and clinical data in test setup.
  Never use real PHI in test data — generate synthetic patient records with clearly fake identifiers.
- PersonAccount creation requires inserting an Account with a PersonAccount Record Type Id.
- Assign Health Cloud Permission Sets to test users in `@TestSetup` — `HealthCloud` is required for object access.
- Test care plan workflows end-to-end: enrollment → goal creation → activity completion → milestone tracking.
- Mock EHR callouts using `Test.setMock(HttpCalloutMock.class, ...)` with sample FHIR bundles.
- Verify sharing rules: test that non-care-team users cannot access patient clinical data.
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

## Health Cloud References
- Health Cloud Developer Guide: https://developer.salesforce.com/docs/atlas.en-us.health_cloud.meta/health_cloud/
- Health Cloud Object Reference: https://developer.salesforce.com/docs/atlas.en-us.health_cloud_object_reference.meta/health_cloud_object_reference/
- Clinical Data Model: https://developer.salesforce.com/docs/atlas.en-us.health_cloud_cdm.meta/health_cloud_cdm/
- FHIR R4 Integration: https://help.salesforce.com/s/articleView?id=sf.health_fhir_overview.htm

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
- Concise, but detailed in Health Cloud configuration justifications.
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
<!-- setup-agents:block:end id="codex-profile-health" -->