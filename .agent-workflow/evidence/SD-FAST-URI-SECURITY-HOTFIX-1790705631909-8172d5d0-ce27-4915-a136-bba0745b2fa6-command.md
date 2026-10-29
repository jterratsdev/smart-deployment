# Evidence SD-FAST-URI-SECURITY-HOTFIX: command

- Role: developer
- Summary: After QA rejected broad lock regeneration, restored origin/main locks and applied minimal fast-uri-only patch: package Yarn resolution and npm override 3.1.6->3.1.7, plus exact version/resolved/integrity in yarn.lock and npm-shrinkwrap. Product diff is 9 additions/9 deletions across three files. Clean npm ci and clean Yarn frozen install both preserved hashes and selected 3.1.7 without incorrect-entry warnings; release structural contracts passed before/after; npm audit --omit=dev reports zero vulnerabilities; build, 1682 unit tests (2 pending), 41 NUTs, and packed clean-install passed.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
