<!-- setup-agents: 3.23.0 -->

# Document Quality Review

## Purpose

Run an independent quality review after authoring and QA, before final PDF/deck rendering or release. Visual polish never substitutes for content validity.

## Required report

Record the ordered source paths and source digest, audience profile, author, independent reviewer, evidence references, findings by dimension, disposition, and timestamp. The digest is NOT a plain file checksum — compute it with `sf setup-agents docs digest --input <same input as the render>`, which prints the ordered `sourceFiles` and `sourceDigest` to paste directly into the report.

The report must follow the docs CLI contract: ordered `sourceFiles`, matching `sourceDigest`, `audienceProfile`, `author`, independent
`reviewer`, `reviewedAt`, `disposition`, and `findings`. Pass it to every final render with
`sf setup-agents docs --pdf|--deck --input <source> --output <artifact> --review <review.json>`.

## Blocking checklist

- [ ] **Grounding:** every material claim maps to read evidence; distinguish active behavior from commented, dead, historical, feature-gated, and unverifiable evidence. Grep/counts locate evidence but do not prove conclusions.
- [ ] **Consistency:** numbers, dates, durations, versions, statuses, IDs, terminology, severities, recommendations, and companion documents agree.
- [ ] **Audience and tone:** language matches the audience profile and avoids blame, implied incompetence, unsupported certainty, unexplained jargon, and internal process commentary in client-facing deliverables.
- [ ] **Scope and decision readiness:** in/out, assumptions, gaps, decision owner, open decisions, trade-offs, reversibility, and commitments are explicit. Executive artifacts lead with impact and decisions, not implementation debt.
- [ ] **Integrity:** links and citations resolve, no stale or superseded claim remains, and the source digest matches the reviewed source.
- [ ] Run `yarn link-check` when the project provides it; otherwise verify every referenced local path and URL directly.

## Render checks

After content approval, verify source/render parity, clipping and overflow, page/slide count, accessibility labels, broken links, and responsive HTML behavior. Any source edit invalidates the approval and requires a new review digest.

## Disposition

Use `approve`, `changes`, or `block`. Do not silently rewrite substantive scope, commitments, or recommendations. Do not render or publish while findings are blocking or the review is stale.

Record the report with `sf setup-agents evidence add --task <id> --role release-manager --type report --summary "Document quality review: <disposition>"`. The gated transition is `document-review→release`; QA hands off directly to Document Review without a phase gate.

## Evidence

```bash
sf setup-agents evidence add --task <id> --role release-manager --type report --summary "Document Quality Review completed"
```
