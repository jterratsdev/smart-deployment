# 🔧 Troubleshooting Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Common issues and solutions for the Smart Deployment Plugin.

---

## 🚨 Common Issues

### Issue: "No components found"

**Symptoms**:

```
✅ Found 0 components with 0 dependencies
```

**Possible Causes**:

1. Wrong source path
2. Project not in SFDX format
3. Metadata files not in expected locations

**Solutions**:

```bash
# 1. Check source path
sf smart-deployment analyze --source-path force-app

# 2. Verify project structure
ls force-app/main/default/

# 3. Check for sfdx-project.json
cat sfdx-project.json
```

**Prevention**: Always verify your project structure before analyzing.

---

### Issue: "Deployment plan not found"

**Symptoms**:

```
❌ Error: Deployment plan not found: .smart-deployment/deployment-plan.json
💡 Run: sf smart-deployment analyze --save-plan
```

**Solutions**:

```bash
# Generate deployment plan
sf smart-deployment analyze --save-plan

# Or use custom path
sf smart-deployment analyze --save-plan --plan-path custom-plan.json
```

**Prevention**: Always generate a plan before using `--use-plan` flag.

---

### Issue: "Tests required in production"

**Symptoms**:

```
⚠️  Production org detected: --no-test-run is ignored (tests are required in production)
```

**Solutions**:

```bash
# Wrong (ignored in production)
sf smart-deployment start --target-org prod --no-test-run

# Correct - Use wave-specific tests
sf smart-deployment start --target-org prod --run-wave-test

# Or let SF CLI handle it (default)
sf smart-deployment start --target-org prod
```

**Explanation**: Salesforce requires tests in production orgs. The plugin automatically enforces this.

---

### Issue: "Manifest validation failed"

**Symptoms**:

```
❌ Manifest validation failed
   Component 'ApexClass:MyClass' listed in manifest not found in scanned project
```

**Possible Causes**:

1. Component was deleted but still in manifest
2. Component name mismatch
3. File path changed

**Solutions**:

```bash
# 1. Re-scan project
sf smart-deployment analyze --source-path .

# 2. Regenerate manifests
sf smart-deployment start --target-org myorg --dry-run

# 3. Check component exists
ls force-app/main/default/classes/MyClass.cls
```

---

### Issue: "Circular dependencies detected"

**Symptoms**:

```
⚠️  168 component(s) couldn't be placed (circular deps)
```

**Solutions**:

1. **Review circular dependencies**:

   ```bash
   sf smart-deployment analyze --format html --output deps.html
   # Open deps.html to visualize circular dependencies
   ```

2. **Break circular dependencies**:

   - Refactor code to remove circular references
   - Use dependency injection
   - Split components if necessary

3. **Manual wave assignment**:
   - Use priority overrides in `.smart-deployment.json`
   - Manually assign components to waves

**Prevention**: Design components with clear dependency hierarchy.

---

### Issue: "Wave too large"

**Symptoms**:

```
⚠️  Wave 1 exceeds maximum component limit (300)
```

**Solutions**:

The plugin automatically splits large waves. If you see this warning:

1. **Check wave splitting**:

   ```bash
   sf smart-deployment analyze
   # Check output for wave counts
   ```

2. **Review component count**:
   - Large waves may indicate missing dependencies
   - Verify dependency graph is correct

**Note**: Wave splitting is automatic and handled by the plugin.

---

### Issue: "Deployment failed at wave X"

**Symptoms**:

```
❌ Wave 3 failed: Deployment failed: FIELD_CUSTOM_VALIDATION_EXCEPTION
```

**Solutions**:

1. **Check deployment status**:

   ```bash
   sf smart-deployment status --target-org myorg
   ```

2. **Review error details**:

   - Check logs: `.smart-deployment/logs/deployment.log`
   - Review SF CLI output for specific errors

3. **Resume deployment**:
   ```bash
   # Fix the issue, then resume
   sf smart-deployment resume --target-org myorg
   ```

**Common Deployment Errors**:

| Error                               | Solution                             |
| ----------------------------------- | ------------------------------------ |
| `FIELD_CUSTOM_VALIDATION_EXCEPTION` | Check validation rules               |
| `INSUFFICIENT_ACCESS_OR_READONLY`   | Verify profile/permission set access |
| `DUPLICATE_VALUE`                   | Check for duplicate records          |
| `UNKNOWN_EXCEPTION`                 | Review Salesforce debug logs         |

---

### Issue: "Strict mode requires --use-plan"

**Symptoms**:

```
❌ Strict mode requires --use-plan
💡 Run: sf smart-deployment analyze --save-plan
```

**Solutions**:

```bash
# Generate plan first
sf smart-deployment analyze --save-plan

# Then use strict mode
sf smart-deployment start --target-org prod --use-plan .smart-deployment/deployment-plan.json --strict
```

**Explanation**: Strict mode requires a pre-approved deployment plan for CI/CD safety.

---

### Issue: "Plan diff too high"

**Symptoms**:

```
❌ Error: Component diff too high: 25% (max: 20%)
```

**Solutions**:

