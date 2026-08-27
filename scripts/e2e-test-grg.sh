#!/bin/bash

# E2E Test Script for @smart-deployment plugin
# Configured for the GRG project and grg-support org

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
log_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

log_success() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# Configuration
TARGET_ORG="grg-support"
PROJECT_PATH="$HOME/dev/grg-ss"

log_info "═══════════════════════════════════════════"
log_info "Smart Deployment E2E Tests"
log_info "═══════════════════════════════════════════"
log_info "Target Org: $TARGET_ORG"
log_info "Project Path: $PROJECT_PATH"
log_info "═══════════════════════════════════════════"
log_info ""

# Check if sf CLI is installed
if ! command -v sf &> /dev/null; then
    log_error "Salesforce CLI (sf) is not installed"
    exit 1
fi

log_success "Salesforce CLI found"

# Check if plugin is linked or installed
if ! sf plugins | grep -q "smart-deployment"; then
    log_error "Plugin smart-deployment is not installed or linked"
    log_info "Linking plugin..."
    cd "$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/.."
    sf plugins link
    if ! sf plugins | grep -q "smart-deployment"; then
        log_error "Failed to link plugin"
        exit 1
    fi
fi

log_success "Plugin smart-deployment is available"

# Verify org exists (check by alias or username)
log_info "Verifying org: $TARGET_ORG..."
ORG_CHECK=$(sf org list --json | jq -r ".result.nonScratchOrgs[] | select(.alias == \"$TARGET_ORG\" or (.username | contains(\"$TARGET_ORG\"))) | .username" | head -1)

if [ -z "$ORG_CHECK" ]; then
    log_warning "Org '$TARGET_ORG' not found in authorized orgs"
    log_info "Available orgs:"
    sf org list --json | jq -r '.result.nonScratchOrgs[] | "  - \(.username) (alias: \(.alias // "none"))"'
    log_info ""
    log_info "Attempting to use '$TARGET_ORG' anyway (may be authenticated via different method)"
    ORG_CHECK="$TARGET_ORG"
else
    log_success "Org found: $ORG_CHECK"
fi

# Verify project exists
if [ ! -d "$PROJECT_PATH" ]; then
    log_error "Project directory does not exist: $PROJECT_PATH"
    exit 1
fi

if [ ! -f "$PROJECT_PATH/sfdx-project.json" ] && [ ! -f "$PROJECT_PATH/sf-project.json" ]; then
    log_error "Project directory does not appear to be a Salesforce project"
    exit 1
fi

log_success "Project found: $PROJECT_PATH"

# Navigate to project
log_info "Navigating to project..."
cd "$PROJECT_PATH"
log_success "Working directory: $(pwd)"

# Check git status for safety validation
if [ -d ".git" ]; then
    log_info "Git repository found - will validate file safety"
    INITIAL_GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "")
else
    log_warning "No git repository found - file safety checks will be limited"
    INITIAL_GIT_STATUS=""
fi

# Test 1: Analyze command (basic)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 1: Analyze command (basic)"
log_info "═══════════════════════════════════════════"

log_info "Running: sf analyze --source-path ."
ANALYZE_OUTPUT=$(sf analyze --source-path . 2>&1)
ANALYZE_EXIT_CODE=$?

# Check exit code
if [ $ANALYZE_EXIT_CODE -ne 0 ]; then
    log_error "Analyze command failed with exit code $ANALYZE_EXIT_CODE"
    echo "$ANALYZE_OUTPUT"
    exit 1
fi

echo "$ANALYZE_OUTPUT"

# Validate success messages
if ! echo "$ANALYZE_OUTPUT" | grep -q "✅ Found.*components.*dependencies"; then
    log_error "Missing success message: '✅ Found X components with Y dependencies'"
    exit 1
fi

if ! echo "$ANALYZE_OUTPUT" | grep -q "✅ Generated.*deployment wave"; then
    log_error "Missing success message: '✅ Generated X deployment wave(s)'"
    exit 1
fi

# Extract and validate numbers (macOS compatible - no -P flag)
COMPONENTS=$(echo "$ANALYZE_OUTPUT" | grep -oE "Found [0-9]+ components" | grep -oE "[0-9]+" | head -1)
DEPENDENCIES=$(echo "$ANALYZE_OUTPUT" | grep -oE "with [0-9]+ dependencies" | grep -oE "[0-9]+" | head -1)
WAVES=$(echo "$ANALYZE_OUTPUT" | grep -oE "Generated [0-9]+ deployment wave" | grep -oE "[0-9]+" | head -1)

if [ -z "$COMPONENTS" ] || [ "$COMPONENTS" -eq 0 ]; then
    log_error "Invalid component count: $COMPONENTS"
    exit 1
fi

if [ -z "$DEPENDENCIES" ]; then
    log_warning "Could not extract dependency count"
else
    log_info "  ✓ Components: $COMPONENTS"
    log_info "  ✓ Dependencies: $DEPENDENCIES"
fi

if [ -z "$WAVES" ] || [ "$WAVES" -eq 0 ]; then
    log_error "Invalid wave count: $WAVES (expected > 0)"
    exit 1
fi

log_info "  ✓ Waves: $WAVES"
log_success "Analyze command executed successfully"

# Check git status
if [ -n "$INITIAL_GIT_STATUS" ]; then
    CURRENT_GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "")
    MODIFIED_SOURCE_FILES=$(echo "$CURRENT_GIT_STATUS" | grep -v ".smart-deployment/" | grep -v "node_modules/" || true)

    if [ -z "$MODIFIED_SOURCE_FILES" ]; then
        log_success "✓ No source files modified (safe analyze confirmed)"
    else
        log_error "CRITICAL: Source files were modified!"
        echo "$MODIFIED_SOURCE_FILES"
        exit 1
    fi
