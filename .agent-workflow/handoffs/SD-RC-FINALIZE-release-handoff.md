# Release Handoff: SD-RC-FINALIZE

## Verdict

NO-GO. The scoped implementation is functionally approved, but the current branch/worktree is not a release candidate ready to merge under the repository release gates.

Both requested product items pass: JSON validation normalizes the circular `target-org` object before structured logging, and the root Salesforce API version is 67.0. They cannot both be closed as delivered yet because these changes remain uncommitted and the release gate has actual audit/version-workflow failures.

## Blocking Findings

1. `npm audit --omit=dev --json` fails on the Node 24 release runtime with one high and four moderate runtime vulnerabilities. The high finding is `fast-uri` 3.1.5 (`GHSA-5jgf-p345-68v8`, `GHSA-f65p-4m7j-42xc`, `GHSA-fph4-wmhf-6fwf`, and `GHSA-jqff-g426-hqxp`); package overrides and shrinkwrap explicitly retain 3.1.5. The moderate `csv-parse` finding flows through `@jsforce/jsforce-node` and the direct Salesforce dependencies. The publish workflow runs this exact audit and will stop before tagging or publishing.
2. Version/release automation has two competing contracts. Semantic-release 25.0.3 analyzes the three committed changes after `v1.5.0` as a minor release and calculates 1.6.0. However, `.github/workflows/publish-npm.yml` never runs semantic-release; a normal merge with no `package.json` change does not trigger its push path, while the current package/tag/npm version 1.5.0 already exists. A manual workflow run using its default patch bump would produce 1.5.1, contradicting semantic-release. The release mechanism and intended version must be made explicit before merge/publish.
3. The requested fixes are unstaged/uncommitted (`src/commands/validate.ts`, `test/unit/commands/validate.test.ts`, and `sfdx-project.json`). HEAD contains only the three Agentforce commits. Merging the branch HEAD now would omit both requested fixes.
4. Package metadata does not consistently identify the public repository: the checked-out remote is `github.com/jterrats/smart-deployment`, but `package.json.repository.url` points to `github.com/jterratsdev/smart-deployment`. This fails the release-candidate checklist requirement that package metadata match the public repository.

## Verified Gates

- PASS: scoped diff review and `git diff --check`.
- PASS: Node 24 build.
- PASS: Node 24 integration suite, 34 passing.
- PASS: Node 24 E2E suite on an isolated rerun, 36 passing and 2 pending. The earlier concurrent run failed only because two Wireit builds raced on the same cache.
- PASS: Node 24 performance suite, 6 passing.
- PASS with test-infrastructure caveat: full unit run exercised 1679 tests plus 2 pending in QA; the release-manager concurrent rerun reached 1676 passing plus 2 pending before an installed-CLI setup build hit the same Wireit cache race. Independent E2E and build reruns passed.
- PASS: clean-worktree `npm run prepack` under Node 24.
- PASS: clean-worktree `npm pack --dry-run --ignore-scripts --json`, 805 entries, including compiled Agentforce parsers, commands, messages, manifest, lock, and shrinkwrap.
- FAIL: `npm audit --omit=dev --json`, 1 high and 4 moderate runtime vulnerabilities.
- PASS for version analysis: semantic-release 25.0.3, with publish/auth plugins excluded only to avoid publication credentials, identifies `v1.5.0` and calculates next version 1.6.0 from one `feat` and two `fix` commits.
- EXPECTED local limitation: the full semantic-release dry run reaches verification but cannot authenticate to npm/GitHub locally. No publish step ran.
- PASS: npm registry and Git tag checks confirm 1.5.0 already exists and latest is 1.5.0.
- PASS: prior real `cg-demo` evidence remains applicable. API 67 org discovery found AiAuthoringBundle and related Agentforce records; dry-run scanning placed 3 components/4 dependencies in 2 waves; Salesforce check-only deployment job `0Afak00000kUOH2CAO` succeeded 3/3 with zero errors. Current QA also verified `validate --target-org cg-demo --json` succeeds after the logging fix.

## Expected Version

The semantic-release result is **1.6.0**. Do not manually edit the version. The repository must first choose one release authority: either wire `semantic-release` into the release path, or deliberately use the custom workflow with explicit `version=1.6.0` and document that semantic-release is analysis-only. Using the custom workflow's default patch input would instead produce 1.5.1 and is not equivalent.

## Merge And Publish Sequence

1. Resolve the runtime audit so `npm audit --omit=dev --json` exits 0 on Node 24; regenerate and validate both lock artifacts as required.
2. Align `package.json.repository.url` with the actual public repository.
3. Commit the scoped JSON logging test/fix and API 67 change together with only intended release fixes; rerun build, full tests, prepack, pack dry-run, audit, and diff checks from a clean checkout.
4. Resolve the release-authority mismatch and verify the chosen path produces 1.6.0 without pre-existing tag/npm collisions.
5. Merge only after required branch checks are green. Do not interpret the current failing scheduled Windows NUT aggregate as a code regression without rerunning the candidate; Linux unit/NUT and Windows build jobs were green, while historical Windows NUT failures are environment/fake-job related.
6. After merge, invoke only the chosen release path. Verify `v1.6.0`, the GitHub release, npm package visibility, provenance, and `latest=1.6.0`.

## Rollback

- Before tag/publication: revert the merge commit or corrective commits on `main`; do not create a release tag.
- After tag but before npm publication: stop the workflow, delete the GitHub release/tag only if organizational policy permits and no consumer has used it, then fix forward.
- After npm publication: npm versions are immutable. Deprecate 1.6.0 if necessary, restore `latest` to 1.5.0, revert the faulty code on `main`, and publish a corrective 1.6.1 or later version through the same verified path.
- Salesforce smoke was check-only; no org rollback is required for job `0Afak00000kUOH2CAO`.

## Residual Risks

- AiAuthoringBundle records are listable in the API 67 org but remain unavailable for Metadata API retrieve; real evidence covers related retrieved Agentforce metadata and check-only deployment, not direct AiAuthoringBundle retrieval.
- Node 26 remains incompatible with direct Mocha scripts; the supported release/CI runtime is Node 24 and passes those suites.
- Historical scheduled Windows NUT runs fail around fake Salesforce deployment-job behavior; a candidate branch CI rerun is still required before merge.
- Prepack rewrites lockfiles under npm 11; release validation must use the Node 24 workflow toolchain and review generated diffs.
- The worktree contains unrelated Orchestra state and generated `.smart-deployment/` reports; they must not be included in the product merge/package.

## Closure

- JSON target-org logging fix: functionally accepted, not closable as delivered until committed and merged.
- Salesforce API 67 alignment: functionally accepted, not closable as delivered until committed and merged.
- SD-RC-FINALIZE release readiness: remains open/blocked.
- SD-RC-RECONCILE: cannot be closed as release-ready because the original 1.5.0 collision is superseded by, but not operationally resolved into, a verified 1.6.0 release path.
