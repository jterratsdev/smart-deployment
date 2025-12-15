# 🔑 Agentforce API Key Configuration

## 📋 Overview

The `smart-deployment` plugin uses Agentforce (Salesforce AI) for intelligent analysis when using the `--use-ai` flag. This guide explains how to configure the necessary authentication.

## 🔐 Authentication Types

The plugin supports **three authentication methods** (in priority order):

### 1. **Automatic Authentication with Salesforce CLI** ⭐ Recommended

**No additional configuration needed.** If you use `--target-org` with `--use-ai`, the plugin automatically uses the access token from your authenticated org:

```bash
# Simply authenticate your org first
sf org login web --alias my-org

# Then use the command with --target-org
sf analyze --source-path . --use-ai --target-org my-org
```

The plugin automatically:
- Gets the access token from the authenticated org
- Uses it to authenticate with Agentforce
- **No separate API key required**

### 2. API Key (Environment Variable) - Fallback

If you don't use `--target-org`, you can configure the `AGENTFORCE_API_KEY` environment variable:

```bash
# Linux/macOS
export AGENTFORCE_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:AGENTFORCE_API_KEY="your-api-key-here"

# Windows (CMD)
set AGENTFORCE_API_KEY=your-api-key-here
```

### 3. Mock Mode (No Authentication) - Development/Testing

If you don't configure any authentication, the plugin automatically uses mock responses (useful for development/testing).

## 🌐 Configured Endpoints

The plugin uses these endpoints by default:

- **AgentforceService**: `https://api.salesforce.com/ai/v1`
- **AgentforcePriorityService**: `https://api.salesforce.com/services/einstein/llm/v1`

You can override the endpoint with an environment variable:
```bash
export AGENTFORCE_ENDPOINT="https://your-custom-endpoint.com/ai/v1"
```

## 🔍 What You Need

### Option 1: Use Salesforce CLI Authentication (Recommended) ⭐

**No additional setup needed.** Simply:

1. Authenticate your org:
   ```bash
   sf org login web --alias my-org
   ```

2. Use the command with `--target-org`:
   ```bash
   sf analyze --source-path . --use-ai --target-org my-org
   ```

The plugin automatically gets the access token from the authenticated org and uses it for Agentforce.

### Option 2: Manual API Key (Only if not using --target-org)

If you prefer to use an API key directly (without `--target-org`), you can configure:

```bash
export AGENTFORCE_API_KEY="your-access-token-here"
```

To get the access token manually:
```bash
sf org display --target-org my-org --json | jq -r '.result.accessToken'
```

### Option 3: Mock Mode (Development/Testing)

If you don't configure authentication, the plugin automatically uses mock responses:

```bash
# Without authentication, the plugin will use mocks
sf analyze --source-path . --use-ai
# Output: ⚠️ No API key configured, using mock response
```

## 📝 Verification

### With Salesforce CLI Authentication (Recommended)

```bash
# Verify org is authenticated
sf org list

# Test with analyze command using --target-org
sf analyze --source-path . --use-ai --target-org my-org --org-type Production
```

If authentication works, you'll see:
- ✅ Real Agentforce calls (not mocks)
- ✅ Real response times (>500ms typically)
- ✅ Tokens used reported in logs
- ✅ No "No API key configured" messages

### Con API Key Manual

```bash
# Verificar variable de entorno
echo $AGENTFORCE_API_KEY

# Probar sin --target-org
sf analyze --source-path . --use-ai --org-type Production
```

## 🛠️ Troubleshooting

### Error: "Agentforce API key not configured"
- **Solution 1 (Recommended)**: Use `--target-org` with an authenticated org:
  ```bash
  sf org login web --alias my-org
  sf analyze --source-path . --use-ai --target-org my-org
  ```
- **Solution 2**: Configure `AGENTFORCE_API_KEY` as an environment variable

### Error: "Agentforce unavailable, using static analysis only"
- **Cause**: The access token is invalid or the service is unavailable
- **Solution**:
  - Verify the org is correctly authenticated: `sf org list`
  - Re-authenticate if necessary: `sf org login web --alias my-org`
  - Verify you have access to Agentforce in your org

### Using Mock Responses
- **Cause**: No authentication configured (neither `--target-org` nor `AGENTFORCE_API_KEY`)
- **Behavior**: The plugin works but uses simulated responses
- **For development**: This is acceptable and allows testing the flow without costs
- **For production**: Use `--target-org` or configure `AGENTFORCE_API_KEY`

## 🔒 Security

⚠️ **Important**:
- Never commit the API key in code
- Use environment variables or CI/CD secrets
- For production, use GitHub Actions secrets, GitLab CI secrets, etc.

### Example: GitHub Actions

```yaml
env:
  AGENTFORCE_API_KEY: ${{ secrets.AGENTFORCE_API_KEY }}
```

## 📚 Referencias

- [Agentforce Developer Guide](https://developer.salesforce.com/docs/einstein/genai/guide/agent-api.html)
- [Einstein Platform API Authentication](https://developer.salesforce.com/docs/einstein/einstein-api/docs/en-us/einstein-platform-api.pdf)

## 💡 Next Steps

1. If you're a Salesforce employee: Contact the Agentforce team to get access
2. If you're a partner/customer: Verify if you have access to Agentforce in your org
3. For development: Use mock mode (no API key) to test the flow

## 📚 Related Documentation

- [Agentforce Integration Guide](./guides/AGENTFORCE_INTEGRATION.md) - Complete integration guide
- [AI Auto-Apply](./AI_AUTO_APPLY.md) - Auto-apply feature documentation
- [Agentforce Token Limits](./guides/AGENTFORCE_TOKEN_LIMITS.md) - Token usage and limits

