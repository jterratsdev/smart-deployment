<!-- setup-agents: 3.23.0 -->
<!-- setup-agents:block:start id="prompt-register-guidance" version="3.23.0" -->

# Generated Documentation Prompts

> AI prompt register for ADRs, architecture review docs, runbooks, data model docs, user guides, release notes in this project.
> Maintained by the agent — one entry per component, latest prompt only.
> Commit this file so the team can trace every generated artifact back to its origin.

## Format

```
## <ComponentName>
- **Created:** YYYY-MM-DD
- **Updated:** YYYY-MM-DD   ← omit if never updated
- **Iterations:** N          ← increment on each substantial change

### Key decisions
- <Pattern / constraint / design choice that shaped the component>

### Prompt
```

<the final prompt that produced or substantially changed this component>
```
---
```

**Substantial change** = new method, new business requirement, pattern change, architectural refactor.
Minor fixes (typos, formatting, single-line corrections) do NOT update the prompt entry.

---

## Usage

When generating documentation, the agent reads this file to understand the existing
documentation structure, naming conventions, and audience (technical, business, operations).
Always updates rather than duplicates an existing doc.

---

<!-- setup-agents:block:end id="prompt-register-guidance" -->
<!-- Entries below this line are maintained by the agent -->

## Field Migration CLI Reference

- **Created:** 2026-10-09
- **Updated:** 2026-10-09
- **Iterations:** 1
- **Task:** SD-FIELD-MIGRATION-PLAN

### Key decisions

- Document the read-only assessment separately from `start` behavior so it cannot be mistaken for automatic pre-destructive deployment or reference rewriting.
- State the need for complete org observation, data backup and reviewed consumer changes before field deletion.

### Prompt

```
In docs/cli-reference.md explain that CustomField type, formula and global value set migrations are not yet executable through start, and that the new pure assessment does not query the org, edit consumers or authorize deletion.
```

---

## CLI Reference Impact Command

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1

### Key decisions

- Updated the existing CLI reference instead of creating a new document.
- Documented impact command flags, read-only behavior, working-tree default, ref comparison mode, and CI JSON fields.

### Prompt

```
Document the new smart-deployment impact command in docs/cli-reference.md with supported flags and behavior, preserving the existing Salesforce Cloud header and CLI reference structure.
```

---

## CliReferenceGraphExport

- **Created:** 2026-05-29
- **Updated:** 2026-05-29
- **Iterations:** 1

### Key decisions

- Documented `sf smart-deployment graph export` in the existing CLI reference rather than adding a new guide.
- Captured output path precedence, supported formats, default graph export location, and JSON artifact review metadata.

### Prompt

```
Update the CLI reference for PLUGIN-GRAPH-EXPORT with supported flags, behavior, default files written, and CI artifact expectations while preserving existing documentation structure and Salesforce Cloud header.
```

---

## CLI Reference Init Command

- **Created:** 2026-06-03
- **Updated:** 2026-06-03
- **Iterations:** 1

### Key decisions

- Documented `sf smart-deployment init` in the existing CLI reference rather than creating a separate guide.
- Captured overwrite protection, generated config fields, project detection behavior, and non-deployment semantics.

### Prompt

```
Document the new smart-deployment init command in docs/cli-reference.md with supported flags, generated config behavior, overwrite protection, and files written.
```

---

## CLI Reference Retrieve Command

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Updated README and the existing CLI reference instead of creating a new guide.
- Documented retrieve flags, post-retrieve .forceignore enforcement, strict failure behavior, and opt-in DigitalExperience meta normalization.

### Prompt

```
Document the new smart-deployment retrieve command in README.md and docs/cli-reference.md, including forceignore-protected bundle sub-path restoration, strict ignore behavior, normalize-meta behavior, and the fact that the command guards the local workspace after Salesforce CLI retrieve completes.
```

---

## CLI Reference Destructive Rollback

- **Created:** 2026-06-05
- **Updated:** 2026-06-05
- **Iterations:** 1

### Key decisions

- Updated README and docs/cli-reference.md rather than adding a new guide.
- Documented --destructive, --rollback-from, --rollback-to, reverse destructive waves, and release tags as recommended rollback boundaries.

### Prompt

```
Document destructive and rollback start modes in README.md and docs/cli-reference.md, including release-tag rollback guidance and the fact that destructive mode remains part of the start command.
```

---

<!-- Entries below this line are maintained by agents -->

## docs/research/metadata-catalog/object-flexipage-activation-plan.md

- **Created:** 2026-10-20
- **Updated:** 2026-10-21
- **Iterations:** 2
- **Task:** SD-ACCOUNT-OMISSION-DEMO-EXPERIMENT
- **Role:** qa
- **Paths:** docs/research/metadata-catalog/object-flexipage-activation-plan.md

### Key decisions

- Prompt registry update recorded.

### Evidence

- Pending verification evidence.

### Prompt

```
Document the user-approved disposable cg-demo Account Metadata API 67.0 minimal omission test, precise payload, validation/deploy IDs, identical before/after object XML hash and REST overrides, and scope limitations without authorizing production or runner changes.
```

---
