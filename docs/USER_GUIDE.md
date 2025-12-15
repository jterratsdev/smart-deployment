# 📖 User Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Welcome to the Smart Deployment Plugin user guide. This guide will help you get started with intelligent Salesforce metadata deployment.

---

## 🚀 Quick Start

### Installation

```bash
# Install the plugin
sf plugins install @salesforce/plugin-smart-deployment

# Or link locally for development
sf plugins link .
```

### First Deployment

```bash
# 1. Authenticate to your Salesforce org
sf org login web --alias myorg

# 2. Analyze your project (optional, but recommended)
sf smart-deployment analyze --source-path .

# 3. Start deployment
sf smart-deployment start --target-org myorg
```

---

## 📋 Commands Overview

The Smart Deployment Plugin provides the following commands:

| Command | Description | Use Case |
|---------|-------------|----------|
| `analyze` | Analyze metadata without deploying | Preview deployment waves |
| `start` | Execute deployment | Deploy metadata to org |
| `validate` | Validate deployment | Check deployment validity |
| `status` | Check deployment status | Monitor active deployment |
| `resume` | Resume failed deployment | Continue after failure |
| `config` | Manage configuration | Configure plugin settings |

---

## 🔍 Command: `analyze`

Analyzes your Salesforce metadata, builds a dependency graph, and generates deployment waves **without deploying**.

### Basic Usage

```bash
# Analyze current directory
sf smart-deployment analyze

# Analyze specific path
sf smart-deployment analyze --source-path force-app

# Save deployment plan for CI/CD
sf smart-deployment analyze --save-plan
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--source-path` | `-p` | Path to analyze | `.` (current directory) |
| `--target-org` | `-o` | Target org (for AI auth) | None |
| `--save-plan` | | Save deployment plan | `false` |
| `--plan-path` | | Custom plan path | `.smart-deployment/deployment-plan.json` |
| `--use-ai` | | Enable AI analysis | `false` |
| `--org-type` | | Org type (Production/Sandbox/Developer) | Auto-detect |
| `--industry` | | Industry context for AI | None |
| `--locale` | | Language locale | Auto-detect |
| `--output` | `-o` | Output file path | Console |
| `--format` | `-f` | Output format (json\|html) | `json` |

### Examples

```bash
# Basic analysis
sf smart-deployment analyze

# Analysis with AI
sf smart-deployment analyze --use-ai --target-org myorg --org-type Production

# Save plan for CI/CD
sf smart-deployment analyze --save-plan --plan-path custom-plan.json

# Analysis with industry context
sf smart-deployment analyze --use-ai --industry Fintech --org-type Production
```

### Output

The `analyze` command outputs:

- **Component count**: Total metadata components found
- **Dependency count**: Total dependencies detected
- **Wave count**: Number of deployment waves generated
- **Circular dependencies**: Components with circular dependencies
- **Deployment plan** (if `--save-plan`): JSON file for CI/CD

---

## 🚀 Command: `start`

Executes the deployment to your Salesforce org. This is the main deployment command.

### Basic Usage

```bash
# Deploy to target org
sf smart-deployment start --target-org myorg

# Dry-run (preview without deploying)
sf smart-deployment start --target-org myorg --dry-run

# Validate only (check deployment validity)
sf smart-deployment start --target-org myorg --validate-only
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-org` | `-o` | Target org (required) | Required |
| `--dry-run` | `-d` | Preview without deploying | `false` |
| `--validate-only` | `-v` | Validate without committing | `false` |
| `--no-test-run` | | Skip tests (sandbox only) | `false` |
| `--run-wave-test` | | Run only wave test classes | `false` |
| `--use-ai` | | Enable AI prioritization | `false` |
| `--ai-auto` | | Auto-apply AI recommendations | `false` |
| `--ai-confidence-threshold` | | AI confidence threshold (0-1) | `0.8` |
| `--use-plan` | | Use saved deployment plan | None |
| `--strict` | | Strict mode (requires plan) | `false` |
| `--source-path` | `-p` | Source path | `.` |
| `--locale` | | Language locale | Auto-detect |

### Test Execution Flags

The plugin provides granular control over test execution:

#### `--no-test-run`
- **Sandbox**: Skips all tests
- **Production**: **IGNORED** (tests are required by Salesforce)
- **Use case**: Fast sandbox deployments

```bash
# Skip tests in sandbox
sf smart-deployment start --target-org mysandbox --no-test-run
```