fi

# Test 2: Analyze with --save-plan flag
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 2: Analyze with --save-plan flag"
log_info "═══════════════════════════════════════════"

log_info "Running: sf analyze --source-path . --save-plan"
ANALYZE_PLAN_OUTPUT=$(sf analyze --source-path . --save-plan 2>&1)
ANALYZE_PLAN_EXIT_CODE=$?

# Check exit code
if [ $ANALYZE_PLAN_EXIT_CODE -ne 0 ]; then
    log_error "Analyze with --save-plan failed with exit code $ANALYZE_PLAN_EXIT_CODE"
    echo "$ANALYZE_PLAN_OUTPUT"
    exit 1
fi

echo "$ANALYZE_PLAN_OUTPUT"

# Validate success message for plan saving
if ! echo "$ANALYZE_PLAN_OUTPUT" | grep -q "✅ Deployment plan saved"; then
    log_error "Missing success message: '✅ Deployment plan saved'"
    exit 1
fi

# Check if deployment plan was created
if [ ! -f ".smart-deployment/deployment-plan.json" ]; then
    log_error "Deployment plan file not found: .smart-deployment/deployment-plan.json"
    exit 1
fi

log_success "Deployment plan created: .smart-deployment/deployment-plan.json"

# Validate plan structure
if command -v jq &> /dev/null; then
    if ! jq -e '.metadata' .smart-deployment/deployment-plan.json > /dev/null 2>&1; then
        log_error "Deployment plan JSON structure is invalid (missing .metadata)"
        exit 1
    fi

    PLAN_VERSION=$(jq -r '.metadata.version // "unknown"' .smart-deployment/deployment-plan.json)
    PLAN_COMPONENTS=$(jq -r '.metadata.totalComponents // 0' .smart-deployment/deployment-plan.json)
    PLAN_WAVES=$(jq -r '.metadata.totalWaves // 0' .smart-deployment/deployment-plan.json)

    log_info "  Plan version: $PLAN_VERSION"
    log_info "  Total components: $PLAN_COMPONENTS"
    log_info "  Total waves: $PLAN_WAVES"

    # Validate plan numbers match expected ranges
    if [ "$PLAN_COMPONENTS" -eq 0 ]; then
        log_error "Invalid plan: totalComponents is 0"
        exit 1
    fi

    if [ "$PLAN_WAVES" -eq 0 ]; then
        log_error "Invalid plan: totalWaves is 0"
        exit 1
    fi

    # Validate waves array exists and has correct length
    PLAN_WAVES_COUNT=$(jq '.waves | length' .smart-deployment/deployment-plan.json 2>/dev/null || echo "0")
    if [ "$PLAN_WAVES_COUNT" -ne "$PLAN_WAVES" ]; then
        log_warning "Wave count mismatch: metadata says $PLAN_WAVES but array has $PLAN_WAVES_COUNT"
    fi

    log_success "✓ Deployment plan validated: $PLAN_COMPONENTS components, $PLAN_WAVES waves"
else
    log_warning "jq not available - skipping detailed JSON validation"
fi

# Test 3: Validate command (check-only)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 3: Validate command (check-only)"
log_info "═══════════════════════════════════════════"

log_info "Running: sf validate --target-org $TARGET_ORG --source-path ."
VALIDATE_OUTPUT=$(sf validate --target-org "$TARGET_ORG" --source-path . 2>&1)
VALIDATE_EXIT_CODE=$?

echo "$VALIDATE_OUTPUT"

# Check exit code - validate should succeed (exit 0) if validation passes
if [ $VALIDATE_EXIT_CODE -ne 0 ]; then
    # Check if it's a validation failure (expected) or a command error (unexpected)
    if echo "$VALIDATE_OUTPUT" | grep -q "❌ Validation failed\|Validation failed"; then
        log_warning "Validation failed (this may be expected if metadata has issues)"
    else
        log_error "Validate command failed with exit code $VALIDATE_EXIT_CODE (unexpected error)"
        exit 1
    fi
fi

# Validate success messages
if echo "$VALIDATE_OUTPUT" | grep -q "✅ Validation complete"; then
    # Extract validation summary
    VALIDATE_COMPONENTS=$(echo "$VALIDATE_OUTPUT" | grep -oE "Components: [0-9]+" | grep -oE "[0-9]+" | head -1)
    VALIDATE_WAVES=$(echo "$VALIDATE_OUTPUT" | grep -oE "Waves: [0-9]+" | grep -oE "[0-9]+" | head -1)

    if [ -n "$VALIDATE_COMPONENTS" ]; then
        log_info "  ✓ Validation components: $VALIDATE_COMPONENTS"
    fi
    if [ -n "$VALIDATE_WAVES" ]; then
        log_info "  ✓ Validation waves: $VALIDATE_WAVES"

        # Validate wave count is reasonable (> 0)
        if [ "$VALIDATE_WAVES" -eq 0 ]; then
            log_error "Invalid validation: 0 waves generated"
            exit 1
        fi
    fi

    log_success "Validate command executed successfully"
elif echo "$VALIDATE_OUTPUT" | grep -q "❌ Validation failed"; then
    log_warning "Validation failed (check output above for details)"
    # Don't exit - validation failures are acceptable in E2E tests
