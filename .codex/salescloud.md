<!-- setup-agents: 3.16.0 -->

<!-- setup-agents:block:start id="codex-profile-salescloud" version="3.16.0" -->
## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals
- Sales Cloud lead, opportunity, forecast, territory, quote, or sales process work

### Expected Evidence
- pipeline validation
- forecast review
- territory assignment check

### Gates
- sales process
- forecast accuracy

Recommended model: gpt-5.6-terra (standard tier)

---

# Sales Cloud Standards

## Lead Management
- **Lead assignment rules:** use Assignment Rules or lead routing (Salesforce Flow) over Apex triggers for round-robin and territory-based assignment.
- **Lead conversion:** always map Lead fields to Account/Contact/Opportunity during conversion. Use `Database.convertLead()` with `LeadConvert` settings.
- **Web-to-Lead:** validate and deduplicate incoming leads before insertion. Consider duplicate rules + matching rules.
- **Lead scoring:** implement via Flow or Process Builder with custom fields (Score__c). Avoid Apex for simple scoring logic.

## Opportunity Management
- **Sales stages:** map to `StageName` picklist values. Each stage should have defined exit criteria and probability.
- **Opportunity products:** use `OpportunityLineItem` with `PricebookEntry`. Never hardcode prices in Apex — always reference Price Books.
- **Close date management:** use validation rules to prevent past close dates on open opportunities.
- **Big Deal alerts:** use Flow-based notifications for opportunities above threshold amounts.
- **Opportunity splits:** configure team selling with `OpportunitySplit` when revenue sharing is needed.

## Forecasting
- **Forecast categories:** align with opportunity stages (Pipeline, Best Case, Commit, Closed).
- **Collaborative forecasting:** use `ForecastingAdjustment` for manager overrides.
- **Custom forecast types:** define by role, territory, or product family as needed.
- **Quota management:** use `ForecastingQuota` objects. Bulk load via Data Loader for quarterly resets.

## Territory Management
- **Territory2 model:** activate Enterprise Territory Management. Define territory hierarchy.
- **Territory assignment rules:** use `ObjectTerritory2Association` for account-territory mapping.
- **Territory-based sharing:** configure sharing rules that grant access based on territory membership.
- **User-territory association:** manage via `UserTerritory2Association`. One user can belong to multiple territories.

## Products, Price Books & Quotes
- **Product catalog:** use `Product2` with `IsActive` flag. Organize by `Family` picklist.
- **Price Books:** use standard + custom price books. Never bypass PricebookEntry for pricing.
- **Quotes:** use `Quote` object with `QuoteLineItem`. Sync selected quote to opportunity.
- **Discount approval:** implement via approval process on Quote when discount exceeds threshold.
- **CPQ integration:** if Salesforce CPQ is present, defer to CPQ profile rules.

## Sales Processes & Automation
- **Sales processes:** define per record type to control available stages.
- **Path (Guidance for Success):** configure key fields and guidance per stage for user adoption.
- **Einstein Activity Capture:** enable for automatic email/event logging. Respect privacy settings.
- **Cadences (Sales Engagement):** use for outreach sequences. Track step completion.
- **Approval processes:** use for discount approvals, contract sign-off. Chain approvers by role.

## Reporting & Analytics
- **Pipeline reports:** group by stage, owner, territory. Include weighted amount.
- **Win/loss analysis:** track `StageName` history via `OpportunityFieldHistory`.
- **Activity metrics:** report on tasks/events per opportunity for coaching.
- **Dashboard best practices:** one dashboard per role (rep, manager, VP).


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
<!-- setup-agents:block:end id="codex-profile-salescloud" -->