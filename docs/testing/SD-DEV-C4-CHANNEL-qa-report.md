![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# SD-DEV-C4-CHANNEL — QA Report (OmniStudio channel classifier)

- Author: Salesforce Professional Services (qa profile, independent of implementation)
- Version: 1.0
- Run: wf-1792664256358-7bd912 · Formal workflow phase: `security-review` (task
  `setup-agents-task-1792797661251-05214f87`, status done, verdict PASS-WITH-FINDINGS). No QA phase
  task exists yet — the run cannot advance past `security-review` to `qa` because of a setup-agents
  plugin bug (the ba→architect gate approval signature now reads as "forged"). Per instruction, this
  report is recorded directly as story-level evidence, not through a claimed QA phase task.
- Scope: `src/deployment/omnistudio-channel-classifier.ts` (new),
  `src/deployment/special-deployment-plan.ts` (`OmniStudioVlocityProvider` only),
  `test/unit/deployment/omnistudio-channel-classifier.test.ts` (new),
  `test/unit/deployment/special-deployment-plan.test.ts` (OmniStudio describe block),
  `docs/known-limitations.md` (OmniStudio section).
- Inputs reviewed: `docs/architecture/c4-omnistudio-channel-classification.md`,
  `docs/reviews/SD-DEV-C4-CHANNEL-security-review.md` (v1.1, PASS-WITH-FINDINGS).

## Verdict: **PASS-WITH-RISKS**

The classifier and provider satisfy AC-001 through AC-004 by both unit-test evidence and an
independent black-box run of the real `plan explain` command against a disposable fixture project.
No regression: full suite 1820 passing / 0 failing / 8 pending (pre-existing, unrelated). No files
outside the declared scope changed. Residual risk is exactly what the architecture doc and the
security re-review already flag as open and unresolved — it does not block this classification-only
scope, but it does gate any later lifecycle task that would act on `classifications[]`.

## Acceptance Criteria Traceability Matrix

| AC     | Clause                                                                                                                                                            | Test(s)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Result                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001 | Native OmniDataTransform/OmniIntegrationProcedure/OmniScript/OmniUiCard fixtures classify as native metadata, no managed VBT command based only on directory name | `omnistudio-channel-classifier.test.ts`: "classifies a native OmniDataTransform path..." (case 1), "...OmniIntegrationProcedure..." (case 2), "...OmniScript..." (case 3), "...OmniUiCard..." (case 4); `special-deployment-plan.test.ts`: "classifies native-looking OmniStudio paths as native-metadata with no vlocity command (case 5 / AC-001)"                                                                                                                                                                                                                                                                                                                                                                  | PASS — all 5 green; black-box run (below) independently confirms `commands` contains no `vlocity` tool entry for the 4 native fixture files                                                                                                           |
| AC-002 | Managed DataPack classified only when source shape AND package/runtime identity are evidenced; otherwise block; never admit one artifact to both channels         | Shape+identity positive: "classifies a managed DataPack with a concrete managed namespace..." (case 6), "F1 positive...". Shape-without-identity blocked: "F1 negative" x2, "blocks an unmanaged Object\_\_c-shaped..." SObject variant, "blocks a managed shape with an unresolved %vlocity_namespace% token...". Never-both-channels: "blocks both sides of a native/managed channel conflict..." (case 10), "F2" x5 (DataRaptor, IntegrationProcedure, OmniScript, FlexCard, no-counterpart-never-conflicts), "N1" (case-insensitive conflict). Plan-level: "admits no DataPack record into the core metadata manifest (case 12 / AC-002)"                                                                         | PASS — all green; black-box run independently confirms the conflict pair (native `ConflictScript` + managed `OmniScript/ConflictScript`) is blocked on both sides and the core manifest contains only `ApexClass:AccountService`, no `DataPack:*` key |
| AC-003 | Deterministic tests cover 4 native-looking paths, managed positive fixture, unknown/conflicting source, absent job, no managed record in core manifest            | Matrix cases 1-14 in the architecture doc map 1:1 to named tests (see per-case list below); determinism test "produces identical sorted output regardless of input order (case 13)"; no-candidates case "returns no classifications for non-OmniStudio candidate paths" / plan-level "skips the OmniStudio phase with no errors when no candidate paths are present (case 14)"                                                                                                                                                                                                                                                                                                                                        | PASS — every doc-listed case (1–14) has a corresponding test; see gap note below for case 9 split                                                                                                                                                     |
| AC-004 | No executable VBT job generation, DataPack import, business-data provisioning, native deploy enablement, or org calls in this task                                | `special-deployment-plan.test.ts`: "never generates an executable VBT job placeholder regardless of input (case 11 / AC-004)" asserts `commands: []` and no `<generated-vlocity-job.yaml>` token anywhere in the serialized plan. Org calls: classifier takes no org/target parameter and the provider's `commands` is unconditionally `[]`; confirmed by reading `OmniStudioVlocityProvider.plan()` (special-deployment-plan.ts:271-308) — it never references `context.targetOrg` or `context.targetLookup`. Black-box run used `--source-path` on a disposable fixture with no `--target-org`, and the real command still ran to completion with `success:false` from fixture content alone, not an org round-trip | PASS                                                                                                                                                                                                                                                  |

### Per-case coverage (architecture doc Test Matrix, §"Test Matrix (AC-003)")

| #   | Case                                      | Test                                                                                                                                                          |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Native OmniDataTransform                  | ✓ (classifier test, case 1)                                                                                                                                   |
| 2   | Native OmniIntegrationProcedure           | ✓ (classifier test, case 2)                                                                                                                                   |
| 3   | Native OmniScript                         | ✓ (classifier test, case 3)                                                                                                                                   |
| 4   | Native OmniUiCard                         | ✓ (classifier test, case 4)                                                                                                                                   |
| 5   | Native paths at plan level                | ✓ (plan test, case 5)                                                                                                                                         |
| 6   | Managed positive                          | ✓ (classifier test, case 6)                                                                                                                                   |
| 7   | Unknown shape                             | ✓ (classifier test, case 7, plus remedy test)                                                                                                                 |
| 8   | Directory/suffix mismatch                 | ✓ (classifier test, case 8)                                                                                                                                   |
| 9   | Identity unproven (token, malformed JSON) | ✓ split into "case 9a" (unresolved token) and "case 9b" (malformed JSON), each with its own test — functionally equivalent to the doc's single case 9, no gap |
| 10  | Conflict                                  | ✓ (classifier test, case 10, plus remedy test; extended by F2/N1 security tests beyond the doc's single OmniScript example)                                   |
| 11  | Absent job                                | ✓ (plan test, case 11)                                                                                                                                        |
| 12  | No managed record in core manifest        | ✓ (plan test, case 12)                                                                                                                                        |
| 13  | Determinism                               | ✓ (classifier test, case 13)                                                                                                                                  |
| 14  | No candidates                             | ✓ (classifier test "returns no classifications..." + plan test, case 14)                                                                                      |

**No AC clause is without a test.** The only deviation from the doc's matrix is case 9 being split
into 9a/9b, which increases rather than reduces coverage.

## Commands Run and Results

| Command                                                                                                                                                                                                                | Result                                                                                                                                                                                                                                                                    |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `yarn build`                                                                                                                                                                                                           | 0 scripts run (up to date), exit 0                                                                                                                                                                                                                                        |
| `yarn compile`                                                                                                                                                                                                         | 0 scripts run (up to date), exit 0                                                                                                                                                                                                                                        |
| `npx mocha --loader ts-node/esm test/unit/deployment/omnistudio-channel-classifier.test.ts test/unit/deployment/special-deployment-plan.test.ts`                                                                       | **47 passing, 0 failing** — full log: `docs/testing/SD-DEV-C4-CHANNEL-focused-tests.log`                                                                                                                                                                                  |
| `npx eslint src/deployment/omnistudio-channel-classifier.ts src/deployment/special-deployment-plan.ts test/unit/deployment/omnistudio-channel-classifier.test.ts test/unit/deployment/special-deployment-plan.test.ts` | **0 errors, 5 warnings** (all pre-existing `require-await`/`no-await-in-loop` on untouched provider classes in the same file — matches the security review's own finding) — log: `docs/testing/SD-DEV-C4-CHANNEL-eslint.log`                                              |
| `npx nyc mocha "test/**/*.test.ts"` (full repo suite)                                                                                                                                                                  | **1820 passing, 8 pending, 0 failing** — log: `docs/testing/SD-DEV-C4-CHANNEL-full-suite.log` (coverage instrumentation reported 0/0 — a pre-existing nyc/ESM config gap unrelated to this story; not a regression introduced here)                                       |
| `node ./bin/run.js plan explain --source-path <fixture> --json` (black-box, real command, no org)                                                                                                                      | `success:false` with the expected 3 blocked errors and 1 managed component — full JSON: `docs/testing/SD-DEV-C4-CHANNEL-blackbox-plan-explain.json`                                                                                                                       |
| `git status --porcelain=v1` / `git diff --stat`                                                                                                                                                                        | Confirmed only `src/deployment/special-deployment-plan.ts`, `test/unit/deployment/special-deployment-plan.test.ts`, `docs/known-limitations.md` modified, plus new `src/deployment/omnistudio-channel-classifier.ts` and its test — no other `src/`/`test/` files touched |

## Black-Box Acceptance Evidence (disposable fixture, no org calls)

Fixture built under a registered scratch root (`sf setup-agents scratch register`), a minimal SFDX
project with:

- 4 native fixtures: `omniDataTransforms/Acct.rpt-meta.xml`, `omniIntegrationProcedures/Proc.oip-meta.xml`,
  `omniScripts/Welcome.os-meta.xml`, `omniUiCard/Card.ouc-meta.xml`, plus a 5th native OmniScript
  `omniScripts/ConflictScript.os-meta.xml` used for the conflict case.
- 1 managed positive DataPack: `vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json`
  with `VlocityRecordSObjectType: "vlocity_ins__OmniScript__c"`.
- 1 unproven DataPack: `vlocity/OmniScript/Unproven/Unproven_DataPack.json` with an unresolved
  `%vlocity_namespace%__OmniScript__c` and no `vlocity.yaml` declaring a namespace.
- 1 conflict pair: native `omniScripts/ConflictScript.os-meta.xml` plus managed
  `vlocity/OmniScript/ConflictScript/ConflictScript_DataPack.json` (same logical artifact,
  `OmniScript:ConflictScript`).
- 1 ordinary `ApexClass` (`AccountService`) to give the core-metadata phase something to admit.

Exercised the real plugin entry point `sf smart-deployment plan explain` (invoked directly via
`node ./bin/run.js plan explain --source-path <fixture> --json`, no `--target-org`, default
`dry-run: true`). This is the command surface `PlanExplainService` → `SpecialDeploymentPlanService`
→ `OmniStudioVlocityProvider` actually runs through — no test double, no org round-trip (no
`--target-org` flag passed and `OmniStudioVlocityProvider.plan()` makes no org calls either way).

Observed, independently of the unit tests:

1. **Native not admitted to managed:** the `omnistudio-vlocity` phase's `components` array contains
   exactly one entry, `DataPack:OmniScript/Welcome_English` — none of the 4 standalone native paths
   appear there, and the phase's `warnings` array states all 4 (really 5, including the conflict
   native file before conflict detection removes it) were classified `native-metadata` and excluded.
2. **No vlocity command anywhere:** `[.result.providerDecisions[].commands[] | select(.tool=="vlocity")]`
   is an empty array across every phase.
3. **No job placeholder:** the full JSON response contains zero occurrences of
   `<generated-vlocity-job.yaml>`.
4. **Blocked errors carry Remedy:** all 3 `errors` entries in the `omnistudio-vlocity` decision
   (the 2 conflict-pair sides plus the 1 unproven DataPack) end with a `Remedy:` clause.
5. **Managed record not in core manifest:** the `core-metadata` phase's `components` is exactly
   `["ApexClass:AccountService"]` — no `DataPack:*` key, confirming `CoreMetadataProvider` never
   sees DataPack identities.
6. **Only requested-scope paths evaluated:** the fixture's `sfdx-project.json` scopes the scan to
   `force-app`; `MetadataScannerService` found only `AccountService`, and the OmniStudio candidates
   came entirely from the glob-based changed-path provider's own repo listing (no `--since`), which
   is the documented no-`since`-provided fallback (full working-tree glob, not a wider scope).
7. **No org calls:** the command ran to a deterministic `success:false` result from fixture content
   alone; no `--target-org` was supplied and the result shows no org-dependent fields populated
   (`ai` section absent, as expected with `use-ai` defaulting false).

Full raw JSON is saved at `docs/testing/SD-DEV-C4-CHANNEL-blackbox-plan-explain.json`.

Fixture cleanup: registered scratch root was removed with `sf setup-agents scratch delete --path

<dir>` after evidence capture (see Files Written below for the exact path recorded before deletion).

## Regression

- Full suite: **1820 passing, 8 pending (pre-existing, unrelated to this story), 0 failing.**
- Other special-deployment providers' tests (`CoreMetadataProvider`, `AgentforcePublishProvider`,
  `AgentforceActivationProvider`, `AiEvaluationProvider`, `CommunityPublishProvider`) all pass
  unchanged in `special-deployment-plan.test.ts` — confirmed by the full-suite run above and by the
  file-scope check: `git diff --stat` shows edits confined to the `OmniStudioVlocityProvider` class
  and the `classifications` type addition, no other provider classes touched.
- `git status`/`git diff --stat` confirm no `src/`/`test/` file outside the declared C4 scope changed
  (`src/deployment/omnistudio-channel-classifier.ts` new, `src/deployment/special-deployment-plan.ts`
  edited, two test files new/edited, `docs/known-limitations.md` edited).

## Defects

None found in this independent pass beyond what the architect's security re-review (v1.1,
PASS-WITH-FINDINGS) already disclosed and the developer already remediated (F1, F2 fixed; F3, F4
fixed; F5 partially fixed/accepted; F6, F7 accepted info-level). No new defect is being raised by QA.

