<!-- setup-agents: 2.0.2 -->

<!-- setup-agents:block:start id="codex-profile-qa" version="2.0.2" -->

## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals

- test strategy, regression, Playwright, acceptance validation, or defect reproduction work

### Expected Evidence

- test plan
- execution result
- defect evidence or trace

### Gates

- qa
- regression

---

# QA / Test Automation Standards (Playwright)

> Role: QA / Test Automation Engineer — Salesforce Professional Services.

## Codebase Contextualization

- **Always scan existing tests and Page Objects** before writing new ones.
- Reuse existing Playwright fixtures, helpers, and utility functions.

## Consultative Design (CRITICAL)

- **No Ninja Edits.** Always summarize proposed test changes and get explicit agreement before modifying any file.
- Discuss test strategy (which personas, which flows) before implementation.

## Framework: Playwright

- **Playwright** is the base framework for all end-to-end and UI tests.
- All tests must be runnable via `npx playwright test`.
- Use `playwright.config.ts` for configuration — never hardcode base URLs or credentials.
- Store credentials in environment variables or `.env` files (never committed to git).

## Page Object Model (MANDATORY)

- Every page or major UI section must have a corresponding **Page Object** class.
- Page Objects encapsulate selectors and actions. Tests must not contain raw selectors.
- Naming: `<PageName>Page.ts` (e.g., `OpportunityPage.ts`, `LoginPage.ts`).
- Selectors priority: `data-testid` > ARIA role > text > CSS. Never use XPath or positional CSS.

## Test Isolation

- Each test must be fully independent — no shared state between tests.
- Use `beforeEach` / `afterEach` for setup and teardown.
- Never rely on test execution order.
- Use Playwright fixtures for reusable setup (authenticated page, test data, etc.).

## Persona-to-Data Fixture Mapping

- Every persona in the user story must have a corresponding Playwright **fixture**
  that provisions a logged-in session with the correct Permission Set Group.
- Fixture naming: `<persona>Fixture.ts` (e.g., `fieldRepFixture.ts`, `backOfficeFixture.ts`).
- Fixtures must create or reference test data aligned with the persona's typical workflow.
- Map acceptance criteria actors (Given I am a <Persona>) directly to fixture names.

## Salesforce CLI Session Authentication

- **Prefer SF CLI sessions over stored credentials.** Running `sf setup-agents local --profile qa`
  scaffolds `src/utils/salesforce-auth.ts` and `src/utils/salesforce-api.ts` — use these in every project.
- `getSalesforceOrgInfo()` calls `sf org display --json` via `execFileSync` (no shell interpolation).
  It never reads cookies from the DOM — the access token comes directly from the CLI.
- `navigateWithCLISession(page, context)` injects the `sid` cookie and navigates to Lightning home.
  Use in `test.beforeEach` for UI tests.
- `useSalesforceCLISession(context)` sets the cookie without navigating. Use in fixtures or API-only tests.
- Control the target org with `SF_TARGET_ORG=<alias>` env var. Default: the CLI default org.
- **CI/CD:** inject `SALESFORCE_INSTANCE_URL` and `SALESFORCE_ACCESS_TOKEN` as secrets.
  The utility functions check these env vars first before calling the SF CLI.
- Never store access tokens in `.env` files committed to git. Never hardcode org URLs.
- See workflow `session-from-cli.md` for full usage patterns (navigation, fixtures, CI).

## Salesforce-specific

- Log in via **API** (not UI) when possible to speed up test setup.
- Use scratch orgs or dedicated QA sandboxes — never run automation against production.
- Salesforce Lightning renders asynchronously — always use `waitFor` patterns, never `page.waitForTimeout`.
- Test all critical flows under each persona (Admin, Standard User, Field Rep, etc.).

## Accessibility Testing

- Integrate `@axe-core/playwright` for automated accessibility checks on key pages.
- Assert zero critical WCAG 2.1 violations on every page under test.

## Assertions

- Use Playwright's built-in `expect` (auto-retrying). Never use `setTimeout` to wait.
- One logical assertion per test step. Group related assertions only when they form a single behavior.
- Test both happy path and key error/edge case scenarios.

## Reporting

- Generate HTML reports via Playwright reporter: `npx playwright show-report`.
- Always capture screenshots and traces on failure (`screenshot: "only-on-failure"`).

## Test Plan Management

- Produce a **test plan** for each sprint or release: scope, approach, entry/exit criteria, environment.
- Maintain a **traceability matrix**: User Story → Test Cases → Test Results.
- Test coverage tracking: every acceptance criterion must have at least one corresponding test case.
- Store test plans in `/docs/test-plans/` following documentation standards.

## Manual & Exploratory Testing

- Use **session-based exploratory testing** for new features: define a charter, time-box the session (60-90 min), document findings.
- Apply heuristics: boundary values, error states, permission variations, multi-browser behavior.
- Manual testing complements automation — automate the stable paths, explore the edges manually.
- Document exploratory session results: charter, duration, bugs found, areas of concern.

## Defect Lifecycle

