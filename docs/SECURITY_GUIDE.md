# 🔒 Security Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Security best practices and guidelines for the Smart Deployment Plugin.

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [API Keys](#api-keys)
- [Secrets Management](#secrets-management)
- [File Permissions](#file-permissions)
- [Network Security](#network-security)
- [CI/CD Security](#cicd-security)
- [Audit Trail](#audit-trail)

---

## Authentication

### 1. Use Salesforce CLI Authentication

**Best Practice**: Use Salesforce CLI authentication instead of API keys when possible.

```bash
# ✅ Good: Uses Salesforce CLI authentication
sf org login web --alias myorg
sf smart-deployment analyze --use-ai --target-org myorg

# ❌ Bad: Requires separate API key
export AGENTFORCE_API_KEY="your-key"
sf smart-deployment analyze --use-ai
```

**Benefits**:
- No separate API key management
- Uses existing Salesforce session
- Automatic token refresh
- Better security

### 2. Use Named Credentials

**Best Practice**: Use Named Credentials for CI/CD when possible.

**Benefits**:
- Centralized credential management
- No API keys in code/config
- Automatic rotation support

### 3. Rotate Credentials Regularly

**Best Practice**: Rotate credentials periodically.

**Rotation Schedule**:
- **API Keys**: Every 90 days
- **Access Tokens**: Automatic (via Salesforce CLI)
- **Named Credentials**: Every 180 days

---

## API Keys

### 1. Never Commit API Keys

**Best Practice**: Never commit API keys to version control.

```bash
# ❌ Bad: API key in code
const apiKey = "sk-1234567890abcdef";

# ✅ Good: API key from environment
const apiKey = process.env.AGENTFORCE_API_KEY;
```

**Prevention**:
- Use `.gitignore` for config files
- Use environment variables
- Use CI/CD secrets

### 2. Use Environment Variables

**Best Practice**: Store API keys in environment variables.

```bash
# ✅ Good: Environment variable
export AGENTFORCE_API_KEY="your-key-here"
sf smart-deployment analyze --use-ai

# ❌ Bad: Hardcoded in config
# .smart-deployment.json
{
  "ai": {
    "apiKey": "your-key-here"  # Never do this
  }
}
```

### 3. Restrict API Key Permissions

**Best Practice**: Use API keys with minimal required permissions.

**Permissions**:
- Read-only access when possible
- Scope-limited access
- Time-limited access

---

## Secrets Management

### 1. Use CI/CD Secrets

**Best Practice**: Use CI/CD platform secrets.

**GitHub Actions**:
```yaml
env:
  AGENTFORCE_API_KEY: ${{ secrets.AGENTFORCE_API_KEY }}
```

**GitLab CI**:
```yaml
variables:
  AGENTFORCE_API_KEY: $AGENTFORCE_API_KEY
```

**Azure DevOps**:
```yaml
variables:
  - group: deployment-secrets
```

### 2. Never Log Secrets

**Best Practice**: Never log API keys or tokens.

```typescript
// ❌ Bad: Logs API key
logger.info('API key', { apiKey: process.env.AGENTFORCE_API_KEY });

// ✅ Good: Logs key existence only
logger.info('API key configured', { hasApiKey: !!process.env.AGENTFORCE_API_KEY });
```

### 3. Use Secret Scanning

**Best Practice**: Use secret scanning tools.

**Tools**:
- **GitHub**: Secret scanning (automatic)
- **GitLab**: Secret detection
- **TruffleHog**: Secret scanner
- **git-secrets**: Pre-commit hooks

---

## File Permissions

### 1. Secure Configuration Files

**Best Practice**: Restrict access to configuration files.

```bash
# Restrict .smart-deployment.json
chmod 600 .smart-deployment.json

# Restrict deployment plans
chmod 600 .smart-deployment/deployment-plan.json
```

**Recommended Permissions**:
- **Config files**: `600` (owner read/write only)
- **Log files**: `640` (owner read/write, group read)
- **Cache files**: `644` (owner read/write, others read)

### 2. Secure Log Files

**Best Practice**: Protect log files containing sensitive information.

```bash
# Restrict log file access
chmod 640 .smart-deployment/logs/deployment.log
```

**Log File Security**:
- Don't log API keys
- Don't log access tokens
- Don't log passwords
- Rotate logs regularly

### 3. Use .gitignore

**Best Practice**: Exclude sensitive files from version control.

```gitignore
# .gitignore
.smart-deployment/
*.log
.env
*.key
*.pem
```

---

## Network Security

### 1. Use HTTPS

**Best Practice**: Always use HTTPS for API calls.

**Default Endpoints**:
- ✅ `https://api.salesforce.com/ai/v1` (HTTPS)
- ❌ `http://api.salesforce.com/ai/v1` (HTTP - never use)

### 2. Verify SSL Certificates

**Best Practice**: Verify SSL certificates (enabled by default).

**Node.js**:
- SSL verification is enabled by default
- Don't disable SSL verification

### 3. Use VPN for Internal Networks

**Best Practice**: Use VPN for internal network deployments.

**Benefits**:
- Encrypted traffic
- Network isolation
- Access control

---

## CI/CD Security

### 1. Use Least Privilege

**Best Practice**: Use minimal required permissions.

**Permissions**:
- Read-only access when possible
- Scope-limited access
- Time-limited access

### 2. Use Deployment Plans

**Best Practice**: Use pre-approved deployment plans.

```bash
# CI/CD: Use plan (no AI, no user input)
sf smart-deployment start \
  --target-org prod \
  --use-plan .smart-deployment/deployment-plan.json \
  --strict
```

**Benefits**:
- No AI API calls (reduces attack surface)
- Deterministic deployments
- Pre-approved structure

### 3. Audit CI/CD Deployments

**Best Practice**: Log all CI/CD deployments.

**Audit Information**:
- Who triggered deployment
- When deployment occurred
- What was deployed
- Deployment result

---

## Audit Trail

### 1. Enable Logging

**Best Practice**: Enable comprehensive logging.

```json
// .smart-deployment.json
{
  "logging": {
    "level": "info",
    "file": ".smart-deployment/logs/deployment.log",
    "console": true
  }
}
```

**Log Information**:
- Deployment start/end times
- Wave execution
- Errors and warnings
- Performance metrics

### 2. Review Logs Regularly

**Best Practice**: Review logs for security issues.

**Review Schedule**:
- **Daily**: Check for errors
- **Weekly**: Review deployment patterns
- **Monthly**: Audit security events

### 3. Retain Logs

**Best Practice**: Retain logs for compliance.

**Retention Period**:
- **Development**: 30 days
- **Staging**: 90 days
- **Production**: 1 year

---

## Security Checklist

### Pre-Deployment

- [ ] API keys stored in environment variables
- [ ] No secrets in code or config files
- [ ] File permissions set correctly
- [ ] `.gitignore` configured
- [ ] SSL verification enabled

### During Deployment

- [ ] Using HTTPS endpoints
- [ ] Credentials not logged
- [ ] Deployment plan pre-approved
- [ ] Monitoring enabled

### Post-Deployment

- [ ] Logs reviewed
- [ ] No secrets exposed
- [ ] Audit trail complete
- [ ] Credentials rotated if needed

---

## Common Security Mistakes

### ❌ Mistake 1: Committing API Keys

```bash
# ❌ Bad
git add .smart-deployment.json  # Contains API key
git commit -m "Add config"

# ✅ Good
git add .smart-deployment.json.example  # Template only
# Store actual API key in environment variable
```

### ❌ Mistake 2: Logging Secrets

```typescript
// ❌ Bad
logger.info('API key', { key: process.env.AGENTFORCE_API_KEY });

// ✅ Good
logger.info('API key configured', { hasKey: !!process.env.AGENTFORCE_API_KEY });
```

### ❌ Mistake 3: Using HTTP

```bash
# ❌ Bad
export AGENTFORCE_ENDPOINT="http://api.salesforce.com/ai/v1"

# ✅ Good
export AGENTFORCE_ENDPOINT="https://api.salesforce.com/ai/v1"
```

### ❌ Mistake 4: Weak File Permissions

```bash
# ❌ Bad
chmod 777 .smart-deployment.json  # World writable

# ✅ Good
chmod 600 .smart-deployment.json  # Owner only
```

---

## Incident Response

### 1. If API Key Exposed

**Immediate Actions**:
1. Revoke exposed API key
2. Generate new API key
3. Update all environments
4. Review access logs
5. Notify security team

### 2. If Deployment Compromised

**Immediate Actions**:
1. Stop deployment
2. Review deployment logs
3. Verify deployed components
4. Rollback if necessary
5. Investigate root cause

---

## Related Documentation

- [Configuration Guide](./CONFIGURATION_GUIDE.md) - Configuration options
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md) - CI/CD security
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Security issues

---

**Last Updated**: December 14, 2025


