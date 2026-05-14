---
name: diagram-export
description: >-
  Design, validate, and export Mermaid diagrams following Salesforce Architect standards.
  Supports Lucidchart (via MCP OAuth), draw.io, and local SVG/PDF rendering.
  Validates Mermaid syntax before every export. USE FOR: export diagram, push to lucid,
  lucidchart diagram, drawio export, draw.io, visio, diagram export, diagram sync,
  render diagram, mermaid to pdf, mermaid to svg, salesforce architecture diagram,
  solution diagram, system landscape, capability map, data model, roadmap diagram,
  salesforce architect standard, lucid ai prompt. Reusable by BA, PM, and Architect profiles.
---

# Diagram Export

## Prerequisites

| Tool                         | Check                                     | Install                                  |
| ---------------------------- | ----------------------------------------- | ---------------------------------------- |
| Node.js >= 18                | `node --version`                          | [https://nodejs.org](https://nodejs.org) |
| npx                          | `npx --version`                           | Included with Node.js                    |
| mermaid-to-drawio (optional) | `command -v mermaid-to-drawio`            | `npm install -g mermaid-to-drawio`       |
| Lucid MCP (for lucid target) | Configured via Setup Agents UI OAuth flow | See Lucidchart section below             |

> mermaid-cli is auto-downloaded via `npx -y @mermaid-js/mermaid-cli`. No manual install needed.

---

## CRITICAL: Mermaid Syntax Validation

**Always validate Mermaid syntax before exporting or embedding in any document.**
The validator is the rendering engine itself — run it explicitly:

```bash
# Lint a .mmd file — exit 0 = valid, exit non-zero = syntax error
npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o /tmp/lint-check.svg
echo "Exit code: $?"
```

**Guardrails (MANDATORY):**

1. **Before exporting:** always run the validator above. Never skip.
2. **After AI generation:** treat every generated diagram as untrusted until validated.
3. **When embedding in Markdown:** validate the fenced block contents, not just the text.
4. **On parse error:** read the error message carefully — it includes the exact line and
   character. Fix that specific location, then re-validate. Do NOT guess-fix blindly.
5. **Never suppress errors** with fallback to a simpler diagram without telling the user.

### Common Mermaid Errors and Fixes

| Error Pattern              | Cause                                     | Fix                                                                            |
| -------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------ | --- | ------------------------------ |
| `Parse error on line N`    | Syntax mistake at that line               | Read the `^` pointer, fix that token                                           |
| `No diagram detected`      | Missing or wrong diagram type declaration | Add `graph TD` / `sequenceDiagram` on line 1                                   |
| `UnknownDiagramError`      | Unsupported diagram type                  | Check supported types at [mermaid.js.org/intro](https://mermaid.js.org/intro/) |
| `Duplicate node id`        | Same node id defined twice                | Rename one node                                                                |
| Edge label without content | `A -->                                    |                                                                                | B`  | Fill the label or remove pipes |

---

## Salesforce Architect Diagram Standards

Before generating any architecture diagram, consult the official Salesforce Architect
reference to choose the correct diagram type for the domain and audience.

### Reference Documentation (READ BEFORE DESIGNING)

| Resource                                                                                                                             | Purpose                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| [Diagram Gallery](https://architect.salesforce.com/diagrams)                                                                         | Browse real-world Salesforce architecture diagram examples |
| [Introduction](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/introduction)                                | When to use each diagram type                              |
| [Kit of Parts](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/kit-of-parts.html)                           | Official shape vocabulary and notation                     |
| [Data Model Notation](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/data-model-notation.html)             | ERD conventions for Salesforce objects                     |
| [Capability Map](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-capability-map.html)               | Business capabilities by domain                            |
| [Solution Architecture](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-solution-architecture.html) | Integration, component, and deployment views               |
| [System Landscape](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-system-landscape.html)           | Cross-system context and boundaries                        |
| [Roadmap](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-roadmap.html)                             | Phased delivery and release planning                       |

### Diagram Type Decision Matrix

| User Request                      | Standard Diagram Type | Mermaid Type                        |
| --------------------------------- | --------------------- | ----------------------------------- |
| "Show how systems connect"        | System Landscape      | `graph LR`                          |
| "Show the data model / objects"   | Data Model            | `erDiagram`                         |
| "Show what the system does"       | Capability Map        | `mindmap` or `graph TD`             |
| "Show how components integrate"   | Solution Architecture | `graph LR` with swimlanes           |
| "Show the delivery plan / phases" | Roadmap               | `gantt` or `timeline`               |
| "Show a process / user flow"      | Sequence / Flow       | `sequenceDiagram` or `flowchart TD` |
| "Show states / lifecycle"         | State Machine         | `stateDiagram-v2`                   |

**Agent rule:** Always ask "What is the audience and purpose?" before picking a diagram type.
A developer needs a sequence diagram; a CIO needs a system landscape. Same domain, different diagram.

### Salesforce Kit of Parts — Shape Mapping to Mermaid

The official Kit of Parts uses specific shapes. Map them to Mermaid nodes:

| Salesforce Shape       | Mermaid Syntax    | Use for                           |
| ---------------------- | ----------------- | --------------------------------- |
| Cloud (Salesforce org) | `A[(Org Name)]`   | Salesforce orgs, Experience Cloud |
| Rectangle (System)     | `A[System Name]`  | External systems, apps            |
| Rounded rect (Process) | `A(Process Name)` | Flows, processes, actions         |
| Diamond (Decision)     | `A{Decision?}`    | Branch logic                      |
| Stadium (Data Store)   | `A([Data Store])` | Databases, files, queues          |
| Person icon            | `A(((User)))`     | Personas, users, actors           |

---

## Lucidchart Integration

### Option A: Lucid MCP Server (Recommended)

If the Lucid MCP integration is configured (authenticated via Setup Agents UI),
the agent can create and manage Lucidchart documents directly.

**MANDATORY — Schema-first workflow (always follow this order):**

1. **Inspect the schema** — call `tools/list` on the Lucid MCP and locate the
   `create_document` tool definition. Read the input schema carefully:
   field names, required fields, nested structures, and accepted value types.
   Never assume field names — derive them from the live schema every time.

2. **Build the full payload in memory** — using the schema from step 1, construct
   a single JSON object that represents the complete diagram:

   - All pages (if multi-page — see below)
   - All shapes, groups, swim lanes, and color bands
   - All connections and their labels
   - Layout hints (`use_assisted_layout: true` if the schema exposes it)
     Apply Salesforce design token constraints (see Lucid Diagram Standards in your profile rules)
     while building: colors, notation, and typography go into the payload fields, not as
     post-creation edits.

3. **Call `create_document` once** with the complete payload from step 2.
   Never create shapes individually and connect them in separate calls.

4. **Verify the result explicitly** — check the response for errors.
   Throttle errors from the Lucid MCP can be silent; always inspect the response body.

**Multi-page diagrams:**

If the diagram requires multiple pages (e.g., System Landscape + Data Model + Sequence),
represent all pages in the single payload built in step 2.
Check the `create_document` schema for the pages/tabs array structure before building.
Never call `create_document` once per page — that produces separate unlinked documents.

**Check MCP availability:**

```bash
# In Cursor/Claude Code, list available MCP tools
# Look for: lucid__create_document, lucid__search_documents
```

### Generate a Lucid AI Prompt (MCP not available)

When the MCP is not available, generate a structured prompt for the Lucidchart AI assistant:

```text
Create a [DIAGRAM_TYPE] diagram for a Salesforce [DOMAIN] implementation.

Use the Salesforce Shape Library (Lucidchart has this built-in — enable it from
the shape panel on the left). Apply these conventions:
- Salesforce orgs: cloud shapes
- External systems: rectangles with a top-color band
- Integrations: labeled arrows with protocol (REST/SOAP/Event)
- Color coding: Salesforce blue (#1798c1) for SF components, grey (#6b7280) for external

Components to include:
[PASTE YOUR MERMAID DIAGRAM OR COMPONENT LIST HERE]

Layout: [left-to-right / top-to-bottom]
Audience: [technical / executive]
```

**How to use:**

1. Open Lucidchart → New Document → blank canvas
2. Click the AI panel (sparkle icon) → "Generate diagram"
3. Paste the prompt above with the actual diagram content filled in
4. Lucid AI creates an editable diagram using the Salesforce Shape Library

### Salesforce Shape Library in Lucidchart

Lucidchart includes the official Salesforce shape library:

1. Open any Lucidchart document
2. Shape panel (left) → **"Search shapes"** → type "Salesforce"
3. Click **"Use shape library"** → enables all official Salesforce icons and components

Available shape sets: Salesforce Core Objects, Experience Cloud, Marketing Cloud,
AppExchange logos, and standard system/integration shapes from the Kit of Parts.

### Script-Based Export (Fallback)

```bash
# Auto-detect target (checks LUCID_ACCESS_TOKEN, falls back to drawio, then local)
bash .setup-agents/skills/diagram-export/scripts/export-diagram.sh diagram.mmd

# Explicit targets
bash .setup-agents/skills/diagram-export/scripts/export-diagram.sh diagram.mmd --target lucid --title "Solution Architecture"
bash .setup-agents/skills/diagram-export/scripts/export-diagram.sh diagram.mmd --target drawio
bash .setup-agents/skills/diagram-export/scripts/export-diagram.sh diagram.mmd --target local --format pdf
```

---

## Target: draw.io

Generates a `.drawio` file that opens in [draw.io Desktop](https://www.drawio.com/) or [diagrams.net](https://app.diagrams.net).
No authentication required.

```bash
# Install converter for higher fidelity (optional)
npm install -g mermaid-to-drawio
```

---

## Target: Local SVG / PDF

```bash
# SVG output (validates syntax as a side effect)
npx -y @mermaid-js/mermaid-cli -i diagram.mmd -o diagram.svg

# PDF output
bash .setup-agents/skills/story-mapping/scripts/render-pdf.sh diagram.mmd diagram.pdf
```

---

## Token-Efficient Visual Editing (CRITICAL)

When generating or updating diagrams, **always push to the user's visual tool** instead of iterating via chat.

- **DO:** Generate → validate → export → tell user: _"I've pushed to [tool]. Adjust layout, colors, and positions there."_
- **DO NOT:** Accept "move this box right" or "change color of X" via chat. Redirect to the tool.
- **Exception:** Structural changes (add/remove nodes, rename, change relationships) are valid agent tasks.

If no tool is configured, suggest [Mermaid Live Editor](https://mermaid.live) as a free instant preview.
