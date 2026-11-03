![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# C1-RULES: MatchingRules and DuplicateRule Design Note

- Author: Salesforce Professional Services · Version 1.0
- Status: Proposed (architect phase, SD-DEV-C1-RULES, run `wf-1793266575987-0bc63f`)
- Date: 2026-10-29 · `sourceApiVersion` 67.0
- Inputs: `docs/research/metadata-catalog/c1-rules-refinement.md`, decision `setup-agents-decision-1793266982809-0327d9`,
  prior art `2431d6a` and the scanner part of `a59eaf5` (read with `git show`), target base `reconcile/release-candidate`.
- Human-approved defaults: selective re-port after PR #274 merges; `45d5cd3` goes to SD-DEV-PRODUCT-SETTINGS and
  `c16c4ca` is dropped (the RC branch supersedes it); container-only identity; org evidence still pending; C1-RULES ships before C1-GRAPH.

## 1. Context (what the RC code does now) [Confirmed]

- `metadata-gap-analysis-service.ts` maps `.matchingRule-meta.xml` to `MatchingRules` by suffix. `getSupportStatus`
  returns `supported` when the registry entry has `discovery: proven`. If it doesn't, it returns `ordered-only` when
  `ordering: proven`, and `unsupported` otherwise. No file content is read.
- `metadata-capability-definitions.ts` builds `orderedDefinition()` entries with `ordering: proven` for every
  `DEPLOYMENT_ORDER` key that has no explicit definition, and `scannerDefinition()` does the same for legacy types. So an order
  entry already counts as proof. `MatchingRules` has an explicit row (discovery partial, everything else absent).
  `DuplicateRule` has no row.
- `DEPLOYMENT_ORDER` is typed `Record<MetadataType, number>`. Adding a type to `MetadataType` therefore requires
  an order entry, and without an explicit registry row that entry would make the type `ordering: proven`.
- `data-metadata-scanner.ts#parseCustomFieldComponent` already produces `CustomField:<Object>.<Field>` and fails when
  `fullName` does not match the file name. `scanDataMetadata` adds a `CustomObject` edge only when that object is scanned locally.
- `WaveManifestService.generateManifest/generateDestructiveManifest` is where `deployment-runner.ts` and
  `cycle-remediation-runner.ts` turn a wave into a deployable manifest.

## 2. MatchingRules container contract (AC-001)

| Aspect                    | Contract                                                                                                                                                                                                                                                                                                                               |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source path               | `**/matchingRules/*.matchingRule-meta.xml`                                                                                                                                                                                                                                                                                             |
| Node id / manifest member | `MatchingRules:<Object>` / `<members><Object></members>` under `<name>MatchingRules</name>`. `<Object>` = file basename. It must be non-empty and contain no `.`, otherwise it is a scan error.                                                                                                                                        |
| Root                      | The XML must be well-formed and the root must be exactly `MatchingRules`. `<MatchingRule />`, `<DuplicateRule />`, other roots, and invalid XML produce a scan error (appended to `errors`). They never produce a component.                                                                                                           |
| Children                  | Each `<matchingRules>` child needs a `fullName` and a `ruleStatus` in `{Active, Inactive}`. The `fullName` must be bare, or be `<Object>.<Rule>` with a prefix equal to the container object (the prefix is stripped). Duplicate rule names are an error. `matchingRuleItems.fieldName` values are collected, deduplicated and sorted. |
| Facts                     | `{ kind: 'matching-rules', objectName, rules: [{ name, fields, isActive }] }`, sorted by name.                                                                                                                                                                                                                                         |
| Empty container           | A valid root with zero `<matchingRules>` still emits the component with `rules: []`. This explicitly records "no local rules; standard rules are target-owned". It is not dropped (the `a59eaf5` behavior returned `undefined` and is rejected). An empty container creates no dependencies and makes no readiness claim.              |
| Per-rule identity         | `MatchingRule:<Object>.<Rule>` is **out of scope**. Only the container is modelled.                                                                                                                                                                                                                                                    |

**Support evidence.** A gap-analysis `supported` status for `MatchingRules` requires every detected
`.matchingRule-meta.xml` file to parse successfully through `parseMatchingRules`. One parse failure makes the type
`unsupported`, and the gap lists the failing file and the parser message. Evidence from a manifest alone, from a suffix alone,
or from the registry alone is never `supported` (§5).

## 3. DuplicateRule contract (AC-002)

| Aspect                    | Contract                                                                                                                                                                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source path               | `**/duplicateRules/*.duplicateRule-meta.xml`                                                                                                                                                                                                             |
| Node id / manifest member | `DuplicateRule:<Object>.<Rule>` / `<Object>.<Rule>`. The basename must split at the first `.` into two non-empty parts, otherwise it is a scan error. This is a distinct `MetadataType` and catalog key. It never shares a node id with `MatchingRules`. |
| Root                      | Only `DuplicateRule` is accepted. Invalid XML or a wrong root is a scan error. `isActive` is required and must be `true` or `false`.                                                                                                                     |
| References parsed         | `duplicateRuleMatchRules` gives `(matchRuleSObjectType, matchingRule)`, and both are required. `duplicateRuleFilter.duplicateRuleFilterItems` gives `(table ?? owning object).field`. The owning object comes from the file name.                        |
| Facts                     | `{ kind: 'duplicate-rule', objectName, isActive, references: DataQualityReference[] }`, deterministic order.                                                                                                                                             |

**Reference outcomes.** One new type is shared by both rule facts:

```ts
type DataQualityReference = {
  kind: 'object' | 'field' | 'matching-rule';
  identity: string; // CustomObject:X | CustomField:X.F | MatchingRules:X#Rule
  outcome: 'local' | 'local-missing' | 'target-unknown';
  reason: string;
};
```

| Reference                | `local`                                                 | `local-missing` (fail closed, scan error)                                                                                                      | `target-unknown` (fact only, no edge)                    |
| ------------------------ | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| Owning/referenced object | `CustomObject:X` is in the scanned graph                | never; object absence is not provable locally                                                                                                  | object not in the local graph (standard or org-only)     |
| Filter / matching field  | `CustomField:X.F` is in the scanned graph (RC producer) | never in C1-RULES                                                                                                                              | field not in the local graph                             |
| Matching rule            | `MatchingRules:X` is local and contains `Rule`          | `MatchingRules:X` is local but does not contain `Rule`. A local container is the complete deployable rule set for X, so the absence is proven. | `MatchingRules:X` not local (standard or org-owned rule) |

Additional fail-closed rule (carried over from the prior art): an **active** DuplicateRule that references a local
**inactive** matching rule is a scan error.

Edges: only `local` outcomes become `dependencyDetails` (`kind: 'hard'`, `source: 'parser'`).
`target-unknown` is never an edge, never a readiness claim, and never silently dropped, because it stays visible in `facts.references`.
Lifecycle edges carried over from the prior art: an active DuplicateRule depends on `MatchingRules:X`, and
`MatchingRules:X` depends on an inactive DuplicateRule (deactivate first). Both apply only when the reference is `local`.

**Error channel.** The cross-component pass collects messages into the scan `errors` array and returns
`{ components, errors }`. It does not throw out of the scan, which is what `2431d6a` did. `plan-explain`, validation and
the plan report already treat a non-empty `scanResult.errors` as blocked.

**Where the pass runs.** `MetadataScannerService.scanMetadata` runs it after all package directories are flattened, because references
can cross package directories. The existing `addLocalSharingPrincipalDependencies` call stays where it is.

## 4. CustomField reuse

The branch's `parseCustomFieldComponent` in `data-quality-rule-scanner.ts` and its second `**/objects/*/fields/**`
scan are **dropped**. C1-RULES reads existing `CustomField:<Object>.<Field>` nodes produced by
`data-metadata-scanner.ts` and does not modify that file. Typed CustomField projection belongs to SD-DEV-C1-GRAPH.

## 5. Gap analysis and capability registry changes (AC-001, AC-003)

**Gap analysis** (`metadata-gap-analysis-service.ts`):

1. Add the suffix `['.duplicateRule-meta.xml', 'DuplicateRule']`. Do not add directory-name mappings, because those would be evidence without a parse.
2. Add a small per-type source verifier map, `PARSE_VERIFIED_TYPES: Map<type, (content) => void>`, holding `MatchingRules` and
   `DuplicateRule` and backed by the two parsers. For a listed type, `supportStatus` is `supported` only when
   (a) the registry has `discovery: proven`, (b) at least one source file was detected, and (c) every detected source
   file parses. Otherwise it is `unsupported`, and the gap evidence includes the parse failure or "manifest-only evidence".
   Types not in the map keep their current behavior. This change does not touch them.
3. Replace the existing `<MatchingRule />` fixture expectation. The singular root must report `unsupported`, and a separate real container must report `supported`.

**Capability registry** (`metadata-capability-definitions.ts`): explicit rows for both types, so that the
`orderedDefinition()` default never applies to them:

| Capability   | MatchingRules | DuplicateRule | Basis                                                                                                        |
| ------------ | ------------- | ------------- | ------------------------------------------------------------------------------------------------------------ |
| discovery    | proven        | proven        | scanner registered, plus repository fixtures                                                                 |
| parsing      | proven        | proven        | parser fixtures (positive and negative)                                                                      |
| dependencies | partial       | partial       | `target-unknown` references are facts, not edges                                                             |
| ordering     | partial       | partial       | local dependency/lifecycle edges only. A `DEPLOYMENT_ORDER` entry is a type-priority hint, **not** evidence. |
| lifecycle    | absent        | absent        | activation behavior and readiness need target-org evidence (AC-004)                                          |
| fixtures     | proven        | proven        | repository fixtures only                                                                                     |

Evidence source for every row is `REPOSITORY_SOURCE`, and no org source is cited. `minimumApiVersion` is not raised or newly asserted
from the prior art's `61.0`. `MatchingRules` keeps its current RC value, and `DuplicateRule` uses the same value, flagged TBD-2.

**DEPLOYMENT_ORDER**: add `MatchingRules` and `DuplicateRule` (required by the `Record<MetadataType, number>` typing). Both go in
Tier 1, after `CustomField` (11), with `DuplicateRule` strictly after `MatchingRules`. The developer chooses the exact values
and pins them in `deployment-order.test.ts`. A registry test asserts that neither type is `ordering: proven`.

## 6. Deployment enablement stays blocked (AC-004)

`WaveManifestService` rejects any wave containing a `MatchingRules` or `DuplicateRule` node in **both**
`generateManifest` and `generateDestructiveManifest`. The error says that target-org retrieve, validate and rule-behavior
evidence is required before these types can deploy. That is the only deployment choke point the prior art shares. Scan,
plan, analyze and `plan explain` still show the nodes, their edges and their reference outcomes. Lifting the guard is a separate,
evidence-gated change.

The readiness planner (`data-quality-readiness-planner.ts`) and its `start`/`resume`/`state-manager` wiring are
**deferred**, not ported. While the guard is in place they would be unreachable code. The AC-003 clarification is recorded as
_proposed_ (manual after-wave checkpoint is allowed and is not a readiness claim). It governs that later enablement change. The AC text is unchanged.

## 7. File-level ownership

| File                                                                                                                                                                                                                                                                                                                                                                                                                                        | C1-RULES change                                                                      | Overlap                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------ |
| `src/parsers/matching-rules-parser.ts` (new)                                                                                                                                                                                                                                                                                                                                                                                                | port and harden (§2)                                                                 | none                                       |
| `src/parsers/duplicate-rule-parser.ts` (new)                                                                                                                                                                                                                                                                                                                                                                                                | port and harden (§3)                                                                 | none                                       |
| `src/services/scanners/data-quality-rule-scanner.ts` (new)                                                                                                                                                                                                                                                                                                                                                                                  | component builders plus reference-outcome pass. No CustomField producer.             | none                                       |
| `src/services/metadata-scanner-service.ts`                                                                                                                                                                                                                                                                                                                                                                                                  | two `scanMetadataFiles` calls in `scanDataMetadata`, plus the pass in `scanMetadata` | **C1-GRAPH** (serialize: C1-RULES first)   |
| `src/types/metadata.ts`                                                                                                                                                                                                                                                                                                                                                                                                                     | two `MetadataType` members, two `MetadataFacts` variants, `DataQualityReference`     | **C1-GRAPH** (likely adds facts)           |
| `src/constants/deployment-order.ts`                                                                                                                                                                                                                                                                                                                                                                                                         | two entries                                                                          | none                                       |
| `src/analysis/metadata-capability-definitions.ts`                                                                                                                                                                                                                                                                                                                                                                                           | two explicit rows                                                                    | **C1-GRAPH** (CustomField/Flow rows)       |
| `src/analysis/metadata-gap-analysis-service.ts`                                                                                                                                                                                                                                                                                                                                                                                             | suffix plus parse-verified support                                                   | **C1-GRAPH**                               |
| `src/deployment/wave-manifest-service.ts`                                                                                                                                                                                                                                                                                                                                                                                                   | enablement guard                                                                     | none                                       |
| Tests: `test/unit/parsers/{matching-rules,duplicate-rule}-parser.test.ts`, `test/unit/services/data-quality-rule-scanner.test.ts`, `test/unit/services/metadata-scanner-data-quality-integration.test.ts`, `test/unit/analysis/metadata-{gap-analysis-service,capability-registry}.test.ts`, `test/unit/constants/deployment-order.test.ts`, `test/unit/deployment/wave-manifest-service.test.ts`, `test/unit/types/metadata-types.test.ts` | new or updated                                                                       | C1-GRAPH on the analysis and scanner tests |

**Not touched:** `src/deployment/start-*`, `resume-deployment-service.ts`, `deployment-runner.ts`,
`state-manager.ts`, `src/commands/start.ts`, `src/waves/*`, `data-metadata-scanner.ts`, FlexiPage parser/types,
`test/nut/*` (a concurrent agent owns these). Retail Execution goes to SD-DEV-PRODUCT-SETTINGS.

## 8. Test matrix

| #   | Fixture                                                                              | Expected                                                                                                                        | AC       |
| --- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- | -------- |
| T1  | Container, 2 rules (Active and Inactive), fields                                     | one `MatchingRules:Account`, sorted facts, manifest member `Account`                                                            | 001      |
| T2  | Singular `<MatchingRule />` root                                                     | scan error; gap `unsupported`                                                                                                   | 001      |
| T3  | Invalid XML / `<DuplicateRule />` root in a `.matchingRule` file                     | scan error; gap `unsupported`                                                                                                   | 001      |
| T4  | Missing `fullName` / bad `ruleStatus` / duplicate rule name / prefix ≠ object        | scan error                                                                                                                      | 001      |
| T5  | Empty container                                                                      | component with `rules: []`, no edges, no readiness                                                                              | 001      |
| T6  | Manifest-only `MatchingRules` (no source)                                            | gap `unsupported` ("manifest-only")                                                                                             | 001, 003 |
| T7  | DuplicateRule valid, all refs local                                                  | node `DuplicateRule:Account.Rule`, hard edges to object, field and container; outcomes `local`                                  | 002      |
| T8  | DuplicateRule with standard object/field and no local container                      | outcomes `target-unknown`, no edges, no error                                                                                   | 002      |
| T9  | Local container lacks the referenced rule                                            | outcome `local-missing`, scan error                                                                                             | 002, 003 |
| T10 | Active DuplicateRule → local inactive matching rule                                  | scan error                                                                                                                      | 002, 003 |
| T11 | Bad DuplicateRule filename (`Rule` without object) / missing `isActive` / wrong root | scan error                                                                                                                      | 002, 003 |
| T12 | Inactive DuplicateRule → local matching rule                                         | `MatchingRules:X` depends on `DuplicateRule:…` (deactivation edge)                                                              | 003      |
| T13 | Cross-package-directory reference                                                    | resolves `local` after the flattened pass                                                                                       | 002      |
| T14 | Wave containing either type → `generateManifest` and `generateDestructiveManifest`   | both throw the enablement error                                                                                                 | 003, 004 |
| T15 | Registry rows                                                                        | neither type has `ordering: proven` or `lifecycle: proven`. Deleting the `DEPLOYMENT_ORDER` entries changes no registry status. | 003      |
| T16 | Determinism                                                                          | the same fixture scanned twice gives a byte-identical facts/edges JSON                                                          | 003      |

AC-004 is checked by QA running the suite at the story's final commit. These unit fixtures do not count as AC-004 evidence.

## 9. Out of scope

Per-rule `MatchingRule` identity; activation, deactivation or polling automation; the readiness planner and its start/resume wiring;
lifting the deployment guard; org retrieval or deploys (no org identified); CustomField/Flow projection (C1-GRAPH);
Retail Execution settings (PRODUCT-SETTINGS); FlexiPage hardening; wave-ordering rewrite (already on RC); start aborting
on scan errors (it touches `start-execution-service.ts`, which is owned elsewhere).

## Architectural Concerns (inherited)

1. **(a)** "Gap analysis reports `MatchingRules` as `supported`" from the singular fixture, through the suffix plus the registry. **(b)** Support must be
   gated on a successful container parse (§5). **(c)** Metadata API defines `MatchingRules` as the container type, and singular
   `MatchingRule` exists only as a child/manifest member (Metadata API Developer Guide, MatchingRules). A suffix cannot prove the root.
2. **(a)** Registry rows marked `ordering: proven` partly because `DEPLOYMENT_ORDER` has entries. **(b)** Explicit rows with
   `ordering: partial` and `lifecycle: absent`. **(c)** AC-003, and the existing `orderedDefinition()` default that would otherwise apply.
3. **(a)** Non-local references "silently dropped". **(b)** A three-way `local` / `local-missing` / `target-unknown` outcome kept in facts.
   **(c)** AC-002, and standard matching rules that are owned by the target org rather than the project.
4. **(a)** A duplicate `parseCustomFieldComponent` producer. **(b)** Reuse the RC producer in `data-metadata-scanner.ts`. **(c)** Project
   rule "reuse existing patterns", and C1-GRAPH ownership.
5. **(a)** Readiness checkpoints wired into `start`, with deployment enabled for both types. **(b)** A manifest guard, with the planner deferred.
   **(c)** AC-004 requires org evidence before enablement. No org has been identified.
6. **(a)** The cross-component pass throws out of the scan. **(b)** Append to `errors`. **(c)** The existing `scanResult.errors` blocking contract.

## Architectural Concerns (self-imposed)

- `MetadataType` `MatchingRules` / `DuplicateRule`: needed to scan distinct vendor types. Reuse target: none, because no existing type models them.
- `MetadataFacts` `matching-rules` / `duplicate-rule`: parser-owned facts follow the existing `sharing-rules` facts pattern. The new types reuse that pattern rather than adding a new mechanism.
- `DataQualityReference`: needed because `MetadataDependencyReference` can only express edges, and AC-002 needs non-edge outcomes. It is scoped to these facts and is not a graph-wide type (C1-GRAPH may generalize it later).
- `PARSE_VERIFIED_TYPES` in gap analysis: needed because the registry status alone cannot express per-file proof. Two entries only, with no framework.
- `DEPLOYMENT_ORDER` entries: forced by the `Record<MetadataType, number>` typing. They are explicitly excluded from proof.
- Manifest guard: a single conditional in the existing service, with no new class. No new CMDT, labels, permission sets or Apex, because this repository is a TypeScript CLI plugin.

## TBDs

- TBD-1: who provides the licensed, disposable API 67.0 org for AC-004, and when. Until then the guard stays.
- TBD-2: `minimumApiVersion` for `DuplicateRule`/`MatchingRules` needs vendor or org confirmation.
- TBD-3: whether `plan explain` should render `target-unknown` references (coordinate with C1-GRAPH's equivalent outcome).
- TBD-4: whether an absent `duplicateRuleFilterItems.table` really defaults to the owning object needs org evidence.
