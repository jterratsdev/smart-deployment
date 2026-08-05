<!-- setup-agents: 3.16.0 -->
# Aura Component Prompts

> AI prompt register for Aura components (.cmp / .app) in this project.
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

When creating a new Aura component, the agent first checks whether an LWC equivalent
is possible (prefer LWC over Aura for new work), then reads this file for existing
event patterns and controller conventions.

---

<!-- Entries below this line are maintained by the agent -->
