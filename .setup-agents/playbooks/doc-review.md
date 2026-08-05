<!-- setup-agents: 3.16.0 -->
# Doc Review Playbook

## Purpose
Gates documentation changes in the release phase. Run this playbook before closing the release task to confirm all docs meet project standards.

## Checklist
- [ ] All new/modified pages start with the Salesforce Cloud logo header
- [ ] Version header is incremented (`**Version:** x.y`)
- [ ] All internal links resolve — run `yarn link-check` to verify
- [ ] No orphan pages — every new page is linked from at least one nav or index
- [ ] Command examples match the actual CLI flags (verify against `sf setup-agents --help`)
- [ ] No commands, flags, or features from the previous version remain undocumented


## Evidence
```bash
sf setup-agents evidence add --task <id> --role developer --type report --summary "Doc Review Playbook completed"
```
