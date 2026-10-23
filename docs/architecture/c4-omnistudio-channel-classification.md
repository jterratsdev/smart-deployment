# C4: OmniStudio Native vs Managed DataPack Channel Classification

- Status: Proposed (architect phase, SD-DEV-C4-CHANNEL)
- Date: 2026-10-23
- Decision owners: Smart Deployment maintainers
- Scope decisions: `setup-agents-decision-1792686144435-8722ff`, `setup-agents-decision-1792662769813-cb0547`

## Context

`OmniStudioVlocityProvider` in `src/deployment/special-deployment-plan.ts` selects changed paths with
`/(?:^|\/)(vlocity|omnistudio|omniScripts|dataRaptors|integrationProcedures|flexCards)(?:\/|$)/iu` and,
for any match, emits `vlocity packDeploy --job <generated-vlocity-job.yaml>`.

Defects:

1. `omniScripts` is the native Metadata API directory for `OmniScript`. Native source therefore triggers a
   managed VBT command based only on directory spelling (violates AC-001).
2. No source shape or package/runtime identity is checked before a path is treated as a managed DataPack
   (violates AC-002).
3. `SpecialDeploymentPlanExecutor` has no placeholder handling for `<generated-vlocity-job.yaml>`; it would
   pass the literal string to `vlocity`. The placeholder is an executable command, not a plan annotation
   (violates AC-004).
4. Native OmniStudio types are not in the `MetadataType` union or any scanner, so there is no evidence that
   native artifacts are scanned. They do not reach the core manifest today.

Native registry facts, from `@salesforce/source-deploy-retrieve` `metadataRegistry.json` (installed sf CLI):

| Type                       | Directory                   | Suffix (source file) | Strategy    |
| -------------------------- | --------------------------- | -------------------- | ----------- |
| `OmniDataTransform`        | `omniDataTransforms`        | `.rpt-meta.xml`      | simple file |
| `OmniIntegrationProcedure` | `omniIntegrationProcedures` | `.oip-meta.xml`      | simple file |
| `OmniScript`               | `omniScripts`               | `.os-meta.xml`       | simple file |
| `OmniUiCard`               | `omniUiCard` (singular)     | `.ouc-meta.xml`      | simple file |

## Decision

Add one pure, deterministic classifier. It assigns every OmniStudio-candidate path to exactly one channel.
Anything ambiguous fails closed. The classifier only classifies. It never imports, generates a job, provisions
data, enables a native deploy, or calls an org.

### Classification contract

Input (pure, no I/O except reading candidate source files already on disk):

```ts
classifyOmniStudioChannels(input: {
  projectRoot: string;
  changedPaths: readonly string[];          // project-relative, as ProviderContext.changedPaths
  readFile?: (absPath: string) => Promise<string>; // injectable for tests
}): Promise<OmniStudioChannelClassification[]>
```

Output per candidate path, sorted by `path`:

```ts
type OmniStudioChannel = 'native-metadata' | 'managed-datapack' | 'blocked';
type OmniStudioChannelClassification = {
  path: string;
  channel: OmniStudioChannel;
  artifactKey?: string; // native: `<Type>:<Name>`; managed: `DataPack:<VlocityDataPackType>/<Name>`
  reason: 'native-shape' | 'managed-shape' | 'unknown-shape' | 'identity-unproven' | 'channel-conflict';
  evidence: string[]; // the concrete facts that matched (suffix, dir, JSON keys, namespace)
};
```

A path is an OmniStudio candidate if any segment matches the current regex's directory set, or if any of the
four native directory names appears. Candidate selection may stay broad. The evidence rules below make the
routing decision; the directory name never does.