## Residual Risks (carried forward, not blocking this scope)

1. **Unproven VBT `Type_SubType_Language` naming convention (architecture doc TBD #2 / known-limitations
   "Open assumption on `channel-conflict` naming (F2)").** The conflict-key comparison assumes a VBT
   DataPack folder's `<Name>` segment lines up exactly with the native file's `<Name>` for
   `IntegrationProcedure`/`OmniScript` DataPack types. This is confirmed on the native side (Metadata
   API registry) but not independently verified against VBT documentation or a real exported DataPack.
   The current behavior fails closed (over-flags conflicts on an exact-name match) rather than
   under-flags, so it is safe in this classification-only scope, but it should be re-verified with a
   real VBT export before any lifecycle task trusts `classifications[]` for conflict resolution.
2. **Identity is repo-declared, not org-proven.** `VlocityRecordSObjectType`'s `<ns>__` prefix (or a
   `vlocity.yaml`-declared namespace token) is evidence from source content only; there is no org
   call to confirm the namespace corresponds to an actually-installed managed package. This is by
   design (AC-004 explicitly excludes org calls from this task) and is already stated as the
   responsibility of a later lifecycle task in both the architecture doc and the security re-review's
   N4 finding. Not a defect; a scope boundary to respect going forward.
3. Security re-review's own residual items (N1–N3 hardening, F5 partial fix, F7 locale-dependent
   sort) remain open per that document's "Residual risk / owner" section — re-verify before any
   lifecycle task executes DataPack imports based on `classifications[]`. QA independently confirmed
   N1 (case-insensitive conflict) is fixed via the black-box conflict-pair run and the `N1` unit test.

