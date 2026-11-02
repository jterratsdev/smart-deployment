# Evidence SD-FAST-URI-SECURITY-HOTFIX: command

- Role: release_manager
- Summary: PR #267 release verification at immutable head 9342f395f096b44627d0ab6165bace5541fc0c1c: gh pr diff and git parent diff show exactly package.json, yarn.lock, npm-shrinkwrap.json with 9 additions/9 deletions, solely fast-uri 3.1.6 to 3.1.7 plus matching resolved URL/integrity; git diff --check passed. In separate fresh detached worktrees, Yarn 1 frozen install selected fast-uri@3.1.7 and preserved SHA-256 hashes of all three files; npm ci selected fast-uri@3.1.7 overridden; fresh npm ci --dry-run selected 3.1.7 and left tracked files unchanged. npm audit --omit=dev --json after both isolated Yarn and npm installs reported total=0 vulnerabilities. Failed publish run 36497952623 had passed install/build/tests and failed only Audit runtime dependencies on GHSA-qw65-cvwx-89v3 (>=3.0.0 <3.1.7) and GHSA-58mr-gqgx-xq4g (=3.1.6), both excluded by 3.1.7.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
