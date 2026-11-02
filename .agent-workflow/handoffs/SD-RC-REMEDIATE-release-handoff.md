# Release Handoff: SD-RC-REMEDIATE

## Verdict

FINAL GO for a merge-ready release candidate. This approves the reviewed RC for merge; it does not authorize or represent publication. No commit, push, PR, tag, publication, deployment, or manual version bump was performed.

## Critical Gates

- PASS: Node 24.20.0 and Yarn 1.22.21 frozen install exited 0 with only the accepted `jake` and `csv-parse` resolution-range warnings. It emitted no `Lockfile has incorrect entry` warning and preserved `yarn.lock` SHA-256 `475c1af861c45287f4d5cb60ac6cfa04219abebd4e2e1ee48f47c97aca1726a3`.
- PASS: independent structural parsing inspected 1,499 versioned Yarn entries; every entry has `version`, `resolved`, and `integrity`.
- PASS: Node 24 `npm audit --omit=dev --json` reports zero vulnerabilities across 321 production dependencies.
- PASS: npm/Yarn resolution evidence selects `fast-uri` 3.1.6, `csv-parse` 7.0.2, and Yarn `ip-address` 10.2.0. Salesforce dependencies remain `@salesforce/core` 8.31.0 and `@salesforce/sf-plugins-core` 12.2.24.
- PASS: independent build and focused validate regression completed, with 4 focused tests passing. Corrected developer/QA evidence covers full `test:all`, 34 integration tests, 36 E2E tests with 2 expected pending, 6 performance tests, isolated prepack, and an 805-entry pack dry-run. Final pack inspection confirms the required generated commands, manifest, oclif lock, and shrinkwrap.
- PASS: safe analyzer-only semantic-release 25.0.3 dry-run from `v1.5.0` analyzed two fixes and one feature, selected a minor release, and calculated `1.6.0` without creating a tag or publishing.
- PASS: local and remote `v1.6.0` are absent; npm `@jterrats/smart-deployment@1.6.0` is absent and `latest` remains 1.5.0.
- PASS: `.github/workflows/publish-npm.yml` has one authority: push to `main` runs `npm run release`. Manual versioning, direct publish/tag creation, release-event republication, and competing jobs are removed. `.releaserc.json` owns analysis, changelog, npm/GitHub release, and release commit assets.
- PASS: `package.json.repository.url` is `https://github.com/jterrats/smart-deployment`, matching `origin` at `git@github.com:jterrats/smart-deployment.git`.
- PASS: the original JSON validate correction normalizes a circular target-org object before structured logging and has a regression test. `sfdx-project.json` declares API `67.0`; accepted live `cg-demo` JSON validation evidence returned API 67.0 and a serializable target-org without deployment.
- PASS: `package.json` and `npm-shrinkwrap.json` remain at 1.5.0. Semantic-release must calculate and prepare 1.6.0 after merge.
- PASS: workflow YAML parsing and `git diff --check` succeed.

## Intended Merge Files

Commit and merge exactly these reviewed product files:

- `.github/workflows/publish-npm.yml`
- `.releaserc.json`
- `package.json`
- `npm-shrinkwrap.json`
- `yarn.lock`
- `src/commands/validate.ts`
- `test/unit/commands/validate.test.ts`
- `sfdx-project.json`

The three existing Agentforce commits at `331f640`, `d83f9a2`, and `d5e4631` are part of the RC history and must remain included.

## Exclusions

- Exclude all `.agent-workflow/**` operational state, decisions, evidence, reviews, runtime artifacts, and handoffs from the product commit.
- Exclude all `.smart-deployment/**` generated reports and plans.
- Exclude optional generated-guidance refreshes and any unrelated worktree content.
- Do not regenerate `yarn.lock` with npm shrinkwrap/install tooling after accepting the reviewed hash. If packaging mutates it before commit, restore through Yarn regeneration and repeat the frozen/structural gates.

## Closure State

- `SD-RC-REMEDIATE`: technically complete and approved for Orchestra completion.
- `SD-RC-FINALIZE`: JSON validate and API 67 requirements are technically complete and approved for Orchestra completion.
- RC state: merge-ready, not published. Publication verification remains a post-merge operational action, not part of this verdict.

## Merge And Publish Sequence

1. Stage only the intended product files and verify `yarn.lock` still has SHA-256 `475c1af861c45287f4d5cb60ac6cfa04219abebd4e2e1ee48f47c97aca1726a3`.
2. Commit through the authorized process and merge after required branch checks pass. Do not manually change package versions.
3. Allow only the `main` push workflow to invoke semantic-release. It should calculate 1.6.0 from `v1.5.0`.
4. After the workflow completes, verify the semantic-release commit, `v1.6.0`, GitHub release, npm package/provenance, and `latest=1.6.0`.
5. If the workflow fails partially, inspect which immutable side effects occurred before rerunning; do not use a competing manual release path.

## Rollback And Recovery

- Before tag/publication: revert the merge or corrective commits on `main`; do not create a tag.
- After tag but before npm publication: stop and use semantic-release-aware fix-forward recovery. Remove a GitHub release/tag only when policy permits and no consumer has used it.
- After npm publication: npm versions are immutable. Deprecate 1.6.0 if required, restore `latest` to 1.5.0, revert the defect, and publish a corrective 1.6.1 or later through the same workflow.
- Salesforce validation was non-destructive/check-only, so no org rollback is required.

## Residual Risks

- `csv-parse` 7.0.2 is a major override outside jsforce's declared `^5.5.2` range. Compatibility, full-suite, package, and live-org validation pass; retain it as a dependency watch item.
- npm installation/shrinkwrap tooling can rewrite `yarn.lock` into malformed npm-derived records. Preserve release command ordering and verify the accepted lock hash before merge.
- A partial semantic-release failure has no separate manual dispatch path. Recovery must avoid duplicate npm, tag, GitHub release, or release-commit operations.
- Two live-org E2E scenarios remain intentionally pending; the requested `cg-demo` JSON smoke passed.
- Branch protection must permit the configured semantic-release commit/tag behavior, and `NPM_TOKEN` plus GitHub permissions must remain valid at publication time.