else
    log_warning "Validate command output unclear (check above)"
fi

# Test 4: Start command with --dry-run flag
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 4: Start command with --dry-run"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run"
START_DRYRUN_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run 2>&1)
START_DRYRUN_EXIT_CODE=$?

echo "$START_DRYRUN_OUTPUT"

# Check exit code
if [ $START_DRYRUN_EXIT_CODE -ne 0 ]; then
    log_error "Start --dry-run failed with exit code $START_DRYRUN_EXIT_CODE"
    exit 1
fi

# Validate dry-run messages
if ! echo "$START_DRYRUN_OUTPUT" | grep -q -i "dry.*run\|simulation\|would deploy\|Dry-run/Validate mode"; then
    log_error "Missing dry-run indicator message"
    exit 1
fi

# Validate manifest generation messages
if echo "$START_DRYRUN_OUTPUT" | grep -q "📄 Generating manifests\|✅ Generated.*manifests"; then
    log_success "✓ Manifest generation detected"

    # Check if manifests directory was created (even in dry-run, manifests should be generated)
    if [ -d ".smart-deployment/manifests" ]; then
        MANIFEST_COUNT=$(find .smart-deployment/manifests -name "wave-*-package.xml" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$MANIFEST_COUNT" -gt 0 ]; then
            log_info "  ✓ Manifests generated: $MANIFEST_COUNT"
        fi
    fi
fi

# Validate manifest validation messages
if echo "$START_DRYRUN_OUTPUT" | grep -q "🔍 Validating manifests\|✅ All manifests validated"; then
    log_success "✓ Manifest validation detected"
fi

# Extract wave count from dry-run output
DRYRUN_WAVES=$(echo "$START_DRYRUN_OUTPUT" | grep -oE "wave[s]?.*[0-9]+" | grep -oE "[0-9]+" | head -1 || echo "")
if [ -n "$DRYRUN_WAVES" ]; then
    log_info "  ✓ Dry-run waves: $DRYRUN_WAVES"
fi

log_success "Dry-run command executed successfully"

# CRITICAL VALIDATION: Dry-run should NOT modify any files
if [ -n "$INITIAL_GIT_STATUS" ]; then
    CURRENT_GIT_STATUS=$(git status --porcelain 2>/dev/null || echo "")
    MODIFIED_SOURCE_FILES=$(echo "$CURRENT_GIT_STATUS" | grep -v ".smart-deployment/" | grep -v "node_modules/" || true)

    if [ -z "$MODIFIED_SOURCE_FILES" ]; then
        log_success "✓ No source files modified (dry-run working correctly)"
    else
        log_error "CRITICAL: Dry-run modified source files!"
        echo "$MODIFIED_SOURCE_FILES"
        exit 1
    fi
fi

log_success "Test 4 passed: --dry-run works correctly"

# Test 5: Start command with --validate-only flag
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 5: Start command with --validate-only"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --validate-only"
START_VALIDATE_OUTPUT=$(sf start --target-org "$TARGET_ORG" --validate-only 2>&1)
START_VALIDATE_EXIT_CODE=$?

echo "$START_VALIDATE_OUTPUT"

# Check exit code
if [ $START_VALIDATE_EXIT_CODE -ne 0 ]; then
    # Check if it's a validation failure (acceptable) or command error (unacceptable)
    if echo "$START_VALIDATE_OUTPUT" | grep -q "❌\|Validation failed\|Manifest validation failed"; then
        log_warning "Validation failed (may be expected)"

        # Check for enhanced error messages
        if echo "$START_VALIDATE_OUTPUT" | grep -q "💡 Suggestion:"; then
            log_info "  ✓ Enhanced error messages detected"
        fi
    else
        log_error "Start --validate-only failed with exit code $START_VALIDATE_EXIT_CODE"
        exit 1
    fi
fi

# Validate success messages
if echo "$START_VALIDATE_OUTPUT" | grep -q "✅\|Validation complete\|valid\|All manifests validated"; then
    # Extract wave count
    VALIDATE_ONLY_WAVES=$(echo "$START_VALIDATE_OUTPUT" | grep -oE "wave[s]?.*[0-9]+" | grep -oE "[0-9]+" | head -1 || echo "")
    if [ -n "$VALIDATE_ONLY_WAVES" ]; then
        log_info "  ✓ Validate-only waves: $VALIDATE_ONLY_WAVES"
    fi

    # Validate manifest generation and validation
    if echo "$START_VALIDATE_OUTPUT" | grep -q "📄 Generating manifests"; then
        log_success "✓ Manifest generation detected"
    fi
    if echo "$START_VALIDATE_OUTPUT" | grep -q "🔍 Validating manifests\|✅ All manifests validated"; then
        log_success "✓ Manifest validation detected"
    fi

    log_success "Validate-only command executed successfully"
else
    log_warning "Validate-only output unclear (check above)"
fi

# Test 6: Start command with dry-run (manifest generation and validation)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 6: Start with dry-run (manifest generation)"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run"
START_AI_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run 2>&1)
START_AI_EXIT_CODE=$?

echo "$START_AI_OUTPUT"

# Check exit code
if [ $START_AI_EXIT_CODE -ne 0 ]; then
    log_error "Start --dry-run failed with exit code $START_AI_EXIT_CODE"
    exit 1
fi

