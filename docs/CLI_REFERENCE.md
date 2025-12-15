# 📘 CLI Reference - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Complete reference for all Smart Deployment Plugin CLI commands and flags.

---

## Command: `sf smart-deployment analyze`

Analyzes Salesforce metadata, builds dependency graph, and generates deployment waves without deploying.

### Synopsis

```bash
sf smart-deployment analyze [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--source-path` | `-p` | string | No | `.` | Path to analyze (defaults to current directory) |
| `--target-org` | `-o` | string | No | None | Target org (optional, used for AI authentication) |
| `--save-plan` | | boolean | No | `false` | Save deployment plan for CI/CD |
| `--plan-path` | | string | No | `.smart-deployment/deployment-plan.json` | Custom path for deployment plan |
| `--use-ai` | | boolean | No | `false` | Use Agentforce AI for intelligent analysis |
| `--org-type` | | string | No | Auto-detect | Organization type (Production, Sandbox, Developer) |
| `--industry` | | string | No | None | Industry context for AI analysis |
| `--locale` | | string | No | Auto-detect | Language locale (en, es, fr, de, pt, ja) |
| `--output` | `-o` | string | No | Console | Output file path |
| `--format` | `-f` | string | No | `json` | Output format (json\|html) |

### Examples

```bash
# Basic analysis
sf smart-deployment analyze

# Analyze specific path
sf smart-deployment analyze --source-path force-app

# Save deployment plan
sf smart-deployment analyze --save-plan

# Analysis with AI
sf smart-deployment analyze --use-ai --target-org myorg

# Analysis with industry context
sf smart-deployment analyze --use-ai --industry Fintech --org-type Production

# Custom plan path
sf smart-deployment analyze --save-plan --plan-path custom-plan.json

# HTML output
sf smart-deployment analyze --format html --output report.html
```

### Output

Returns JSON with:
- `components`: Number of components found
- `dependencies`: Number of dependencies detected
- `planSaved`: Whether deployment plan was saved (if `--save-plan`)

---

## Command: `sf smart-deployment start`

Executes deployment to Salesforce org. Main deployment command.

### Synopsis

```bash
sf smart-deployment start --target-org <org> [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--target-org` | `-o` | string | **Yes** | None | Target Salesforce org for deployment |
| `--dry-run` | `-d` | boolean | No | `false` | Preview deployment without executing |
| `--validate-only` | `-v` | boolean | No | `false` | Validate deployment without committing changes |
| `--no-test-run` | | boolean | No | `false` | Skip tests (sandbox only, ignored in production) |
| `--run-wave-test` | | boolean | No | `false` | Run only test classes included in each wave |
| `--use-ai` | | boolean | No | `false` | Use Agentforce AI for intelligent priority weighting |
| `--ai-auto` | | boolean | No | `false` | Auto-apply AI recommendations with confidence > threshold |
| `--ai-confidence-threshold` | | string | No | `0.8` | Minimum AI confidence to auto-apply (0-1) |
| `--org-type` | | string | No | Auto-detect | Organization type (Production, Sandbox, Developer) |
| `--industry` | | string | No | None | Industry context for AI analysis |
| `--use-plan` | | string | No | None | Use saved deployment plan (CI/CD) |
| `--verify-against-plan` | | string | No | None | Verify deployment against plan |
| `--max-diff` | | integer | No | `10` | Maximum diff percentage for plan verification |
| `--strict` | | boolean | No | `false` | Strict mode (requires --use-plan) |
| `--source-path` | `-p` | string | No | `.` | Source path to deploy |
| `--ai-timeout` | | integer | No | `30000` | AI request timeout in milliseconds |
| `--locale` | | string | No | Auto-detect | Language locale (en, es, fr, de, pt, ja) |

### Test Execution Flags

#### `--no-test-run`
- **Sandbox**: Skips all test execution
- **Production**: **IGNORED** (tests are required by Salesforce)
- **Use case**: Fast sandbox deployments

#### `--run-wave-test`
- Runs only test classes included in each wave
- Uses `RunSpecifiedTests` test level
- **Recommended for production** (faster than RunLocalTests)
- If no test classes found in wave, SF CLI determines test level

