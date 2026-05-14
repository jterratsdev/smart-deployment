# Runtime Subagent Delegation Packet: US-RF-PAR-04

- Runtime: Codex CLI (codex-cli)
- Delegation mode: runtime-native
- Runtime-native subagents supported: true
- Direct provider API calls allowed: true

## Parent Task

Refactor src/parsers/layout-parser.ts by isolating field extraction, section parsing, action extraction, related-object mapping, and optional dependency assembly.

## Subagent Assignments

### architect

- Ownership paths: src/parsers/layout-parser.ts, test/unit/parsers/layout-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### developer

- Ownership paths: src/parsers/layout-parser.ts, test/unit/parsers/layout-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### qa

- Ownership paths: src/parsers/layout-parser.ts, test/unit/parsers/layout-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### release_manager

- Ownership paths: src/parsers/layout-parser.ts, test/unit/parsers/layout-parser.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Guardrails

- Do not call OpenAI, Anthropic, or other vendor APIs from Orchestra for this delegation.
- Use the active runtime's own authenticated agent/subagent mechanism.
- If runtime-native delegation is unsupported, stop at this packet and ask the user for approval.
- Avoid overlapping writes; respect ownership paths and active locks.
- Use `orchestra commands manifest --json` for supported commands and flags.