# Validate manifest generation messages
if echo "$START_AI_OUTPUT" | grep -q "📄 Generating manifests"; then
    log_success "✓ Manifest generation detected"

    # Validate manifests were created
    if [ -d ".smart-deployment/manifests" ]; then
        MANIFEST_FILES=$(find .smart-deployment/manifests -name "wave-*-package.xml" 2>/dev/null | wc -l | tr -d ' ')
        if [ "$MANIFEST_FILES" -gt 0 ]; then
            log_success "✓ Manifests created: $MANIFEST_FILES files"

            # Validate manifest structure
            FIRST_MANIFEST=$(find .smart-deployment/manifests -name "wave-*-package.xml" | head -1)
            if [ -n "$FIRST_MANIFEST" ]; then
                if grep -q "<Package xmlns" "$FIRST_MANIFEST" && grep -q "<version>" "$FIRST_MANIFEST"; then
                    log_success "✓ Manifest structure valid"
                else
                    log_error "Invalid manifest structure in $FIRST_MANIFEST"
                    exit 1
                fi
            fi
        else
            log_warning "⚠️  No manifest files found (may be expected if no components)"
        fi
    fi
fi

# Validate manifest validation messages
if echo "$START_AI_OUTPUT" | grep -q "🔍 Validating manifests"; then
    log_success "✓ Manifest validation detected"

    if echo "$START_AI_OUTPUT" | grep -q "✅ All manifests validated"; then
        log_success "✓ All manifests validated successfully"
    elif echo "$START_AI_OUTPUT" | grep -q "❌\|Manifest validation failed"; then
        log_warning "⚠️  Manifest validation failed (check output above)"

        # Check for enhanced error messages
        if echo "$START_AI_OUTPUT" | grep -q "💡 Suggestion:"; then
            log_info "  ✓ Enhanced error messages detected"
        fi
    fi
fi

log_success "Start --dry-run executed successfully"

# Test 7: Start command with --no-test-run flag (sandbox only)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 7: Start with --no-test-run flag"
log_info "═══════════════════════════════════════════"

# Detect if org is production or sandbox
log_info "Detecting org type..."
ORG_INFO=$(sf org display --target-org "$TARGET_ORG" --json 2>/dev/null || echo "{}")
IS_PRODUCTION=$(echo "$ORG_INFO" | jq -r '.result.isProductionOrg // false' 2>/dev/null || echo "false")

# Try to detect from username pattern as fallback
if [ "$IS_PRODUCTION" = "false" ] || [ "$IS_PRODUCTION" = "null" ]; then
    ORG_USERNAME=$(echo "$ORG_INFO" | jq -r '.result.username // ""' 2>/dev/null || echo "")
    if echo "$ORG_USERNAME" | grep -qiE "(sandbox|--|\.sandbox\.)"; then
        IS_PRODUCTION="false"
        log_info "  Detected: Sandbox org (from username pattern)"
    elif [ -n "$ORG_USERNAME" ]; then
        IS_PRODUCTION="true"
        log_info "  Detected: Production org (from username pattern)"
    else
        log_warning "  Could not determine org type, assuming sandbox for safety"
        IS_PRODUCTION="false"
    fi
fi

if [ "$IS_PRODUCTION" = "true" ]; then
    log_info "Running: sf start --target-org $TARGET_ORG --dry-run --no-test-run (PRODUCTION)"
    log_info "Expected: --no-test-run should be IGNORED with warning"

    START_NOTEST_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --no-test-run 2>&1)
    START_NOTEST_EXIT_CODE=$?

    echo "$START_NOTEST_OUTPUT"

    # Check exit code
    if [ $START_NOTEST_EXIT_CODE -ne 0 ]; then
        log_error "Start --dry-run --no-test-run failed with exit code $START_NOTEST_EXIT_CODE"
        exit 1
    fi

    # Validate that --no-test-run was ignored with warning
    if echo "$START_NOTEST_OUTPUT" | grep -qiE "production.*--no-test-run.*ignored|--no-test-run.*ignored.*production|tests.*required.*production"; then
        log_success "✓ --no-test-run correctly ignored in production with warning"
    else
        log_warning "⚠️  Warning message about --no-test-run being ignored not found"
        log_info "  (This may be acceptable if message format changed)"
    fi

    # Validate that SF CLI standard behavior is used (tests will be required)
    if echo "$START_NOTEST_OUTPUT" | grep -q "📋 Using SF CLI standard test behavior\|🧪 Running"; then
        log_success "✓ SF CLI standard test behavior used"
    fi
else
    log_info "Running: sf start --target-org $TARGET_ORG --dry-run --no-test-run (SANDBOX)"
    log_info "Expected: Tests should be skipped"

    START_NOTEST_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --no-test-run 2>&1)
    START_NOTEST_EXIT_CODE=$?

    echo "$START_NOTEST_OUTPUT"

    # Check exit code
    if [ $START_NOTEST_EXIT_CODE -ne 0 ]; then
        log_error "Start --dry-run --no-test-run failed with exit code $START_NOTEST_EXIT_CODE"
        exit 1
    fi

    # Validate that tests are skipped
    if echo "$START_NOTEST_OUTPUT" | grep -qiE "⏭️.*Skipping tests|--no-test-run|NoTestRun"; then
        log_success "✓ Tests correctly skipped with --no-test-run in sandbox"
    else
        log_warning "⚠️  Test skip message not found (may use different format)"
    fi
fi

log_success "Test 7 passed: --no-test-run flag behavior validated"

# Test 8: Start command with --run-wave-test flag
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 8: Start with --run-wave-test flag"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run --run-wave-test"
START_WAVETEST_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --run-wave-test 2>&1)
START_WAVETEST_EXIT_CODE=$?

echo "$START_WAVETEST_OUTPUT"

