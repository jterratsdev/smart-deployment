<!-- setup-agents: 2.0.2 -->

# OmniStudio Prompts

> AI prompt register for OmniScripts, FlexCards, and Integration Procedures (OmniStudio / Core) in this project.
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

When creating OmniStudio artifacts, the agent reads this file for existing data source
patterns, action naming, and activation settings. It notes the deployment target:
OmniStudio managed package or OmniStudio for Core (Vlocity migration path).

---

<!-- Entries below this line are maintained by the agent -->
