# Evidence SD-CROSS-PROJECT-DEPENDENCY-AUDIT: command

- Role: architect
- Summary: Read-only local verifier: sf smart-deployment plan explain --source-path /Users/jterrats/dev/cdf-sf-org/force-app --json | jq filtered result exited 0: 158 components, 2298 edges, 2230 unresolved, 104 wave=0; PermissionSet:CDF_AutomationAccess has resolved Flow:CDF_TourCrewTemplateApprove edge but both wave=0. Flow source actionName CDF_ApproveTourCrewTemplates exists as local ApexClass; scanner src/services/scanners/automation-ai-metadata-scanner.ts:29-33 emits raw name not ApexClass: ID. gdm-experience force-app: 279 components, 220 wave=0; CustomObject:Contract\_\_c wave=1 with no edge to referenced Contract_Record_Page, not scanned locally. experience-cloud-oct-2026/demo/lwc-skills-demo/force-app: 27 components; Network:My Cases wave=3 after CustomSite:My_Cases wave=2, digitalExperienceConfig My_Cases1 absent from plan. cdf-sf-org-ctm0-746 force-app: 38 components, 12 wave=0; Account field, validation rule, role not scanned as individual nodes. All commands analysis only, no deploy/org verification; two independent read-only reviewers challenged these findings. Plan result success=true despite unplaced nodes. Health unhealthy due to missing historical SD-RC-RECONCILE artifacts.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
