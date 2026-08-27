# 🔒 Security Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Security best practices and guidelines for the Smart Deployment Plugin.

---

## 📋 Table of Contents

- [Authentication](#authentication)
- [Secrets Management](#secrets-management)
- [File Permissions](#file-permissions)
- [Network Security](#network-security)
- [CI/CD Security](#cicd-security)
- [Audit Trail](#audit-trail)

---

## Authentication

### 1. Use Salesforce CLI Authentication

**Best Practice**: Use Salesforce CLI authentication.

```bash
# ✅ Good: Uses Salesforce CLI authentication
sf org login web --alias myorg
sf org display --target-org myorg
```

**Benefits**:

- Uses existing Salesforce session
- Automatic token refresh
- Better security

### 2. Use Named Credentials

**Best Practice**: Use Named Credentials for CI/CD when possible.

**Benefits**:

- Centralized credential management
- Automatic rotation support

### 3. Rotate Credentials Regularly

**Best Practice**: Rotate credentials periodically.

**Rotation Schedule**:

- **Access Tokens**: Automatic (via Salesforce CLI)
- **Named Credentials**: Every 180 days

---

---

## Secrets Management

### 1. Use CI/CD Secrets

**Best Practice**: Use CI/CD platform secrets.

**GitHub Actions**:

```yaml
env:
```

**GitLab CI**:

```yaml
variables:
```

**Azure DevOps**:

```yaml
variables:
  - group: deployment-secrets
```

### 2. Never Log Secrets

**Best Practice**: Never log tokens or passwords.

```typescript
// Do not log access tokens or passwords.
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

All Salesforce CLI communication must use the CLI's standard secure transport.

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

- [ ] No secrets in code or config files
- [ ] File permissions set correctly
- [ ] `.gitignore` configured
- [ ] SSL verification enabled

### During Deployment

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

### ❌ Mistake 1: Weak File Permissions

```bash
# ❌ Bad
chmod 777 .smart-deployment.json  # World writable

# ✅ Good
chmod 600 .smart-deployment.json  # Owner only
```

---

## Incident Response

### 1. If Credentials Are Exposed

**Immediate Actions**:

1. Revoke the exposed credential
2. Update all environments
3. Review access logs
4. Notify the security team

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
