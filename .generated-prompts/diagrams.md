<!-- setup-agents: 2.0.2 -->

# Diagram Prompts

> AI prompt register for Architecture diagrams (Mermaid source, Lucid, draw.io) in this project.
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

When creating a new diagram, the agent reads this file for existing diagram style
decisions (Mermaid type, Lucid vs draw.io, Kit of Parts usage, naming conventions)
and generates the diagram consistent with prior architectural decisions.

---

<!-- Entries below this line are maintained by the agent -->
