# Evidence SD-API67-LIVE-HARNESS: command

- Role: qa
- Summary: Re-review evidence (parent, no product edits): temporary fake sf/yarn executables exercised prior plugin states absent/user/link. Partial 'sf plugins link .' mutation then exit 31 caused one unlink and restored each prior state. Non-dry-run start created metadata then exit 32; trap queried, deleted once, re-queried zero, restored plugin, and propagated 32. Delete failure left metadata and forced exit 1. Post-delete Tooling query unverifiable forced exit 1. Normal path exited 0 with exactly one delete (no trap double-delete). TERM injected during mutating start caused compensation (one delete, metadata zero, plugin restored) but harness exited 0, so signal failure is not propagated. bash -n and shellcheck passed; no-opt-in exited 2 with required message. Focused API/validator tests 13/13 passed (67 no newer warning, 68 warning); targeted NUTs 15/15 passed. yarn build/test were valid Wireit cache hits; independent tsc --noEmit passed; eslint passed with 0 errors/47 existing warnings; release:contracts passed; git diff --check passed. No workflow references live harness; no added credential, org URL, cg-demo, or fixed target alias patterns. yarn.lock SHA256 b86e9da1b6e563984ab935aba0c545c75f82216e98d03459ba050bcc91d217f7 and npm-shrinkwrap SHA256 3159f59ef7c70e39215362137bc703d927492844d78fdb279fb9edff28a13c39 match HEAD; no lock/manifest diff. Read-only real baseline: cg-demo connected, API 67.0, zero SD*LinkedE2E*% ApexClass records; installed @jterrats/smart-deployment remains 1.6.2 type=user.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