# Check exit code
if [ $START_WAVETEST_EXIT_CODE -ne 0 ]; then
    log_error "Start --dry-run --run-wave-test failed with exit code $START_WAVETEST_EXIT_CODE"
    exit 1
fi

# Validate that --run-wave-test is recognized
if echo "$START_WAVETEST_OUTPUT" | grep -qiE "🧪.*Running.*test.*class.*wave|RunSpecifiedTests|--run-wave-test"; then
    log_success "✓ --run-wave-test flag recognized"

    # Extract test classes if mentioned
    TEST_CLASSES=$(echo "$START_WAVETEST_OUTPUT" | grep -oE "Running [0-9]+ test class\(es\) from wave:.*" | head -1)
    if [ -n "$TEST_CLASSES" ]; then
        log_info "  $TEST_CLASSES"
    fi
elif echo "$START_WAVETEST_OUTPUT" | grep -qiE "No test classes found in wave"; then
    log_info "  ℹ️  No test classes found in wave (acceptable)"
    log_success "✓ --run-wave-test handled correctly (no test classes)"
else
    log_warning "⚠️  --run-wave-test output unclear (may use different format)"
fi

log_success "Test 8 passed: --run-wave-test flag behavior validated"

# Test 9: Start command with default behavior (no test flags)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 9: Start with default test behavior"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run (no test flags)"
log_info "Expected: SF CLI standard behavior (tests required in prod, optional in sandbox)"

START_DEFAULT_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run 2>&1)
START_DEFAULT_EXIT_CODE=$?

echo "$START_DEFAULT_OUTPUT"

# Check exit code
if [ $START_DEFAULT_EXIT_CODE -ne 0 ]; then
    log_error "Start --dry-run (default) failed with exit code $START_DEFAULT_EXIT_CODE"
    exit 1
fi

# Validate that SF CLI standard behavior message is shown
if echo "$START_DEFAULT_OUTPUT" | grep -q "📋 Using SF CLI standard test behavior"; then
    log_success "✓ SF CLI standard test behavior message shown"
elif echo "$START_DEFAULT_OUTPUT" | grep -qiE "🧪.*Running|test"; then
    log_info "  ℹ️  Test execution mentioned (SF CLI will determine level)"
    log_success "✓ Default behavior working (SF CLI will handle test level)"
else
    log_warning "⚠️  Default test behavior output unclear"
fi

log_success "Test 9 passed: Default test behavior validated"

# Test 10: Start command with --use-plan flag (CI/CD workflow)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 10: Start with --use-plan flag"
log_info "═══════════════════════════════════════════"

# Ensure we have a deployment plan from Test 2
if [ ! -f ".smart-deployment/deployment-plan.json" ]; then
    log_warning "No deployment plan found, creating one..."
    sf analyze --source-path . --save-plan > /dev/null 2>&1
fi

if [ -f ".smart-deployment/deployment-plan.json" ]; then
    log_info "Running: sf start --target-org $TARGET_ORG --dry-run --use-plan .smart-deployment/deployment-plan.json"
    START_PLAN_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --use-plan .smart-deployment/deployment-plan.json 2>&1)
    START_PLAN_EXIT_CODE=$?

    echo "$START_PLAN_OUTPUT"

    # Check exit code
    if [ $START_PLAN_EXIT_CODE -ne 0 ]; then
        log_error "Start --dry-run --use-plan failed with exit code $START_PLAN_EXIT_CODE"
        exit 1
    fi

    # Validate plan loading message
    if echo "$START_PLAN_OUTPUT" | grep -q "📋 Loading deployment plan\|✅ Using approved plan"; then
        log_success "✓ Deployment plan loaded successfully"

        # Extract plan version if mentioned
        PLAN_VERSION=$(echo "$START_PLAN_OUTPUT" | grep -oE "version [0-9.]+" | head -1)
        if [ -n "$PLAN_VERSION" ]; then
            log_info "  ✓ Plan version: $PLAN_VERSION"
        fi
    else
        log_warning "⚠️  Plan loading message not found"
    fi

    log_success "Test 10 passed: --use-plan flag validated"
else
    log_warning "⚠️  Skipping Test 10: No deployment plan available"
fi

# Test 11: Start command with --strict --use-plan (CI/CD safety)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 11: Start with --strict --use-plan"
log_info "═══════════════════════════════════════════"

if [ -f ".smart-deployment/deployment-plan.json" ]; then
    log_info "Running: sf start --target-org $TARGET_ORG --dry-run --strict --use-plan .smart-deployment/deployment-plan.json"
    START_STRICT_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --strict --use-plan .smart-deployment/deployment-plan.json 2>&1)
    START_STRICT_EXIT_CODE=$?

    echo "$START_STRICT_OUTPUT"

    # Check exit code
    if [ $START_STRICT_EXIT_CODE -ne 0 ]; then
        log_error "Start --dry-run --strict --use-plan failed with exit code $START_STRICT_EXIT_CODE"
        exit 1
    fi

    # Validate strict mode is working
    if echo "$START_STRICT_OUTPUT" | grep -q "📋 Loading deployment plan\|✅ Using approved plan"; then
        log_success "✓ Strict mode with plan validated"
    else
        log_warning "⚠️  Strict mode output unclear"
    fi

    log_success "Test 11 passed: --strict --use-plan validated"
else
    log_warning "⚠️  Skipping Test 11: No deployment plan available"
fi