| Channel                         | Required evidence (all must hold)                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `native-metadata`               | Parent directory is exactly the registry `directoryName`, file ends with the paired suffix from the table above, and `<Name>` is derived by stripping the suffix. Both checks must match one type; a directory/suffix mismatch is `unknown-shape`.                                                                                                                                                                                                     |
| `managed-datapack`              | (a) Source shape: VBT DataPack layout `<root>/<VlocityDataPackType>/<Name>/<Name>_DataPack.json`, where the JSON parses and has string `VlocityDataPackType` and `VlocityRecordSObjectType`. (b) Package/runtime identity: `VlocityRecordSObjectType` carries a concrete managed namespace prefix (`<ns>__<Object>__c`). Shape without identity is `identity-unproven`. Sibling files in the same DataPack folder inherit the folder's classification. |
| `blocked` / `unknown-shape`     | Candidate path that satisfies neither rule above, including a native directory with a non-registry suffix and a `vlocity/` file with no `_DataPack.json` sibling.                                                                                                                                                                                                                                                                                      |
| `blocked` / `identity-unproven` | Managed shape is present but the namespace is missing, is the unresolved `%vlocity_namespace%` token, or the JSON is malformed.                                                                                                                                                                                                                                                                                                                        |
| `blocked` / `channel-conflict`  | The same logical artifact (DataPack type plus name mapped to a native type plus name, e.g. `OmniScript/Foo` and `OmniScript:Foo`) is classified as native and as managed in one input. Every member of the conflict is blocked, so no artifact is admitted to both channels.                                                                                                                                                                           |

Invariants (asserted in tests):

- Each input candidate appears exactly once in the output with exactly one channel.
- Directory name alone never yields `managed-datapack`.
- The output is identical for identical input, regardless of input order.

### Where it lives

- New module `src/deployment/omnistudio-channel-classifier.ts`. It is a pure function plus types. It does not
  import scanner services.
- `OmniStudioVlocityProvider` (same file as today) is the only caller.

### Integration with special-deployment-plan

`OmniStudioVlocityProvider.plan()` becomes:

- `components`: sorted `artifactKey`s of the `managed-datapack` classifications only.
- `changedPaths`: the managed paths only.
- `commands`: always `[]` in C4. No `vlocity` command and no job placeholder are emitted (AC-004). Managed
  import is deferred to a separately scoped lifecycle task with target evidence.
- `skipped: true` with `skipReason` that states managed DataPack import is deferred and classification ran in
  plan-only mode, or that no OmniStudio candidates were found.
- `errors`: one entry per `blocked` classification (`<path>: <reason>`), so `plan.success` is false. Fail closed.
- `warnings`: one summary entry for `native-metadata` paths. It states they were classified native and are
  excluded from the managed channel. Native deploy enablement is out of scope.
- New optional field `classifications?: OmniStudioChannelClassification[]` on `SpecialDeploymentPhase`. Only this
  provider populates it.

Label: `Optional phase: OmniStudio managed DataPack classification (import deferred)`.

### Manifest admission

- `CoreMetadataProvider` builds the core manifest from `MetadataScannerService` components. No scanner produces
  managed DataPack records, so today none can enter the core manifest. C4 makes this a tested property:
  a mixed fixture must produce a core phase with no `DataPack:*` key and no path under a managed DataPack folder.
- C4 does not admit native OmniStudio types into the core manifest. Native artifacts are classified and reported
  only, because native deploy enablement is out of scope.

### Capability registry (optional, append-only)

To satisfy the one-cluster-per-catalogKey rule (`cb0547`), C4 may append its own rows to `P0_DEFINITIONS` in
`src/analysis/metadata-capability-definitions.ts`:

- `metadataDefinition` for each of the 4 native types: owner `C4`, `metadata-api`, discovery `partial`
  (classifier only, no scanner).
- `externalDefinition('OmniStudioDataPack', ..., 'C4', 'managed-package-data')` with lifecycle `absent`.

The edits are append-only. If `metadata-capability-registry.test.ts` reveals a key collision, drop this step and
raise a TBD. Do not rename existing keys.

## Out of Scope (AC-004)

- DataPack import, `vlocity packDeploy`/`packExport`, or any executable VBT job file generation.
- Business-data provisioning or operational record migration.
- Native OmniStudio deploy enablement: no `MetadataType` union change, no scanner, no `DEPLOYMENT_ORDER` entry,
  no core-manifest admission.
