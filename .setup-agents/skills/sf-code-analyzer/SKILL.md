---
name: sf-code-analyzer
description: >-
  Run static code analysis on Salesforce projects using sf code-analyzer.
  Supports Apex (PMD), LWC (ESLint), RetireJS, and CPD engines with
  configurable rule selectors, severity thresholds, and output formats.
  USE FOR: code analysis, static analysis, code quality, PMD, ESLint,
  code review, code scan, lint, apex analysis, lwc analysis, security scan.
  Reusable by Developer, QA, Architect, and DevOps profiles.
---

# Salesforce Code Analyzer

## Prerequisites

| Tool | Check | Install |
|------|-------|---------|
| Salesforce CLI | `sf --version` | [https://developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli) |
| Code Analyzer plugin | `sf plugins inspect @salesforce/plugin-code-analyzer` | `sf plugins install @salesforce/plugin-code-analyzer` |

Before proceeding, ensure the plugin is installed:

```bash
sf plugins inspect @salesforce/plugin-code-analyzer 2>/dev/null || sf plugins install @salesforce/plugin-code-analyzer
```

---

## Active Job Monitoring (CRITICAL)

When you execute `sf code-analyzer run`, you MUST wait for it to complete.
**Never** ask the user to check the result or suggest reviewing later.
Report the full results including violation count, severity breakdown, and
affected files. If the analysis is long-running, monitor its progress.

---

## 1. Running Analysis (`sf code-analyzer run`)

### Basic Usage

```bash
# Analyze entire project
sf code-analyzer run --target force-app

# Analyze specific files (comma-separated)
sf code-analyzer run --target "force-app/main/default/classes/MyClass.cls,force-app/main/default/classes/MyService.cls"

# Analyze a directory
sf code-analyzer run --target force-app/main/default/classes
```

### Rule Selectors

Use `--rule-selector` to pick which engines and rule categories to apply:

| Engine | Selector | Covers |
|--------|----------|--------|
| PMD | `pmd:Recommended` | Best practices, code style |
| PMD | `pmd:Security` | SOQL injection, CRUD/FLS, XSS |
| PMD | `pmd:Performance` | SOQL/DML in loops, large queries |
| PMD | `pmd:Design` | Complexity, coupling, class size |
| ESLint | `eslint:Recommended` | JS best practices for LWC |
| ESLint | `eslint:Security` | DOM XSS, eval, unsafe patterns |
| RetireJS | `retire-js:Recommended` | Known vulnerable JS libraries |
| CPD | `cpd:Recommended` | Copy-paste / duplicate code detection |

```bash
# Apex: security + performance rules only
sf code-analyzer run --target force-app/main/default/classes \
  --rule-selector "pmd:Security,pmd:Performance"

# LWC: recommended + security
sf code-analyzer run --target force-app/main/default/lwc \
  --rule-selector "eslint:Recommended,eslint:Security"

# Full scan: all engines
sf code-analyzer run --target force-app \
  --rule-selector "pmd:Recommended,pmd:Security,pmd:Performance,pmd:Design,eslint:Recommended,eslint:Security,retire-js:Recommended,cpd:Recommended"
```

### Severity Threshold

Control which severity level blocks (returns exit code 2):

```bash
# Block only on HIGH/critical violations
sf code-analyzer run --target force-app --severity-threshold 1

# Block on HIGH and MEDIUM
sf code-analyzer run --target force-app --severity-threshold 2

# Block on any violation (HIGH, MEDIUM, LOW)
sf code-analyzer run --target force-app --severity-threshold 3
```

| Exit Code | Meaning |
|-----------|---------|
| 0 | No violations above threshold |
| 2 | Violations found at or above threshold severity |
| Other | Analyzer error (treat as non-blocking) |

### Output Formats

```bash
# Table (default, best for terminal)
sf code-analyzer run --target force-app --output-format table

# JSON (for programmatic processing)
sf code-analyzer run --target force-app --output-format json

# CSV (for spreadsheet analysis)
sf code-analyzer run --target force-app --output-format csv --output-file report.csv

# HTML (for sharing with stakeholders)
sf code-analyzer run --target force-app --output-format html --output-file report.html
```

---

## 2. Listing Rules (`sf code-analyzer rules list`)

Inspect available rules before running analysis:

```bash
# List all available rules
sf code-analyzer rules list

# Filter by engine
sf code-analyzer rules list --rule-selector "pmd:Security"
```

---

## 3. Common Recipes

### Full Project Scan (recommended before PR / release)

```bash
sf code-analyzer run \
  --target force-app \
  --rule-selector "pmd:Recommended,pmd:Security,pmd:Performance,eslint:Recommended,eslint:Security" \
  --severity-threshold 1 \
  --output-format html \
  --output-file code-analysis-report.html
```

Report: total violations by severity, top offending files, and whether any
HIGH violations must be resolved before merging.

### Staged Files Only (CI / pre-commit)

```bash
STAGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(cls|js|html)$' | paste -sd ',' -)
[ -n "$STAGED" ] && sf code-analyzer run \
  --target "$STAGED" \
  --rule-selector "pmd:Recommended,pmd:Security,eslint:Recommended" \
  --severity-threshold 1
```

### Security-focused Scan

```bash
sf code-analyzer run \
  --target force-app \
  --rule-selector "pmd:Security,eslint:Security,retire-js:Recommended" \
  --severity-threshold 1
```

### Duplicate Code Detection

```bash
sf code-analyzer run \
  --target force-app/main/default/classes \
  --rule-selector "cpd:Recommended"
```

---

## 4. Interpreting Results

After each analysis run, report to the user:

1. **Total violation count** broken down by severity (HIGH / MEDIUM / LOW).
2. **Top offending files** — which files have the most violations.
3. **Critical findings** — any security-related violations (SOQL injection, missing CRUD/FLS,
   XSS) that must be fixed immediately.
4. **Actionable recommendations** — concrete fixes for the highest-severity issues.

If the user asks for a code review or quality check, always run analysis first
and base your review on the objective findings.

---

## Quick Reference

| Task | Command |
|------|---------|
| Full project scan | `sf code-analyzer run --target force-app` |
| Apex security scan | `sf code-analyzer run --target force-app/main/default/classes --rule-selector "pmd:Security"` |
| LWC lint | `sf code-analyzer run --target force-app/main/default/lwc --rule-selector "eslint:Recommended"` |
| Block on HIGH only | `--severity-threshold 1` |
| HTML report | `--output-format html --output-file report.html` |
| List available rules | `sf code-analyzer rules list` |
| Staged files only | See "Staged Files Only" recipe above |