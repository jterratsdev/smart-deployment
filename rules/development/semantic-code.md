# Semantic Code

Code must be readable by intent before it is explained by comments.

## Naming

- Use domain language for modules, functions, variables, types, and test names.
- Prefer names that reveal purpose and observable behavior, such as `validateReleaseGateEvidence`, not vague names such as `processData`.
- Boolean names must make the predicate clear: `isReady`, `hasEvidence`, `canRetry`, `shouldBlockRelease`.

## Structure

- Keep entry points thin. Move decisions and business rules into focused domain, service, or policy modules.
- Extract helpers when a reader needs comments to understand a block of code.
- Avoid generic containers in public APIs when narrow types or explicit models can describe the contract.
- Avoid hardcoded command lists, statuses, roles, labels, or fixture values when a typed registry or catalog can be the source of truth.

## Comments

- Comments explain why, trade-offs, invariants, or external constraints.
- Do not add comments that restate what the code already says.
- If a function needs line-by-line comments to be understandable, refactor the names, types, or helper boundaries.

## Review Checklist

- A reviewer can identify the domain intent from names and file boundaries without tracing every line.
- New code follows the existing project vocabulary and layering.
- Tests read like behavior specifications and use meaningful scenario names.
