# QA Correction Verification to Release Manager Handoff

Task: `SD-RC-REMEDIATE`
Role: QA/SDET
Date: 2026-09-10
Verdict: APPROVE CORRECTION
Recommendation: Automatically hand off to `release_manager` for final release-readiness review. Do not publish until the authorized merge to `main`; semantic-release must remain the only version/tag/publish authority.

## Correction Verification

- Independently reviewed `.agent-workflow/handoffs/SD-RC-REMEDIATE-lock-correction-handoff.md` and the exact package, shrinkwrap, Yarn lock, workflow, release configuration, API 67, validate command, and validate regression diffs.
- PASS: Node 24.20.0/Yarn 1.22.21 frozen install exited 0. Captured stderr contained zero `Lockfile has incorrect entry` messages, and accepted `yarn.lock` SHA-256 remained `475c1af861c45287f4d5cb60ac6cfa04219abebd4e2e1ee48f47c97aca1726a3`.
- PASS: structural inspection covered all 1,499 versioned Yarn package entries. Every entry contains `version`, `resolved`, and `integrity`; no incomplete records remain.
- PASS: Yarn selects `fast-uri` 3.1.6, `csv-parse` 7.0.2, and `ip-address` 10.2.0 with complete registry metadata. The expected `jake` and `csv-parse` resolution-range warnings remain non-blocking.
- PASS: Node 24 `npm audit --omit=dev --json` reports zero production vulnerabilities across 321 production dependencies.
- PASS: Salesforce dependency ranges and selected versions remain unchanged: `@salesforce/core` `^8.31.0` / 8.31.0 and `@salesforce/sf-plugins-core` `^12.2.24` / 12.2.24.
- PASS: build, focused validate regression (4 passing), full `test:all`, integration (34 passing), E2E (36 passing, 2 expected pending), performance (6 passing), isolated prepack, 805-entry pack dry-run, required package-file assertions, workflow YAML parse, and `git diff --check`.
- PASS: live `cg-demo` validate returned status 0, API 67.0, serializable resolved target-org username, and a successful release report without deployment.
- PASS: safe semantic-release 25.0.3 dry-run against an isolated local `main` and local bare remote found `v1.5.0`, analyzed the two fixes and one feature, selected a minor release, and calculated 1.6.0 without creating a tag, publishing, or changing product files.
- PASS: package and shrinkwrap remain at 1.5.0; semantic-release remains the sole release authority in the reviewed workflow/configuration.

## Correction Risk

- Confirmed the developer warning: running npm installation/shrinkwrap tooling in the repository can rewrite `yarn.lock` into malformed npm-derived records, including an incorrect `ip-address@10.2.0` entry and missing metadata. QA restored the accepted regenerated lock from the verified artifact and repeated the final frozen-install and structural checks successfully.
- Release automation runs Yarn installation before package checks and does not run `npm ci`; release_manager should preserve this ordering and verify the committed lock hash before merge/release.
- No product source, package, workflow, lock intent, commit, push, tag, publication, or deployment was performed by QA. Only this requested Orchestra handoff and Orchestra evidence/review records were updated.

## Scope Reviewed

- Developer handoff: `.agent-workflow/handoffs/SD-RC-REMEDIATE-wfrun-1789080400988-9af105-developer-developer-runtime-handoff.md`.
- Complete product diff, including `package.json`, `npm-shrinkwrap.json`, `yarn.lock`, `.github/workflows/publish-npm.yml`, `.releaserc.json`, and the pre-existing `src/commands/validate.ts`, `test/unit/commands/validate.test.ts`, and `sfdx-project.json` changes.
- Release-trigger regression risk from removing `workflow_dispatch` and GitHub `release.published` handling.
- No product files were modified. No commit, push, tag, publish, deploy, or manual version change was performed.

## Results

