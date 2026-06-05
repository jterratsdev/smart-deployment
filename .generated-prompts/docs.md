<!-- setup-agents: 2.0.2 -->

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

<!-- Entries below this line are maintained by the agent -->

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
