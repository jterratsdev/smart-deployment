# Known Limitations

This document tracks important current limitations of the Smart Deployment plugin.

## Deployment Execution

- The command layer is usable, but live deployment coverage against real orgs is still narrower than the local test coverage.
- `status` and `resume` are driven by persisted local state and are not yet a full remote deployment polling system.

## Circular Dependency Remediation

- automatic remediation is intentionally conservative
- supported scope is currently limited to simple, safely rewritable cycles
- unsupported or ambiguous cycles still require manual resolution

See [Circular dependency remediation spec](CIRCULAR_DEPENDENCY_REMEDIATION_SPEC.md) for the intended direction.

## AI Support

- AI support is optional and can fall back to heuristics
- not every product path is equally AI-enriched yet
- provider support is still early-stage despite the shared abstraction

## XML Validation

- the XML metadata validator exists, but it does not yet satisfy the full scope described in the tracked story for richer namespace, fix-up, and integration behavior

## OmniStudio Channel Classification

`OmniStudioVlocityProvider` classifies OmniStudio candidate paths into `native-metadata`,
`managed-datapack`, or `blocked` (see `src/deployment/omnistudio-channel-classifier.ts` and
`docs/architecture/c4-omnistudio-channel-classification.md`). It never generates an executable
VBT job, imports a DataPack, or deploys native OmniStudio metadata — classification only. A
`blocked` path fails the plan (`plan.success = false`). Reason → remedy:

Each `blocked` classification carries a `remedy` string (see `BLOCKED_REMEDIES` in
`omnistudio-channel-classifier.ts`) that is appended to the provider's plan error. Keep this
table and that map in sync.

| Reason              | What it means                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Remedy                                                                                                                                                                                                                                                                                                                                   |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `unknown-shape`     | Path matches neither the native Metadata API registry (`omniDataTransforms/*.rpt-meta.xml`, `omniIntegrationProcedures/*.oip-meta.xml`, `omniScripts/*.os-meta.xml`, `omniUiCard/*.ouc-meta.xml`) nor the VBT `<DataPackType>/<Name>/<Name>_DataPack.json` layout, or a native-looking directory has the wrong suffix. Also covers a DataPack JSON read that resolves outside the project root (`..` traversal, or a symlink that escapes the root)                                                                                                                                                                                                                                                              | Keep only native registry files (`omniDataTransforms/*.rpt-meta.xml`, `omniIntegrationProcedures/*.oip-meta.xml`, `omniScripts/*.os-meta.xml`, `omniUiCard/*.ouc-meta.xml`) or VBT exports shaped as `<Type>/<Name>/<Name>_DataPack.json`; if the path is not OmniStudio, add it to `.forceignore`                                       |
| `identity-unproven` | A VBT DataPack shape was found, but `VlocityRecordSObjectType` is not a strict `<ns>__<Name>__<suffix>` managed API name (an unmanaged `Object__c`/`Field__c` value never counts, even if another field in the record looks namespaced), and the `%vlocity_namespace%` token is unresolved because no root-level `namespace:` key is declared in `vlocity.yaml` (a nested/indented key is ignored). Also covers malformed DataPack JSON, a DataPack JSON file over its size cap, and a `vlocity.yaml` file over its (smaller) size cap — both checked via `stat` before the file is read, and an unresolvable real path (symlink check failure on either the project root or the file) fails closed the same way | For an unresolved `%vlocity_namespace%` token, declare a root-level `namespace: <ns>` in `vlocity.yaml` at the project root; otherwise re-export with VBT so `VlocityRecordSObjectType` carries a concrete `<ns>__<Name>__<suffix>` managed API name (fix or re-export if the DataPack JSON or `vlocity.yaml` is malformed or oversized) |
| `channel-conflict`  | The same logical artifact was classified as both native and managed in the same input. The managed side's VBT `VlocityDataPackType` is mapped to its native counterpart first (`DataRaptor`→`OmniDataTransform`, `IntegrationProcedure`→`OmniIntegrationProcedure`, `OmniScript`→`OmniScript`, `FlexCard`→`OmniUiCard`), then both sides' `<Name>` are case-folded before comparing (Salesforce DeveloperName/component-name uniqueness is case-insensitive); a DataPack type with no native counterpart (e.g. `SObject`) never conflicts                                                                                                                                                                        | Keep the artifact in exactly one format (native Metadata API or managed DataPack) and remove the other                                                                                                                                                                                                                                   |

Managed DataPack import itself (`vlocity packDeploy`) is out of scope for this classifier and is
deferred to a separately scoped lifecycle task with target-org evidence.

**Open assumption on `channel-conflict` naming (F2):** the VBT-to-native type mapping above is
confirmed on the native side (Metadata API registry), but the assumption that a VBT DataPack
folder name for `IntegrationProcedure`/`OmniScript` lines up exactly with the native file name
(e.g. both use a `Type_SubType_Language`-style name) is not independently verified against VBT
documentation or a real exported DataPack — this is architecture doc TBD #2. The classifier
compares the `<Name>` segment exactly (case-sensitive) after type mapping, which fails closed
(flags a conflict whenever the names match) but will not catch a real VBT naming convention that
differs from the native file name for the same artifact.

## Reporting And Contracts

- command output is becoming more structured, but the JSON contract should still be treated as evolving
- analysis reports are real and written to disk, but broader deployment-reporting semantics are still being hardened

## Historical Docs

Several documents were archived because they described non-existent flags or superseded workflows. If you find references to `--ai-auto`, `--use-plan`, `--strict`, `--verify-against-plan`, or `--max-diff`, treat those as historical material, not current product behavior.
