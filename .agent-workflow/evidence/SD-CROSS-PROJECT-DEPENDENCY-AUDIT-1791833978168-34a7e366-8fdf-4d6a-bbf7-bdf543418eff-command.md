# Evidence SD-CROSS-PROJECT-DEPENDENCY-AUDIT: command

- Role: architect
- Summary: Parent read-only blocker diagnosis after commit 79c0895: sf smart-deployment plan explain --source-path /Users/jterrats/dev/cdf-sf-org/force-app --json | jq filtered output exited 0; result.success=false, 158 scanned components, 2086 dependencies, 2017 unresolved, 103 without wave. CDF_AccountSetMembershipBatch has hard unresolved CustomField:Account.CDF_Channel**c, CustomField:Account.CDF_StoreSize**c, CustomField:Account.cgcloud**Sales_Org**c edges, each reason Dynamic SOQL apex-string reference and confidence 0.4. First two field-meta.xml files exist locally, third not found in inspected project. src/services/metadata-scanner-service.ts:212-240 only scans CustomObject directories and custom metadata, not individual CustomField files; src/waves/wave-topology.ts:18-27 counts missing graph dependencies by default. Unplaced types include Layout 34, ApexClass 33, FlexiPage 17, PermissionSet 7, ApexTrigger 5, Profile 4, Flow 1, EmailTemplate 1, LWC 1. Do not infer target-org absence from missing source; no org query or deploy performed.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