- Org calls of any kind, including namespace or installed-package lookup. Identity comes from source only.
- Executor changes. With `commands: []`, `SpecialDeploymentPlanExecutor` needs no change. A guard that rejects
  unresolved `vlocity` placeholders belongs to SD-DEV-P2-PROVIDER-BOUNDARIES.

## Test Matrix (AC-003)

File: `test/unit/deployment/omnistudio-channel-classifier.test.ts` (pure), plus focused cases in
`test/unit/deployment/special-deployment-plan.test.ts`. Fixtures are in-memory paths with an injected `readFile`.
No org access.

| #   | Case                               | Input                                                                                                                                                                 | Expected                                                                                           |
| --- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| 1   | Native OmniDataTransform           | `force-app/main/default/omniDataTransforms/Acct.rpt-meta.xml`                                                                                                         | `native-metadata`, `OmniDataTransform:Acct`                                                        |
| 2   | Native OmniIntegrationProcedure    | `.../omniIntegrationProcedures/Proc.oip-meta.xml`                                                                                                                     | `native-metadata`                                                                                  |
| 3   | Native OmniScript                  | `.../omniScripts/Welcome.os-meta.xml`                                                                                                                                 | `native-metadata`                                                                                  |
| 4   | Native OmniUiCard                  | `.../omniUiCard/Card.ouc-meta.xml`                                                                                                                                    | `native-metadata`                                                                                  |
| 5   | Native paths at plan level         | cases 1-4 as changedPaths                                                                                                                                             | omni phase `commands` = `[]`, `components` = `[]`, no `vlocity` tool anywhere in plan (AC-001)     |
| 6   | Managed positive                   | `vlocity/OmniScript/Welcome_English/Welcome_English_DataPack.json` with `VlocityDataPackType: "OmniScript"`, `VlocityRecordSObjectType: "vlocity_ins__OmniScript__c"` | `managed-datapack`, `DataPack:OmniScript/Welcome_English`                                          |
| 7   | Unknown shape                      | `vlocity/OmniScript/Welcome/Welcome.json` (no `_DataPack.json`)                                                                                                       | `blocked/unknown-shape`, plan `success=false`                                                      |
| 8   | Directory/suffix mismatch          | `.../omniScripts/Welcome.json`                                                                                                                                        | `blocked/unknown-shape`                                                                            |
| 9   | Identity unproven                  | case 6 with `%vlocity_namespace%__OmniScript__c` and, separately, with malformed JSON                                                                                 | `blocked/identity-unproven`                                                                        |
| 10  | Conflict                           | case 3 (`OmniScript:Welcome`) plus a managed DataPack `OmniScript/Welcome`                                                                                            | both `blocked/channel-conflict`, neither admitted                                                  |
| 11  | Absent job                         | any input                                                                                                                                                             | omni phase `commands` is `[]`, no `<generated-vlocity-job.yaml>` token in serialized plan (AC-004) |
| 12  | No managed record in core manifest | mixed scanner components plus case 6 path                                                                                                                             | core phase `components` contain no `DataPack:*` key                                                |
| 13  | Determinism                        | shuffled input of cases 1-10                                                                                                                                          | identical sorted output                                                                            |
| 14  | No candidates                      | non-OmniStudio paths only                                                                                                                                             | omni phase skipped, no errors                                                                      |

The existing assertion in `special-deployment-plan.test.ts` that expects
`['packDeploy', '--job', '<generated-vlocity-job.yaml>']` for `vlocity/OmniScript/Welcome/Welcome.json` encodes the
defect. It must be replaced by case 7. Check `release-report-facts-factory` and `ci-publish` tests for
dependence on that command.

## File Ownership Boundaries

