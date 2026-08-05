# Model Evaluation

Run prompt, model, provider-routing, fallback, and rubric evaluations.

## When To Load

- Trigger: `model`
- Trigger: `llm`
- Trigger: `prompt`
- Trigger: `provider`
- Trigger: `fallback`
- Trigger: `eval`
- Trigger: `rubric`
- Trigger: `routing`

## Procedure

- Define eval objectives, cases, rubric, and expected behavior before changing prompts or routing.
- Compare model/provider behavior for material changes and record disagreements.
- Avoid storing raw sensitive prompts or responses in provenance artifacts.

## Evidence

- `report`
- `file`
