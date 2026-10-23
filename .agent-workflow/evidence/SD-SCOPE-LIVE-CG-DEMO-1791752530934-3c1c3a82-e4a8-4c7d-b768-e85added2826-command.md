# Evidence SD-SCOPE-LIVE-CG-DEMO: command

- Role: qa
- Summary: Authorized isolated cg-demo commit-scope E2E: SMART*DEPLOYMENT_LIVE_SCOPE=1 SMART_DEPLOYMENT_LIVE_SCOPE_APPROVAL=I_APPROVE_CG_DEMO_SD_CREATE_DELETE npx mocha test/e2e/live-isolated-commit-scope.e2e.test.ts passed 1/1 (72713ms) using linked plugin 1.6.4. Unique SD_ScopeTarget*_ Apex class in a committed scope selected alone; validate-only returned changedComponents and includedComponents exactly [ApexClass:SD*ScopeTarget*_]; start --skip-tests completed, Tooling ApexClass showed selected class present and SD*ScopeOther*\* absent. Test deleted exact selected identity. Independent follow-up Tooling query returned zero SD_Scope% Apex classes; Case remained Private/Private. First attempt had JSON log parser error before deployment and independently left zero classes. Test TypeScript compile and scoped ESLint passed. This proves isolated success only; does not reproduce #270 permission/flows omission, #271 test guesses, #272 merge, or #273 FlexiPage. No lockfile or existing org metadata edited.
- Path: not applicable
- Command: SMART_DEPLOYMENT_LIVE_SCOPE=1 SMART_DEPLOYMENT_LIVE_SCOPE_APPROVAL=I_APPROVE_CG_DEMO_SD_CREATE_DELETE npx mocha test/e2e/live-isolated-commit-scope.e2e.test.ts
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: shell
- Assertions: Exit status 0; output 1 passing in 72713ms. Result validated exact scoped SD\_\* Apex class after validate-only, isolated creation and removal; independent Tooling API output confirms totalSize=0 for SD_Scope% and Case Private/Private
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
