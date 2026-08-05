# Prompt Registry

Read and update .generated-prompts registers for substantial AI-generated artifacts.

## When To Load

- Trigger: `prompt`
- Trigger: `generated`
- Trigger: `artifact`
- Trigger: `code`
- Trigger: `ui`
- Trigger: `docs`
- Trigger: `diagram`
- Trigger: `eval`

## Procedure

- Before substantial generation, read the relevant .generated-prompts register.
- After substantial changes, update one entry with task, role, decisions, evidence, and prompt summary.
- Do not update the register for typo-only, formatting-only, or single-line mechanical fixes.

## Evidence

- `file`