## Files Written

- `/Users/jterrats/dev/smart-deployment/docs/testing/SD-DEV-C4-CHANNEL-qa-report.md` (this report)
- `/Users/jterrats/dev/smart-deployment/docs/testing/SD-DEV-C4-CHANNEL-focused-tests.log`
- `/Users/jterrats/dev/smart-deployment/docs/testing/SD-DEV-C4-CHANNEL-eslint.log`
- `/Users/jterrats/dev/smart-deployment/docs/testing/SD-DEV-C4-CHANNEL-full-suite.log`
- `/Users/jterrats/dev/smart-deployment/docs/testing/SD-DEV-C4-CHANNEL-blackbox-plan-explain.json`
- Disposable fixture (deleted after evidence capture): a `mktemp -d` directory under the system temp
  root, registered via `sf setup-agents scratch register --path <dir>` and removed via
  `sf setup-agents scratch delete --path <dir>` — not part of the repo.

## Evidence Recorded

Recorded on the story directly (no QA phase task exists yet, per the workflow-state note above):

```
sf setup-agents evidence add --task SD-DEV-C4-CHANNEL --role qa --profile qa --type report \
  --path docs/testing/SD-DEV-C4-CHANNEL-qa-report.md --summary "..."
sf setup-agents evidence add --task SD-DEV-C4-CHANNEL --role qa --profile qa --type command \
  --path docs/testing/SD-DEV-C4-CHANNEL-focused-tests.log --summary "..."
sf setup-agents evidence add --task SD-DEV-C4-CHANNEL --role qa --profile qa --type command \
  --path docs/testing/SD-DEV-C4-CHANNEL-full-suite.log --summary "..."
sf setup-agents evidence add --task SD-DEV-C4-CHANNEL --role qa --profile qa --type command \
  --path docs/testing/SD-DEV-C4-CHANNEL-blackbox-plan-explain.json --summary "..."
```

Evidence IDs returned by each call are listed in the handback to the caller.
