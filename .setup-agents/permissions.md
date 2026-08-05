<!-- setup-agents: 3.16.0 -->

# Command Permissions

This file defines which shell commands agents may execute without human approval
and which are NEVER allowed. Commands not listed require explicit user confirmation.

## Allow (auto-approved)

| Pattern | Purpose |
|---------|---------|
| `ls` | List directory contents |
| `pwd` | Print working directory |
| `echo` | Print text |
| `cat` | Read file contents |
| `head` | Read file head |
| `tail` | Read file tail |
| `wc` | Count lines/words/bytes |
| `find` | Find files |
| `grep` | Search file contents |
| `rg` | Ripgrep search |
| `mkdir` | Create directories |
| `touch` | Create empty files |
| `cp` | Copy files |
| `mv` | Move/rename files |
| `git status` | Show working tree status |
| `git diff*` | Show changes |
| `git log*` | Show commit history |
| `git show*` | Show commit details |
| `git add*` | Stage changes |
| `git commit*` | Create commits |
| `git stash*` | Stash changes |
| `git branch*` | List/create branches |
| `git checkout*` | Switch branches/restore files |
| `git fetch*` | Download remote refs |
| `git pull*` | Fetch and merge |
| `git restore*` | Restore working tree files |
| `git rev-parse*` | Parse git references |
| `git ls-files*` | List tracked files |
| `git config --get*` | Read git config |
| `git reset HEAD*` | Unstage files |
| `git reset --soft*` | Soft reset (keep changes) |
| `git reset --mixed*` | Mixed reset (unstage) |
| `git mv*` | Move tracked files |
| `git rm*` | Remove tracked files |
| `node*` | Run Node.js |
| `npm run*` | Run npm scripts |
| `npm install*` | Install dependencies |
| `npm ci*` | Clean install |
| `npx*` | Run npx commands |
| `yarn*` | Yarn package manager |
| `python*` | Run Python |
| `python3*` | Run Python 3 |
| `pip install*` | Install Python packages |
| `pip3 install*` | Install Python 3 packages |
| `prettier*` | Format code |
| `eslint*` | Lint code |
| `jq*` | Process JSON |
| `curl*` | HTTP requests |
| `openssl*` | Certificate/crypto utilities |
| `sf project deploy*` | Deploy Salesforce metadata |
| `sf project retrieve*` | Retrieve Salesforce metadata |
| `sf org list*` | List connected orgs |
| `sf org display*` | Display org details |
| `sf apex run*` | Execute anonymous Apex |
| `sf data*` | Query/manipulate org data |
| `sf scanner*` | Run Salesforce Code Analyzer |
| `sf code-analyzer*` | Run Code Analyzer (v4) |
| `mmdc*` | Mermaid CLI diagram rendering |
| `sf elements*` | Elements.cloud CLI |
| `gh issue*` | GitHub issue management |
| `gh pr*` | GitHub PR management |

## Deny (NEVER execute)

These commands are **destructive or irreversible**. Never execute them autonomously.
If the task requires one of these, stop and ask the user for explicit approval.

| Pattern | Reason |
|---------|--------|
| `git push*` | Push to remote (requires human approval) |
| `git reset --hard*` | Destructive: discards all local changes |
| `git clean -f*` | Destructive: removes untracked files |
| `git clean -d*` | Destructive: removes untracked directories |
| `git clean -fd*` | Destructive: removes untracked files and dirs |
| `git rebase -i*` | Interactive rebase (requires TTY) |
| `rm -rf*` | Destructive: recursive force delete |
| `rm -fr*` | Destructive: recursive force delete (alt) |
| `sudo*` | Privilege escalation not allowed |
| `sf org delete*` | Destructive: deletes Salesforce org |
| `sf package version delete*` | Destructive: deletes package version |
| `npm publish*` | Publish to npm (requires human approval) |
| `npm unpublish*` | Unpublish from npm (requires human approval) |

## Unlisted Commands

Any command not in Allow or Deny requires user confirmation before execution.
