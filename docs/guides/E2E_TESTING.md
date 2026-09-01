# E2E Testing Guide - Smart Deployment Plugin

**Last Updated**: December 14, 2025

Comprehensive guide for writing, running, and maintaining End-to-End (E2E) tests for the Smart Deployment plugin.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [Prerequisites](#prerequisites)
3. [Test Scripts](#test-scripts)
4. [Writing E2E Tests](#writing-e2e-tests)
5. [Running E2E Tests](#running-e2e-tests)
6. [Test Structure](#test-structure)
7. [Best Practices](#best-practices)
8. [Troubleshooting](#troubleshooting)

---

## Overview

E2E tests validate that the Smart Deployment plugin works correctly against real Salesforce orgs and projects. Unlike unit tests that mock dependencies, E2E tests execute actual commands and verify real-world behavior.

### What E2E Tests Cover

- ✅ Command execution against real orgs
- ✅ Flag combinations and interactions
- ✅ Error handling and edge cases
- ✅ Integration between components
- ✅ Real metadata scanning and analysis
- ✅ Deployment plan generation
- ✅ Manifest generation and validation
- ✅ Deterministic metadata analysis

### What E2E Tests Don't Cover

- ❌ Unit-level logic (use unit tests)
- ❌ Internal implementation details
- ❌ Performance benchmarks (use performance tests)
- ❌ Stress testing (use stress tests)

---

## Prerequisites

### Required Tools

1. **Salesforce CLI** (`sf`)

   ```bash
   sf --version  # Should be 2.x or later
   ```

2. **GitHub CLI** (`gh`) - For CI/CD

   ```bash
   gh --version
   ```

3. **jq** (optional) - For JSON validation
   ```bash
   jq --version
   ```

### Required Setup

1. **Plugin Linked**

   ```bash
   cd /path/to/smart-deployment
   sf plugins link
   ```

2. **Authenticated Org**

   ```bash
   sf org login web --alias test-org
   sf org list  # Verify org is available
   ```

3. **Test Project**
   - Use an existing Salesforce project, or set `E2E_PROJECT_PATH` to its path
   - Or create temporary project for testing

---

## Test Scripts

### Basic Script: `scripts/e2e-test.sh`

**Purpose**: Comprehensive E2E test suite for the Smart Deployment plugin

**Configuration**:

- **Target Org**: selected from authorized non-production orgs, or set with `E2E_TARGET_ORG`
- **Project Path**: temporary `test-project-e2e`, or set with `E2E_PROJECT_PATH`
- **Tests**: 7 numbered tests

**Usage**:

```bash
cd /path/to/smart-deployment
./scripts/e2e-test.sh
```

**Environment Variables**:

```bash
export E2E_TARGET_ORG="your-org-alias"  # Override selected org
export E2E_PROJECT_PATH="/path/to/project"  # Use an existing project
```

### Comprehensive Script: `scripts/e2e-test-grg.sh`

**Purpose**: Comprehensive E2E-style suite (24 numbered tests)

**Usage**:

```bash
./scripts/e2e-test-grg.sh
```

**Features**:

- Auto-detects suitable test org
- Creates temporary test project
- Validates git safety
- Cleans up after tests

---

## Writing E2E Tests

### Test Structure

Each E2E test follows this structure:

```bash
# Test N: Description
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test N: Test Description"
log_info "═══════════════════════════════════════════"

log_info "Running: sf command --flags"
OUTPUT=$(sf command --flags 2>&1)
EXIT_CODE=$?

echo "$OUTPUT"

# Validate exit code
if [ $EXIT_CODE -ne 0 ]; then
    log_error "Command failed with exit code $EXIT_CODE"
    exit 1
fi

# Validate output
if echo "$OUTPUT" | grep -q "expected pattern"; then
    log_success "✓ Validation passed"
else
    log_error "Validation failed"
    exit 1
fi

log_success "Test N passed: Description"
```

### Example: Adding a New Test

```bash
# Test 25: New feature test
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 25: New feature test"
log_info "═══════════════════════════════════════════"

   log_info "Running: sf smart-deployment analyze --new-flag value"
   ANALYZE_NEW_OUTPUT=$(sf smart-deployment analyze --new-flag value 2>&1)
ANALYZE_NEW_EXIT_CODE=$?

echo "$ANALYZE_NEW_OUTPUT"

# Check exit code
if [ $ANALYZE_NEW_EXIT_CODE -ne 0 ]; then
    log_error "Analyze --new-flag failed with exit code $ANALYZE_NEW_EXIT_CODE"
    exit 1
fi

# Validate flag is recognized
if echo "$ANALYZE_NEW_OUTPUT" | grep -q "new-flag\|new flag"; then
    log_success "✓ --new-flag recognized"
else
    log_warning "⚠️  --new-flag output unclear"
fi

log_success "Test 25 passed: New feature validated"
```

### Validation Patterns

#### Exit Code Validation

```bash
if [ $EXIT_CODE -ne 0 ]; then
    log_error "Command failed"
    exit 1
fi
```

#### Output Pattern Matching

```bash
# Case-insensitive match
if echo "$OUTPUT" | grep -qiE "pattern"; then
    log_success "✓ Pattern found"
fi

# Exact match
if echo "$OUTPUT" | grep -q "exact text"; then
    log_success "✓ Exact match found"
fi
```

#### File Existence

```bash
if [ -f "$FILE_PATH" ]; then
    log_success "✓ File created: $FILE_PATH"
else
    log_error "File not found: $FILE_PATH"
    exit 1
fi
```

#### JSON Validation (with jq)

```bash
if command -v jq &> /dev/null; then
    if jq -e '.key' "$JSON_FILE" > /dev/null 2>&1; then
        log_success "✓ JSON structure valid"
    fi
fi
```

---

## Running E2E Tests

### Local Execution

#### Basic Run

```bash
cd /path/to/smart-deployment
./scripts/e2e-test.sh
```

#### With Custom Org

```bash
export E2E_TARGET_ORG="my-test-org"
./scripts/e2e-test.sh
```

#### With Custom Project

```bash
export E2E_PROJECT_PATH="/path/to/my-project"
./scripts/e2e-test.sh
```

### CI/CD Execution

The current GitHub Actions workflows do not run these shell E2E scripts automatically. The test workflow runs unit tests and NUTs; the acceptance workflow leaves integration/E2E steps commented out.

### Debugging Failed Tests

1. **Check Exit Code**

   ```bash
   echo "Exit code: $EXIT_CODE"
   ```

2. **Inspect Output**

   ```bash
   echo "$OUTPUT" | tee /tmp/test-output.log
   ```

3. **Run Single Command**

   ```bash
   sf smart-deployment analyze --source-path . --output report.json --format json
   ```

4. **Check State**
   ```bash
   sf smart-deployment status --target-org test-org
   ls -la .smart-deployment/
   ```

---

## Test Structure

### Current Script Coverage (24 Numbered Tests)

#### Analyze Command (Tests 1, 2, 6, 17, 19, 21, 22)

- Basic analyze
- Save plan
- Metadata analysis and wave generation
- Locale support
- Custom plan path
- JSON report generation
- HTML report generation

#### Validate Command (Test 3)

- Check-only deployment
- Wave validation

#### Start Command (Tests 4, 5, 7-16, 18, 20)

- Dry-run mode
- Validate-only mode
- Plan-based execution
- Test execution flags
- Plan-based deployment
- Strict validation
- Locale support
- Flag conflicts

#### Resume Command (Test 15, 23)

- Failed deployment detection
- State loading
- Wave resumption
- Manifest generation
- Deployment execution

#### Status Command (Test 16, 24)

- Status display
- Progress tracking
- State information

### Test Organization

Tests are organized by:

1. **Command** (analyze, start, validate, resume, status)
2. **Feature** (flags, manifests, reports, etc.)
3. **Priority** (critical → nice-to-have)

---

## Best Practices

### 1. Test Independence

Each test should be independent and not rely on previous tests:

```bash
# ❌ BAD: Relies on previous test
# Test 2 assumes Test 1 created a file

# ✅ GOOD: Self-contained
# Test 2 creates its own test data
```

### 2. Clean State

Always start with a clean state:

```bash
# Clean up before test
rm -rf .smart-deployment/
```

### 3. Clear Validation

Make validation clear and specific:

```bash
# ❌ BAD: Vague validation
if echo "$OUTPUT" | grep -q "something"; then
    log_success "OK"
fi

# ✅ GOOD: Specific validation
if echo "$OUTPUT" | grep -q "✅ Generated.*manifests"; then
    log_success "✓ Manifest generation confirmed"
fi
```

### 4. Error Handling

Handle expected failures gracefully:

```bash
# Expected failure (validation should fail)
if [ $EXIT_CODE -ne 0 ]; then
    log_success "✓ Validation correctly failed"
else
    log_error "Validation should have failed"
    exit 1
fi
```

### 5. Informative Messages

Use clear, informative log messages:

```bash
log_info "Running: sf command --flags"
log_info "Expected: Description of expected behavior"
```

### 6. File Cleanup

Clean up generated files:

```bash
# Cleanup after test
rm -f "$REPORT_PATH"
```

---

## Troubleshooting

### Common Issues

#### 1. Plugin Not Found

```
Error: Command 'sf smart-deployment' not found
```

**Solution**:

```bash
sf plugins link
sf plugins list  # Verify plugin is linked
```

#### 2. Org Not Authenticated

```
Error: No org found
```

**Solution**:

```bash
sf org login web --alias test-org
sf org list  # Verify org is available
```

#### 3. Permission Denied

```
Error: Permission denied: ./scripts/e2e-test.sh
```

**Solution**:

```bash
chmod +x scripts/e2e-test.sh
```

#### 4. Test Timeout

```
Error: Test timed out
```

**Solution**:

- Check org connectivity
- Verify org is not locked
- Check for long-running operations

#### 5. False Positives

**Symptoms**: Tests pass but functionality is broken

**Solution**:

- Improve validation patterns
- Add more specific checks
- Verify actual file contents
- Check exit codes more carefully

### Debugging Tips

1. **Run Single Test**

   ```bash
   # Comment out other tests, run only one
   ```

2. **Add Debug Output**

   ```bash
   echo "DEBUG: Variable value: $VARIABLE"
   ```

3. **Check Intermediate State**

   ```bash
   ls -la .smart-deployment/
   cat .smart-deployment/deployment-plan.json
   ```

4. **Compare with Manual Run**
   ```bash
   # Run command manually, compare output
   sf smart-deployment analyze --source-path . --output report.json --format json
   ```

---

## Test Maintenance

### Adding New Tests

1. **Identify Gap**: What functionality needs testing?
2. **Write Test**: Follow test structure guidelines
3. **Validate**: Run test locally
4. **Update Summary**: Add to final summary list
5. **Document**: Update this guide if needed

### Updating Existing Tests

1. **Identify Change**: What changed in functionality?
2. **Update Test**: Modify validation patterns
3. **Test Locally**: Verify test still works
4. **Update Docs**: Update test descriptions

### Removing Tests

1. **Identify Obsolete**: What functionality was removed?
2. **Remove Test**: Delete test code
3. **Update Summary**: Remove from final summary
4. **Update Count**: Update total test count

---

## Coverage Goals

### Current Coverage

Flag coverage is not maintained as a verified current percentage. The comprehensive script contains 24 numbered tests and the basic script contains 7; no Playwright specs currently exist under `test/e2e/`.

### Target Coverage: 80% (27/34 flags)

### Priority Order

1. **Critical Flags** (Must Have)

   - `--use-plan` ✅
   - `--strict` ✅
   - `--output` ✅
   - `--format` ✅

2. **Important Flags** (Should Have)

   - `--source-path`

3. **Nice-to-Have Flags** (Could Have)
   - `--watch`
   - Flag combinations
   - Edge cases

---

## Resources

- **E2E Coverage Analysis**: `docs/E2E_COVERAGE_ANALYSIS.md`
- **Testing Review**: `docs/TESTING_REVIEW.md`
- **Test Scripts**: `scripts/e2e-test.sh` and `scripts/e2e-test-grg.sh`
- **CI/CD Workflows**: `.github/workflows/`

---

## Conclusion

E2E tests are crucial for validating real-world functionality. Follow this guide to write, run, and maintain effective E2E tests for the Smart Deployment plugin.

**Remember**: E2E tests should validate behavior, not implementation details. Focus on what users see and experience, not how it's implemented internally.
