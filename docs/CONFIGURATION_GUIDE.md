# ⚙️ Configuration Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Complete guide to configuring the Smart Deployment Plugin.

---

## 📋 Configuration Methods

The plugin supports three configuration methods (in priority order):

1. **CLI Flags** (highest priority)
2. **Environment Variables**
3. **Configuration File** (`.smart-deployment.json`)

---

## 📁 Configuration File: `.smart-deployment.json`

Create a `.smart-deployment.json` file in your project root:

```json
{
  "$schema": "./schemas/config.schema.json",
  "version": "1.0",

  "ai": {
    "enabled": false,
    "confidenceThreshold": 0.9,
    "maxDiffFromPlan": 0.1,
    "timeout": 10000,
    "fallbackToStaticOnError": true,
    "model": "claude-sonnet"
  },

  "cicd": {
    "requireApprovedPlan": true,
    "planPath": ".smart-deployment/deployment-plan.json",
    "strictMode": true,
    "maxDiffPercentage": 20,
    "validateBeforeDeploy": true
  },

  "deployment": {
    "targetOrg": "${TARGET_ORG}",
    "dryRun": false,
    "validateOnly": false,
    "skipTests": false,
    "testLevel": "RunLocalTests",
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

---

## 🤖 AI Configuration

### `ai.enabled`
- **Type**: boolean
- **Default**: `false`
- **Description**: Enable Agentforce AI integration
- **Example**: `"enabled": true`

### `ai.confidenceThreshold`
- **Type**: number (0-1)
- **Default**: `0.9`
- **Description**: Minimum AI confidence to auto-apply recommendations
- **Example**: `"confidenceThreshold": 0.9`

### `ai.maxDiffFromPlan`
- **Type**: number (0-1)
- **Default**: `0.1`
- **Description**: Maximum difference from plan before warning (10%)
- **Example**: `"maxDiffFromPlan": 0.1`

### `ai.timeout`
- **Type**: number (milliseconds)
- **Default**: `10000`
- **Description**: AI request timeout
- **Example**: `"timeout": 30000`

### `ai.fallbackToStaticOnError`
- **Type**: boolean
- **Default**: `true`
- **Description**: Fallback to static analysis if AI fails
- **Example**: `"fallbackToStaticOnError": true`

### `ai.model`
- **Type**: string
- **Default**: `"claude-sonnet"`
- **Options**: `claude-sonnet`, `gpt-4o`, `gemini-1.5-pro`, `gemini-1.5-flash`, `einstein-gpt`
- **Description**: AI model to use
- **Example**: `"model": "gemini-1.5-pro"`

---

## 🚀 CI/CD Configuration

### `cicd.requireApprovedPlan`
- **Type**: boolean
- **Default**: `true`
- **Description**: Require approved deployment plan in CI/CD
- **Example**: `"requireApprovedPlan": true`

### `cicd.planPath`
- **Type**: string
- **Default**: `".smart-deployment/deployment-plan.json"`
- **Description**: Path to deployment plan file
- **Example**: `"planPath": "custom-plan.json"`

### `cicd.strictMode`
- **Type**: boolean
- **Default**: `true`
- **Description**: Enable strict mode (requires plan, no AI)
- **Example**: `"strictMode": true`

### `cicd.maxDiffPercentage`
- **Type**: number
- **Default**: `20`
- **Description**: Maximum diff percentage before failing
- **Example**: `"maxDiffPercentage": 20`

### `cicd.validateBeforeDeploy`
- **Type**: boolean
- **Default**: `true`
- **Description**: Validate deployment before executing
- **Example**: `"validateBeforeDeploy": true`

---

## 📦 Deployment Configuration

### `deployment.targetOrg`
- **Type**: string
- **Default**: `"${TARGET_ORG}"`
- **Description**: Default target org (supports environment variables)
- **Example**: `"targetOrg": "myorg"` or `"targetOrg": "${TARGET_ORG}"`

### `deployment.dryRun`
- **Type**: boolean
- **Default**: `false`
- **Description**: Default to dry-run mode
- **Example**: `"dryRun": false`

### `deployment.validateOnly`
- **Type**: boolean
- **Default**: `false`
- **Description**: Default to validate-only mode
- **Example**: `"validateOnly": false`

### `deployment.skipTests`
- **Type**: boolean
- **Default**: `false`
- **Description**: Default to skip tests (sandbox only)
- **Example**: `"skipTests": false`

### `deployment.testLevel`
- **Type**: string
- **Default**: `"RunLocalTests"`
- **Options**: `NoTestRun`, `RunLocalTests`, `RunSpecifiedTests`, `RunAllTestsInOrg`
- **Description**: Default test level
- **Example**: `"testLevel": "RunLocalTests"`

### `deployment.maxComponentsPerWave`
- **Type**: number
- **Default**: `300`
- **Description**: Maximum components per wave (Salesforce limit)
- **Note**: This is a hardcoded Salesforce limit, not recommended to change
- **Example**: `"maxComponentsPerWave": 300`

### `deployment.maxCmtRecordsPerWave`
- **Type**: number
- **Default**: `200`
- **Description**: Maximum Custom Metadata records per wave
- **Note**: This is a hardcoded Salesforce limit, not recommended to change
- **Example**: `"maxCmtRecordsPerWave": 200`

---

## 🎯 Priority Configuration

### `priorities`
- **Type**: object
- **Description**: Component priority overrides
- **Format**: `"ComponentType:ComponentName": priority (0-100)`
- **Example**:
```json
{
  "priorities": {
    "CustomObject:Payment__c": 100,
    "ApexClass:PaymentHandler": 95,
    "Flow:PaymentFlow": 90
  }
}
```

**Priority Values**:
- `100`: Critical (deploy first)
- `90-99`: High priority
- `50-89`: Normal priority
- `0-49`: Low priority

---

## 📝 Logging Configuration

### `logging.level`
- **Type**: string
- **Default**: `"info"`
- **Options**: `debug`, `info`, `warn`, `error`
- **Description**: Logging level
- **Example**: `"level": "debug"`

### `logging.file`
- **Type**: string
- **Default**: `".smart-deployment/logs/deployment.log"`
- **Description**: Log file path
- **Example**: `"file": ".smart-deployment/logs/deployment.log"`

### `logging.console`
- **Type**: boolean
- **Default**: `true`
- **Description**: Enable console logging
- **Example**: `"console": true`

---

## 🌍 Environment Variables

You can override configuration using environment variables:

### AI Configuration

```bash
export SF_AI_ENABLED=true
export SF_AI_CONFIDENCE_THRESHOLD=0.9
export SF_AI_TIMEOUT=30000
export SF_AI_MODEL=gemini-1.5-pro
```

### CI/CD Configuration

```bash
export SF_STRICT_MODE=true
export SF_DEPLOYMENT_PLAN=.smart-deployment/deployment-plan.json
export SF_MAX_DIFF=20
```

### Deployment Configuration

```bash
export SF_TARGET_ORG=myorg
export SF_DRY_RUN=false
export SF_VALIDATE_ONLY=false
export SF_SKIP_TESTS=false
```

### Logging Configuration

```bash
export SF_LOG_LEVEL=debug
export SF_LOG_FILE=.smart-deployment/logs/deployment.log
export SF_LOG_CONSOLE=true
```

---

## 🔧 Using `config` Command

Manage configuration via CLI:

```bash
# Get configuration value
sf smart-deployment config --get ai.enabled

