---
name: project-knowledge-bootstrap
description: >-
  Scan a Salesforce project structure and populate .setup-agents/project-knowledge.md
  with architecture decisions, naming conventions, label language, and codebase map.
  USE FOR: first architect task, empty project-knowledge sections, codebase onboarding,
  naming convention detection, label language detection.
---

# Project Knowledge Bootstrap

Populates the `.setup-agents/project-knowledge.md` contract by scanning the project structure.
Run this skill when `project-knowledge.md` exists but has empty sections.

## Trigger

- The architect role starts its first task and `project-knowledge.md` has empty sections.
- Any agent detects `force-app/` exists but `## Codebase Map` is blank.

## Protocol

### 1. Detect Project Type

```bash
# Check for Salesforce project markers
ls force-app/main/default 2>/dev/null && echo "SALESFORCE"
ls sfdx-project.json 2>/dev/null && echo "SFDX"
ls package.xml 2>/dev/null && echo "PACKAGE_XML"
```

### 2. Scan Codebase Structure

```bash
# Directory tree (depth 3 for overview)
find force-app -type d -maxdepth 3 | sort

# Count artifacts by type
echo "=== Apex Classes ===" && ls force-app/main/default/classes/*.cls 2>/dev/null | wc -l
echo "=== Triggers ===" && ls force-app/main/default/triggers/*.trigger 2>/dev/null | wc -l
echo "=== LWC ===" && ls force-app/main/default/lwc/ 2>/dev/null | wc -l
echo "=== Flows ===" && ls force-app/main/default/flows/*.flow-meta.xml 2>/dev/null | wc -l
echo "=== Objects ===" && ls force-app/main/default/objects/ 2>/dev/null | wc -l
echo "=== Perm Sets ===" && ls force-app/main/default/permissionsets/*.permissionset-meta.xml 2>/dev/null | wc -l
```

### 3. Detect Naming Conventions

For each artifact type, sample 3-5 existing files and infer the pattern:

```bash
# Apex class naming
ls force-app/main/default/classes/*.cls 2>/dev/null | head -5

# Test class naming (suffix? prefix? folder?)
ls force-app/main/default/classes/*Test*.cls 2>/dev/null | head -5
ls force-app/main/default/classes/*_Test*.cls 2>/dev/null | head -5

# Trigger naming
ls force-app/main/default/triggers/*.trigger 2>/dev/null | head -5

# LWC naming
ls force-app/main/default/lwc/ 2>/dev/null | head -5

# Custom object naming
ls force-app/main/default/objects/ 2>/dev/null | grep "__c" | head -5

# Flow naming
ls force-app/main/default/flows/*.flow-meta.xml 2>/dev/null | head -5
```

**Rules for inference:**
- If a prefix is consistent across 80%+ of files, record it (e.g., `APP_ClassName`).
- If test classes use a suffix, record it (e.g., `*Test` vs `*_Test`).
- If no clear pattern emerges, leave the convention cell **empty** and add a note:
  "No convention detected — ask user before creating new artifacts."

### 4. Detect Label Language

```bash
# Sample custom field labels from object metadata
grep -h "<label>" force-app/main/default/objects/*/fields/*.field-meta.xml 2>/dev/null | head -10

# Sample custom object labels
grep -h "<label>" force-app/main/default/objects/*/*.object-meta.xml 2>/dev/null | head -5

# Sample flow labels
grep -h "<label>" force-app/main/default/flows/*.flow-meta.xml 2>/dev/null | head -5
```

**Language detection heuristic:**
- If labels contain accented characters (á, é, ñ, ü) or non-ASCII → likely Spanish/Portuguese/French.
- If labels are CamelCase English words → English.
- If mixed → record "Mixed — confirm with user."
- Record both the label language AND description language (they may differ).

### 5. Identify Architecture Patterns

```bash
# Look for trigger handler pattern
grep -rl "TriggerHandler\|ITriggerHandler\|TriggerDispatcher" force-app/ 2>/dev/null | head -3

# Look for data access layer
grep -rl "Selector\|Repository\|DataAccess\|DynamicQueries\|DatabaseService" force-app/ 2>/dev/null | head -3

# Look for service layer
grep -rl "Service\b" force-app/main/default/classes/ 2>/dev/null | grep -v Test | head -5

# Look for async patterns
grep -rl "implements Queueable\|@future\|implements Schedulable\|implements Database.Batchable" force-app/ 2>/dev/null | head -5

# Look for Platform Events
ls force-app/main/default/platformEventChannelMembers/ 2>/dev/null
ls force-app/main/default/customMetadata/ 2>/dev/null | head -5
```

