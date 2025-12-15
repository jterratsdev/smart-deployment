# CI/CD Optimization Strategy

## Current State

During the initial phases of the project (Phase 1-2), GitHub Actions workflows have been optimized to **minimize CI minute consumption** while developing only types, constants, and base interfaces.

## Simplified Workflows

### 1. `test.yml` - Tests on Push

**Active**: Only unit tests
**Commented**: NUTs (Salesforce integration tests on Ubuntu + Windows)

**Reason**: In this phase there are only types and constants, no real Salesforce logic that requires integration tests.

**Re-enable when**:

- First parser is implemented (Issue #13+) ✅ **COMPLETED**
- Dependency analysis logic is implemented (Issue #28+) ✅ **COMPLETED**
- Real deployment is implemented (Issue #85+) ✅ **COMPLETED**

### 2. `acceptance-criteria-validation.yml` - AC Validation in PRs

**Active**: Only unit tests
**Commented**: Integration tests, E2E tests, NUTs

**Reason**: The `test:integration`, `test:e2e` scripts do not exist yet and there is no functionality that requires these testing levels.

**Re-enable when**:

- Integration tests: Phase 3 (Dependencies) - Issue #28+
- E2E tests: Phase 5 (CLI Commands) - Issue #46+
- NUTs: Phase 6 (Deployment) - Issue #85+

## Removed Tests (Placeholders)

The following files were removed because they were empty placeholders that caused linting errors:

### Removed Unit Tests

- `test/unit/utils/functional.test.ts` → **Recreate in Issue #1** (Functional Utils)
- `test/unit/utils/functional.error.test.ts` → **Recreate in Issue #1** (Error Handling)
- `test/unit/parsers/apex-parser.test.ts` → **Recreate in Issue #13** (Apex Parser)

### Removed E2E Tests

- `test/e2e/features/deployment.feature` → **Recreate in Issue #61** (E2E Testing)
- `test/e2e/features/error-handling.feature` → **Recreate in Issue #62** (Error Scenarios)

## Recreation Strategy (TDD)

Each test will be recreated **BEFORE** implementing its corresponding functionality, following **Test-Driven Development**:

1. **Write the test** (must fail)
2. **Implement the minimum functionality** to pass
3. **Refactor** if necessary
4. **Add `@ac` annotations** to link with acceptance criteria

### TDD Workflow Example

```bash
# 1. Create branch for Issue #13 (Apex Parser)
git checkout -b feat/13-apex-parser

# 2. Crear test PRIMERO (TDD)
touch test/unit/parsers/apex-parser.test.ts
# Escribir tests con @ac annotations

# 3. Ejecutar test (debe FALLAR)
yarn test

# 4. Implementar funcionalidad
touch src/parsers/apex-parser.ts
# Escribir código mínimo

# 5. Ejecutar test (debe PASAR)
yarn test

# 6. Commit y PR
git add -A
git commit -m "feat: implement Apex parser (Issue #13)"
git push
```

## Timeline de Rehabilitación

### Phase 1 (Current) - Foundation

- ✅ Solo unit tests básicos
- ❌ No NUTs, no integration, no E2E

### Phase 2 (Issues #13-27) - Parsers

- ✅ Unit tests para parsers
- ⚠️ Considerar habilitar integration tests si se necesita org real
- ❌ No E2E todavía

### Phase 3 (Issues #28-37) - Dependencies

- ✅ Unit tests + Integration tests
- ⚠️ Considerar habilitar NUTs light
- ❌ No E2E todavía

### Phase 4-5 (Issues #38-53) - Waves & CLI

- ✅ Unit tests + Integration tests + E2E tests
- ⚠️ Habilitar NUTs parcialmente
- ✅ E2E con Cucumber/Gherkin

### Phase 6 (Issues #85-90) - Deployment

- ✅ ALL tests enabled (unit, integration, E2E, NUTs)
- ✅ Full CI/CD matrix (Ubuntu + Windows)
- ✅ Pre-release testing completo

## Estimated Minutes Saved

### Current Configuration (Simplified)

- Push to branch: ~5 mins (only unit tests)
- PR to main: ~5 mins (only unit tests + AC validation)
- **Total per complete PR**: ~10 mins

### Full Configuration

- Push to branch: ~25 mins (unit + NUTs on 2 OS)
- PR to main: ~40 mins (unit + integration + E2E + NUTs)
- **Total per complete PR**: ~65 mins

### Savings during initial development

- **Estimated 11 PRs in Phase 1**: 11 × 55 mins = **605 minutes saved** (~10 hours)
- **Estimated 15 PRs in Phase 2**: 15 × 55 mins = **825 minutes saved** (~14 hours)

## Commands to Re-enable

### Step 1: Uncomment in `test.yml`

```yaml
nuts:
  needs: unit-tests
  uses: salesforcecli/github-workflows/.github/workflows/nut.yml@main
  # ... rest of config
```

### Step 2: Uncomment in `acceptance-criteria-validation.yml`

```yaml
- name: Run integration tests
  id: integration-tests
  run: |
    yarn test:integration --json --outputFile=test-results-integration.json || true
  continue-on-error: true
# ... rest of tests
```

### Step 3: Add scripts in `package.json` (when they exist)

```json
{
  "scripts": {
    "test:integration": "mocha 'test/integration/**/*.test.ts'",
    "test:e2e": "cucumber-js test/e2e/features",
    "test:nuts": "nyc mocha '**/*.nut.ts' --slow 4500 --timeout 600000"
  }
}
```

## Notas

- ⚠️ No eliminar los comentarios de los workflows hasta que se rehabiliten
- ⚠️ Actualizar este documento cuando se habilite cada nivel de testing
- ⚠️ Monitorear límites de GitHub Actions minutes si se excede el plan free
- ✅ Considerar usar `workflow_dispatch` para tests pesados (trigger manual)

## Referencias

- GitHub Actions Usage Limits: https://docs.github.com/en/billing/managing-billing-for-github-actions/about-billing-for-github-actions
- Salesforce CLI Workflows: https://github.com/salesforcecli/github-workflows
- TDD Best Practices: `docs/methodology/TESTING_STRATEGY.md`