# Set configuration value
sf smart-deployment config --set ai.enabled=true
sf smart-deployment config --set ai.confidenceThreshold=0.9
sf smart-deployment config --set cicd.strictMode=true
```

---

## 📊 Configuration Priority

Configuration is resolved in this order (highest to lowest):

1. **CLI Flags** - `--use-ai`, `--strict`, etc.
2. **Environment Variables** - `SF_AI_ENABLED`, `SF_STRICT_MODE`, etc.
3. **Configuration File** - `.smart-deployment.json`
4. **Defaults** - Built-in defaults

### Example

```bash
# .smart-deployment.json
{
  "ai": { "enabled": false }
}

# Environment variable
export SF_AI_ENABLED=true

# CLI flag
sf smart-deployment analyze --use-ai

# Result: AI is enabled (CLI flag wins)
```

---

## 🎯 Configuration Examples

### Example 1: Development Setup

```json
{
  "ai": {
    "enabled": true,
    "confidenceThreshold": 0.8,
    "model": "claude-sonnet"
  },
  "deployment": {
    "targetOrg": "dev",
    "skipTests": true
  },
  "logging": {
    "level": "debug",
    "console": true
  }
}
```

### Example 2: CI/CD Production Setup

```json
{
  "cicd": {
    "requireApprovedPlan": true,
    "strictMode": true,
    "maxDiffPercentage": 10,
    "validateBeforeDeploy": true
  },
  "deployment": {
    "targetOrg": "${TARGET_ORG}",
    "testLevel": "RunSpecifiedTests"
  },
  "logging": {
    "level": "info",
    "file": ".smart-deployment/logs/deployment.log"
  }
}
```

### Example 3: High-Priority Components

```json
{
  "priorities": {
    "CustomObject:Payment__c": 100,
    "ApexClass:PaymentHandler": 95,
    "Flow:PaymentFlow": 90,
    "CustomMetadata:PaymentConfig__mdt": 85
  }
}
```

---

## 🔍 Configuration Validation

The plugin validates configuration on startup:

- **Schema Validation**: Validates against JSON schema
- **Type Checking**: Ensures correct types
- **Value Ranges**: Validates numeric ranges (e.g., confidenceThreshold 0-1)
- **Required Fields**: Checks required fields are present

### Validation Errors

If configuration is invalid, the plugin will:
1. Show validation errors
2. Fall back to defaults for invalid values
3. Continue with valid configuration

---

## 📚 Related Documentation

- [User Guide](./USER_GUIDE.md) - Getting started
- [CLI Reference](./CLI_REFERENCE.md) - Command reference
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md) - CI/CD configuration

---

**Last Updated**: December 14, 2025








