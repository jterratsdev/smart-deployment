# ⚡ Performance Tuning Guide - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Guide to optimizing performance when using the Smart Deployment Plugin.

---

## 📋 Table of Contents

- [Analysis Performance](#analysis-performance)
- [Deployment Performance](#deployment-performance)
- [AI Performance](#ai-performance)
- [Caching Strategies](#caching-strategies)
- [Monitoring](#monitoring)

---

## Analysis Performance

### 1. Use Dependency Caching

**Best Practice**: Enable dependency caching for faster subsequent analyses.

```bash
# Dependency cache is enabled by default
# Cache is stored in .smart-deployment/cache/
```

**Benefits**:

- Faster re-analysis
- Reduced parsing overhead
- Better performance on large projects

**Cache Invalidation**:

- Cache is invalidated when source files change
- Use `--no-cache` flag to force fresh analysis (if implemented)

### 2. Limit Analysis Scope

**Best Practice**: Analyze only what you need.

```bash
# Analyze specific path
sf smart-deployment analyze --source-path force-app/main/default/classes

# Instead of analyzing entire project
sf smart-deployment analyze  # Analyzes everything
```

**Benefits**:

- Faster analysis
- Reduced memory usage
- Focused results

### 3. Use Parallel Parsing

**Best Practice**: Parsers run in parallel by default.

**Optimization**:

- Ensure sufficient CPU cores
- Consider increasing Node.js memory limit for large projects

```bash
# Increase Node.js memory
NODE_OPTIONS="--max-old-space-size=4096" sf smart-deployment analyze
```

---

## Deployment Performance

### 1. Use Wave-Specific Tests

**Best Practice**: Use `--run-wave-test` for faster deployments.

```bash
# ✅ Fast (runs only wave tests)
sf smart-deployment start --target-org prod --run-wave-test

# ❌ Slower (runs all local tests)
sf smart-deployment start --target-org prod  # Uses RunLocalTests
```

**Performance Impact**:

- **Wave-specific tests**: ~30-60 seconds per wave
- **RunLocalTests**: ~5-15 minutes per wave
- **Savings**: 80-90% faster

### 2. Use Deployment Plans

**Best Practice**: Use pre-generated plans to skip AI analysis.

```bash
# Development: Generate plan (with AI)
sf smart-deployment analyze --save-plan

# CI/CD: Use plan (no AI, faster)
sf smart-deployment start --target-org prod --use-plan plan.json --strict
```

**Performance Impact**:

- **With AI**: ~30-60 seconds for analysis
- **With plan**: ~1-2 seconds to load plan
- **Savings**: 95% faster

### 3. Optimize Wave Size

**Best Practice**: Ensure waves are optimally sized.

**Optimal Wave Size**:

- **200-300 components**: Optimal
- **<100 components**: Too small (consider merging)
- **>300 components**: Too large (will be split automatically)

**Check Wave Distribution**:

```bash
sf smart-deployment analyze --format json --output analysis.json
# Review wave sizes in analysis.json
```

### 4. Skip Tests in Sandbox

**Best Practice**: Use `--no-test-run` in sandbox for faster deployments.

```bash
# Sandbox: Skip tests
sf smart-deployment start --target-org mysandbox --no-test-run

# Production: Use wave-specific tests
sf smart-deployment start --target-org prod --run-wave-test
```

**Performance Impact**:

- **No tests**: ~10-30 seconds per wave
- **Wave tests**: ~30-60 seconds per wave
- **Savings**: 50-70% faster

---

## AI Performance

### 1. Use Deployment Plans

**Best Practice**: Generate plans once, use many times.

```bash
# Generate plan once (with AI)
sf smart-deployment analyze --save-plan

# Use plan multiple times (no AI calls)
sf smart-deployment start --target-org staging --use-plan plan.json
sf smart-deployment start --target-org prod --use-plan plan.json
```

**Benefits**:

- No AI API calls in CI/CD
- Faster deployments
- Consistent wave structure

### 2. Limit AI Usage

**Best Practice**: Use AI only when needed.

```bash
# ✅ Use AI for initial analysis
sf smart-deployment analyze

# ❌ Don't use AI for every deployment
sf smart-deployment start --target-org myorg  # Unnecessary
```

**When to Use AI**:

- Initial project analysis
- Complex dependency scenarios
- Priority optimization

**When NOT to Use AI**:

- Routine deployments
- CI/CD pipelines
- Repeated deployments

### 3. Configure AI Timeout

**Best Practice**: Set appropriate timeout values.

```json
// .smart-deployment.json
{
  "ai": {
    "timeout": 10000, // 10 seconds (default: 30000)
    "maxRetries": 2 // Reduce retries for faster failure
  }
}
```

**Performance Impact**:

- **Shorter timeout**: Faster failure detection
- **Fewer retries**: Faster fallback to static analysis

---

## Caching Strategies

### 1. Dependency Cache

**Location**: `.smart-deployment/cache/`

**What's Cached**:

- Parsed metadata components
- Dependency relationships
- Graph structure

**Cache Invalidation**:

- Automatic on file changes
- Manual: Delete `.smart-deployment/cache/` directory

### 2. Deployment Plan Cache

**Location**: `.smart-deployment/deployment-plan.json`

**What's Cached**:

- Wave structure
- Component assignments
- Priority overrides

**Cache Usage**:

- Load plan instead of regenerating
- Use `--use-plan` flag

### 3. Manifest Cache

**Location**: `.smart-deployment/manifests/`

**What's Cached**:

- Generated `package.xml` files
- Per-wave manifests

**Cache Usage**:

- Reuse manifests if waves unchanged
- Regenerate if components changed

---

## Monitoring

### 1. Track Performance Metrics

**Best Practice**: Monitor deployment performance.

```bash
# Enable performance monitoring
export SF_LOG_LEVEL=debug

# Review logs for performance metrics
cat .smart-deployment/logs/deployment.log | grep "performance"
```

**Metrics to Track**:

- Analysis time
- Wave generation time
- Deployment time per wave
- Total deployment time

### 2. Use Performance Reports

**Best Practice**: Generate performance reports.

```bash
# Analyze with performance tracking
sf smart-deployment analyze --format json --output analysis.json

# Review performance metrics in analysis.json
```

**Metrics Available**:

- Component count
- Dependency count
- Wave count
- Estimated deployment time

### 3. Profile Slow Operations

**Best Practice**: Identify bottlenecks.

**Common Bottlenecks**:

1. **Large projects**: Use path filtering
2. **AI calls**: Use deployment plans
3. **Test execution**: Use wave-specific tests
4. **Network latency**: Use local caching

---

## Performance Benchmarks

### Typical Performance

| Operation                 | Small Project (<100 components) | Medium Project (100-500) | Large Project (500+) |
| ------------------------- | ------------------------------- | ------------------------ | -------------------- |
| **Analysis**              | 5-10s                           | 15-30s                   | 30-60s               |
| **Wave Generation**       | <1s                             | 1-3s                     | 3-10s                |
| **Deployment (per wave)** | 10-20s                          | 20-40s                   | 40-60s               |
| **With AI**               | +5-10s                          | +10-20s                  | +20-30s              |

### Optimization Impact

| Optimization             | Performance Gain            |
| ------------------------ | --------------------------- |
| **Wave-specific tests**  | 80-90% faster               |
| **Deployment plans**     | 95% faster (no AI)          |
| **Skip tests (sandbox)** | 50-70% faster               |
| **Dependency caching**   | 60-80% faster (re-analysis) |

---

## Best Practices Summary

### ✅ Do

- Use deployment plans in CI/CD
- Use wave-specific tests in production
- Enable dependency caching
- Monitor performance metrics
- Optimize wave sizes

### ❌ Don't

- Use AI for every deployment
- Skip analysis before deploying
- Deploy without monitoring
- Ignore performance metrics
- Use `--no-test-run` in production

---

## Related Documentation

- [Deployment Best Practices](./DEPLOYMENT_BEST_PRACTICES.md) - Deployment guidelines
- [User Guide](./USER_GUIDE.md) - Getting started
- [Troubleshooting Guide](./TROUBLESHOOTING_GUIDE.md) - Performance issues

---

**Last Updated**: December 14, 2025