#### Default Behavior
- If no test flags provided, SF CLI uses its standard behavior:
  - **Production**: Requires tests (enforced by SF CLI)
  - **Sandbox**: Allows NoTestRun

### Examples

```bash
# Basic deployment
sf smart-deployment start --target-org myorg

# Dry-run (preview)
sf smart-deployment start --target-org myorg --dry-run

# Validate only
sf smart-deployment start --target-org myorg --validate-only

# Skip tests (sandbox only)
sf smart-deployment start --target-org mysandbox --no-test-run

# Run wave-specific tests (production)
sf smart-deployment start --target-org prod --run-wave-test

# Use AI prioritization
sf smart-deployment start --target-org myorg --use-ai --ai-auto

# Use saved deployment plan (CI/CD)
sf smart-deployment start --target-org prod --use-plan .smart-deployment/deployment-plan.json --strict

# AI with custom confidence threshold
sf smart-deployment start --target-org myorg --use-ai --ai-auto --ai-confidence-threshold 0.9
```

### Output

Returns JSON with:
- `success`: Whether deployment succeeded
- `waves`: Number of waves deployed

---

## Command: `sf smart-deployment validate`

Validates deployment without executing it.

### Synopsis

```bash
sf smart-deployment validate --target-org <org> [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--target-org` | `-o` | string | **Yes** | None | Target Salesforce org |
| `--source-path` | `-p` | string | No | `.` | Source path to validate |
| `--locale` | | string | No | Auto-detect | Language locale (en, es, fr, de, pt, ja) |

### Examples

```bash
# Validate deployment
sf smart-deployment validate --target-org myorg

# Validate specific path
sf smart-deployment validate --target-org myorg --source-path force-app
```

### Output

Returns JSON with:
- `success`: Whether validation succeeded
- `errors`: Array of validation errors (if any)

---

## Command: `sf smart-deployment status`

Shows current deployment status and progress.

### Synopsis

```bash
sf smart-deployment status --target-org <org> [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--target-org` | `-o` | string | **Yes** | None | Target Salesforce org |
| `--watch` | `-w` | boolean | No | `false` | Watch for status changes |

### Examples

```bash
# Check status
sf smart-deployment status --target-org myorg

# Watch status
sf smart-deployment status --target-org myorg --watch
```

### Output

Returns JSON with:
- `currentWave`: Current wave number
- `totalWaves`: Total number of waves
- `completedWaves`: Array of completed wave numbers

---

## Command: `sf smart-deployment resume`

Resumes a failed deployment from the last completed wave.

### Synopsis

```bash
sf smart-deployment resume --target-org <org> [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--target-org` | `-o` | string | **Yes** | None | Target Salesforce org |
| `--source-path` | `-p` | string | No | `.` | Source path |

### Examples

```bash
# Resume failed deployment
sf smart-deployment resume --target-org myorg
```

### Output

Returns JSON with:
- `success`: Whether resume succeeded
- `resumedFromWave`: Wave number where deployment resumed

---

## Command: `sf smart-deployment config`

Manages plugin configuration settings.

### Synopsis

```bash
sf smart-deployment config [FLAGS]
```

### Flags

| Flag | Short | Type | Required | Default | Description |
|------|-------|------|----------|---------|-------------|
| `--get` | `-g` | string | No | None | Get configuration value |
| `--set` | `-s` | string | No | None | Set configuration value (key=value) |

### Examples

```bash
# Get configuration
sf smart-deployment config --get ai.enabled

# Set configuration
sf smart-deployment config --set ai.enabled=true
sf smart-deployment config --set ai.confidenceThreshold=0.9
```

### Output

Returns JSON with:
- `success`: Whether operation succeeded

---

## Flag Reference

### Common Flags

#### `--target-org` / `-o`
- **Type**: string
- **Required**: Yes (for `start`, `validate`, `status`, `resume`)
- **Description**: Target Salesforce org alias or username
- **Example**: `--target-org myorg` or `-o myorg`

#### `--source-path` / `-p`
- **Type**: string
- **Required**: No
- **Default**: `.` (current directory)
- **Description**: Path to source code directory
- **Example**: `--source-path force-app` or `-p force-app`

