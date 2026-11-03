![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# SD-DEV-C1-RULES — BA Refinement: MatchingRules and DuplicateRule

Author: Salesforce Professional Services · Version 1.0 · Phase `ba` · Run `wf-1793266575987-0bc63f`

Scope: fit-gap of prior art against AC-001..AC-004, recommended delivery approach, refined acceptance
details, open questions. No code. Project `sourceApiVersion` 67.0.

## Inputs reviewed

- `docs/research/metadata-catalog/unknown-validation-handoff.md` (C1 rows, QA note on the singular fixture).
- Prior art `origin/feat/wave-deployment-order-contracts` (base `63bf0ca` = `origin/main`), read via `git show`:
  `c16c4ca` wave ordering, `45d5cd3` Retail Execution settings, `2431d6a` matching/duplicate rules,
  `a59eaf5` live-org hardening (empty standard-rule containers, FlexiPage). 45 files, +2037/−154.
- Local reviews `.agent-workflow/reviews/SD-MATCH-DUP-*` (all `approve`; "lifecycle polling remains
  intentionally manual pending a stable Salesforce query contract").
- Integration branch `reconcile/release-candidate` (HEAD, PR #274).

Certainty labels: **[Confirmed]** = read in code/docs; **[Func rec]** / **[Tech rec]** = recommendation;
**[Pending]** = needs human/org confirmation.

## 1. Fit-gap per AC

| AC                                                                                       | Prior art satisfies                                                                                                                                                                                                                                                                                                                         | Partial / gap                                                                                                                                                                                                                                                                                                                                                                       | Contradicts                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AC-001 container XML + exact identity                                                    | `matching-rules-parser.ts` requires root `MatchingRules`, iterates `<matchingRules>` children, requires `fullName` and `ruleStatus ∈ {Active, Inactive}`; rejects malformed XML and `<DuplicateRule />` root. Node id `MatchingRules:<Object>` from `<Object>.matchingRule-meta.xml`. [Confirmed]                                           | No check that a rule `fullName` is consistent with the container object, no check that the file basename is a valid object API name. Empty container (`a59eaf5`) returns `undefined` — silently drops the node instead of recording "standard rule, target-owned". Per-rule `MatchingRule:<Object>.<Rule>` manifest identity is not modelled (only the container type). [Confirmed] | **Gap analysis still reports `MatchingRules` as `supported` from the singular `<MatchingRule />` fixture** (`test/unit/analysis/metadata-gap-analysis-service.test.ts` on the branch), because support derives from the suffix + capability registry, not from a successful parse. Capability registry marks discovery/parsing/dependencies/ordering/fixtures `proven` with `minApiVersion '61.0'` without org retrieve evidence. [Confirmed] |
| AC-002 distinct DuplicateRule, verified references, local vs target uncertainty          | Distinct `DuplicateRule` type, node `DuplicateRule:<Object>.<Rule>`, filename must be `Object.Rule`; parses `duplicateRuleMatchRules` (`matchRuleSObjectType` + `matchingRule`), filter fields, required `isActive`. Missing rule inside a **local** container fails closed; active-duplicate → inactive-matching fails closed. [Confirmed] | References to objects/fields/rules that are not local are **silently dropped** (no edge, no fact) — e.g. a standard matching rule with no container is "target-owned" only by omission. There is no explicit `local-missing` vs `target-unknown` outcome as required by the handoff. Filter `table` defaults to the owning object without validation. [Confirmed]                   | Branch adds its own `parseCustomFieldComponent` (no `fullName` check) while RC already has a stricter one in `data-metadata-scanner.ts`; CustomField projection belongs to SD-DEV-C1-GRAPH. Duplicate/competing CustomField node producer. [Confirmed]                                                                                                                                                                                        |
| AC-003 deterministic +/− fixtures, fail-closed, no activation/readiness from order entry | Good fixture set: parser, scanner, lifecycle ordering (deactivate DuplicateRule before MatchingRules), inactive/missing references, checkpoint id collisions, destructive manifest rejection, scan errors abort start (`start-execution-service.ts`). No code activates rules. [Confirmed]                                                  | Readiness is a **manual** after-wave checkpoint ("Confirm matching-rule activation completed…"): it is not an automated readiness claim, but no fixture asserts that the plan never reports readiness without that checkpoint being satisfied. Missing-local-field / missing-object negative fixtures exist only as "no edge", not as an explicit unresolved outcome. [Confirmed]   | `DEPLOYMENT_ORDER` gets `MatchingRules: 17` and `DuplicateRule: 17`, and the registry says `ordering: proven` partly on that basis — an order entry used as support evidence, which AC-003 forbids. [Confirmed]                                                                                                                                                                                                                               |
| AC-004 independent QA of executed tests, org evidence before enabling deploy             | Prior QA reviews report full suite pass and a scoped live check-only. [Confirmed]                                                                                                                                                                                                                                                           | Those reviews belong to other stories (SD-MATCH-DUP-\*), pre-date RC, and are not executed against this story's merged code; live evidence was on an external org (`cg-demo`), API version not recorded. [Confirmed]                                                                                                                                                                | Branch enables deployment of both types (manifest generation, `start` path) without gating on org retrieval/behavior evidence for API 67.0. [Confirmed]                                                                                                                                                                                                                                                                                       |

## 2. Recommended delivery approach

**[Tech rec] Selective re-port onto `reconcile/release-candidate` (after PR #274 merges), not a rebase/merge of the branch.**

- Port only the C1-RULES slice of `2431d6a` + the scanner part of `a59eaf5`: the two parsers, the
  data-quality scanner, the readiness planner, and their tests. Rework them to meet AC-001..AC-003
  (explicit unresolved outcomes, support status derived from parse evidence, no `proven` without org evidence).
- **Do not port** `c16c4ca` (safe wave ordering): RC already carries an equivalent rewrite
  (`e70f7f8`/`1d77607` "enforce safe wave order…"); the branch conflicts with RC in 14 files including
  `wave-builder/merger/topology/validator` and `deployment-order.ts` (`git merge-tree`). Treat as superseded by RC. [Confirmed conflict; supersession = Tech rec]
- **Split out** `45d5cd3` (Retail Execution settings) to SD-DEV-PRODUCT-SETTINGS — out of C1-RULES scope. [Func rec]
- **Drop** the branch's `parseCustomFieldComponent`; reuse RC's CustomField node from `data-metadata-scanner.ts` and coordinate with SD-DEV-C1-GRAPH (handoff requires disjoint or serialized ownership of scanner/gap-analysis files).
- FlexiPage parser change in `a59eaf5` is out of scope; route to whichever story owns FlexiPage (blocked executor must stay untouched).

Risks: (R1) PR #274 not yet merged — porting before merge doubles conflict work; (R2) C1-GRAPH edits the
same `metadata-scanner-service.ts` / `metadata-gap-analysis-service.ts`; (R3) deleting the branch loses
traceability — keep it unmerged as reference, cite commit SHAs in the new commits; (R4) prior QA approvals
must not be reused as AC-004 evidence.

## 3. Refined acceptance details (proposals — AC text unchanged)

Plain observable bullets (no AC-format preference recorded in project-knowledge; default applied).

AC-001

- A `MatchingRules` container `<MatchingRules><matchingRules><fullName>…` with 1..n rules yields one node `MatchingRules:<Object>` plus per-rule facts; manifest member is `<Object>`.
- Singular `<MatchingRule />`, wrong root, invalid XML, missing `fullName`/`ruleStatus` → scan error, and gap analysis must **not** report `supported` (replace the existing singular gap fixture with a real container + a separate negative case).
- Empty container → explicit "target-owned standard rules, no local rules" outcome, not a silently dropped node.

AC-002

- Each DuplicateRule reference (object, filter field, matching rule) resolves to exactly one of: `local`, `local-missing` (fail-closed), `target-unknown` (reported, not an edge, not a readiness claim).
- `DuplicateRule` and `MatchingRules` never share a node id or catalog key; no new CustomField producer.

AC-003

- Fixtures: present prerequisites; missing local object/field/rule; inactive rule referenced by active duplicate rule; invalid filename identity; destructive request → each yields a deterministic plan or fail-closed error.
- No plan output, capability entry, or report states "active"/"ready" from a `DEPLOYMENT_ORDER` entry; readiness only via an unsatisfied manual checkpoint until an org query contract exists.

AC-004

- QA runs the tests on the story's final commit and records command output.
- Capability status for both types stays below `proven`/deploy-enabled until API 67.0 disposable-org retrieve + validate + rule-behavior evidence is attached. No deploys or edits in external projects.

**Proposed AC change, needs human confirmation:** AC-003 — clarify that a _manual_ after-wave readiness checkpoint is an allowed mechanism (it is not a readiness claim). Without this, the prior-art checkpoint design is ambiguous against the AC.

## 4. Open questions (human)

1. Approach: confirm selective re-port after PR #274 merge (vs. rebase whole branch, vs. clean reimplementation).
2. Confirm `45d5cd3` moves to SD-DEV-PRODUCT-SETTINGS and `c16c4ca` is superseded by RC.
3. Confirm the AC-003 clarification about the manual checkpoint.
4. Is per-rule `MatchingRule` (singular type, `Object.Rule`) manifest identity in scope, or container-only?
5. Which org (licensed, disposable, API 67.0) provides AC-004 evidence, and who owns obtaining it? [Pending]
6. Sequencing with SD-DEV-C1-GRAPH: serialize (which first?) or split file ownership?

ROM: medium (~1 week incl. rework and QA), excluding org evidence acquisition. Persona: release engineer
running `sf smart-deployment start` against a target org.

## Prior work check

Related: SD-DEV-PRODUCT-SETTINGS (consistent — receives Retail Execution split), SD-DEV-C1-GRAPH (consistent,
coordination required on shared files/CustomField), SD-DEV-C2-SOURCES, SD-DEV-P2-PROVIDER-BOUNDARIES (consistent),
SD-METADATA-UNKNOWN-VALIDATION and decision `…cb0547` (consistent — one catalog key per type, fail-closed),
SD-DEV-C4-CHANNEL decisions (consistent, no overlap). No conflicts.