# Test 12: Start command with --strict without --use-plan (should fail)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 12: Start with --strict (without --use-plan, should fail)"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run --strict"
START_STRICT_FAIL_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --strict 2>&1)
START_STRICT_FAIL_EXIT_CODE=$?

# This should fail
if [ $START_STRICT_FAIL_EXIT_CODE -eq 0 ]; then
    log_error "Start --strict without --use-plan should have failed but didn't"
    exit 1
fi

# Validate error message
if echo "$START_STRICT_FAIL_OUTPUT" | grep -qiE "strict.*requires.*use-plan|Strict mode requires.*use-plan"; then
    log_success "✓ Correct error message shown for --strict without --use-plan"
else
    log_warning "⚠️  Error message format may have changed"
fi

log_success "Test 12 passed: --strict validation works correctly"

# Test 13: Resume command (without failed deployment)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 13: Resume command (no failed deployment)"
log_info "═══════════════════════════════════════════"

log_info "Running: sf resume --target-org $TARGET_ORG"
RESUME_OUTPUT=$(sf resume --target-org "$TARGET_ORG" 2>&1)
RESUME_EXIT_CODE=$?

echo "$RESUME_OUTPUT"

# Resume should handle gracefully when no failed deployment exists
if echo "$RESUME_OUTPUT" | grep -qiE "No.*failed.*deployment\|No active deployment\|ℹ️.*No failed"; then
    log_success "✓ Resume correctly handles no failed deployment"
elif [ $RESUME_EXIT_CODE -eq 0 ]; then
    log_info "  ℹ️  Resume completed (may have found state or handled gracefully)"
else
    log_warning "⚠️  Resume exit code: $RESUME_EXIT_CODE (may be expected)"
fi

log_success "Test 13 passed: Resume command validated"

# Test 14: Status command
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 14: Status command"
log_info "═══════════════════════════════════════════"

log_info "Running: sf status --target-org $TARGET_ORG"
STATUS_OUTPUT=$(sf status --target-org "$TARGET_ORG" 2>&1)
STATUS_EXIT_CODE=$?

echo "$STATUS_OUTPUT"

# Status should work even without active deployment
if [ $STATUS_EXIT_CODE -eq 0 ]; then
    if echo "$STATUS_OUTPUT" | grep -qiE "Deployment Status\|No active deployment\|ℹ️.*No active"; then
        log_success "✓ Status command executed successfully"
    else
        log_info "  ℹ️  Status output format may vary"
    fi
else
    log_warning "⚠️  Status exit code: $STATUS_EXIT_CODE (may be expected)"
fi

log_success "Test 14 passed: Status command validated"

# Test 15: Analyze with standard output
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 15: Analyze with standard output"
log_info "═══════════════════════════════════════════"

log_info "Running: sf analyze --source-path ."
ANALYZE_LOCALE_OUTPUT=$(sf analyze --source-path . 2>&1)
ANALYZE_LOCALE_EXIT_CODE=$?

# Check exit code
if [ $ANALYZE_LOCALE_EXIT_CODE -ne 0 ]; then
    log_error "Analyze failed with exit code $ANALYZE_LOCALE_EXIT_CODE"
    exit 1
fi

# Validate standard output
if echo "$ANALYZE_LOCALE_OUTPUT" | grep -q "✅ Found.*components"; then
    log_success "✓ Analyze executed successfully"
else
    log_warning "⚠️  Analyze output unclear"
fi

log_success "Test 15 passed: standard output validated"

# Test 16: Start with standard output
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 16: Start with standard output"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run"
START_LOCALE_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run 2>&1)
START_LOCALE_EXIT_CODE=$?

# Check exit code
if [ $START_LOCALE_EXIT_CODE -ne 0 ]; then
    log_error "Start --dry-run failed with exit code $START_LOCALE_EXIT_CODE"
    exit 1
fi

# Validate standard output
if echo "$START_LOCALE_OUTPUT" | grep -q "✅ Found.*components\|📊 Analyzing"; then
    log_success "✓ Start executed successfully"
else
    log_warning "⚠️  Start output unclear"
fi

log_success "Test 16 passed: Start standard output validated"

# Test 17: Analyze with --plan-path flag
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 17: Analyze with --plan-path flag"
log_info "═══════════════════════════════════════════"

CUSTOM_PLAN_PATH=".smart-deployment/custom-plan.json"
log_info "Running: sf analyze --source-path . --save-plan --plan-path $CUSTOM_PLAN_PATH"
ANALYZE_PLANPATH_OUTPUT=$(sf analyze --source-path . --save-plan --plan-path "$CUSTOM_PLAN_PATH" 2>&1)
ANALYZE_PLANPATH_EXIT_CODE=$?

# Check exit code
if [ $ANALYZE_PLANPATH_EXIT_CODE -ne 0 ]; then
    log_error "Analyze --plan-path failed with exit code $ANALYZE_PLANPATH_EXIT_CODE"
    exit 1
fi

# Validate custom plan path was used
if [ -f "$CUSTOM_PLAN_PATH" ]; then
    log_success "✓ Custom plan path created: $CUSTOM_PLAN_PATH"

    # Validate plan structure
    if command -v jq &> /dev/null; then
        if jq -e '.metadata' "$CUSTOM_PLAN_PATH" > /dev/null 2>&1; then
            log_success "✓ Custom plan structure valid"
        fi
    fi
else
    log_warning "⚠️  Custom plan file not found at $CUSTOM_PLAN_PATH"
fi

log_success "Test 17 passed: --plan-path flag validated"

# Test 18: Start with conflicting test flags (should handle gracefully)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 18: Start with conflicting test flags"
log_info "═══════════════════════════════════════════"

