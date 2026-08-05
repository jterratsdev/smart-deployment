# Diagram Export

Create, validate, and export architecture, workflow, and sequence diagrams.

## When To Load

- Trigger: `diagram`
- Trigger: `mermaid`
- Trigger: `architecture`
- Trigger: `flow`
- Trigger: `sequence`
- Trigger: `draw.io`
- Trigger: `lucid`

## Procedure

- Load `docs/diagrams/diagram-master-prompt.md` as the canonical source-free
  diagram prompt when detailed generation or validation guidance is needed.
- Identify the diagram purpose and authoritative architecture sources before drawing.
- Classify the task before drawing: `semantic`, `inspired-by-reference`, or `recreation`.
- For `recreation`, acceptance is pixel-perfect source fidelity unless the user explicitly accepts an approximation. Structural similarity is not enough.
- For `recreation`, inventory every visible source element before drawing: containers, labels, icons, connectors, arrowheads, line styles, colors, borders, spacing, rotations, z-order, and page/canvas bounds.
- Choose the diagram style from the decision matrix before drafting.
- When there is no source reference, create a diagram contract before drawing: purpose, audience, node inventory, groups, relationships, labels, annotations, expected reading flow, and planned connector endpoints/anchors.
- Prefer text-native diagrams such as Mermaid unless the project requires another format.
- For recreated or high-fidelity diagrams, always perform a post-render visual QA pass against the source reference. Re-evaluate container sizing, text fit, spacing, connector bend points, and line/container overlaps after the diagram is rendered.
- After populating real text, subcards, chips, icons, and internal connectors, run a global layout reflow: grow parent containers when children need padding, then re-evaluate neighbors, connector routes, label lanes, and canvas bounds.
- Do not solve container overflow primarily by shrinking text. Prefer growing the parent container, repositioning children, or rerouting connectors unless the source reference requires tighter text.
- For `recreation`, record source-vs-output gaps by element ID or visual region after each iteration. If the chosen target cannot reach pixel-perfect fidelity, reclassify as approximation and document the reason.
- Avoid running connector lines over containers or important labels whenever practical. Add bend points, adjust spacing, or resize containers before treating the diagram as ready.
- Validate connector endpoint distance during the visual QA pass: every arrow must visibly leave the intended source edge and land on the intended target edge.
- Validate connector-label separation during the visual QA pass: labels must be placed in reserved whitespace or on readable label backgrounds, and must not touch connector strokes, arrowheads, or container borders.
- Validate element ordering during the visual QA pass: connectors and arrowheads must remain visible above the states or containers they connect, while accepted diagrams should remain visually stable across regenerations.
- Validate connector anchor aesthetics during the visual QA pass: choose source and target edge points that minimize bend count and unnecessary line travel without changing the intended relationship.
- Validate diagonal and crossing aesthetics during the visual QA pass: prefer orthogonal connectors and add line jumps or bridge arcs where unavoidable crossings remain.
- Validate layout simplification during the visual QA pass: before accepting a bent connector, check whether moving either connected element slightly creates a straighter route without breaking nearby spacing or semantics.
- Validate editable/rendered equivalence during the visual QA pass: draw.io XML and rendered SVG must describe the same moved elements, connectors, labels, and annotations.
- Validate annotation target clarity during the visual QA pass: every annotation arrow must visibly land on the exact element or line it describes, without obscuring target text or labels.
- For source-free diagrams, validate the rendered output against the diagram contract before handoff; correct and re-render when endpoints, labels, anchors, bend counts, or reading flow drift from the contract.
- Source-free diagrams still require a pixel-perfect quality pass against their own contract before delivery: text must fit, containers must be correctly sized, connectors must visibly attach to the intended source/target edges, arrowheads must remain visible, labels must not collide with lines or borders, and whitespace must be intentional.
- Never deliver the first render of a source-free diagram without re-evaluating sizes, line routing, connector anchors, text containment, z-order, and visual balance.
- After every correction, review the whole canvas again. Local fixes are incomplete until container containment, neighboring positions, connector routes, label lanes, z-order, and whitespace still pass globally.
- Before final handoff, perform diagram artifact hygiene:
  - keep the accepted editable source, accepted render, prompt master or final prompt, and minimum QA evidence;
  - archive or exclude intermediate previews, failed renders, temporary prompts, and one-off correction notes;
  - do not publish source-specific prompt fragments into the prompt bank unless they have been rewritten as reusable rules;
  - record where archived iterations or evidence can be found when traceability is required.
- Run `orchestra diagrams lint --file <diagram.mmd>` for lint-only validation before sharing Mermaid diagrams.
- Attach evidence with `orchestra diagrams lint --file <diagram.mmd> --task <task-id>` when the diagram supports workflow delivery.
- If `mmdc` is missing, report the install guidance instead of pretending validation passed.
- Mermaid outputs can be accepted as semantic diagrams, but not as pixel-perfect recreations when exact layout, connectors, icons, rotations, or reference styling are acceptance criteria. Escalate those cases to draw.io XML or Lucid.

## Decision Matrix

- Architecture boundary or component ownership: C4/container or component diagram.
- User, business, or agent workflow: flowchart or state diagram.
- Service/API/message exchange: sequence diagram.
- Data ownership or relationships: entity relationship diagram.
- Runtime topology, infrastructure, or deployment: deployment or infrastructure diagram.

## Evidence

- `file`
- `report`
- `screenshot`
