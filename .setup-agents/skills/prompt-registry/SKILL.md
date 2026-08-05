---
name: prompt-registry
description: >-
  Maintain the .generated-prompts/ register: read before creating any artifact
  to infer project conventions, write/update after creation. Keeps the latest
  prompt that produced each component so the team can trace every generated
  artifact back to its origin. USE FOR: generated prompts, prompt history,
  prompt register, artifact traceability, prompt registry, generated apex,
  generated lwc, generated flow, generated component, vibe coding history,
  prompt persistence, ai prompt log. Active for Developer, Architect, Admin,
  BA, UX, PM, DevOps, MuleSoft, QA, OmniStudio, CRMA, Data Cloud, Security profiles.
---

# Prompt Registry

## Overview

`.generated-prompts/` is a commit-tracked directory at the repo root.
Each file registers the AI prompts that created or substantially changed
artifacts of a given type. One entry per component. Latest prompt only.
The git history holds the version trail.

## Before creating any artifact (MANDATORY)

1. Check if `.generated-prompts/<type>.md` exists.
2. If it exists, read the **entire file** before generating the artifact.
3. Use existing entries to infer:
   - Naming conventions in use
   - Data layer strategy (dynamic queries utility, selector layer, inline SOQL, etc.)
   - Patterns already established (trigger handler style, flow sub-flow depth, etc.)
   - Sharing model decisions
   - Any project-specific constraints recorded in prior prompts
4. Generate the new artifact **consistent with those conventions**.

## After creating or substantially changing an artifact (MANDATORY)

1. Open the corresponding `.generated-prompts/<type>.md`.
2. Search for an existing `## <ComponentName>` heading.
3. **No existing entry** → append a new entry at the bottom of the file.
4. **Entry exists** → update in place: increment **Iterations**, update **Updated**, replace **Prompt** with the refined prompt.
5. Never stack multiple versions. Only the latest prompt lives in the file.

## What counts as a substantial change

| Counts | Does NOT count |
|--------|---------------|
| New method or responsibility | Typo fix |
| New business requirement | Formatting change |
| Pattern change (e.g. @future → Queueable) | Single-line correction |
| Architectural refactor | Test assertion adjustment |
| New integration or dependency | Comment update |

## Register file reference

| File | Artifacts covered | Active profiles |
|------|------------------|-----------------|
| `apex.md` | Apex classes (.cls) | developer, architect |
| `lwc.md` | LWC (.js / .html / .js-meta.xml) | developer, ux |
| `flows.md` | Flows (.flow-meta.xml) | developer, admin, ba |
| `triggers.md` | Apex triggers + handlers (.trigger) | developer |
| `visualforce.md` | Visualforce pages and components | developer |
| `aura.md` | Aura components (.cmp / .app) | developer |
| `omnistudio.md` | OmniScripts, FlexCards, Integration Procedures | omnistudio |
| `metadata.md` | CustomObjects, CustomFields, ValidationRules, PermissionSets, CMDT, Platform Events, FlexiPages, NamedCredentials | developer, architect, admin, security |
| `diagrams.md` | Architecture diagrams (Mermaid / Lucid / draw.io) | architect, ba, ux, pm |
| `cicd.md` | Pipeline YAML, deployment scripts, GitHub Actions, Azure Pipelines | devops, mulesoft |
| `docs.md` | Generated documentation (ADRs, runbooks, data models, user guides) | architect, ba, ux, pm, devops, mulesoft, crma, data360, security |
| `tests.md` | Test plans, Playwright specs, Apex test classes | qa |

## Entry format

```markdown
## <ComponentName>
- **Created:** YYYY-MM-DD
- **Updated:** YYYY-MM-DD   ← omit if never updated
- **Iterations:** N          ← increment on each substantial change

### Key decisions
- <Pattern / constraint / design choice that shaped the component>

### Prompt
\`\`\`
<the final prompt, summarized to key decisions if over 500 words>
\`\`\`
---
```
