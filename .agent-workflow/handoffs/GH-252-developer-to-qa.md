# Handoff GH-252: developer to qa

## Task Context

- Title: Add release and clean-install contract tests
- Goal: Detect release configuration regressions and prove a packed plugin installs cleanly in an isolated Salesforce CLI environment before publication
- Current owner: developer
- Current status: pending

## Acceptance Criteria

- CI fails before release when package repository metadata does not match the canonical GitHub repository
- CI fails when configured semantic-release plugins attempt to commit or push directly to protected main
- An isolated Salesforce CLI installation of the dry-run tarball reports the package version and discovers validate and ci-publish commands
- Documentation explains unsigned plugin confirmation and npm min-release-age behavior without changing global npm policy

## Scope And Paths

- .github/workflows
- .releaserc.json
- package.json
- scripts
- test
- docs

## Phase Handoff

- Status: ready_for_review
- Changed components: Added scripts/ci/release-contract.mjs, semantic-release-analysis.sh, clean-install-test.sh, focused Node contract tests, PR CI jobs/steps, release docs, and removed unused @semantic-release/git from package.json/yarn.lock/npm-shrinkwrap.json.
- Behavior changed: PR CI now rejects repository metadata drift and direct Git-write release config, performs non-publishing semantic-release analysis, and installs the packed checkout into a fully isolated Salesforce CLI to verify exact version plus validate/ci-publish help without org credentials.
- Unit tests: Passed build, full unit suite, 41 NUTs, 14 CI contract tests, semantic-release dry-run, clean install, actionlint for test.yml, bash -n/shellcheck, act job listing, frozen Yarn lock and offline npm shrinkwrap validation. Full act job run blocked by unavailable local private runner image.
- Commands run: yarn build; yarn test; yarn test:nuts; node --test test/ci/_.test.mjs; yarn release:analyze; yarn test:clean-install; actionlint .github/workflows/test.yml; shellcheck scripts/ci/_.sh; act --list -W .github/workflows/test.yml
- Known gaps: none
- Risks: none
- Recommended Playwright coverage: not applicable
- Executor provenance: not recorded

## Memory Consumption

- Hook: before_handoff
- Lessons consulted: 0
- none
- Lessons applied: none available
- Prompt registry entries consulted: 4
- code.md#InitCommand: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-INIT-WIZARD - **Role:** developer ### Key decisions - Added `smart-deployment init` as a deterministic, non-destructive command that delegates con...
- code.md#RetrieveCommand: - **Created:** 2026-06-05 - **Updated:** 2026-06-05 - **Iterations:** 1 - **Task:** gh-feature-222-forceignore-stash - **Role:** developer ### Key decisions - Added a smart-deployment retrieve alias that wraps Salesforce CLI retrieve inp...
- code.md#MetadataGapsCommand: - **Created:** 2026-06-10 - **Updated:** 2026-06-10 - **Iterations:** 1 - **Task:** PLUGIN-AI-METADATA-GAP-DETECTION - **Role:** developer ### Key decisions - Added `smart-deployment metadata gaps` with JSON-safe output and a concise hum...
- services.md#InitConfigGenerationService: - **Created:** 2026-06-03 - **Updated:** 2026-06-03 - **Iterations:** 1 - **Task:** PLUGIN-INIT-WIZARD - **Role:** developer ### Key decisions - Centralized config generation in a service that detects `sfdx-project.json`, derives relativ...
- Prompt registry entries updated: verify via PROMPT_REGISTRY_UPDATED events or accepted rationale before release.

## Transition Guard

- State transition: not recorded
- Required fields: none
- Contract result: not evaluated

## Flow-specific required context

- changed behavior
- commands run
- qa plan
- test evidence