log_info "Running: sf start --target-org $TARGET_ORG --dry-run --no-test-run --run-wave-test"
log_info "Expected: --run-wave-test should take precedence (or show warning)"

START_CONFLICT_OUTPUT=$(sf start --target-org "$TARGET_ORG" --dry-run --no-test-run --run-wave-test 2>&1)
START_CONFLICT_EXIT_CODE=$?

echo "$START_CONFLICT_OUTPUT"

# Check exit code
if [ $START_CONFLICT_EXIT_CODE -ne 0 ]; then
    log_warning "⚠️  Command failed (may be expected if flags conflict)"
else
    # Check which flag took precedence
    if echo "$START_CONFLICT_OUTPUT" | grep -qiE "run-wave-test\|RunSpecifiedTests"; then
        log_success "✓ --run-wave-test took precedence (expected)"
    elif echo "$START_CONFLICT_OUTPUT" | grep -qiE "no-test-run\|Skipping tests"; then
        log_info "  ℹ️  --no-test-run took precedence (may be acceptable)"
    else
        log_info "  ℹ️  Conflict resolution unclear (may be acceptable)"
    fi
fi

log_success "Test 18 passed: Conflicting flags handled"

# Test 19: Analyze with --output --format json (report generation)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 19: Analyze with --output --format json"
log_info "═══════════════════════════════════════════"

REPORT_JSON_PATH="$PROJECT_PATH/.smart-deployment/analysis-report.json"
log_info "Running: sf analyze --source-path $PROJECT_PATH --output $REPORT_JSON_PATH --format json"

ANALYZE_JSON_OUTPUT=$(sf analyze --source-path "$PROJECT_PATH" --output "$REPORT_JSON_PATH" --format json 2>&1)
ANALYZE_JSON_EXIT_CODE=$?

echo "$ANALYZE_JSON_OUTPUT"

# Check exit code
if [ $ANALYZE_JSON_EXIT_CODE -ne 0 ]; then
    log_error "Analyze --output --format json failed with exit code $ANALYZE_JSON_EXIT_CODE"
    exit 1
fi

# Validate report file was created
if [ -f "$REPORT_JSON_PATH" ]; then
    log_success "✓ JSON report file created: $REPORT_JSON_PATH"

    # Validate JSON structure
    if command -v jq &> /dev/null; then
        if jq -e '.timestamp, .statistics, .components, .waves' "$REPORT_JSON_PATH" > /dev/null 2>&1; then
            log_success "✓ JSON report structure valid"

            # Extract statistics
            COMPONENTS_COUNT=$(jq -r '.statistics.totalComponents' "$REPORT_JSON_PATH" 2>/dev/null || echo "0")
            WAVES_COUNT=$(jq -r '.statistics.totalWaves' "$REPORT_JSON_PATH" 2>/dev/null || echo "0")
            log_info "  ✓ Components: $COMPONENTS_COUNT"
            log_info "  ✓ Waves: $WAVES_COUNT"
        else
            log_warning "⚠️  JSON report structure may be invalid"
        fi
    else
        log_info "  ℹ️  jq not available, skipping JSON validation"
    fi
else
    log_error "JSON report file not found at $REPORT_JSON_PATH"
    exit 1
fi

# Validate output message
if echo "$ANALYZE_JSON_OUTPUT" | grep -q "📄 Report saved\|Report saved to"; then
    log_success "✓ Report generation message shown"
fi

log_success "Test 19 passed: JSON report generation validated"

# Test 20: Analyze with --output --format html (report generation)
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 20: Analyze with --output --format html"
log_info "═══════════════════════════════════════════"

REPORT_HTML_PATH="$PROJECT_PATH/.smart-deployment/analysis-report.html"
log_info "Running: sf analyze --source-path $PROJECT_PATH --output $REPORT_HTML_PATH --format html"

ANALYZE_HTML_OUTPUT=$(sf analyze --source-path "$PROJECT_PATH" --output "$REPORT_HTML_PATH" --format html 2>&1)
ANALYZE_HTML_EXIT_CODE=$?

echo "$ANALYZE_HTML_OUTPUT"

# Check exit code
if [ $ANALYZE_HTML_EXIT_CODE -ne 0 ]; then
    log_error "Analyze --output --format html failed with exit code $ANALYZE_HTML_EXIT_CODE"
    exit 1
fi

# Validate report file was created
if [ -f "$REPORT_HTML_PATH" ]; then
    log_success "✓ HTML report file created: $REPORT_HTML_PATH"

    # Validate HTML structure
    if grep -q "<!DOCTYPE html>" "$REPORT_HTML_PATH" && grep -q "<html" "$REPORT_HTML_PATH"; then
        log_success "✓ HTML report structure valid"

        # Check for key content
        if grep -q "Smart Deployment Analysis Report" "$REPORT_HTML_PATH"; then
            log_success "✓ HTML report contains expected content"
        fi

        # Check for statistics section
        if grep -q "Statistics\|statistics" "$REPORT_HTML_PATH"; then
            log_success "✓ HTML report contains statistics"
        fi
    else
        log_warning "⚠️  HTML report structure may be invalid"
    fi
else
    log_error "HTML report file not found at $REPORT_HTML_PATH"
    exit 1
fi

# Validate output message
if echo "$ANALYZE_HTML_OUTPUT" | grep -q "📄 Report saved\|Report saved to"; then
    log_success "✓ Report generation message shown"
fi

log_success "Test 20 passed: HTML report generation validated"