#### `--locale`
- **Type**: string
- **Required**: No
- **Default**: Auto-detect from environment
- **Options**: `en`, `es`, `fr`, `de`, `pt`, `ja`
- **Description**: Language locale for output messages
- **Example**: `--locale es`

### AI Flags

#### `--use-ai`
- **Type**: boolean
- **Default**: `false`
- **Description**: Enable Agentforce AI for intelligent analysis
- **Example**: `--use-ai`

#### `--ai-auto`
- **Type**: boolean
- **Default**: `false`
- **Requires**: `--use-ai`
- **Description**: Auto-apply AI recommendations with confidence > threshold
- **Example**: `--use-ai --ai-auto`

#### `--ai-confidence-threshold`
- **Type**: string (number 0-1)
- **Default**: `0.8`
- **Requires**: `--ai-auto`
- **Description**: Minimum AI confidence to auto-apply (0-1)
- **Example**: `--ai-confidence-threshold 0.9`

#### `--org-type`
- **Type**: string
- **Options**: `Production`, `Sandbox`, `Developer`
- **Description**: Organization type for AI context
- **Example**: `--org-type Production`

#### `--industry`
- **Type**: string
- **Description**: Industry context for AI analysis
- **Example**: `--industry Fintech`

### CI/CD Flags

#### `--save-plan`
- **Type**: boolean
- **Default**: `false`
- **Description**: Save deployment plan for CI/CD
- **Example**: `--save-plan`

#### `--plan-path`
- **Type**: string
- **Default**: `.smart-deployment/deployment-plan.json`
- **Description**: Custom path for deployment plan
- **Example**: `--plan-path custom-plan.json`

#### `--use-plan`
- **Type**: string
- **Description**: Use saved deployment plan (CI/CD)
- **Example**: `--use-plan .smart-deployment/deployment-plan.json`

#### `--strict`
- **Type**: boolean
- **Default**: `false`
- **Requires**: `--use-plan`
- **Description**: Strict mode (requires pre-approved plan)
- **Example**: `--use-plan plan.json --strict`

#### `--verify-against-plan`
- **Type**: string
- **Description**: Verify deployment against plan
- **Example**: `--verify-against-plan plan.json`

#### `--max-diff`
- **Type**: integer
- **Default**: `10`
- **Description**: Maximum diff percentage for plan verification
- **Example**: `--max-diff 20`

### Test Flags

#### `--no-test-run`
- **Type**: boolean
- **Default**: `false`
- **Description**: Skip tests (sandbox only, ignored in production)
- **Example**: `--no-test-run`

#### `--run-wave-test`
- **Type**: boolean
- **Default**: `false`
- **Description**: Run only test classes included in each wave
- **Example**: `--run-wave-test`

### Output Flags

#### `--output` / `-o`
- **Type**: string
- **Description**: Output file path
- **Example**: `--output report.json` or `-o report.json`

#### `--format` / `-f`
- **Type**: string
- **Default**: `json`
- **Options**: `json`, `html`
- **Description**: Output format
- **Example**: `--format html` or `-f html`

### Deprecated Flags

#### `--skip-tests` / `-s`
- **Status**: ⚠️ **Deprecated** (use `--no-test-run` instead)
- **Deprecated in**: Version 2.0.0
- **Replacement**: `--no-test-run`

---

## Exit Codes

| Code | Meaning |
|------|---------|
| `0` | Success |
| `1` | General error |
| `2` | Command error (invalid flags, missing required flags) |

---

## JSON Output Format

All commands support `--json` flag for machine-readable output:

```bash
sf smart-deployment analyze --json
sf smart-deployment start --target-org myorg --json
sf smart-deployment status --target-org myorg --json
```

---

## Environment Variables

You can set default values using environment variables:

```bash
export SF_TARGET_ORG=myorg
export SF_AI_ENABLED=true
export SF_AI_CONFIDENCE_THRESHOLD=0.9
export SF_STRICT_MODE=true
```

---

## Related Documentation

- [User Guide](./USER_GUIDE.md) - Getting started guide
- [Configuration Guide](./CONFIGURATION_GUIDE.md) - Configuration options
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md) - CI/CD integration

---

**Last Updated**: December 14, 2025








