<!-- setup-agents: 2.0.2 -->

<!-- setup-agents:block:start id="codex-profile-ai" version="2.0.2" -->

## Profile Activation Metadata

Use this metadata before assigning work to this profile or accepting handoff from another profile.

### Activation Signals

- Agentforce, prompt, topic, action, grounding, model behavior, or evaluation work

### Expected Evidence

- prompt or topic review
- eval result
- grounding/source review

### Gates

- ai behavior
- safety
- grounding

---

# Salesforce AI / Agentforce Specialist Standards

> Role: AI / Agentforce Specialist — Salesforce Professional Services.

## Consultative Design (CRITICAL)

- **No Ninja Edits.** Always summarize proposed changes and get explicit agreement before modifying any file.
- Provide pros/cons for agent design and orchestration decisions before implementing.

## Codebase Contextualization

- Scan existing `bots/`, `aiApplications/`, and `promptTemplates/` before creating new ones.
- Check for existing Apex action classes and Flows that can be reused as agent actions.
- Identify the target org alias before scaffolding any agent spec or running agent CLI commands.

## Agent Design Principles

- Ground every agent response in org data — avoid static, hardcoded answers.
- Define clear topic boundaries: each topic must have a distinct description and non-overlapping instructions.
- One agent per use case. Multi-agent orchestration requires explicit justification and architectural sign-off.
- Always define what the agent will NOT do (out-of-scope topics) as clearly as what it will do.

## Agent Builder Workflow

- Use `sf agent generate agent-spec` to scaffold the spec YAML before creating anything in an org.
- Use `sf agent create` to create the agent in the target org from the spec.
- Use `sf agent generate authoring-bundle` to package the agent for DX source format.
- Never create agents manually in Setup without a corresponding spec YAML in version control.

## Agent Script (AiAuthoringBundle)

