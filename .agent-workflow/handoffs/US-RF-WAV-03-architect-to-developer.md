# Handoff US-RF-WAV-03: architect to developer

- Status: ready_for_review
- Changed components: Architecture phase: split wave validation by prompt construction, transport, response parsing/fallback, risk/result synthesis, and report formatting.
- Behavior changed: validateWaves() and formatValidationReport() public behavior should remain unchanged; provider config access stays on WaveValidationService.
- Unit tests: Required compile, focused eslint, focused wave validation test command, npm run build, and npm test.
- Commands run: orchestra runtime delegate-plan --task US-RF-WAV-03 --roles architect,developer,qa,release_manager --runtime codex-cli --budget 4000 --json
- Known gaps: none
- Risks: none
- Recommended Playwright coverage: not applicable

## Flow-specific required context

- architecture decision
- scope
- code diff
- unit test results
