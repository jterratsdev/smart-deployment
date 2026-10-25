![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# SD-DEV-C4-CHANNEL — Release Candidate Note

Author: Salesforce Professional Services (release-manager profile)

Version: 1.2 (yarn.lock integrity fixed; release:contracts now passes)

- Run: wf-1792664256358-7bd912 · Phase: `release`
  - v1.0 evidence: task `setup-agents-task-1792906427032-ee958cb5`, digest `efd6e1acc707`, HEAD `1876d2f`
  - v1.1 evidence: task `setup-agents-task-1792915427141-1e7933af`, digest `47d8b52de21b`, HEAD `939b914`
  - v1.2 evidence (this update): task `setup-agents-task-1792916815279-15399e39`, digest `3fb095eb38d9`, HEAD `ad59d1a`
- Repo: `@jterrats/smart-deployment` (TypeScript `sf` CLI plugin — **not** a Salesforce org project)
- Branch: `reconcile/release-candidate` · HEAD: `ad59d1a` (feature code at `fe1b418`; npm-audit fix at
  `5153fcd`; coverage-instrumentation fix at `aeb4097`; release note at `939b914`; yarn.lock integrity
  fix at `ad59d1a`)
- Current published tag: `v1.6.3` · `package.json` version: `1.6.4` (not yet bumped for this change set)

## What changed

`OmniStudioVlocityProvider` now classifies every OmniStudio candidate path into exactly one of
three channels before any plan is built:

- **`native-metadata`** — matches the Metadata API registry shape for `OmniDataTransform`,
  `OmniIntegrationProcedure`, `OmniScript`, or `OmniUiCard` (dir + suffix pair). Never routed to a
  managed VBT command.
- **`managed-datapack`** — only when the VBT `<Type>/<Name>/<Name>_DataPack.json` shape AND a
  concrete managed package/runtime identity (`<ns>__` prefix on `VlocityRecordSObjectType`, or a
  `vlocity.yaml`-declared namespace resolving the `%vlocity_namespace%` token) are both evidenced.
- **`blocked`** — unknown shape, unproven identity, or a channel conflict (same logical artifact
  claimed by both channels). A `blocked` classification fails the plan (`plan.success = false`)
  with a `remedy` string (see `docs/known-limitations.md` → "OmniStudio Channel Classification").

New module: `src/deployment/omnistudio-channel-classifier.ts`. No executable VBT job generation,
DataPack import, business-data provisioning, native deploy enablement, or org call is introduced —
classification only (AC-004).

## Behavior change for users with legacy `vlocity/` folders

Before this change, a directory-name match alone (e.g. an `omniScripts/` path) could route into the
managed VBT code path and emit an unresolvable `%vlocity_namespace%` placeholder command — a job
that could never actually execute. After this change:

- Native-looking paths are always classified `native-metadata` and never reach the VBT path, by
  shape alone — no behavior change for correctly-shaped native fixtures.
- A legacy/ambiguous `vlocity/` DataPack export that lacks a concrete managed namespace or a
  `vlocity.yaml`-declared namespace now **fails the plan** (`blocked` / `identity-unproven`) instead
  of silently producing a dead placeholder command.
- **Remedy for an affected user:** declare a root-level `namespace: <ns>` key in `vlocity.yaml` at
  the project root, or re-export with VBT so `VlocityRecordSObjectType` carries a concrete
  `<ns>__<Name>__<suffix>` managed API name. See the reason/remedy table in
  `docs/known-limitations.md`.

This is a stricter, fail-closed gate, not a new capability — plans that previously "succeeded" with
an unexecutable placeholder command now report a clear blocking error instead.

## Evidence (v1.2, HEAD `ad59d1a`)

| Check                         | Command                                                                             | Result                                                                                                                                                                                                                              |
| ----------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Build                         | `yarn build`                                                                        | succeeded, exit 0                                                                                                                                                                                                                   |
| Full test suite               | `yarn test:only`                                                                    | **1820 passing, 8 pending (pre-existing/unrelated), 0 failing**, exit 0                                                                                                                                                             |
| npm audit (production deps)   | `npm audit --omit=dev --json`                                                       | **0 critical/high** (1 moderate — `fast-copy`, unrelated, outside the release gate's critical/high filter); npm exits 1 whenever any advisory exists (even moderate-only), so exit 1 here does not indicate a critical/high finding |
| Coverage instrumentation      | real c8 numbers from `yarn test:only` under the ESM loader                          | statements 92.87%, branches 82.61%, functions 94.07%, lines 92.87%                                                                                                                                                                  |
| Release contract check        | `yarn release:contracts`                                                            | **PASSES** — "Release metadata and protected-main contracts are valid.", exit 0                                                                                                                                                     |
| Semantic-release dry analysis | `yarn release:analyze` (commit-analyzer only, no npm/GitHub publish plugins loaded) | 16 commits since `v1.6.3`; **expected next release: `type=minor`, `version=1.7.0`**, exit 0                                                                                                                                         |

### `yarn release:contracts` is now fixed

Commit `ad59d1a` (`fix(sd-dev-c4-channel): repair yarn.lock integrity after audit remediation`)
regenerated `yarn.lock` so the three previously-broken entries (`ip-address@10.2.0`,
`minipass-flush@^1.0.5`, the multi-range `typescript@4.6.x || ... || 5.6.x` entry) carry
`resolved`/`integrity` again, and all `resolutions` pins (including
`**/socks/**/ip-address` and `**/minimatch/brace-expansion`) are now satisfied. Verified directly:
`yarn release:contracts` exits 0 at HEAD `ad59d1a`. This closes the finding reported in v1.1 of
this note.

### Note on the coverage threshold

`.nycrc` declares an internal `check-coverage: true` gate at 90% for lines/statements/functions/branches,
but `yarn test:only` runs with `c8 --check-coverage=false`, so this threshold is not enforced at test
time. The measured branches figure (82.61%) is below that internal 90% target; lines/statements/functions
(92.87% / 92.87% / 94.07%) are above it. Whether to raise branch coverage before release, lower the
`.nycrc` branches target, or accept the gap is a human decision — not something resolved by this phase.

## Prior-phase evidence referenced (already recorded, not reproduced here)

- Architecture: `docs/architecture/c4-omnistudio-channel-classification.md`
- Security re-review (PASS-WITH-FINDINGS): `docs/reviews/SD-DEV-C4-CHANNEL-security-review.md`
- QA report (PASS-WITH-RISKS): `docs/testing/SD-DEV-C4-CHANNEL-qa-report.md`,
  `docs/testing/SD-DEV-C4-CHANNEL-focused-tests.log`,
  `docs/testing/SD-DEV-C4-CHANNEL-full-suite.log`,
  `docs/testing/SD-DEV-C4-CHANNEL-blackbox-plan-explain.json`
- Document review (approve): `docs/reviews/SD-DEV-C4-CHANNEL-document-review.json`

## Residual risks (carried forward, not blocking this release candidate)

1. **VBT `Type_SubType_Language` naming convention is unverified.** The channel-conflict key
   assumes a VBT DataPack folder's `<Name>` segment lines up exactly with the native file's
   `<Name>` for `IntegrationProcedure`/`OmniScript` types. Confirmed on the native (Metadata API)
   side only; not independently verified against a real VBT export. Fails closed (over-flags
   conflicts) rather than under-flags, so it is safe for this classification-only scope, but should
   be re-verified before any later task trusts `classifications[]` for conflict resolution.
2. **Identity is repo-declared, not org-proven.** The `<ns>__` prefix or `vlocity.yaml`-declared
   namespace is source-content evidence only; there is no org call confirming the namespace matches
   an actually-installed managed package. This is by design — AC-004 explicitly excludes org calls
   from this task — and is already flagged as a later lifecycle task's responsibility in both the
   architecture doc and the security re-review (finding N4).
3. Security re-review minors N1–N3 (case-sensitive conflict key — now fixed and QA-confirmed;
   realpath-failure fallback; size cap ordering) and locale-dependent sort (F7) remain tracked as
   open hardening items per the security review's own "Residual risk / owner" section.

## Rollback

```
git revert fe1b418
```

Reverting the single `fix(sd-dev-c4-channel)` commit returns `OmniStudioVlocityProvider` to its
prior behavior: directory-name-based routing of native-looking OmniStudio paths into the managed
VBT code path, which emits the unresolvable `%vlocity_namespace%` placeholder command described
above. The companion `docs(sd-dev-c4-channel)` commit (`1876d2f`) only records QA/document-review
evidence and does not need to be reverted for the code behavior to roll back, but reverting it too
keeps the docs consistent with the reverted code.

## Scope limits honored in this phase

- **No Salesforce org deploy of any kind was performed.** AC-004 forbids org calls for this task,
  and this plugin is itself the deliverable (a CLI tool), not a Salesforce org metadata package —
  the org-deploy/validate/quick-deploy steps in `.setup-agents/playbooks/release.md` and
  `.setup-agents/playbooks/validate.md` do not apply to this story.
- **No `git push`, tag, PR creation, `npm publish`, or non-dry `semantic-release` run was
  performed.** Only the read-only analyzer (`scripts/ci/analyze-release.mjs`, no npm/GitHub publish
  plugins loaded, no credentials used) and the static release-contract checker were run.
- **No commit was made in this phase.**

## Pending human steps

The following remain for a human to execute (explicit human approval required per
`AGENTS.md` Action Risk Scale — ⚠️ ASK / 🔒 Human-only tiers):

0. Run `sf setup-agents local --force` to resync the ~50 stale generated scaffold files flagged by
   the release gate's `setup-health` check (`.cursor/skills/*`, `.generated-prompts/*`,
   `.setup-agents/playbooks/*`, etc. — embedded 3.16.0 vs. current plugin 3.23.0). This command is
   human-only and must not be run by an agent session.
   0b. Decide whether to raise branch coverage (currently 82.61%) to meet `.nycrc`'s internal 90% target,
   lower that target, or explicitly accept the gap — not enforced today since `yarn test:only` runs
   with `c8 --check-coverage=false`.
1. Review and push the `reconcile/release-candidate` branch to the remote.
2. Open a pull request from `reconcile/release-candidate` to `main`.
3. Let CI run (install, build, full test suite, lint, release workflow checks) on the PR.
4. Merge the PR to `main` (squash merge per branching convention).
5. Let `semantic-release` run on `main` to compute and publish the actual next version (expected
   `1.7.0` per the dry-run analysis above, pending whatever commits land between now and merge),
   create the Git tag, GitHub Release, and npm publish with provenance.
