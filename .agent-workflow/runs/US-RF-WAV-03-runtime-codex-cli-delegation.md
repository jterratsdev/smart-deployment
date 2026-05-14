# Runtime Subagent Delegation Packet: US-RF-WAV-03

- Runtime: Codex CLI (codex-cli)
- Delegation mode: runtime-native
- Runtime-native subagents supported: true
- Direct provider API calls allowed: true

## Parent Task

Refactor src/ai/wave-validation-service.ts so provider orchestration, prompt construction, response parsing, fallback handling, and risk synthesis are isolated.

## Subagent Assignments

### architect

- Ownership paths: src/ai/wave-validation-service.ts, test/unit/ai/wave-validation-service.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### developer

- Ownership paths: src/ai/wave-validation-service.ts, test/unit/ai/wave-validation-service.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### qa

- Ownership paths: src/ai/wave-validation-service.ts, test/unit/ai/wave-validation-service.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

### release_manager

- Ownership paths: src/ai/wave-validation-service.ts, test/unit/ai/wave-validation-service.test.ts
- Allowed commands: npm run format, npm run build, npm run precommit
- Expected artifacts: code diff, test evidence, handoff notes
- Handoff must include touched files, evidence, risks, and remaining work.

## Guardrails

- Do not call OpenAI, Anthropic, or other vendor APIs from Orchestra for this delegation.
- Use the active runtime's own authenticated agent/subagent mechanism.
- If runtime-native delegation is unsupported, stop at this packet and ask the user for approval.
- Avoid overlapping writes; respect ownership paths and active locks.
- Use `orchestra commands manifest --json` for supported commands and flags.
