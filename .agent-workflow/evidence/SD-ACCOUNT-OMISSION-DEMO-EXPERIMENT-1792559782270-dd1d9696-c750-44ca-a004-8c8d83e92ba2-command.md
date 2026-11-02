# Evidence SD-ACCOUNT-OMISSION-DEMO-EXPERIMENT: command

- Role: qa
- Summary: Parent-run user-approved cg-demo Account probe: baseline and post Metadata API 67.0 Account.object SHA256 both 6fc801bd2055bdd6c163315a36d87642796f5a8634c51be586ed01a849a253fa. Minimal Account payload only enableHistory=true (unchanged), actionOverrides omitted. Dry-run success 0Afak00000p5JRFCA2; real deploy success 0Afak00000p5JavCAE; REST describe View LARGE/SMALL remained on 0M0ak00000GcBNqCAN. No restoration required, no page changes. Scope limited to no-op payload.
- Path: not applicable
- Command: sf project deploy start --metadata-dir .smart-deployment/account-omission-probe --target-org cg-demo --api-version 67.0 --wait 20 --json
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: exit code 0; stdout JSON status 0, result.success true, checkOnly false, componentSuccesses CustomObject Account, id 0Afak00000p5JavCAE; stderr none; artifacts .smart-deployment/account-override-baseline-current.zip, .smart-deployment/account-omission-probe/objects/Account.object, .smart-deployment/account-override-after-omission.zip; final state Account.object SHA256 unchanged and sf sobject describe View LARGE/SMALL pageId unchanged
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
