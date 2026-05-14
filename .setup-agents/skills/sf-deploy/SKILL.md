---
name: sf-deploy
description: >-
  Deploy and validate Salesforce metadata using @jterrats/profiler for complete
  profile retrieval and @jterrats/smart-deployment for dependency-aware wave
  deployments. USE FOR: deploy, validate, sf deploy, profile retrieve, profile
  compare, smart deployment, wave deployment, metadata deployment, deploy
  validation, deployment pipeline. Reusable by Developer, DevOps, and Architect
  profiles.
---

# Salesforce Deploy & Validate

## Prerequisites

| Tool                       | Check                                           | Install                                                                                                      |
| -------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Salesforce CLI             | `sf --version`                                  | [https://developer.salesforce.com/tools/salesforcecli](https://developer.salesforce.com/tools/salesforcecli) |
| @jterrats/profiler         | `sf plugins inspect @jterrats/profiler`         | `sf plugins install @jterrats/profiler --force`                                                              |
| @jterrats/smart-deployment | `sf plugins inspect @jterrats/smart-deployment` | `sf plugins install @jterrats/smart-deployment --force`                                                      |

Before proceeding, run this check and install anything missing:

```bash
sf plugins inspect @jterrats/profiler 2>/dev/null || sf plugins install @jterrats/profiler --force
sf plugins inspect @jterrats/smart-deployment 2>/dev/null || sf plugins install @jterrats/smart-deployment --force
```

> **Note:** The `--force` flag is required because these are unsigned community plugins.
> Without it, `sf plugins install` will prompt for interactive confirmation that blocks
> non-interactive execution (e.g., when an AI agent runs the command).

---

## Active Job Monitoring (CRITICAL)

When you execute **any** command from this skill (deploy, validate, test run, analyze),
you MUST wait for it to complete. **Never** ask the user to check the result or suggest
reviewing it later. You own the job from start to finish:

- **Synchronous CLI commands:** Wait for the command to return and report the result.
- **Async/long-running deploys:** Poll with `sf project deploy report` until status
  is `Succeeded` or `Failed`.
- **Test runs:** Wait for `sf apex test run` to complete. Report pass/fail count,
  coverage, and any errors.
- **GitHub Actions (if triggered):** Use `gh run watch <run-id>` or poll
  `gh run view <run-id>` until the workflow concludes. Report the final conclusion.

After completion, always report: **status**, **duration**, and **actionable next steps**
if there were failures.

---

## 1. Profile Retrieval (`sf profiler`)

### Retrieve Profiles with Full Dependencies

`sf profiler retrieve` guarantees complete profile metadata by automatically
resolving all dependencies (Apex Classes, Custom Objects, Custom Permissions,
Tabs, Flows, Layouts, etc.).

```bash
# Retrieve all profiles from the target org
sf profiler retrieve -o <alias>

# Retrieve specific profiles (comma-separated)
sf profiler retrieve -o <alias> --name "Admin,Standard User"

# Fast mode: use local project metadata instead of listing from org
sf profiler retrieve -o <alias> --from-project

# Include Field Level Security
sf profiler retrieve -o <alias> --all-fields

# Exclude managed package metadata
sf profiler retrieve -o <alias> --exclude-managed

# Dry run: preview without writing files
sf profiler retrieve -o <alias> --dry-run
```

**Best practice:** Always use `--from-project` when local metadata exists.
It skips the org describe call and is ~10x faster (~3s vs ~30s).

### Compare Profiles Across Environments

```bash
# Compare local profiles vs a single org
sf profiler compare -o <alias>

# Compare across multiple orgs (dev, qa, prod)
sf profiler compare --sources "dev,qa,prod" --name "Admin"

# Export comparison as HTML matrix
sf profiler compare --sources "dev,qa,prod" --output-format html --output-file comparison.html

# JSON output for automation
sf profiler compare -o <alias> --output-format json
```

### Generate Profile Documentation

```bash
# Generate markdown docs for all profiles
sf profiler docs

# Specific profiles to a custom directory
sf profiler docs --name "Admin,Custom Profile" --output-dir profile-docs
```

---

## 2. Smart Deployment (`sf smart-deployment`)

### Analyze Dependencies

Always analyze before deploying. This builds the dependency graph and identifies
optimal deployment waves.

```bash
# Analyze only (no deploy)
sf smart-deployment analyze
```

Review the output: it shows the dependency graph, wave breakdown, and any
circular dependencies that need manual resolution.

### Validate (Dry Run)

```bash
# Validate the deployment plan without executing
sf smart-deployment validate --target-org <alias>
```

**Never skip validation.** It catches missing dependencies and limit violations
before the actual deploy.

### Deploy in Waves

```bash
# Full deploy: analyze + deploy in optimized waves
sf smart-deployment start --target-org <alias>
```

### Resume from Failure

If a wave fails mid-deployment:

```bash
sf smart-deployment resume --target-org <alias>
```

This picks up from the last successful wave without re-deploying completed components.

### Salesforce Limits Awareness

The plugin respects these hard limits per wave:

| Limit                    | Value                       |
| ------------------------ | --------------------------- |
| Max components per wave  | 300                         |
| Max CMT records per wave | 200                         |
| Max files per deployment | ~400-500                    |
| Metadata types priority  | 78 types in optimized order |

---

## 3. Combined Deployment Pipeline

For a complete deployment, follow this sequence:

### Step 1: Ensure Profiles Are Complete

```bash
sf profiler retrieve -o <alias> --from-project --exclude-managed
```

### Step 2: Analyze Dependencies

```bash
sf smart-deployment analyze
```

Review the wave breakdown. If circular dependencies are reported, resolve them
manually before proceeding.

### Step 3: Validate

```bash
sf smart-deployment validate --target-org <alias>
```

Share the validation result with the user. Only proceed if validation passes.

### Step 4: Deploy

```bash
sf smart-deployment start --target-org <alias>
```

Wait for all waves to complete. If any wave fails, report which components
failed and attempt `sf smart-deployment resume --target-org <alias>` before
escalating.

### Step 5: Post-Deployment Verification

```bash
sf apex test run --target-org <alias> --test-level RunLocalTests --code-coverage --result-format human
```

Report:

- Wave count and components per wave
- Total pass/fail test count
- Overall code coverage (must be >= 90%)
- Any classes below the 90% threshold

### Step 6: Profile Comparison (Optional)

After deploying to a new environment, verify profile parity:

```bash
sf profiler compare --sources "<source-alias>,<target-alias>" --output-format html --output-file post-deploy-comparison.html
```

---

## Quick Reference

| Task                     | Command                                          |
| ------------------------ | ------------------------------------------------ |
| Retrieve profiles (fast) | `sf profiler retrieve -o <alias> --from-project` |
| Compare envs             | `sf profiler compare --sources "dev,qa,prod"`    |
| Profile docs             | `sf profiler docs --output-dir profile-docs`     |
| Analyze deps             | `sf smart-deployment analyze`                    |
| Validate deploy          | `sf smart-deployment validate -o <alias>`        |
| Deploy waves             | `sf smart-deployment start -o <alias>`           |
| Resume failed            | `sf smart-deployment resume -o <alias>`          |