#### `--run-wave-test`
- Runs only test classes included in each wave
- Uses `RunSpecifiedTests` test level
- **Recommended for production** (faster than RunLocalTests)

```bash
# Run only wave-specific tests
sf smart-deployment start --target-org myorg --run-wave-test
```

#### Default Behavior
- If no test flags provided, SF CLI uses its standard behavior:
  - **Production**: Requires tests (enforced by SF CLI)
  - **Sandbox**: Allows NoTestRun

### Examples

```bash
# Basic deployment
sf smart-deployment start --target-org myorg

# Dry-run to preview
sf smart-deployment start --target-org myorg --dry-run

# Deploy with AI prioritization
sf smart-deployment start --target-org myorg --use-ai --ai-auto

# Use saved deployment plan (CI/CD)
sf smart-deployment start --target-org prod --use-plan .smart-deployment/deployment-plan.json --strict

# Deploy with wave-specific tests (production)
sf smart-deployment start --target-org prod --run-wave-test
```

### Deployment Flow

1. **Scan**: Scans project metadata
2. **Analyze**: Builds dependency graph
3. **Generate Waves**: Creates deployment waves
4. **Generate Manifests**: Creates `package.xml` files
5. **Validate Manifests**: Validates against source
6. **Deploy**: Executes waves sequentially
7. **Report**: Generates deployment report

---

## ✅ Command: `validate`

Validates deployment without executing it. Useful for checking deployment readiness.

### Basic Usage

```bash
# Validate deployment
sf smart-deployment validate --target-org myorg

# Validate specific path
sf smart-deployment validate --target-org myorg --source-path force-app
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-org` | `-o` | Target org (required) | Required |
| `--source-path` | `-p` | Source path | `.` |
| `--locale` | | Language locale | Auto-detect |

### Examples

```bash
# Validate deployment
sf smart-deployment validate --target-org myorg

# Validate with custom path
sf smart-deployment validate --target-org myorg --source-path force-app/main/default
```

---

## 📊 Command: `status`

Shows the current deployment status, including progress and completed waves.

### Basic Usage

```bash
# Check deployment status
sf smart-deployment status --target-org myorg

# Watch status updates
sf smart-deployment status --target-org myorg --watch
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-org` | `-o` | Target org (required) | Required |
| `--watch` | `-w` | Watch for changes | `false` |

### Output

- Current wave number
- Total waves
- Completed waves
- Deployment status (deploying, failed, completed, etc.)
- Progress percentage
- Estimated time remaining

### Examples

```bash
# Check status
sf smart-deployment status --target-org myorg

# Watch status
sf smart-deployment status --target-org myorg --watch
```

---

## 🔄 Command: `resume`

Resumes a failed deployment from the last completed wave.

### Basic Usage

```bash
# Resume failed deployment
sf smart-deployment resume --target-org myorg
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--target-org` | `-o` | Target org (required) | Required |
| `--source-path` | `-p` | Source path | `.` |

### Examples

```bash
# Resume deployment
sf smart-deployment resume --target-org myorg
```

**Note**: The plugin automatically saves deployment state after each wave, so `resume` can pick up where it left off.

---

## ⚙️ Command: `config`

Manages plugin configuration settings.

### Basic Usage

```bash
# Get configuration value
sf smart-deployment config --get ai.enabled

# Set configuration value
sf smart-deployment config --set ai.enabled=true
```

### Flags

| Flag | Short | Description | Default |
|------|-------|-------------|---------|
| `--get` | `-g` | Get config key | None |
| `--set` | `-s` | Set config key=value | None |

### Examples

```bash
# Get AI enabled status
sf smart-deployment config --get ai.enabled

# Enable AI
sf smart-deployment config --set ai.enabled=true

# Set confidence threshold
sf smart-deployment config --set ai.confidenceThreshold=0.9
```

---

## 🎯 Common Workflows

### Workflow 1: First-Time Deployment

```bash
# 1. Analyze first
sf smart-deployment analyze --source-path .

# 2. Review waves (check output)
# 3. Deploy
sf smart-deployment start --target-org myorg
```

### Workflow 2: CI/CD Deployment

```bash
# Development: Generate plan
sf smart-deployment analyze --save-plan --use-ai --org-type Production

# Commit plan to Git
git add .smart-deployment/deployment-plan.json
git commit -m "chore: deployment plan for v2.0"
git push

# CI/CD: Deploy with plan
sf smart-deployment start \
  --target-org prod \
  --use-plan .smart-deployment/deployment-plan.json \
  --strict
```

