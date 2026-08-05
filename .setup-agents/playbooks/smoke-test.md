<!-- setup-agents: 3.16.0 -->
# Post-Deploy Smoke Test

## Goal
Validate critical paths in the target environment immediately after deployment to confirm the release is stable.

## Critical Path Scenarios
1. **Login:** Can users log in to the org?
2. **Core records:** Can users view, create, and edit the key object(s) modified by this story?
3. **Key flows:** Do the primary business processes (Flows, Apex triggers, LWC components) execute without errors?
4. **Permissions:** Do all relevant Permission Sets / Profiles still grant correct access?

## Environment Validation
- [ ] Check Salesforce debug logs for errors (last 15 minutes post-deploy)
- [ ] Check email alerts or outbound message queues for unexpected failures
- [ ] Verify integration endpoints are still responding (if applicable)

## Rollback Trigger Conditions
If any of the following are true, escalate to rollback immediately:
- Core record creation/edit is broken
- Login or authentication failures
- Data corruption detected
- Error rate > 5% in debug logs

## Steps
1. Execute critical path scenarios above in the target org.
2. Check debug logs and monitoring.
3. Document results: scenario → pass/fail → notes.
4. If pass: record evidence and clear for release.
5. If fail: block release gate and escalate.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type report --summary "Post-Deploy Smoke Test completed"
```
