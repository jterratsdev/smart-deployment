# 📜 Scripts

Automation scripts for the Smart Deployment Plugin project.

---

## 🎫 create-github-issues.js

Automates the creation of GitHub issues from `USER_STORIES.md`.

### Prerequisites

1. **GitHub CLI** installed and authenticated:

   ```bash
   # Install (macOS)
   brew install gh

   # Authenticate
   gh auth login
   ```

2. **Node.js** (v14+)

### Usage

#### Dry Run (Preview)

See what issues would be created without actually creating them:

```bash
node scripts/create-github-issues.js --dry-run
```

#### Create All Issues

Create all 90 user stories as GitHub issues:

```bash
node scripts/create-github-issues.js
```

#### Create Specific Epic

Create issues for a specific epic only:

```bash
# Epic 1: Core Infrastructure
node scripts/create-github-issues.js --epic=1

# Epic 2: Metadata Parsers
node scripts/create-github-issues.js --epic=2

# Epic 3: Dependency Analysis
node scripts/create-github-issues.js --epic=3

# ... and so on
```

### What It Does

1. **Parses** `docs/USER_STORIES.md`
2. **Extracts** all user stories with:
   - Title
   - User story format (As a... I want... So that...)
   - Acceptance criteria (as checkboxes)
   - Priority
   - Story points
   - Dependencies
   - Epic information
3. **Creates labels** automatically:
   - Epic labels (epic:core-infrastructure, etc.)
   - Priority labels (priority:must-have, etc.)
   - Story point labels (points:1, points:2, etc.)
   - User story label (user-story)
4. **Creates GitHub issues** with proper formatting and labels

### Example Output

```
🚀 GitHub Issues Creator for Smart Deployment Plugin

📖 Parsing USER_STORIES.md...

Found 90 user stories across 10 epics

Ensuring labels exist...
  ✅ Created label: epic:core-infrastructure
  ✅ Created label: priority:must-have
  ✅ Created label: points:3
  ...

📝 Creating issues...

Creating issue: [US-001] Functional Utilities...
✅ Created: https://github.com/jterrats/smart-deployment/issues/1

Creating issue: [US-002] Graph Algorithms...
✅ Created: https://github.com/jterrats/smart-deployment/issues/2

...

================================================================================
📊 Summary
================================================================================
✅ Created: 90 issues
❌ Failed: 0 issues
================================================================================
```

### Issue Format

Each GitHub issue includes:

- **Title**: `[US-XXX] Story Title`
- **Labels**:
  - `user-story`
  - `epic:name`
  - `priority:level`
  - `points:N`
- **Body**:

  ```markdown
  ## User Story

  **As a** developer
  **I want** to do something
  **So that** I achieve a goal

  ## Acceptance Criteria

  - [ ] Criterion 1
  - [ ] Criterion 2
  - [ ] Criterion 3

  ## Metadata

  - **Epic**: 1 - Core Infrastructure
  - **Priority**: Must Have
  - **Story Points**: 3
  - **Dependencies**: US-001, US-002

  ## Epic Goal

  Establish foundational architecture and utilities
  ```

### Tips

1. **Start with dry-run**: Always preview with `--dry-run` first
2. **Epic by epic**: Create issues one epic at a time for better organization
3. **Check labels**: Verify labels are created correctly before bulk creation
4. **Rate limits**: GitHub API has rate limits; the script handles this with retries

### Troubleshooting

#### Error: "gh: command not found"

Install GitHub CLI: https://cli.github.com/

#### Error: "gh auth status failed"

Authenticate with: `gh auth login`

#### Error: "API rate limit exceeded"

Wait a few minutes and try again, or create issues epic by epic

#### Error: "Label already exists"

This is expected and handled gracefully - the script will reuse existing labels

---

## 🧪 e2e-test.sh

End-to-end test script that validates smart-deployment commands against a real Salesforce org.

### Prerequisites

1. **Salesforce CLI** installed and authenticated:
   ```bash
   sf --version
   sf org list
   ```

2. **Plugin linked**:
   ```bash
   sf plugins link
   ```

3. **Authorized org** (preferably dev/qa, NOT prod/uat):
   ```bash
   sf org login web --alias dev
   ```

### Usage

#### Basic Usage (Auto-detect org)

The script will automatically find a suitable test org (prefers dev/qa, excludes prod/uat):

```bash
./scripts/e2e-test.sh
```

#### Specify Target Org

Override org selection with environment variable:

```bash
export E2E_TARGET_ORG=your-org-alias
./scripts/e2e-test.sh
```

### What It Tests

1. **Test 1: Analyze command** - Validates metadata analysis without deployment
2. **Test 2: Analyze with --save-plan** - Creates deployment plan JSON
3. **Test 3: Validate command** - Check-only deployment validation
4. **Test 4: Start with --dry-run** - Simulates deployment without executing
5. **Test 5: Start with --validate-only** - Validates waves without deploying
6. **Test 6: Analyze with --use-ai** - AI-powered analysis (if Agentforce available)
7. **Test 7: Error handling** - Invalid orgs, missing flags, etc.

### Safety Validations

The script creates dummy metadata files (`DummyTest.cls`, `DummyObject__c`) and verifies they are **NEVER modified** by any smart-deployment command. This ensures:

- ✅ Commands don't accidentally modify source metadata
- ✅ Only analysis/plan files are created (`.smart-deployment/`)
- ✅ Git safety (no unintended commits)

### Test Project

- **Location**: `test-project-e2e/` (created automatically)
- **Cleanup**: Automatically removed after tests complete
- **Git**: Initialized to validate git safety

### Example Output

```
ℹ Fetching list of authorized orgs...
✓ Using org: dev-org@example.com
ℹ Creating SF project in: /path/to/test-project-e2e
✓ Project created
✓ Git repository initialized
✓ Dummy metadata files created and committed

═══════════════════════════════════════════
Test 1: Analyze command (basic)
═══════════════════════════════════════════
ℹ Running: sf smart-deployment analyze...
✓ Analyze command executed
✓ No unexpected files modified (safe analyze confirmed)
✓ DummyTest.cls unchanged
✓ DummyObject__c unchanged
🛡️  SAFETY VALIDATED: Only analysis files created, source metadata untouched

...

✓ All E2E tests completed successfully!
```

### Troubleshooting

#### Error: "No suitable authorized orgs found"

Authenticate to a dev/qa org:
```bash
sf org login web --alias dev
export E2E_TARGET_ORG=dev
./scripts/e2e-test.sh
```

#### Error: "Plugin smart-deployment is not installed"

Link the plugin:
```bash
sf plugins link
```

#### Error: "Test failed! Cleaning up..."

Check the output above the error for specific failure details. Common issues:
- Org authentication expired
- Insufficient permissions
- Network connectivity issues

### Integration with CI/CD

The script can be used in CI/CD pipelines:

```yaml
# .github/workflows/e2e.yml
- name: Run E2E Tests
  env:
    E2E_TARGET_ORG: ${{ secrets.E2E_TEST_ORG }}
  run: ./scripts/e2e-test.sh
```

---

## 🔮 Future Scripts

- `generate-changelog.js` - Generate CHANGELOG from git commits
- `sync-dependencies.js` - Sync dependencies between stories
- `generate-sprint-plan.js` - Generate sprint plans from user stories
- `update-story-status.js` - Update story status from GitHub issues

---

**Last Updated**: December 2, 2025
