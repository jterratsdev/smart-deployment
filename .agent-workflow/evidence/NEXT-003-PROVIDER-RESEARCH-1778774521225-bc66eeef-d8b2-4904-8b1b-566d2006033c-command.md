# Evidence NEXT-003-PROVIDER-RESEARCH: command

- Role: architect
- Summary: Configured setup-agents local profiles for NEXT-003 provider research: architect, BA, PM, DevOps, QA, CRMA, Data360, SFMC, Security, Service, OmniStudio, AI, and Tableau. Verified with sf setup-agents status --json.
- Path: not applicable
- Command: sf setup-agents init --force --mode project --profile architect,ba,pm,ai,omnistudio,sfmc,crma,data360,tableau,security,service,devops,qa --tools codex --json && sf setup-agents status --json
- Exit code: 0
