# Review SD-CROSS-PROJECT-DEPENDENCY-AUDIT: architect

- Result: changes
- Severity: info
- Findings: Independent read-only reviews and local verifier confirm local Flow apex_action produces untyped reference and wave=0 despite local Apex class; 104/158 cdf-sf-org components wave=0 with result.success=true. gdm-experience object actionOverride FlexiPage ref not emitted; Network->CustomSite works but picassoSite digital experience config not scanned; CustomField/ValidationRule/Role refs have no individual nodes in CTM sample. No Salesforce target org preexistence checked; unresolved graph edges include parser false positives and external candidates, so no hard dependency inference or release approval.
- Recommendation: Prioritize typed Flow Apex/subflow edges and fail-closed unplaced reporting; then classify missing-vs-external with explicit org evidence, and add fixture coverage for object actionOverrides and nested digital experience metadata. Keep audit distinct from GH-268 and scope bugs; require deterministic tests and safe org validation before execution changes.

## Return Action

- Return role: architect
- Return phase: architect
- Summary: Return to architect (architect) for correction before release can proceed.
- Required evidence: Complete the requested implementation correction, attach real command/file evidence, then record an approving review from the responsible role or QA before resuming release.
- Resume command: `orchestra workflow run --task SD-CROSS-PROJECT-DEPENDENCY-AUDIT --resume wfrun-1791752556066-43a9d6`
