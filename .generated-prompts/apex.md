<!-- setup-agents: 2.0.2 -->

# Apex Class Prompts

> AI prompt register for Apex classes (.cls) in this project.
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

When creating a new Apex class, the agent reads this file for existing naming patterns,
data layer strategy (JT_DynamicQueries vs DataSelector), and sharing model decisions,
then generates the class consistent with prior entries.

When modifying an existing class substantially, the agent updates the entry in place
(increments **Iterations**, updates **Updated**, replaces **Prompt**).

---

<!-- Entries below this line are maintained by the agent -->
