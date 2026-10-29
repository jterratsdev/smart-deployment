# Evidence SD-FAST-URI-SECURITY-HOTFIX: command

- Role: qa
- Summary: Independent final QA: git diff origin/main is exactly package.json 2/2, yarn.lock 4/4, npm-shrinkwrap.json 3/3, exclusively fast-uri 3.1.6->3.1.7 plus matching URL/integrity. npm registry metadata exactly matches sha512-dOvZ...VVHg==. Yarn 1.22.21 frozen install in isolated full snapshot preserved pre/post SHA-256 hashes, emitted no incorrect-lock-entry warning, selected fast-uri@3.1.7, and passed release:contracts; all 1476 Yarn registry entries have resolved/integrity and ip-address@10.2.0 is valid. Isolated package.json+npm-shrinkwrap-only npm ci preserved hashes, selected fast-uri@3.1.7, and npm audit --omit=dev reported 0 vulnerabilities. Commands: git diff --numstat/check; npm view fast-uri@3.1.7; yarn install --frozen-lockfile; yarn why fast-uri; npm ci; npm ls fast-uri --all; npm audit --omit=dev --json; npm run release:contracts.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