| Area                       | Result                     | Exact evidence                                                                                                                                                                                                                                                                                                                |
| -------------------------- | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Production vulnerabilities | PASS                       | Node 24.20.0 `npm audit --omit=dev --json`: 0 info, low, moderate, high, critical; 0 total across 321 production dependencies.                                                                                                                                                                                                |
| npm dependency graph       | PASS                       | `npm ls @salesforce/core @salesforce/sf-plugins-core fast-uri csv-parse --all`: Salesforce core 8.31.0, sf-plugins-core 12.2.24, overridden csv-parse 7.0.2, overridden fast-uri 3.1.6.                                                                                                                                       |
| Yarn dependency graph      | PASS with expected warning | `yarn list --pattern '@salesforce/core                                                                                                                                                                                                                                                                                        | @salesforce/sf-plugins-core | fast-uri | csv-parse' --depth=20`: exactly Salesforce core 8.31.0, sf-plugins-core 12.2.24, csv-parse 7.0.2, fast-uri 3.1.6. Yarn reports that csv-parse 7.0.2 is outside jsforce's declared `^5.5.2` range. |
| Salesforce versions        | PASS for task intent       | Direct ranges remain `^8.31.0` and `^12.2.24`; installed locks remain 8.31.0 and 12.2.24, with no downgrade. Registry check shows newer compatible patches (8.32.6 and 12.2.28) and newer majors; those unrelated upgrades are outside remediation scope.                                                                     |
| npm lock determinism       | PASS                       | In isolated copy, two Node 24 `npm install --package-lock-only --ignore-scripts` runs retained SHA-256 `00c4b227bd26a4f7ca2f5bf993c50ebb7023cf9b06b66a0282f390a4d47b4203`.                                                                                                                                                    |
| Yarn lock determinism      | PASS                       | In isolated copy, `yarn install --frozen-lockfile --ignore-scripts --network-timeout 600000` retained SHA-256 `ac0ff003b3fd933a5eea3f94f7dd6bbb17a0c44cd7904d2056786d760afe90b3`.                                                                                                                                             |
| csv-parse compatibility    | PASS with residual watch   | csv-parse 7 sync parsing passed quoted-column and header parsing; stream parser passed. Full integration/E2E suites exercise Salesforce dependencies successfully.                                                                                                                                                            |
| Build                      | PASS                       | Node 24 `npm run build`: exit 0. Wireit cache skipped already-valid compile/lint outputs.                                                                                                                                                                                                                                     |
| Full tests                 | PASS                       | Node 24 `npm test`: exit 0; Wireit ran two scripts and skipped one valid cached script in 85.7 seconds.                                                                                                                                                                                                                       |
| Validate regression        | PASS                       | Node 24 focused Mocha suite: 4 passing, including circular Org object JSON serialization.                                                                                                                                                                                                                                     |
| Integration                | PASS                       | Node 24 `npm run test:integration`: 34 passing.                                                                                                                                                                                                                                                                               |
| E2E                        | PASS                       | Node 24 `npm run test:e2e`: 36 passing, 2 intentionally pending live-org scenarios.                                                                                                                                                                                                                                           |
| Performance                | PASS                       | Node 24 `npm run test:performance`: 6 passing in 71 ms.                                                                                                                                                                                                                                                                       |
| Prepack                    | PASS                       | Isolated-copy Node 24 `npm run prepack`: TypeScript compile, oclif manifest, oclif lock, and shrinkwrap completed.                                                                                                                                                                                                            |
| Pack                       | PASS                       | Node 24 `npm pack --dry-run --ignore-scripts --json`: exit 0, 805 entries, required generated commands present.                                                                                                                                                                                                               |
| Workflow YAML              | PASS                       | Ruby YAML safe parse passed; actionlint (when available) returned no findings. Static review confirms only `push` to `main`, one release job, full-history checkout, frozen Yarn install, build/test/audit/package checks, and `npm run release`.                                                                             |
| Sole release authority     | PASS                       | No manual versioning, direct `npm publish`, direct tag creation, or release-event republish path remains in publish workflow. `package.json` exposes only `release: semantic-release`. `.releaserc.json` owns analysis, changelog, npm publication, GitHub release, and release commit.                                       |
| Safe version calculation   | PASS                       | In an isolated local branch named `main`, semantic-release 25.0.3 was run `--dry-run --no-ci` with only analyzer/notes plugins. From tag v1.5.0 it analyzed three commits (two fixes, one feature), selected a minor release, and calculated 1.6.0. It created no tag, release, package publication, or product modification. |
| Repository URL             | PASS                       | `package.json` repository is `https://github.com/jterrats/smart-deployment`, matching origin `git@github.com:jterrats/smart-deployment.git`; safe dry-run generated links under the corrected repository.                                                                                                                     |
| API 67                     | PASS                       | Parsed `sfdx-project.json` contains `sourceApiVersion: 67.0`; integration discovery also observed API 67.0.                                                                                                                                                                                                                   |
| cg-demo JSON smoke         | PASS                       | `sf org display --target-org cg-demo --json`: connected, API 67.0. Node 24 `node ./bin/dev.js smart-deployment validate --target-org cg-demo --json`: status 0, success true, serializable resolved username in logging and release report, detected API 67.0, no deployment executed.                                        |
| Diff hygiene               | PASS                       | `git diff --check` passed. Static assertions confirmed package and shrinkwrap versions remain 1.5.0 and repository/override/resolution values are exact.                                                                                                                                                                      |