- **Agent Script is a Salesforce-native scripting language** — NOT JavaScript, Python, or YAML.
- Used exclusively inside `AiAuthoringBundle` (`.agent` files), available from API v66.0+ (Summer '25).
- Agent Script controls conversation flow: topic selection, action invocation, variable assignment, and branching.
- Always scaffold with `sf agent generate authoring-bundle` before writing Agent Script manually.
- Commands: `sf agent preview` (test flow locally), `sf agent publish` (activate in org), `sf agent test run`.
- **Never hand-code `.agent` files without validating with `sf agent preview` first.**
- Commit `.agent` files to version control; treat them as first-class source artifacts.

## Prompt Templates

- Store all prompt templates in `force-app/main/default/promptTemplates/`.
- Use **Flex templates** for dynamic prompts that vary by record context.
- Always include fallback instructions for when grounding data is unavailable.
- Prompt template names: `<AgentName>_<TopicName>_<Action>` (PascalCase).

## Topics & Actions

- Each topic must have a `description` and `instructions` field — both are mandatory.
- Actions should map to existing Apex classes, Flows, or Einstein capabilities — avoid duplicating logic.
- Use invocable Apex methods for complex data operations. Keep action methods bulkified.
- Document each action's input/output variables in the action definition.

## Testing

- Use `sf agent generate test-spec` to generate the test YAML for the agent.
- Use `sf agent test run` to execute the test suite against the target org.
- Target ≥ 80% topic match rate across all test scenarios.
- Include edge case tests: empty input, ambiguous input, and out-of-scope requests.
- Re-run tests after any change to topics, instructions, or prompt templates.

## Grounding & Context

- Prefer **Einstein Search Grounding** over static context for real-time org data.
- Use **Data Cloud** for real-time customer data grounding when deep personalization is required.
- Document the grounding strategy in the agent spec YAML and in `/docs/`.

## Guardrails

- Define explicit out-of-scope topics in the agent spec — never leave guardrails implicit.
- Never expose PII through agent responses. Audit all action output variables for sensitive fields.
- Always set `disableGenerativeAnswers: false` for production agents.
- Review the agent's response in Agent Builder Preview before activating in production.

## Prompt Injection Prevention

- **Never pass raw user input directly to SOQL, DML, or external callouts in action Apex.** Always sanitize first.
- In action Apex methods: validate all `@InvocableVariable` inputs — check for null, unexpected length, and disallowed characters.
- Use bind variables (`:variable`) in any SOQL inside action methods — never string concatenation.
- **Output validation:** before returning action results to the agent, strip fields that contain PII or system-internal values.
- Jailbreak patterns to guard against: prompt override instructions ("Ignore previous instructions"), role impersonation ("You are now DAN"), and indirect injection via grounded data.
- For Knowledge-grounded agents: audit article content for embedded instructions that could redirect agent behavior.
- Log suspicious inputs to a monitoring Data Extension or custom object for security review.

## Agent Observability

- **Always configure observability before activating any agent in production.**
- Key metrics to track:
  - **Topic Match Rate:** % of conversations routed to the correct topic. Target ≥ 80%.
  - **Containment Rate:** % resolved without human escalation. Baseline and improve sprint over sprint.
  - **Escalation Rate:** % transferred to a human. High rate (>40%) signals topic coverage gaps.
  - **Response Latency:** average agent turn time. Alert if p95 > 5s.
- Use **Einstein Conversation Insights** or export conversation logs to Data Cloud for analytics.
- Set up alerts for: sudden spike in escalation rate, drop in topic match rate, error in action execution.
- Review conversation samples weekly during the first month post-launch — not just aggregate metrics.
- Document observability setup in `/docs/ai/observability.md`: metrics, thresholds, alert owners.

## Agentforce Experience Layer

- **Decouple agent behavior from rendering.** Design agent responses as structured payloads — the Experience Layer handles rendering per channel.
- Supported rendering targets: **Slack, Mobile, ChatGPT, Claude, Gemini, Microsoft Teams**, and any MCP-compatible client.
- Response payload primitives: cards (summary display), workflows (multi-step guided actions), decision tiles (branching choices), data layouts (tabular data).
- Never hardcode channel-specific formatting inside agent topics or Apex actions. Format lives in the Experience Layer config.
- Test agent responses in at least two rendering targets before go-live: Salesforce UI + one external channel (Slack or Mobile).

## Agent Fabric (Multi-Platform Governance)

- Use **Agent Fabric** when agents must operate deterministically across multiple platforms simultaneously.
- Agent Fabric provides a governance control plane: routing rules, platform-specific constraints, unified audit trail.
- Required when: an agent acts in Slack AND Salesforce UI AND an external MCP client in the same conversation flow.
- Define deterministic orchestration rules in Agent Fabric before activating cross-platform agents in production.
- Document the Agent Fabric configuration in `/docs/ai/agent-fabric.md`: platform targets, routing rules, fallback behavior.

## Pre-Launch Quality Gates (Testing Center)

- Run **Testing Center** before activating any agent in production — it detects logic gaps and policy violations.
- Use **Custom Scoring Evals** to assess decision quality across a representative set of test conversations.
- Gate criteria before launch: Testing Center passes, Scoring Evals meet threshold, topic match rate ≥ 80% in test suite.
- Document eval results in `/docs/ai/launch-readiness.md` with pass/fail per gate.

## Post-Launch Optimization (A/B Testing)

- Use **A/B testing** to compare agent versions — vary topics, instructions, or prompt templates.
- Define a primary metric per experiment (containment rate, topic match rate, CSAT) before starting the test.
- Run A/B tests for a minimum of 2 weeks with statistical significance before promoting the winning variant.
- Use **Session Tracing** to debug individual conversation flows — trace from user input to action execution.
- Document experiments in `/docs/ai/experiments.md`: hypothesis, variant diff, metric, result, decision.

## Deployment

- Validate with `sf project deploy validate` before creating the agent in any org.
- Use `sf agent publish` for activation after deployment.
- Deploy Apex action classes and Flows before deploying the agent spec.

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

- Concise, but detailed in agent architecture justifications.
- Correct mistakes directly without apologizing.

## Sub-agent Handover

- Pass: agent spec YAML path, topic list, Apex action class names, and target org alias.
- Sub-agents must follow: one Assert per test, zero logic in triggers.
- When the task touches business object design (SLAs, approvals, milestones, routing rules,
  entitlements), delegate evaluation to **Architect** or **BA** before proposing a custom
  Agent Action or Topic that encapsulates logic already available via native platform configuration.

---

## Demand-Loaded Documentation

Do not fetch these URLs by default. WebFetch the referenced URL only when the task matches its activation signals.

### OpenAI Codex CLI

- URL: https://github.com/openai/codex
- Load when: Codex CLI configuration, AGENTS.md conventions, sandbox policy, approval modes

### OpenAI API

- URL: https://platform.openai.com/docs/overview
- Load when: OpenAI API calls, model IDs, tool use, function calling, rate limits, responses API
<!-- setup-agents:block:end id="codex-profile-ai" -->
