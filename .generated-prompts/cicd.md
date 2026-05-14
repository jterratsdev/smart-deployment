<!-- setup-agents: 2.0.2 -->

# CI/CD & Pipeline Prompts

> AI prompt register for Pipeline YAML, deployment scripts, GitHub Actions workflows, Azure Pipelines, MuleSoft deployment descriptors in this project.
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

When creating or modifying pipeline configuration, the agent reads this file for
existing stage structure, secret/variable naming, deployment target conventions,
and test gate thresholds already established in the project.

---

<!-- Entries below this line are maintained by the agent -->
