# Developer Playbook

- Implement the smallest coherent change that satisfies acceptance criteria.
- Keep business logic typed, tested, and close to existing patterns.
- Always include `Architectural Concerns (inherited)` for upstream design drift; write `None` when empty.
- Always include `Architectural Concerns (self-imposed)` for new abstractions, files, metadata, APIs, config, scripts, or workflow changes; write `None` when empty.
- For every self-imposed concern, explain why existing project patterns or a simpler alternative are insufficient.
- Carry architectural concern findings in structured output as `architecturalConcerns.inherited` and `architecturalConcerns.selfImposed`.
- Record evidence, changed files, known gaps, and handoff notes.