### Workflow 3: Production Deployment with Tests

```bash
# Deploy with wave-specific tests (faster)
sf smart-deployment start \
  --target-org prod \
  --run-wave-test \
  --use-plan .smart-deployment/deployment-plan.json
```

### Workflow 4: Sandbox Quick Deploy

```bash
# Skip tests for fast sandbox deployment
sf smart-deployment start \
  --target-org mysandbox \
  --no-test-run
```

### Workflow 5: AI-Enhanced Deployment

```bash
# Use AI for intelligent prioritization
sf smart-deployment start \
  --target-org myorg \
  --use-ai \
  --ai-auto \
  --ai-confidence-threshold 0.9 \
  --org-type Production \
  --industry Fintech
```

---

## 🔧 Configuration

### Configuration File: `.smart-deployment.json`

Create a `.smart-deployment.json` file in your project root:

```json
{
  "$schema": "./schemas/config.schema.json",
  "version": "1.0",

  "ai": {
    "enabled": false,
    "confidenceThreshold": 0.9,
    "timeout": 10000,
    "model": "claude-sonnet"
  },

  "cicd": {
    "requireApprovedPlan": true,
    "planPath": ".smart-deployment/deployment-plan.json",
    "strictMode": true,
    "maxDiffPercentage": 20
  },

  "deployment": {
    "maxComponentsPerWave": 300,
    "maxCmtRecordsPerWave": 200
  },

  "priorities": {
    "CustomObject:Payment__c": 100,
    "ApexClass:PaymentHandler": 95
  },

  "logging": {
    "level": "info",
    "file": ".smart-deployment/logs/deployment.log",
    "console": true
  }
}
```

### Environment Variables

```bash
# AI Configuration
export SF_AI_ENABLED=true
export SF_AI_CONFIDENCE_THRESHOLD=0.9

# CI/CD Configuration
export SF_STRICT_MODE=true
export SF_DEPLOYMENT_PLAN=.smart-deployment/deployment-plan.json

# Target Org
export SF_TARGET_ORG=myorg
```

---

## 🎓 Best Practices

### 1. Always Analyze First

```bash
# Good practice
sf smart-deployment analyze
sf smart-deployment start --target-org myorg

# Not recommended
sf smart-deployment start --target-org myorg  # Without analyzing first
```

### 2. Use Deployment Plans in CI/CD

```bash
# Development: Generate plan
sf smart-deployment analyze --save-plan --use-ai

# CI/CD: Use plan
sf smart-deployment start --use-plan deployment-plan.json --strict
```

### 3. Use Wave-Specific Tests in Production

```bash
# Faster than RunLocalTests
sf smart-deployment start --target-org prod --run-wave-test
```

### 4. Monitor Deployment Status

```bash
# In another terminal
sf smart-deployment status --target-org myorg --watch
```

### 5. Handle Failures Gracefully

```bash
# If deployment fails
sf smart-deployment status --target-org myorg
# Review error, fix issue, then:
sf smart-deployment resume --target-org myorg
```

---

## 🚨 Troubleshooting

### Issue: "No components found"

**Solution**: Check your `--source-path` flag:

```bash
# Verify path
sf smart-deployment analyze --source-path force-app
```

### Issue: "Deployment plan not found"

**Solution**: Generate plan first:

```bash
sf smart-deployment analyze --save-plan
```

### Issue: "Tests required in production"

**Solution**: Use `--run-wave-test` instead of `--no-test-run`:

```bash
# Wrong (ignored in production)
sf smart-deployment start --target-org prod --no-test-run

# Correct
sf smart-deployment start --target-org prod --run-wave-test
```

### Issue: "Agentforce API key not configured"

**Solution**: Use `--target-org` for authentication:

```bash
sf smart-deployment analyze --use-ai --target-org myorg
```

---

## 📚 Additional Resources

- [CLI Reference](./CLI_REFERENCE.md) - Complete command reference
- [Configuration Guide](./CONFIGURATION_GUIDE.md) - Detailed configuration options
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md) - CI/CD integration
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common issues and solutions

---

## 💡 Tips

1. **Start Small**: Test with a small project first
2. **Use Dry-Run**: Always use `--dry-run` first in new environments
3. **Save Plans**: Use `--save-plan` for reproducible deployments
4. **Monitor Progress**: Use `status` command to monitor deployments
5. **Read Logs**: Check `.smart-deployment/logs/` for detailed logs

---

**Need Help?** Check the [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) or open an issue on GitHub.








