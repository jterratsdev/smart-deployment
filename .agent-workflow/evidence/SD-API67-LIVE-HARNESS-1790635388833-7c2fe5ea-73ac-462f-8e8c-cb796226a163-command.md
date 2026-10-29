# Evidence SD-API67-LIVE-HARNESS: command

- Role: developer
- Summary: Implementation validation: supported yarn test:only passed 1680 tests with 2 pending; build/lint passed; after updating healthy NUT fixtures from API 61 to API 67, all 41 NUTs passed. bash -n, shellcheck, no-opt-in exit code 2, and git diff check passed. New SMART_DEPLOYMENT_LIVE_TARGET_ORG=cg-demo yarn test:live-org built and linked current branch, validated and dry-ran one unique API 67 ApexClass, deployed and executed probe(), removed SD_LinkedE2E_20260928224147_94125, verified no matching classes remain, and restored npm plugin 1.6.2 as type=user. First harness attempt exposed sf plugins inspect JSON behavior before any metadata deploy; cleanup left org clean but plugin absent, then 1.6.2 was manually restored and harness fixed to snapshot sf plugins root array. Second full run passed including automatic restore.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
