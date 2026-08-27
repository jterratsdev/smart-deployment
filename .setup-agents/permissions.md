<!-- setup-agents: 3.18.9 -->
<!-- runtime-permissions-sha256: 867e6fb138bc0ec59a80d7e0ba43fc21c2f702bb86f0d8ccfa7c1ebc115b2392 -->

# Command Permissions

This file is rendered from the typed runtime permission policy. Profile capabilities provide
task context only; they do not silently elevate command permissions.

Active profile capabilities: deploy, code-analysis, doc-sync, prompt-registry, declare-points, oclif-plugin, story-mapping, elements-sync, project-knowledge-bootstrap, org-assessment, story-refinement, decomposition, adr.

## Capability policy

| Risk               | Decision  | Representative argv                                                                                       | Purpose                                                                             |
| ------------------ | --------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| read-only          | **allow** | `pwd`, `ls`, `cat`, `head`, `tail`, `wc`, `find`, `grep`, `rg`, `jq`                                      | Read and search local files without redirects or shell composition.                 |
| read-only          | **allow** | `git status`, `git diff`, `git log`, `git show`, `git rev-parse`, `git ls-files`, `git config --get`      | Inspect the local Git worktree, history, references, and configuration.             |
| read-only          | **allow** | `npm test`, `npm run <safe-script>`, `yarn test`, `yarn run <safe-script>`, `tsc`, `eslint`               | Run existing unit, build, typecheck, and lint scripts without install or fix flags. |
| local-write        | **ask**   | `mkdir`, `touch`, `cp`, `mv`, `git add`, `git stash`, `git branch`, `git restore`                         | Create, change, stage, move, or restore local files or Git state.                   |
| network-dependency | **ask**   | `npm install`, `npm ci`, `yarn install`, `pip install`, `pip3 install`, `npx`, `curl`, `git fetch`        | Access the network, download executable content, or install dependencies.           |
| org-read           | **ask**   | `sf org list`, `sf org display`, `sf data query`, `sf project retrieve`                                   | Read authenticated Salesforce org metadata or data.                                 |
| org-mutate-deploy  | **ask**   | `sf project deploy`, `sf data <mutation>`, `sf apex run`, `sf package <mutation>`                         | Mutate an org, execute Apex, deploy metadata, or change packages.                   |
| git-remote-shared  | **ask**   | `git commit`, `git checkout`, `git rm`, `git pull`, `git push`, `git tag`, `npm publish`, `npm unpublish` | Change shared Git history/state, publish packages, or incorporate remote changes.   |
| destructive        | **deny**  | `rm`, `sudo`, `git reset --hard`, `git clean`, `sf org delete`, `sf package version delete`               | Delete data, discard changes, remove orgs/packages, or escalate privileges.         |

Commands are parsed as argv. Shell chains, redirects, substitutions, malformed quoting, and
unknown commands fail closed. Substring matches never grant permission.

## Runtime enforcement support

| Runtime  | Enforcement           | Detail                                                                                                |
| -------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| opencode | native-command-policy | Generated native rules deny by default and preserve ask decisions.                                    |
| claude   | approval-only         | Native approval is retained, but setup-agents cannot express the complete argv policy in CLI flags.   |
| codex    | approval-only         | Suggest mode retains approval, but setup-agents cannot express the complete argv policy in CLI flags. |
| cursor   | unsupported           | Cursor print mode has no setup-agents command-policy enforcement channel.                             |

## Decisions

- **allow**: may run without additional approval.
- **ask**: requires explicit approval scoped to the exact command and target.
- **deny**: must not run. Unknown or unrepresentable operations are denied.
