<!-- setup-agents: 3.16.0 -->
# Apex Trigger Prompts

> AI prompt register for Apex triggers (.trigger) and their handler classes in this project.
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

When creating a new trigger+handler pair, the agent reads this file to:
- Verify no trigger already exists for that object (one trigger per object rule).
- Read existing handler patterns (Kevin O'Hara, delegation style, service class names).

Each entry covers both the trigger and its handler class.

---

<!-- Entries below this line are maintained by the agent -->
