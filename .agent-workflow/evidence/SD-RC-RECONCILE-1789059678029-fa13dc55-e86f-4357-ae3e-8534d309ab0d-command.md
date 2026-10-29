# Evidence SD-RC-RECONCILE: command

- Role: qa
- Summary: Real-org smoke on cg-demo: alias connected (org 00Dak0000189OhPEAU, API 67, expires 2026-09-22); org exposes 2 AiAuthoringBundle records, 3 GenAiPlannerBundle records, 28 GenAiFunction records, 1 GenAiPlugin, and 39 GenAiPromptTemplate records. Retrieved Consumer_Goods_Account_Summary function/prompt plus Store_and_Account_Inquiries plugin. smart-deployment start --dry-run scanned 3 components and 4 dependencies into 2 waves with all components placed. Salesforce check-only validation succeeded as job 0Afak00000kUOH2CAO with 3/3 components and zero errors. AiAuthoringBundle retrieve remains unavailable via Metadata API even with API 67, despite list metadata exposing records. The validate command with --target-org --json fails before analysis because logger serializes the circular Org object.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