```bash
# Option 1: Regenerate plan
sf smart-deployment analyze --save-plan

# Option 2: Increase max diff threshold
sf smart-deployment start --target-org prod --use-plan plan.json --max-diff 30

# Option 3: Update configuration
# In .smart-deployment.json:
{
  "cicd": {
    "maxDiffPercentage": 30
  }
}
```

---

### Issue: "No deployment state found"

**Symptoms**:

```
ℹ️  No deployment state found
```

**Solutions**:

This is normal if:

- No deployment has been started
- Previous deployment completed successfully
- State file was deleted

**To resume a failed deployment**:

1. Check if deployment actually failed
2. Verify state file exists: `.smart-deployment/deployment-state.json`
3. If missing, start fresh deployment

---

## 🔍 Debugging Tips

### Enable Debug Logging

```bash
# Set log level to debug
export SF_LOG_LEVEL=debug

# Or in .smart-deployment.json:
{
  "logging": {
    "level": "debug"
  }
}
```

### Check Logs

```bash
# View deployment logs
cat .smart-deployment/logs/deployment.log

# Tail logs in real-time
tail -f .smart-deployment/logs/deployment.log
```

### Verbose Output

```bash
# Use --json for detailed output
sf smart-deployment analyze --json

# Check SF CLI output
sf smart-deployment start --target-org myorg --dry-run
```

---

## 🛠️ Diagnostic Commands

### Check Project Structure

```bash
# Verify SFDX project
cat sfdx-project.json

# Check metadata structure
ls -la force-app/main/default/

# Verify .forceignore
cat .forceignore
```

### Verify Org Connection

```bash
# List authenticated orgs
sf org list

# Test org connection
sf org display --target-org myorg

# Re-authenticate if needed
sf org login web --alias myorg
```

### Check Deployment State

```bash
# Check status
sf smart-deployment status --target-org myorg

# View state file
cat .smart-deployment/deployment-state.json

# View deployment plan
cat .smart-deployment/deployment-plan.json
```

---

## 📊 Performance Issues

### Issue: "Analysis is slow"

**Solutions**:

1. **Use caching**:

   - Dependency cache is enabled by default
   - Cache is stored in `.smart-deployment/cache/`

2. **Disable AI** (if not needed):

   ```bash
   # Don't use if not needed
   sf smart-deployment analyze
   ```

3. **Limit scope**:
   ```bash
   # Analyze specific path
   sf smart-deployment analyze --source-path force-app/main/default/classes
   ```

### Issue: "Deployment is slow"

**Solutions**:

1. **Use wave-specific tests**:

   ```bash
   sf smart-deployment start --target-org myorg --run-wave-test
   ```

2. **Skip tests in sandbox**:

   ```bash
   sf smart-deployment start --target-org mysandbox --no-test-run
   ```

3. **Use deployment plans** (faster, no AI):
   ```bash
   sf smart-deployment start --target-org prod --use-plan plan.json --strict
   ```

---

## 🔐 Authentication Issues

### Issue: "Org not authenticated"

**Symptoms**:

```
❌ Error: No org found with alias: myorg
```

**Solutions**:

```bash
# Authenticate org
sf org login web --alias myorg

# Or use JWT
sf org login jwt --username user@example.com --jwt-key-file key.json --alias myorg

# Verify authentication
sf org list
```

### Issue: "Access token expired"

**Symptoms**:

```

```

**Solutions**:

```bash
# Re-authenticate
sf org login web --alias myorg

# Or refresh token
sf org display --target-org myorg
```

---

## 📝 Getting Help

### Check Documentation

1. [User Guide](./USER_GUIDE.md) - Getting started
2. [CLI Reference](./CLI_REFERENCE.md) - Command reference
3. [Configuration Guide](./CONFIGURATION_GUIDE.md) - Configuration options

### Enable Debug Mode

```bash
# Set debug logging
export SF_LOG_LEVEL=debug

# Run command with verbose output
sf smart-deployment analyze --json
```

### Collect Information

When reporting issues, include:

1. **Command used**: Exact command with flags
2. **Error message**: Full error output
3. **Logs**: `.smart-deployment/logs/deployment.log`
4. **Configuration**: `.smart-deployment.json` (remove sensitive data)
5. **Project structure**: `sfdx-project.json`
6. **Org type**: Production, Sandbox, or Developer

### Report Issues

- **GitHub Issues**: [Create an issue](https://github.com/jterrats/smart-deployment/issues)
- **Include**: Command, error, logs, configuration

---

## ✅ Prevention Checklist

Before deploying:

- [ ] Project structure is correct (SFDX format)
- [ ] Org is authenticated (`sf org list`)
- [ ] Dependencies are correct (no circular deps)
- [ ] Tests are available (if deploying to production)
- [ ] Deployment plan is generated (for CI/CD)
- [ ] Configuration is correct (`.smart-deployment.json`)
- [ ] Logs directory is writable

---

## 📚 Related Documentation

- [User Guide](./USER_GUIDE.md) - Getting started
- [CLI Reference](./CLI_REFERENCE.md) - Command reference
- [Configuration Guide](./CONFIGURATION_GUIDE.md) - Configuration
- [Error Catalog](./ERROR_CATALOG.md) - Complete error reference

---

**Last Updated**: December 14, 2025