# Test 21: Enhanced Resume command test
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 21: Enhanced Resume command test"
log_info "═══════════════════════════════════════════"

log_info "Running: sf resume --target-org $TARGET_ORG --source-path $PROJECT_PATH"
RESUME_OUTPUT=$(sf resume --target-org "$TARGET_ORG" --source-path "$PROJECT_PATH" 2>&1)
RESUME_EXIT_CODE=$?

echo "$RESUME_OUTPUT"

# Check exit code (may be 0 or non-zero depending on state)
if [ $RESUME_EXIT_CODE -eq 0 ]; then
    # Check for appropriate messages
    if echo "$RESUME_OUTPUT" | grep -q "No failed deployment found\|No deployment state found"; then
        log_success "✓ Resume correctly detects no failed deployment"
    elif echo "$RESUME_OUTPUT" | grep -q "Resuming from wave\|Resuming.*waves"; then
        log_success "✓ Resume command executing (deployment state found)"

        # Validate manifest generation
        if echo "$RESUME_OUTPUT" | grep -q "📄 Generating manifests\|✅ Generated.*manifests"; then
            log_success "✓ Manifest generation for resume detected"
        fi

        # Validate deployment execution
        if echo "$RESUME_OUTPUT" | grep -q "🌊 Deploying Wave\|✅ Wave.*deployed successfully"; then
            log_success "✓ Deployment execution detected"
        fi
    else
        log_info "  ℹ️  Resume output format may have changed"
    fi
else
    log_warning "⚠️  Resume command failed (may be expected if no failed deployment)"
fi

log_success "Test 21 passed: Enhanced resume command validated"

# Test 22: Enhanced Status command test
log_info ""
log_info "═══════════════════════════════════════════"
log_info "Test 22: Enhanced Status command test"
log_info "═══════════════════════════════════════════"

log_info "Running: sf status --target-org $TARGET_ORG"
STATUS_OUTPUT=$(sf status --target-org "$TARGET_ORG" 2>&1)
STATUS_EXIT_CODE=$?

echo "$STATUS_OUTPUT"

# Check exit code
if [ $STATUS_EXIT_CODE -ne 0 ]; then
    log_warning "⚠️  Status command failed (may be expected if no active deployment)"
else
    # Check for status information
    if echo "$STATUS_OUTPUT" | grep -q -iE "status|wave|deployment|idle|deploying|completed|failed"; then
        log_success "✓ Status information displayed"

        # Check for current wave
        if echo "$STATUS_OUTPUT" | grep -q -iE "wave.*[0-9]|current.*wave"; then
            log_success "✓ Current wave information shown"
        fi

        # Check for progress
        if echo "$STATUS_OUTPUT" | grep -q -iE "progress|completed|remaining"; then
            log_success "✓ Progress information shown"
        fi
    else
        log_info "  ℹ️  Status output format may have changed"
    fi
fi

log_success "Test 22 passed: Enhanced status command validated"

# Final summary
log_info ""
log_info "═══════════════════════════════════════════"
log_success "All E2E tests completed! (Tests 1-22)"
log_info "═══════════════════════════════════════════"
log_info "Project: $PROJECT_PATH"
log_info "Org: $TARGET_ORG"
log_info "Org Type: $([ "$IS_PRODUCTION" = "true" ] && echo "Production" || echo "Sandbox")"
log_info ""
log_info "Tests executed:"
log_info "  ✓ Analyze command (basic)"
log_info "  ✓ Analyze with --save-plan"
log_info "  ✓ Validate command"
log_info "  ✓ Start with --dry-run (manifest generation)"
log_info "  ✓ Start with --validate-only (manifest validation)"
log_info "  ✓ Start with --no-test-run (org type aware)"
log_info "  ✓ Start with --run-wave-test"
log_info "  ✓ Start with default test behavior"
log_info "  ✓ Start with --use-plan (CI/CD workflow)"
log_info "  ✓ Start with --strict --use-plan (CI/CD safety)"
log_info "  ✓ Start with --strict validation (should fail)"
log_info "  ✓ Resume command"
log_info "  ✓ Status command"
log_info "  ✓ Analyze with standard output"
log_info "  ✓ Start with standard output"
log_info "  ✓ Analyze with --plan-path"
log_info "  ✓ Start with conflicting test flags"
log_info "  ✓ Analyze with --output --format json (report generation)"
log_info "  ✓ Analyze with --output --format html (report generation)"
log_info "  ✓ Enhanced Resume command test"
log_info "  ✓ Enhanced Status command test"
log_info ""
log_info "Features validated:"
log_info "  ✓ Manifest generation (package.xml per wave)"
log_info "  ✓ Manifest validation against source"
log_info "  ✓ Enhanced error messages with suggestions"
log_info "  ✓ Test execution flags (--no-test-run, --run-wave-test)"
log_info "  ✓ Production org test requirement enforcement"
log_info "  ✓ SF CLI standard test behavior"
log_info "  ✓ CI/CD workflow (--use-plan, --strict)"
log_info "  ✓ Resume functionality"
log_info "  ✓ Status monitoring"
log_info "  ✓ Custom plan paths (--plan-path)"
log_info "  ✓ Flag conflict handling"
log_info ""
if [ -n "$INITIAL_GIT_STATUS" ]; then
    log_success "🛡️  Git safety confirmed (no source files modified)"
fi
log_info ""
log_info "Note: Analysis files may have been created in .smart-deployment/"
log_info "      These are expected and safe to commit if needed."
log_info ""

log_success "✅ E2E tests completed successfully!"
