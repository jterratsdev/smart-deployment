# Evidence SD-FLOW-WAVE-IDENTITY-FIX: command

- Role: developer
- Summary: Parent-executed correction: typed Flow Apex/subflow dependencies in src/services/scanners/automation-ai-metadata-scanner.ts; plan explain reports success=false for unplaced scanned components, summary.unplacedComponentCount and human warning. Updated unit tests and docs/cli-reference.md. Commands: npx tsc -p . --noEmit --incremental false --pretty false passed; npx mocha four focused suites passed 11; yarn build passed; sf plugins link . --no-install passed; sf smart-deployment --help passed; git diff --check passed. Read-only linked sf smart-deployment plan explain --source-path /Users/jterrats/dev/cdf-sf-org/force-app --json | jq filtered output: action Flow:CDF_TourCrewTemplateApprove -> ApexClass:CDF_ApproveTourCrewTemplates resolved=true; success=false; unplacedComponentCount=104/158, unresolvedReferenceCount=2229. CLI envelope status remains 0; no deploy, no external-project edits. Existing external/false-positive dependencies remain blocked and need separate correction.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