### 6. Build Documentation Index

Populate `.setup-agents/doc-index.md` (a separate lightweight file agents read to locate docs).

```bash
# Find documentation files and directories
ls docs/ 2>/dev/null && echo "=== docs/ exists ==="
ls docs/adr/ 2>/dev/null && echo "=== ADRs found ==="
find . -maxdepth 2 -name "README*" -o -name "CHANGELOG*" -o -name "CONTRIBUTING*" | sort
find . -maxdepth 3 -name "*.md" -path "*/docs/*" | sort | head -20
ls wiki/ 2>/dev/null || ls .wiki/ 2>/dev/null || echo "No local wiki"
find . -maxdepth 2 -name "decisions" -type d 2>/dev/null
find . -maxdepth 2 -name "runbook*" -o -name "playbook*" | head -5
```

For each documentation source found, add a row to `doc-index.md`:

| Path | Content | When to read |
|------|---------|--------------|
| docs/adr/ | Architecture Decision Records | Before proposing new architecture |
| docs/deployment/runbook.md | Deploy steps and rollback procedures | Before release phase |
| README.md | Project overview, setup, and local dev instructions | Onboarding, first task |
| CHANGELOG.md | Release history and breaking changes | Before versioning decisions |

This index is intentionally a separate file so agents can read it in one shot
without loading the full project-knowledge.md (which contains naming, architecture, etc.).

### 7. Build Class Catalog

Populate `.setup-agents/class-catalog.md` by classifying every Apex class, trigger, and LWC.

```bash
# List all Apex classes (non-test)
ls force-app/main/default/classes/*.cls 2>/dev/null | grep -v "_Test\|Test\." | xargs -I{} basename {}

# For each class, read the first 5 lines to detect its type:
# - "implements TriggerHandler" or extends TriggerHandler → Trigger Handler
# - "Domain" in name or wraps a specific SObject → Domain
# - "Service" in name or orchestrates multiple objects → Service
# - "@InvocableMethod" or "@RestResource" or "implements Queueable" → Invocable/REST
# - "*Selector" or "*Factory" or "*Helper" or "*Util*" → Utility

head -10 force-app/main/default/classes/<ClassName>.cls
```

**Classification rules:**
- **Domain**: class name contains object name OR class doc mentions a specific SObject. Record the object.
- **Service**: orchestrates cross-object logic, often has "Service" suffix. Record one-line responsibility.
- **Trigger Handler**: extends/implements trigger handler base. Record which object and trigger.
- **Test**: has `@isTest` annotation or `_Test`/`Test` suffix. Record what it tests.
- **Invocable/REST**: `@InvocableMethod`, `@RestResource`, `implements Queueable/Batch/Schedulable`. Record type + purpose.
- **LWC**: each directory under `lwc/`. Read the `.js-meta.xml` for the target (lightning__RecordPage, etc.).
- **Utility**: everything else (selectors, factories, helpers, base classes).

Write results to `.setup-agents/class-catalog.md` filling each section table.

### 8. Populate project-knowledge.md

Fill each section with findings. Use this format:

**Architecture Decisions:**
```markdown
- Trigger pattern: [detected pattern or "None — ask before implementing"]
- Data layer: [detected class/pattern or "None — propose options"]
- Async strategy: [detected patterns in use]
- Sharing model: [with sharing / without sharing defaults detected]
```

**Naming Conventions table:**
Fill the table cells with detected patterns. Leave empty cells for undetected patterns.

**Label Language:**
```markdown
- Labels: [detected language]
- Descriptions: [detected language]
- API Names: English (standard)
```

**Codebase Map:**
```markdown
- Entry points: [trigger classes, REST endpoints, schedulables]
- Service classes: [path pattern]
- Utility classes: [path pattern]
- Test helpers: [path pattern, test data factory]
- LWC components: [path + any shared library components]
```

**Search Hints:**
```markdown
- Trigger handlers: force-app/main/default/classes/*Handler.cls
- Test classes: force-app/main/default/classes/*Test.cls
- [other patterns discovered]
```

## Rules

- Never guess conventions. If <3 samples exist for a pattern, mark as "insufficient data — ask user."
- Do not modify source code. This skill is read-only analysis.
- If `force-app/` does not exist, check for `src/`, `app/`, or other source roots and adapt.
- After populating, write the updated content via the `writeProjectKnowledge` service.
- Run time budget: complete within 60 seconds of shell commands.