## Trigger Regression Review

- Removing `release.published` prevents the semantic-release-created GitHub release from causing a duplicate npm publication. This is correct and removes a competing authority.
- Removing manual patch/minor/major inputs prevents operators from overriding conventional-commit calculation or publishing an arbitrary existing tag. This is correct for the single-authority requirement.
- Every push to `main` now evaluates semantic-release, rather than only package-version changes. Non-release commits result in no release; the semantic-release release commit includes `[skip ci]`, preventing a recursive workflow run.
- Workflow-level concurrency serializes release runs and does not cancel an active publication.
- Operational regression: there is no manual API/UI retry trigger. A failed run can be rerun from GitHub Actions, but a partial failure after tag/publication may require semantic-release-aware recovery rather than dispatching an existing tag. This is an accepted consequence of sole authority, not a product defect; release_manager should document rollback/recovery before publishing.

## Findings

No release-blocking defects found.

1. Non-blocking compatibility risk: `csv-parse` 7.0.2 is a major override over `@jsforce/jsforce-node`'s declared `^5.5.2`. Import, sync/stream parsing, build, unit, integration, E2E, performance, and real-org validate checks all pass. Retain as a dependency watch item until jsforce supports the fixed major explicitly.
2. Non-blocking package freshness note: the Salesforce packages were preserved without downgrade at the accepted locked versions, but newer compatible patches exist. Do not fold unrelated dependency updates into this RC remediation.
3. Non-blocking release recovery risk: manual and release-event entry points are intentionally removed. Rerun/recovery after a partial semantic-release failure must avoid duplicate npm/tag/GitHub operations.
4. Two E2E scenarios remain pending because they require explicit live-org test configuration; the requested live `cg-demo` validate smoke passed independently.
5. The workspace is intentionally dirty with the RC product changes and Orchestra artifacts. An authorized actor must commit the exact reviewed product files before merge; uncommitted changes are not present in branch HEAD.

## Release Manager Handoff

Automatic handoff: GO to `release_manager` review. The prior lockfile block is corrected and independently verified. Confirm the final committed `yarn.lock` SHA-256 is `475c1af861c45287f4d5cb60ac6cfa04219abebd4e2e1ee48f47c97aca1726a3`, the committed diff exactly matches this reviewed workspace, branch protection allows semantic-release's release commit/tag behavior, required `NPM_TOKEN`/GitHub permissions are valid, and partial-failure recovery is documented. Do not manually edit version 1.5.0; after merge, semantic-release should calculate and prepare 1.6.0.
