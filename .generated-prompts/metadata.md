<!-- setup-agents: 2.0.2 -->

# Metadata Configuration Prompts

> AI prompt register for CustomObjects, CustomFields, ValidationRules, PermissionSets, CMDT, Platform Events, FlexiPages, NamedCredentials in this project.
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

When creating declarative metadata, the agent reads this file for existing field naming
conventions (PascalCase API name, Spanish label), sharing model decisions, and CMDT patterns.

Use this file to reconstruct the business intent behind custom fields or validation rules
whose purpose is not obvious from the API name alone.

---

<!-- Entries below this line are maintained by the agent -->
