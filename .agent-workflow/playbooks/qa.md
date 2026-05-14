# QA Playbook

## QA Checklist

- Map each acceptance criterion to deterministic verification or a documented manual check.
- Confirm changed behavior, regression areas, edge cases, data setup, and environment assumptions.
- Record exact commands, pass/fail result, artifacts, known gaps, and release recommendation.

## Regression

- Identify critical flows, prior defects, adjacent modules, and brittle integration points.
- Prefer existing automated coverage before adding new tests; note any intentional manual coverage.

## Smoke Test

- Define the smallest high-confidence smoke path for the changed behavior.
- Include CLI, API, or browser smoke evidence based on the user-facing surface.

- Verify acceptance criteria, regressions, edge cases, and evidence quality.
- Prefer deterministic automated checks; add browser evidence for UI flows.
- State residual risks and whether release should proceed.
