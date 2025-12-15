# 🎯 Deployment Best Practices - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Best practices for deploying Salesforce metadata using the Smart Deployment Plugin.

---

## 📋 Table of Contents

- [Pre-Deployment](#pre-deployment)
- [During Deployment](#during-deployment)
- [Post-Deployment](#post-deployment)
- [CI/CD Best Practices](#cicd-best-practices)
- [Production Deployment](#production-deployment)
- [Troubleshooting](#troubleshooting)

---

## Pre-Deployment

### 1. Always Analyze First

**Best Practice**: Always run `analyze` before deploying.

```bash
# ✅ Good
sf smart-deployment analyze --source-path .
sf smart-deployment start --target-org myorg

# ❌ Bad
sf smart-deployment start --target-org myorg  # Without analyzing first
```

**Why**:
- Identifies circular dependencies
- Shows deployment waves
- Highlights potential issues
- Estimates deployment time

### 2. Review Deployment Waves

**Best Practice**: Review generated waves before deploying.

```bash
# Analyze and review output
sf smart-deployment analyze --format html --output waves.html
# Open waves.html to review wave structure
```

**Check**:
- Wave count (too many waves = slow deployment)
- Component distribution (even distribution is better)
- Circular dependencies (should be minimal)

### 3. Use Deployment Plans in CI/CD

**Best Practice**: Generate and commit deployment plans.

```bash
# Development: Generate plan
sf smart-deployment analyze --save-plan --use-ai --org-type Production

# Commit plan
git add .smart-deployment/deployment-plan.json
git commit -m "chore: deployment plan for v2.0"
git push
```

**Benefits**:
- Deterministic deployments
- Pre-approved wave structure
- Faster CI/CD (no AI calls)
- Audit trail

### 4. Set Component Priorities

**Best Practice**: Configure priority overrides for critical components.

```json
// .smart-deployment.json
{
  "priorities": {
    "CustomObject:Payment__c": 100,
    "ApexClass:PaymentHandler": 95,
    "Flow:PaymentFlow": 90
  }
}
```

**When to Use**:
- Critical business components
- Components with external dependencies
- Components that must deploy first/last

---

## During Deployment

### 1. Use Wave-Specific Tests in Production

**Best Practice**: Use `--run-wave-test` for faster production deployments.

```bash
# ✅ Good (production)
sf smart-deployment start \
  --target-org prod \
  --run-wave-test \
  --use-plan .smart-deployment/deployment-plan.json

# ❌ Bad (production)
sf smart-deployment start \
  --target-org prod \
  --no-test-run  # Ignored in production anyway
```

**Why**:
- Faster than `RunLocalTests`
- Only tests relevant to wave
- Still meets Salesforce requirements

### 2. Monitor Deployment Progress

**Best Practice**: Monitor deployment in another terminal.

```bash
# Terminal 1: Start deployment
sf smart-deployment start --target-org myorg

# Terminal 2: Monitor progress
sf smart-deployment status --target-org myorg --watch
```

**Benefits**:
- Real-time progress
- Early error detection
- Better visibility

### 3. Use Dry-Run First

**Best Practice**: Always test with `--dry-run` first in new environments.

```bash
# ✅ Good
sf smart-deployment start --target-org newenv --dry-run
# Review output, then deploy for real

# ❌ Bad
sf smart-deployment start --target-org newenv  # Without dry-run
```

**Why**:
- Validates deployment without committing
- Identifies issues early
- Safe testing

### 4. Handle Failures Gracefully

**Best Practice**: Use `resume` command after fixing failures.

```bash
# If deployment fails
sf smart-deployment status --target-org myorg
# Review error, fix issue

# Resume from failure
sf smart-deployment resume --target-org myorg
```

**Benefits**:
- No need to restart from beginning
- Faster recovery
- State persistence

---

## Post-Deployment

### 1. Verify Deployment

**Best Practice**: Verify deployment completed successfully.

```bash
# Check status
sf smart-deployment status --target-org myorg

# Verify components deployed
sf project deploy report --target-org myorg
```

**Check**:
- All waves completed
- No failed components
- Tests passed

### 2. Review Deployment Logs

**Best Practice**: Review logs for warnings and issues.

```bash
# View deployment logs
cat .smart-deployment/logs/deployment.log

# Check for warnings
grep -i "warning" .smart-deployment/logs/deployment.log
```

**Why**:
- Identifies potential issues
- Documents deployment
- Helps with troubleshooting

### 3. Update Deployment Plan

**Best Practice**: Update deployment plan if waves changed.

```bash
# If waves were modified during deployment
sf smart-deployment analyze --save-plan
git add .smart-deployment/deployment-plan.json
git commit -m "chore: update deployment plan"
```

---

## CI/CD Best Practices

### 1. Use Strict Mode

**Best Practice**: Use `--strict` mode in CI/CD.

```bash
# CI/CD deployment
sf smart-deployment start \
  --target-org prod \
  --use-plan .smart-deployment/deployment-plan.json \
  --strict
```

**Why**:
- Requires pre-approved plan
- Prevents unexpected changes
- Deterministic deployments

### 2. Generate Plans in Development

**Best Practice**: Generate plans during development, not in CI/CD.

```bash
# Development: Generate plan
sf smart-deployment analyze --save-plan --use-ai

# CI/CD: Use plan (no AI calls)
sf smart-deployment start --use-plan plan.json --strict
```

**Benefits**:
- Faster CI/CD (no AI calls)
- Pre-approved structure
- Consistent deployments

### 3. Validate Before Deploying

**Best Practice**: Use `validate` command in CI/CD.

```bash
# CI/CD pipeline
sf smart-deployment validate --target-org staging
# If validation passes, deploy to production
sf smart-deployment start --target-org prod --use-plan plan.json
```

**Why**:
- Catches issues early
- Validates against target org
- Prevents production failures

### 4. Use Environment Variables

**Best Practice**: Use environment variables for configuration.

```yaml
# GitHub Actions
env:
  SF_TARGET_ORG: ${{ secrets.PROD_ORG }}
  SF_STRICT_MODE: true
  SF_DEPLOYMENT_PLAN: .smart-deployment/deployment-plan.json
```

**Benefits**:
- Secure credential management
- Environment-specific config
- No hardcoded values

---

## Production Deployment

### 1. Always Use Deployment Plans

**Best Practice**: Never deploy to production without a plan.

```bash
# ✅ Good
sf smart-deployment start \
  --target-org prod \
  --use-plan .smart-deployment/deployment-plan.json \
  --strict

# ❌ Bad
sf smart-deployment start --target-org prod --use-ai  # No plan
```

**Why**:
- Pre-approved structure
- Deterministic deployments
- Audit trail

### 2. Use Wave-Specific Tests

**Best Practice**: Use `--run-wave-test` for faster deployments.

```bash
# Production deployment
sf smart-deployment start \
  --target-org prod \
  --run-wave-test \
  --use-plan plan.json
```

**Benefits**:
- Faster than `RunLocalTests`
- Still meets requirements
- Optimized test execution

### 3. Deploy During Maintenance Windows

**Best Practice**: Schedule deployments during maintenance windows.

**Why**:
- Reduces user impact
- Allows for rollback time
- Better monitoring

### 4. Have Rollback Plan

**Best Practice**: Always have a rollback plan ready.

**Rollback Options**:
- Previous deployment plan
- Git revert + redeploy
- Manual component removal

---

## Troubleshooting

### 1. Check Logs First

**Best Practice**: Always check logs first.

```bash
# View logs
cat .smart-deployment/logs/deployment.log

# Search for errors
grep -i "error" .smart-deployment/logs/deployment.log
```

### 2. Use Validate Command

**Best Practice**: Use `validate` to identify issues.

```bash
# Validate before deploying
sf smart-deployment validate --target-org myorg
```

### 3. Review Circular Dependencies

**Best Practice**: Review and fix circular dependencies.

```bash
# Analyze to see circular dependencies
sf smart-deployment analyze --format html --output deps.html
# Open deps.html and review cycles
```

### 4. Check Component Limits

**Best Practice**: Verify waves don't exceed limits.

**Limits**:
- Max 300 components per wave
- Max 200 CMT records per wave
- Max ~400-500 files per deployment

---

## Common Mistakes to Avoid

### ❌ Mistake 1: Skipping Analysis

```bash
# ❌ Bad
sf smart-deployment start --target-org myorg

# ✅ Good
sf smart-deployment analyze
sf smart-deployment start --target-org myorg
```

### ❌ Mistake 2: Not Using Plans in CI/CD

```bash
# ❌ Bad (CI/CD)
sf smart-deployment start --target-org prod --use-ai

# ✅ Good (CI/CD)
sf smart-deployment start --target-org prod --use-plan plan.json --strict
```

### ❌ Mistake 3: Using --no-test-run in Production

```bash
# ❌ Bad (ignored anyway)
sf smart-deployment start --target-org prod --no-test-run

# ✅ Good
sf smart-deployment start --target-org prod --run-wave-test
```

### ❌ Mistake 4: Not Monitoring Deployments

```bash
# ❌ Bad
sf smart-deployment start --target-org prod
# Walk away, hope it works

# ✅ Good
sf smart-deployment start --target-org prod &
sf smart-deployment status --target-org prod --watch
```

---

## Related Documentation

- [User Guide](./USER_GUIDE.md) - Getting started
- [CLI Reference](./CLI_REFERENCE.md) - Command reference
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Common issues
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md) - CI/CD integration

---

**Last Updated**: December 14, 2025