| Surface                                                                                                          | Owner                                                                           | C4 permission                                                         |
| ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| `src/deployment/omnistudio-channel-classifier.ts` (new) and its test                                             | C4                                                                              | Create                                                                |
| `OmniStudioVlocityProvider` class and the optional `classifications` phase field in `special-deployment-plan.ts` | C4                                                                              | Edit only this class and type addition; other providers are untouched |
| OmniStudio rows in `metadata-capability-definitions.ts`                                                          | C4                                                                              | Append only                                                           |
| `src/services/metadata-scanner-service.ts`, `src/services/scanners/*`                                            | C1-GRAPH (CustomField/Flow projections), C1-RULES (MatchingRules/DuplicateRule) | Do not edit                                                           |
| `src/analysis/metadata-gap-analysis-service.ts` (`SOURCE_DIRECTORY_TYPES`, `FILE_SUFFIX_TYPES`)                  | C1-RULES                                                                        | Do not edit; native Omni suffixes are not added in C4                 |
| `src/constants/deployment-order.ts`, `src/types/metadata.ts` `MetadataType`                                      | C1 / shared                                                                     | Do not edit (no native deploy enablement)                             |
| `src/deployment/special-deployment-executor.ts` and provider command guards                                      | P2-PROVIDER-BOUNDARIES                                                          | Do not edit; P2 consumes the C4 classification contract               |

Merge order: C4 lands before P2. If C1 and C4 change `special-deployment-plan.ts` at the same time, they touch
disjoint classes, so rebase conflicts should be textual only.

## Architectural Concerns (inherited)

- (a) The BA handoff names catalogKey `OmniStudioDataPackClassifier` for the managed row. (b) A catalogKey
  should name the artifact family (`OmniStudioDataPack`), not the code that classifies it. (c) The capability
  registry keys every other row by vendor or artifact type, and the one-cluster-per-catalogKey rule needs a
  stable artifact identity. Recommendation: `OmniStudioDataPack`. TBD for PO/SA if the handoff key is
  load-bearing.
- (a) The current provider emits a `vlocity` command for managed DataPacks. (b) The OOTB Salesforce path for
  native OmniStudio is the Metadata API through `sf project deploy`; VBT is only relevant to managed-package
  runtimes. (c) In SDR `metadataRegistry.json`, all four native types are simple-file Metadata API types. Routing
  them to VBT duplicates a native channel.

## Architectural Concerns (self-imposed)

- `omnistudio-channel-classifier.ts`: a pure function is needed so AC-003 can be tested without a scanner or
  provider context. The alternative is inlining it in `special-deployment-plan.ts`, which is already 400 lines
  and is shared with C1 and P2 edits. No OOTB platform feature classifies local source by channel.
- `SpecialDeploymentPhase.classifications` (optional field): without it, native classification evidence would be
  visible only as warning strings, which tests and reports cannot assert structurally. It reuses the existing
  phase type and adds no new report type.
- Capability registry rows: optional. They only make the C4 catalogKeys explicit under `cb0547`. If they
  collide, drop them.
- Rejected: a new `MetadataType` member, a scanner, a `DEPLOYMENT_ORDER` entry, a CMDT/config file for the
  namespace allowlist, or a new phase kind. Each is either native deploy enablement (out of scope) or
  configuration for a lifecycle C4 does not run.

## TBDs

1. Namespace identity rule: should any concrete `<ns>__` prefix count as evidence, or only a fixed allowlist
   (`vlocity_cmt`, `vlocity_ins`, `vlocity_ps`, `omnistudio`)? The default is any concrete prefix with
   `%vlocity_namespace%` blocked. A project-declared namespace needs a separate config decision.
2. The VBT DataPack JSON keys (`VlocityDataPackType`, `VlocityRecordSObjectType`) and the `_DataPack.json`
   layout come from VBT conventions. Before fixtures are fixed, Developer must confirm them against VBT
   documentation or a real exported DataPack.
3. Fail-closed plan failure: a repository with legacy `vlocity/` folders that do not match the shape now gets
   `plan.success=false`. PO must confirm that this behavior change is acceptable, which follows from decision
   `8722ff`.
4. Catalog key name (see inherited concern 1).
