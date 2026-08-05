<!-- setup-agents: 3.16.0 -->
# Observable Assertions — QA Evidence Guide

## Goal
Ensure every automated test validates an observable outcome, not just that a script ran to completion without errors.

## Rule
**A test that finishes without throwing is not evidence of correctness.**
Every test must assert at least one user-facing or system-state outcome.

## Patterns by Test Type

### Web / Playwright
```typescript
// ❌ Wrong — asserts element exists, not what the user sees
await expect(page.locator('.success-msg')).toBeVisible();

// ✅ Correct — asserts the actual content shown to the user
await expect(page.locator('.success-msg')).toHaveText('Record saved successfully');
```
- After a form submit: assert the confirmation message text or navigation URL.
- After a button click: assert the resulting page state, not just that the click succeeded.
- On error paths: assert the error message text shown to the user.
- Screenshot on failure is required evidence for visual assertions.

### API Tests
```typescript
// ❌ Wrong — asserts only status
expect(response.status).toBe(200);

// ✅ Correct — asserts body content and persistence
expect(response.body.name).toBe('Test Account');
const record = await sfClient.query(`SELECT Name FROM Account WHERE Id = '${response.body.id}'`);
expect(record[0].name).toBe('Test Account');
```
- Always re-query after POST/PATCH to confirm persistence.
- Assert 403/401 for unauthorized requests — do not skip permission tests.

### Agentforce DML
```typescript
// ❌ Wrong — asserts only the chat response
expect(chatResponse).toContain('I created the case');

// ✅ Correct — asserts both conversational output AND database state
expect(chatResponse).toContain('I created the case');
const cases = await sfClient.query(`SELECT Subject FROM Case WHERE Subject = 'Test Case'`);
expect(cases).toHaveLength(1); // @agent-dml
```
- Tag the test with `@agent-dml` in the test title.
- Poll for async DML: max 10 s, 500 ms interval.
- Save `sf data query` JSON output to `test-results/<spec>-<test>-dml.json`.

### CLI Tests
```bash
# ❌ Wrong — asserts only exit code
sf setup-agents local --rules cursor && echo "OK"

# ✅ Correct — asserts exit code + generated files + content
sf setup-agents local --rules cursor --profile developer
test -f .cursor/rules/developer-standards.mdc || exit 1
grep "alwaysApply" .cursor/rules/developer-standards.mdc || exit 1
```

### Documenting Gaps
If observable assertion is not possible today:
```
// DEFERRED VALIDATION: Cannot assert X because <reason>.
// Owner: <name>. Follow-up by: <date>.
```

## Steps
1. For each test in scope, identify the observable outcome it should verify.
2. Apply the pattern for that test type above.
3. For any gap: add the deferred validation comment with owner and date.

## Evidence
```bash
sf setup-agents evidence add --task <id> --role qa --type test --summary "Observable Assertions — QA Evidence Guide completed"
```
