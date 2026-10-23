# Evidence SD-ACCOUNT-CHANGED-OVERLAY-DEMO: command

- Role: qa
- Summary: Parent-executed cg-demo (org 00Dak0000189OhPEAU) API 67 Account probe: fresh baseline retrieve 09Sak00000rGdZxEAK, SHA256 6fc801bd2055bdd6c163315a36d87642796f5a8634c51be586ed01a849a253fa; minimal change and restore packages omit actionOverrides; sf project deploy start --metadata-dir .smart-deployment/account-changed-probe --target-org cg-demo --api-version 67.0 --dry-run --wait 20 --json succeeded 0Afak00000p5PbVCAU, restore dry-run 0Afak00000p5Py5CAE succeeded; change deploy 0Afak00000p5Q7lCAE succeeded; retrieve 09Sak00000rGduvEAC and diff -u against baseline showed only top-level compactLayoutAssignment SYSTEM -> Account_Layout; sf sobject describe --sobject Account --target-org cg-demo --json showed both View LARGE/SMALL pageId 0M0ak00000GcBNqCAN unchanged; restore deploy 0Afak00000p5QPVCA2 succeeded; retrieve 09Sak00000rGdzlEAC and diff -u against baseline produced no differences; restored SHA256 matched baseline, same REST describe page IDs; Tooling FlexiPage query confirmed Account_Record_Page1. No staged executor or UI assignment QA performed.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
