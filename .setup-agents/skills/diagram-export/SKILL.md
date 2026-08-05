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

| Tool | Check | Install |
|------|-------|---------|
| Node.js >= 18 | `node --version` | [https://nodejs.org](https://nodejs.org) |
| npx | `npx --version` | Included with Node.js |
| mermaid-to-drawio (optional) | `command -v mermaid-to-drawio` | `npm install -g mermaid-to-drawio` |
| Lucid MCP (for lucid target) | Configured via Setup Agents UI OAuth flow | See Lucidchart section below |

> mermaid-cli is auto-downloaded via `npx -y @mermaid-js/mermaid-cli`. No manual install needed.

---

## First-party rendering (prefer this in an IDE conversation)

When the diagram model exists as `AgentDiagramData` JSON, render it with the built-in
command instead of hand-rolling `mermaid-cli` — it applies the ER/architecture layout and
connector routing and emits a standalone SVG/PDF the IDE can open directly:

```bash
# Build the model from real sources first (force-app metadata, an existing .drawio/.mmd/.md)
sf setup-agents diagram import -i force-app --from force-app --out model.json
# Render to a standalone SVG (or pdf) — no browser, no external service
sf setup-agents diagram render -i model.json -f svg -o diagram.svg
```

- Runs headless (no bridge, no web-console) — it is a plain CLI command the agent invokes
  during the conversation; the IDE (VS Code / Cursor) previews the resulting SVG/PDF natively.
- `-f`/`--format` accepts `mermaid | drawio | maxgraph-json | svg | pdf`.
- Use `mermaid-cli` (below) only for ad-hoc `.mmd` linting/preview when there is no
  `AgentDiagramData` model.

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

---

## Diagram Fidelity Classification (CRITICAL)

Classify every diagram task before drawing:

| Class | Meaning | Authoritative target |
|-------|---------|----------------------|
| `semantic` | Explain the idea, relationships, or architecture for review | Mermaid is usually enough |
| `inspired-by-reference` | Borrow structure or style from a source, without exact fidelity | Mermaid, draw.io, or Lucid |
| `recreation` | Reproduce a source PDF, image, Lucid, draw.io, or screenshot | draw.io XML / Lucid / measured SVG |

**Rules:**
- For `recreation`, acceptance is pixel-perfect source fidelity unless the user explicitly accepts an approximation.
- Structural similarity is not enough for a recreation.
- Mermaid is a semantic diagram target; do not present Mermaid as a pixel-perfect recreation when exact layout, connector anchors, icons, rotations, or styling matter.
- Escalate to draw.io XML or Lucid when exact geometry, connector bend points, line jumps, or manual label placement are acceptance criteria.
- For source-free diagrams, define a diagram contract before drawing: purpose, audience, nodes, groups, relationships, labels, reading flow, and expected connector endpoints.

### Post-Render Visual QA

After rendering, inspect the actual SVG/PDF/PNG output before handoff:

- Text fits inside every container.
- Containers are sized and balanced after real labels are placed.
- Connector endpoints visibly leave the intended source edge and land on the intended target edge.
- Arrowheads are visible and not hidden behind shapes.
- Lines do not cross labels, important symbols, or containers unless the source explicitly requires it.
- Labels have clearance from borders, connectors, and arrowheads.
- Whitespace is intentional and does not make the layout look broken.
- Editable source and rendered output are equivalent; do not make SVG-only fixes that cannot be regenerated.

Record residual fidelity gaps when the output is an approximation.

### Common Mermaid Errors and Fixes

| Error Pattern | Cause | Fix |
|--------------|-------|-----|
| `Parse error on line N` | Syntax mistake at that line | Read the `^` pointer, fix that token |
| `No diagram detected` | Missing or wrong diagram type declaration | Add `graph TD` / `sequenceDiagram` on line 1 |
| `UnknownDiagramError` | Unsupported diagram type | Check supported types at [mermaid.js.org/intro](https://mermaid.js.org/intro/) |
| `Duplicate node id` | Same node id defined twice | Rename one node |
| Edge label without content | `A -->|  | B` | Fill the label or remove pipes |

---

## Salesforce Architect Diagram Standards

Before generating any architecture diagram, consult the official Salesforce Architect
reference to choose the correct diagram type for the domain and audience.

### Reference Documentation (READ BEFORE DESIGNING)

| Resource | Purpose |
|----------|---------|
| [Diagram Gallery](https://architect.salesforce.com/diagrams) | Browse real-world Salesforce architecture diagram examples |
| [Introduction](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/introduction) | When to use each diagram type |
| [Kit of Parts](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/kit-of-parts.html) | Official shape vocabulary and notation |
| [Data Model Notation](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/data-model-notation.html) | ERD conventions for Salesforce objects |
| [Capability Map](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-capability-map.html) | Business capabilities by domain |
| [Solution Architecture](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-solution-architecture.html) | Integration, component, and deployment views |
| [System Landscape](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-system-landscape.html) | Cross-system context and boundaries |
| [Roadmap](https://architect.salesforce.com/docs/architect/reference-diagrams/guide/section-roadmap.html) | Phased delivery and release planning |

### Diagram Type Decision Matrix

| User Request | Standard Diagram Type | Mermaid Type |
|-------------|----------------------|--------------|
| "Show how systems connect" | System Landscape | `graph LR` |
| "Show the data model / objects" | Data Model | `erDiagram` |
| "Show what the system does" | Capability Map | `mindmap` or `graph TD` |
| "Show how components integrate" | Solution Architecture | `graph LR` with swimlanes |
| "Show the delivery plan / phases" | Roadmap | `gantt` or `timeline` |
| "Show a process / user flow" | Sequence / Flow | `sequenceDiagram` or `flowchart TD` |
| "Show states / lifecycle" | State Machine | `stateDiagram-v2` |

**Agent rule:** Always ask "What is the audience and purpose?" before picking a diagram type.
A developer needs a sequence diagram; a CIO needs a system landscape. Same domain, different diagram.

### Salesforce Kit of Parts — Shape Mapping to Mermaid

The official Kit of Parts uses specific shapes. Map them to Mermaid nodes:

| Salesforce Shape | Mermaid Syntax | Use for |
|-----------------|----------------|---------|
| Cloud (Salesforce org) | `A[(Org Name)]` | Salesforce orgs, Experience Cloud |
| Rectangle (System) | `A[System Name]` | External systems, apps |
| Rounded rect (Process) | `A(Process Name)` | Flows, processes, actions |
| Diamond (Decision) | `A{Decision?}` | Branch logic |
| Stadium (Data Store) | `A([Data Store])` | Databases, files, queues |
| Person icon | `A(((User)))` | Personas, users, actors |

---

## Shape Catalog & Theme References

Before generating any Lucid diagram, load these project references:

1. **Shape Catalog** — `.setup-agents/references/lucid-shape-catalog.md`
   Contains: shape class → Salesforce product mapping, swimlane role archetypes,
   flow phase patterns, connector patterns, architecture diagram patterns,
   Standard Import format mapping (export class → import type).

2. **Color Theme** — resolve in this order:
   - `.setup-agents/diagram-theme.json` (project override — if exists, use it)
   - `.setup-agents/references/diagram-theme.defaults.json` (Salesforce Architect defaults)

   Apply resolved palette values to shape `style.fill`, `style.stroke`, line `stroke.color`,
   and swimlane `headerFill`/`laneFill` properties.

3. **Standard Import Spec** — if cached at `.setup-agents/references/lucid-standard-import-spec.md`,
   read it for type registry, container rules, and endpoint formats.

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
   - **Shape selection:** use `.setup-agents/references/lucid-shape-catalog.md` to pick
     the correct shape type/class for each Salesforce product or flow element.
   - **Colors:** read the resolved theme (project override or defaults) and apply palette
     values — never hardcode hex colors directly.
   Apply Salesforce design token constraints (see Lucid Diagram Standards in your profile rules)
   while building: colors, notation, and typography go into the payload fields, not as
   post-creation edits.

3. **Generate SVG preview** — before calling Lucid, render a local SVG for user approval:
   - Convert the payload structure to a Mermaid flowchart (semantic approximation)
   - Render with: `npx -y @mermaid-js/mermaid-cli -i preview.mmd -o preview.svg`
   - Show the SVG to the user and ask for confirmation before proceeding
   - If the user requests changes, iterate on the payload and re-render the preview
   - Only proceed to step 4 after explicit user approval

   The preview is a semantic approximation — it will not match Lucid pixel-for-pixel,
   but it validates structure, node count, labels, connections, and flow direction.

4. **Call `create_document` once** with the approved payload from step 3.
   Never create shapes individually and connect them in separate calls.

5. **Verify the result explicitly** — check the response for errors.
   Throttle errors from the Lucid MCP can be silent; always inspect the response body.

6. **Run the post-write validation cycle (MANDATORY)** — see below.

**Post-Write Validation Cycle (MANDATORY after every batch of write operations):**

After any `lucid_add_block`, `lucid_add_line`, `lucid_edit_item`, or `lucid_delete_items` call:

1. Re-fetch the affected page items with a fresh `lucid_get_document` or item-list call.

2. Run these assertions against the fetched data:

   | Check | Rule | Auto-fix |
   |-------|------|----------|
   | **Duplicate detection** | No two items with the same text placed within 200px of each other | Delete the later duplicate |
   | **Icon-text gap** | Every icon/label pair has a gap >= 10px (no overlap) | Reposition label +20px from icon edge |
   | **Bounds check** | All labels fit within their container/column width | Truncate or widen container |
   | **Phantom text** | No items whose text matches known fallback patterns (see list below) | Delete or reclassify the element |
   | **Orphan check** | No items with empty text that should have content | Prompt user or delete |

   Known phantom text patterns:
   - `"aws-general-*"` — AWS shape class not fully resolved
   - `"plugin-flowchart-shape-*"` — Lucid plugin shape fallback
   - `"Type something"` — unfilled text placeholder
   - `"AdvancedSwimLaneBlock"` — invisible swim lane container rendered as text

3. Export a PNG snapshot after validation:

```bash
# Visual verification artifact — attach to evidence if workflow is active
# lucid_export_document_as_PNG(document_id, page_index)
```

4. If all assertions pass: proceed silently.
   If any assertion fails: auto-fix what is possible, re-export, and report remaining issues to the user.
   Never mark a diagram task complete without a passing validation cycle.

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

### Canonical path: `sf setup-agents diagram render` (PREFERRED)

The plugin ships a deterministic renderer exposed as a CLI command. **Prefer this over
writing a one-off `build-*.cjs` script or the legacy `export-diagram.sh --target drawio` wrapper.**
Produce an `AgentDiagramData` JSON document, then render it:

```bash
# Render to draw.io XML (orthogonal routing, row-level ERD connections, dagre layout)
sf setup-agents diagram render --input data.json --format drawio --out docs/architecture/diagram.drawio

# Render to Mermaid (prints to stdout when --out is omitted)
sf setup-agents diagram render --input data.json --format mermaid

# Render to maxGraph JSON
sf setup-agents diagram render --input data.json --format maxgraph-json --out diagram.json
```

**AgentDiagramData shape** (the JSON you produce — do NOT hand-roll a converter script):

```jsonc
{
  "type": "flowchart",        // flowchart | sequence | class | er | architecture
  "title": "My Diagram",      // optional
  "direction": "TB",          // optional: TB | BT | LR | RL
  "nodes": [
    { "id": "a", "label": "Node A", "shape": "rounded", "group": "core", "style": "..." }
  ],
  "edges": [
    { "from": "a", "to": "b", "label": "calls", "style": "solid", "arrowhead": "normal" },
    { "from": "a", "to": "b", "cardinality": "1:N" }   // er only: explicit crow-feet
  ]
  // sequence diagrams also use: "participants": [...], "messages": [{ from, to, label, type }]
}
```

For ERDs, encode PK/FK rows in the node `label` as newline-separated lines prefixed with `PK ` / `FK `; the drawio renderer builds table shapes and routes FK connections automatically.

**Object-names-only (conceptual) ERD.** When you know the OBJECTS and how they relate but not the fields, give each node just a `label` (no PK/FK lines) and set an explicit `cardinality` on each edge — one of `1:1 | 1:N | N:1 | N:M | 0:1 | 0:N` (read source→target). The explicit value drives the crow's-feet directly and OVERRIDES the label/style/group heuristics, so the diagram is predictable without FK-row matching:

```jsonc
{
  "type": "er",
  "nodes": [{ "id": "Account", "label": "Account" }, { "id": "Contact", "label": "Contact" }],
  "edges": [{ "from": "Account", "to": "Contact", "cardinality": "1:N" }]
}
```
After rendering an ERD, you may further tune an existing `.drawio` with `sf setup-agents diagram migrate --file <file> --relayout`.

### UML class diagram — `type: "class"`

A class renders as a 3-compartment UML box: the node `label` is newline-separated — line 1 is the class name (optionally a `«stereotype»` prefix or a second `(stereotype)` line), then members. A member whose text contains `(` is a METHOD; otherwise an ATTRIBUTE. Keep visibility prefixes (`+ - # ~`). Set the relationship kind on each edge via `relation` — `inheritance` (hollow triangle), `realization` (hollow triangle, dashed), `composition` (filled diamond), `aggregation` (hollow diamond), `dependency` (dashed open arrow), or `association` (default open arrow).

```jsonc
{
  "type": "class",
  "nodes": [
    { "id": "Account", "label": "Account\n+ name: String\n- id: Id\n+ save(): void" },
    { "id": "Person", "label": "«abstract» Person\n# name: String" }
  ],
  "edges": [{ "from": "Account", "to": "Person", "relation": "inheritance" }]
}
```

### System landscape — `type: "architecture"`

An architecture diagram is a topology-routed box graph with a labeled CONTAINER drawn behind each `group` (system-landscape convention). Give every node a `group` so related systems read together; edges route orthogonally with directional arrowheads, same as flowcharts. Use edge `label` for the protocol/sync mode (e.g. "REST (sync)", "Platform Event (async)").

```jsonc
{
  "type": "architecture",
  "nodes": [
    { "id": "sf", "label": "Salesforce Core", "group": "Core" },
    { "id": "mw", "label": "MuleSoft", "group": "Integration" },
    { "id": "erp", "label": "SAP ERP", "group": "Backend" }
  ],
  "edges": [{ "from": "sf", "to": "mw", "label": "REST (sync)" }, { "from": "mw", "to": "erp" }]
}
```

### Dense ERD layout (groups + hubs) — `type: "er"`

For a large data model, give every node a `group` (its domain — e.g. `core`, `sales`, `service`, `junction`) and the renderer will:

- **Cluster each group into a labeled swim-lane band** (light background + group title), so
  domains read apart instead of intermixing.
- **Push high-degree hubs (>= 5 connections) to the top/bottom edges** of the layout — a hub is a
  normal-sized box that many edges reach, never a giant full-width bar.
- **Distribute connection points** along each table border so arrowheads at a hub do not collide.

A ready-to-render grouped example ships with this skill — render it directly:

```bash
sf setup-agents diagram render \
  --input .setup-agents/skills/diagram-export/examples/erd-grouped.json \
  --format drawio --out docs/architecture/data-model.drawio
```

The example shape (abbreviated — see the file for the full model):

```jsonc
{
  "type": "er",
  "title": "Data Model",
  "direction": "TB",
  "nodes": [
    { "id": "Account", "label": "Account", "group": "core" },       // hub — many edges
    { "id": "Contact", "label": "Contact", "group": "sales" },
    { "id": "Case", "label": "Case", "group": "service" },
    { "id": "AccountContactRelation", "label": "AccountContactRelation", "group": "junction" }
  ],
  "edges": [
    { "from": "Account", "to": "Contact", "label": "has" },
    { "from": "Account", "to": "AccountContactRelation", "label": "tiene" },
    { "from": "Contact", "to": "AccountContactRelation", "label": "en" },
    { "from": "Account", "to": "Case", "label": "casos" }
  ]
}
```

### ER source resolution — where the objects come from

An ERD models OBJECTS (Salesforce sObjects / entities), never fields. Resolve the source of truth in this order:

1. **`force-app/**/objects/*` exists (real org/project)** → the object FOLDERS under `objects/` are your
   nodes. Each `<Name>/` directory (or `<Name>.object-meta.xml`) is ONE entity. The `*.field-meta.xml`
   files inside are that entity's columns — they are NEVER their own nodes.
2. **Cached reference docs (`--fetch-refs`)** → when you model from the Salesforce documentation cache in
   `.setup-agents/references/` (Data Models, object reference, SOQL/SOSL guides), an entry is an OBJECT
   only if the doc describes it as a standard sObject or custom object. Doc tables list a "Fields"
   column / "Field Name" rows PER object — those rows are columns, NOT objects. A heading like
   "Account object" is a node; "AccountSource field" (or any row under that object's Fields section) is
   not. Confirm against the doc's object index, never infer an entity from a field row.
3. **No `force-app` and no doc (greenfield / in design)** → model the ERD from the plan & design, the
   ADR, or `project-knowledge.md`. The objects defined there are the source of truth. Do NOT block on
   the absence of `force-app`.

### Node validation — an object is an OBJECT, not a field (CRITICAL)

Every `node` in an `er` diagram MUST be a real entity (standard sObject, custom object `*__c`, or a
design-defined object). A FIELD of an object must never appear as its own node. This guard exists because
agents have wrongly promoted a field (e.g. `Account.Region__c`, a lookup, a picklist) into a standalone
entity — inflating the ERD with phantom objects and breaking cardinality.

Before rendering, validate EACH proposed node:

- **Standard object?** It must be a real Salesforce sObject (e.g. `Account`, `Contact`, `Case`,
  `Opportunity`, `Territory2`, `User`). If you cannot name it as a standard sObject, it is not one.
- **Custom object?** Its API name ends in `__c` AND it is declared as an object — in
  `force-app/**/objects/<Name>__c/` when force-app exists, or explicitly listed as an object in the
  plan & design. A `__c` API name alone is NOT proof: custom FIELDS also end in `__c`.
- **Field smell test — REJECT as a node when any of these is true:**
  - The name is dotted (`Object.Field__c`) — that is a field reference, model it as an EDGE or a column.
  - It is a lookup / master-detail / hierarchy field (`*__c` on an object that points AT another object)
    — that is a RELATIONSHIP (an `edge`), not an entity.
  - It is a picklist, formula, rollup, checkbox, currency, or text attribute — that is a column.
  - It only ever appears as a property of one object and never owns its own records.
- **Relationships are edges, attributes are labels.** A lookup from A→B is `{ "from": "A", "to": "B" }`,
  not a third node. Key columns (PK/FK) belong inside the entity label (`"Account\nId PK\nName"`),
  never as separate nodes.

If unsure whether a name is an object or a field: when force-app exists, confirm a matching
`objects/<Name>/` folder; when modeling from `--fetch-refs` docs, confirm it appears in the doc's
OBJECT index (not as a row under some object's Fields section); otherwise confirm it is listed as an
object (not a field) in the design doc. When still unsure, ask — do NOT guess a field into an entity.

### Build the model from a source — `sf setup-agents diagram import`

Do NOT hand-transcribe the AgentDiagramData JSON when a source already exists. `diagram import`
builds the model for you, then `diagram render` lays it out — the full generate loop:

```bash
# force-app metadata → ERD model → optimized drawio (no manual JSON authoring)
sf setup-agents diagram import --input force-app --from force-app --out /tmp/model.json
sf setup-agents diagram render --input /tmp/model.json --format drawio --out /tmp/erd.drawio
```

| `--from` | Source | Notes |
|----------|--------|-------|
| `force-app` | a force-app directory | scans `objects/*` → entities; lookups/master-detail → edges; groups by namespace (`core` / `cgcloud` / `custom` / `junction`). Fields are never nodes (see Node validation). |
| `drawio` | a `.drawio` file | re-imports an existing diagram so it re-renders through the optimized layout; ER table rows/field cells stay columns, swimlanes become groups. |
| `mermaid` | a `.mmd` file | parses `flowchart`/`graph` (subgraph→group) and `erDiagram`. |
| `md` | a `.md` file | extracts the first ````mermaid` block and routes it through the mermaid adapter. |
| `auto` (default) | infer | a directory → `force-app`; otherwise by file extension. |

Each adapter emits the SAME AgentDiagramData, so one `render` produces the grouped/hub-optimized
output regardless of where the model came from. Write the model to `/tmp` (it is a generated
artifact, not a source-controlled input).

### Legacy: mermaid-to-drawio converter (Mermaid source only)

When your source is an existing `.mmd` file rather than structured data:

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

- **DO:** Generate → validate → export → tell user: *"I've pushed to [tool]. Adjust layout, colors, and positions there."*
- **DO NOT:** Accept "move this box right" or "change color of X" via chat. Redirect to the tool.
- **Exception:** Structural changes (add/remove nodes, rename, change relationships) are valid agent tasks.

If no tool is configured, suggest [Mermaid Live Editor](https://mermaid.live) as a free instant preview.

---

## Structured Reports: `sf setup-agents report generate`

The plugin also ships a deterministic report renderer for QA findings, audit summaries,
and metric dashboards. Produce an `AgentReportData` JSON document and render it instead of hand-writing HTML/Markdown:

```bash
sf setup-agents report generate --input report.json --format markdown
sf setup-agents report generate --input report.json --format html --out report.html
```

**AgentReportData shape:** `{ title, generatedAt, taskId?, author?, sections: [{ title, findings?, metrics?, recommendations?, prose? }] }`.
Findings carry `severity` (critical/high/medium/low/info); recommendations carry `priority` and optional `effort`.

---

## Document Extraction: `sf setup-agents extract`

When a referenced PDF or HTML doc is too large to `Read` whole (over ~256KB), convert it to a greppable
Markdown file first, then `Grep` the result for the relevant section:

```bash
sf setup-agents extract pdf-to-markdown --input spec.pdf --out spec.md
sf setup-agents extract html-to-markdown --input page.html --out page.md
```