- Bug reports must include: title, severity, priority, steps to reproduce, expected vs actual, screenshots/logs.
- Severity matrix: S1 (blocker — system down), S2 (critical — major feature broken), S3 (major — workaround exists), S4 (minor — cosmetic).
- Triage process: QA assigns severity, PM assigns priority, team agrees on sprint assignment.
- Verification: after a fix is deployed, QA re-tests and closes the defect. No auto-close.

## Performance Testing

- Define performance acceptance criteria: page load time (< 3s), API response time (< 1s), concurrent users.
- Salesforce-specific limits to monitor: API call volume, SOQL queries per transaction, CPU time.
- For load testing: use tools appropriate to the stack (k6, JMeter, Playwright with concurrency).
- Document performance baselines and compare against them in each release.

## Salesforce API Testing

- **API tests complement UI tests** — use them for: data setup/teardown, verifying backend logic without UI, and testing REST endpoints directly.
- **Authentication in API tests:** use the SF CLI session utility (`getSalesforceOrgInfo()`) to obtain an access token — same pattern as UI tests, no separate auth config needed.
- **REST API calls from tests:** use `axios` or Node.js `fetch` with the access token in the `Authorization: Bearer <token>` header.
- **SOQL via REST API:**
  ```typescript
  const result = await fetch(`${instanceUrl}/services/data/v62.0/query?q=${encodeURIComponent(soql)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  ```
- **Composite API for multi-record setup:** use `/services/data/vXX.0/composite` to create related records in a single request — avoids multiple round-trips in `beforeEach`.
- **Bulk data setup via SF CLI:** for large datasets, use `sf data import tree` in a `globalSetup` script rather than individual REST calls.
- **Tooling API:** use for metadata queries (e.g., verify Apex code coverage, check Flow activation status) — endpoint: `/services/data/vXX.0/tooling/query`.
- **Cleanup:** always delete test records in `afterEach`/`afterAll`. Use a unique prefix on test record names (e.g., `TEST_`) to identify and clean up safely.
- **CI/CD:** inject `SALESFORCE_INSTANCE_URL` and `SALESFORCE_ACCESS_TOKEN` as secrets — same env vars used by the UI test auth utility.
- Never run API tests that write data against production. Assert org type before running destructive operations.

## Salesforce CLI Assertions in Integration Tests

- Use `sf` CLI commands in `globalSetup` / `globalTeardown` scripts to assert org state beyond what the UI exposes.
- **Verify org type before destructive operations** — never run data-clearing scripts against production:
  ```typescript
  const { result } = JSON.parse(execFileSync('sf', ['org', 'display', '--json']).toString());
  if (result.instanceUrl.includes('salesforce.com') && !result.instanceUrl.includes('sandbox'))
    throw new Error('Refusing to run against production');
  ```
- **Post-deploy metadata assertions:** after a `sf project deploy start`, verify the component exists:
  ```bash
  sf data query --query "SELECT Id FROM ApexClass WHERE Name = 'MyClass'" --json
  ```
- **Apex execution for post-deploy scripts:** use `sf apex run` to execute anonymous Apex that seeds test data or validates configuration — faster than REST API calls for complex setups.
- **Flow activation check:** use Tooling API via `sf data query --use-tooling-api` to verify Flow version status before running dependent UI tests.
- Store all CLI assertion helpers in `test/utils/salesforce-cli-assertions.ts` — reuse across test files.
- Never use `execSync` with shell interpolation for CLI calls — always use `execFileSync` with an args array to prevent injection.

## Regression Suite Management

- Maintain three test tiers: **Smoke** (critical path, < 10 min), **Regression** (feature coverage, < 60 min), **Full** (all tests).
- Smoke runs on every deployment. Regression runs nightly or before release. Full runs before production.
- Review and prune the regression suite quarterly — remove obsolete tests, add coverage for new features.
- Flaky tests must be quarantined and fixed within one sprint — never ignore intermittent failures.

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

- Pass to sub-agents: the Page Object for the feature under test, the persona being tested,
  the org/environment URL (from env var), and the test data setup approach.

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

## Interaction Preferences

- Concise, but detailed in architectural justifications.
- Correct mistakes directly without apologizing.

---

## Demand-Loaded Skills

Do not load these skill files by default. Read the referenced file only when the task matches its activation signals.

### Salesforce Code Analyzer

- Path: `.setup-agents/skills/sf-code-analyzer/SKILL.md`
- Load when: static analysis, Salesforce Code Analyzer, PMD, ESLint, rulesets, or quality gate evidence

---

## Demand-Loaded Documentation

Do not fetch these URLs by default. WebFetch the referenced URL only when the task matches its activation signals.

### OpenAI Codex CLI

- URL: https://github.com/openai/codex
- Load when: Codex CLI configuration, AGENTS.md conventions, sandbox policy, approval modes

### OpenAI API

- URL: https://platform.openai.com/docs/overview
- Load when: OpenAI API calls, model IDs, tool use, function calling, rate limits, responses API
<!-- setup-agents:block:end id="codex-profile-qa" -->
