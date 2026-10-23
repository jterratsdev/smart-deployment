---
name: prompt-registry
description: >-
  Maintain prompt provenance when .generated-prompts/registry.jsonl exists.
  Read only register views that exist; never claim coverage for arbitrary files.
  USE FOR: generated prompts, prompt history,
  prompt register, artifact traceability, prompt registry, generated apex,
  generated lwc, generated flow, generated component, vibe coding history,
  prompt persistence, ai prompt log. Active for Developer, Architect, SA,
  UX, PM, Release Manager, MuleSoft, QA, OmniStudio, CRMA, Data Cloud profiles.
---

# Prompt Registry

## Overview

`.generated-prompts/registry.jsonl` is the canonical typed provenance store.
The Markdown files beside it are human-maintained views and may not exist for every
artifact type. A missing view means that artifact type is not configured, not covered.

## Register file reference

| Artifact                 | View             |
| ------------------------ | ---------------- |
| Apex                     | `apex.md`        |
| Lightning Web Components | `lwc.md`         |
| Flows                    | `flows.md`       |
| Triggers                 | `triggers.md`    |
| Visualforce              | `visualforce.md` |
| Aura                     | `aura.md`        |
| Metadata                 | `metadata.md`    |
| Diagrams                 | `diagrams.md`    |
| Documentation            | `docs.md`        |
| CI/CD                    | `cicd.md`        |
| Tests                    | `tests.md`       |

## Before creating any artifact (MANDATORY)

1. Check whether `.generated-prompts/registry.jsonl` and the applicable Markdown view exist.
2. If it exists, read the **entire file** before generating the artifact.
3. Use existing entries to infer:
   - Naming conventions in use
   - Data layer strategy (dynamic queries utility, selector layer, inline SOQL, etc.)
   - Patterns already established (trigger handler style, flow sub-flow depth, etc.)
   - Sharing model decisions
   - Any project-specific constraints recorded in prior prompts
4. Generate the new artifact **consistent with those conventions**.

## After creating or substantially changing an artifact (MANDATORY)

1. If no corresponding Markdown view exists, do not create one or claim registry coverage.
2. Open the existing corresponding `.generated-prompts/<type>.md`.
3. Search for an existing `## <ComponentName>` heading.
4. **No existing entry** → append a new entry at the bottom of the file.
5. **Entry exists** → update in place: increment **Iterations**, update **Updated**, replace **Prompt** with the refined prompt.
6. Never edit `registry.jsonl` by hand. Product-owned generators register their own outputs.

## What counts as a substantial change

| Counts                                    | Does NOT count            |
| ----------------------------------------- | ------------------------- |
| New method or responsibility              | Typo fix                  |
| New business requirement                  | Formatting change         |
| Pattern change (e.g. @future → Queueable) | Single-line correction    |
| Architectural refactor                    | Test assertion adjustment |
| New integration or dependency             | Comment update            |

## Entry format

```markdown
## <ComponentName>

- **Created:** YYYY-MM-DD
- **Updated:** YYYY-MM-DD ← omit if never updated
- **Iterations:** N ← increment on each substantial change

### Key decisions

- <Pattern / constraint / design choice that shaped the component>

### Prompt

\`\`\`
<the final prompt, summarized to key decisions if over 500 words>
\`\`\`

---
```
