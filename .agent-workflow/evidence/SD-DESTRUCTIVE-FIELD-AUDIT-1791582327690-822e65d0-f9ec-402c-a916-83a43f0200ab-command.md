# Evidence SD-DESTRUCTIVE-FIELD-AUDIT: command

- Role: architect
- Summary: Parent-run read-only investigation: gh run view 37989945683 --repo cdfdes/cdf-sf-org --job 114021241226 --log-failed shows sf project deploy validate --source-dir force-app --test-level RunLocalTests with no --pre-destructive-changes, failing Account.CDF_Cedis**c (controlling field currently Text) and Account.CDF_PlantCode**c (cannot change global value set). gh api repos/cdfdes/cdf-sf-org/pulls/94/files shows PR changes Account.CDF_PlantCode**c from Text to Picklist, adds dependent CDF_Cedis**c and global value sets and manifest/CTM0-450/preDestructiveChanges.xml deleting PlantCode, Flow, Territory2Rules; run command does not consume it. Repo src/deployment/start-execution-service.ts:105 reverses destructive waves only with --destructive; src/deployment/deployment-runner.ts:174-204 always sends destructiveChangesTiming post; src/commands/start.ts:236-243 only sequences destructive then restore in rollback, normal run only one mode. src/services/scanners/data-metadata-scanner.ts:13-49 emits CustomObject with sharing facts, no per-field transition comparison. No automatic pre-delete for type/value-set transitions evidenced.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
