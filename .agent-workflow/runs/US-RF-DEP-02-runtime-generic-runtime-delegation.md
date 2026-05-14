# Runtime Subagent Delegation Packet: US-RF-DEP-02

- Runtime: Generic Runtime (generic-runtime)
- Delegation mode: brief-only
- Runtime-native subagents supported: false
- Direct provider API calls allowed: true

## Parent Task

Split dependency-resolver into staged resolution, optional dependency handling, managed package handling, validation/classification, and topological ordering.

## Subagent Assignments

### architect

- Ownership paths: src/dependencies/dependency-resolver.ts, test/unit/dependencies/dependency-resolver.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### developer

- Ownership paths: src/dependencies/dependency-resolver.ts, test/unit/dependencies/dependency-resolver.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### qa

- Ownership paths: src/dependencies/dependency-resolver.ts, test/unit/dependencies/dependency-resolver.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Guardrails

- Do not call OpenAI, Anthropic, or other vendor APIs from Orchestra for this delegation.
- Use the active runtime's own authenticated agent/subagent mechanism.
- If runtime-native delegation is unsupported, stop at this packet and ask the user for approval.
- Avoid overlapping writes; respect ownership paths and active locks.
- Use `orchestra commands manifest --json` for supported commands and flags.
