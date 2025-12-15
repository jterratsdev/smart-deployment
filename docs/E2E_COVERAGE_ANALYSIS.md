# E2E Test Coverage Analysis

## 📊 Comandos Disponibles

### 1. `analyze`
**Flags:**
- `--source-path` (char: `-p`, default: `.`) ✅ Cubierto
- `--target-org` (char: `-o`) ✅ Cubierto (con --use-ai)
- `--save-plan` ✅ Cubierto
- `--plan-path` ❌ NO cubierto
- `--use-ai` ✅ Cubierto
- `--org-type` ❌ NO cubierto
- `--industry` ❌ NO cubierto
- `--locale` ❌ NO cubierto
- `--output` (char: `-o`) ❌ NO cubierto
- `--format` (default: `json`) ❌ NO cubierto

**Tests actuales:**
- ✅ Test 1: `analyze --source-path .`
- ✅ Test 2: `analyze --source-path . --save-plan`
- ✅ Test 6: `analyze --source-path . --use-ai --target-org`

**Falta cubrir:**
- `analyze --plan-path custom/path.json`
- `analyze --org-type Production`
- `analyze --industry Healthcare`
- `analyze --locale es`
- `analyze --output report.json`
- `analyze --format html`
- Combinaciones: `analyze --use-ai --org-type Production --industry Healthcare`

### 2. `start`
**Flags:**
- `--target-org` (char: `-o`, required) ✅ Cubierto
- `--dry-run` (char: `-d`) ✅ Cubierto
- `--validate-only` (char: `-v`) ✅ Cubierto
- `--skip-tests` (deprecated) ⚠️ Mencionado pero no probado explícitamente
- `--no-test-run` ✅ Cubierto (Test 8)
- `--run-wave-test` ✅ Cubierto (Test 9)
- `--use-ai` ✅ Cubierto (Test 7)
- `--ai-auto` ❌ NO cubierto
- `--ai-confidence-threshold` ❌ NO cubierto
- `--org-type` ❌ NO cubierto
- `--industry` ❌ NO cubierto
- `--use-plan` ❌ NO cubierto
- `--strict` ❌ NO cubierto
- `--locale` ❌ NO cubierto
- `--source-path` (char: `-p`) ❌ NO cubierto

**Tests actuales:**
- ✅ Test 4: `start --target-org X --dry-run`
- ✅ Test 5: `start --target-org X --validate-only`
- ✅ Test 7: `start --target-org X --dry-run --use-ai`
- ✅ Test 8: `start --target-org X --dry-run --no-test-run` (org-aware)
- ✅ Test 9: `start --target-org X --dry-run --run-wave-test`
- ✅ Test 10: `start --target-org X --dry-run` (default)

**Falta cubrir:**
- `start --target-org X --use-plan plan.json`
- `start --target-org X --strict --use-plan plan.json`
- `start --target-org X --dry-run --ai-auto --ai-confidence-threshold 0.9`
- `start --target-org X --dry-run --org-type Production`
- `start --target-org X --dry-run --industry Healthcare`
- `start --target-org X --dry-run --locale es`
- `start --target-org X --dry-run --source-path custom/path`
- Combinaciones conflictivas: `--no-test-run` + `--run-wave-test` (debería fallar o priorizar)
- Combinaciones: `--use-ai` + `--ai-auto` + `--org-type Production`

### 3. `validate`
**Flags:**
- `--target-org` (char: `-o`, required) ✅ Cubierto
- `--source-path` (char: `-p`) ✅ Cubierto
- `--locale` ❌ NO cubierto

**Tests actuales:**
- ✅ Test 3: `validate --target-org X --source-path .`

**Falta cubrir:**
- `validate --target-org X --locale es`

### 4. `resume`
**Flags:**
- `--target-org` (char: `-o`, required) ❌ NO cubierto
- `--source-path` (char: `-p`) ❌ NO cubierto

**Tests actuales:**
- ❌ NINGUNO

**Falta cubrir:**
- `resume --target-org X` (sin deployment fallido - debería mostrar mensaje apropiado)
- `resume --target-org X --source-path .` (con deployment fallido - requeriría setup previo)

### 5. `status`
**Flags:**
- `--target-org` (char: `-o`, required) ❌ NO cubierto
- `--watch` (char: `-w`) ❌ NO cubierto

**Tests actuales:**
- ❌ NINGUNO

**Falta cubrir:**
- `status --target-org X` (sin deployment activo)
- `status --target-org X` (con deployment activo - requeriría setup previo)
- `status --target-org X --watch` (modo watch - difícil de testear en E2E)

### 6. `config`
**Flags:**
- `--set` (char: `-s`) ❌ NO cubierto
- `--get` (char: `-g`) ❌ NO cubierto

**Tests actuales:**
- ❌ NINGUNO

**Falta cubrir:**
- `config --set key=value`
- `config --get key`
- `config --get key` (cuando no existe)

### 7. `hello world`
**Flags:**
- (comando de ejemplo, probablemente no crítico)

## 📈 Resumen de Cobertura

| Comando | Flags Totales | Flags Cubiertos | Cobertura | Tests Actuales |
|---------|---------------|-----------------|-----------|----------------|
| `analyze` | 10 | 3 | 30% | 3 |
| `start` | 15 | 6 | 40% | 6 |
| `validate` | 3 | 2 | 67% | 1 |
| `resume` | 2 | 0 | 0% | 0 |
| `status` | 2 | 0 | 0% | 0 |
| `config` | 2 | 0 | 0% | 0 |
| **TOTAL** | **34** | **11** | **32%** | **10** |

## 🎯 Prioridades para Agregar Tests

### Alta Prioridad (Funcionalidad Crítica)
1. ✅ `start --use-plan` (CI/CD workflow crítico)
2. ✅ `start --strict --use-plan` (CI/CD safety)
3. ✅ `resume` command (resume functionality)
4. ✅ `status` command (monitoring)

### Media Prioridad (Funcionalidad Importante)
5. ✅ `start --ai-auto` (AI automation)
6. ✅ `analyze --plan-path` (custom plan paths)
7. ✅ `analyze --locale` / `start --locale` (i18n)
8. ✅ `config` command (configuration management)

### Baja Prioridad (Nice to Have)
9. ⚠️ `analyze --format html` (output formats)
10. ⚠️ `analyze --industry` (AI context)
11. ⚠️ `start --source-path` (custom paths)
12. ⚠️ Combinaciones de múltiples flags

## 🔍 Combinaciones de Flags Críticas a Probar

### `start` command:
- `--dry-run --use-plan plan.json` ✅ CRÍTICO
- `--strict --use-plan plan.json` ✅ CRÍTICO
- `--use-ai --ai-auto --org-type Production` ⚠️ IMPORTANTE
- `--no-test-run --run-wave-test` (conflicto) ⚠️ IMPORTANTE
- `--dry-run --use-ai --org-type Production --industry Healthcare` ⚠️ NICE TO HAVE

### `analyze` command:
- `--use-ai --target-org X --org-type Production` ⚠️ IMPORTANTE
- `--save-plan --plan-path custom/path.json` ⚠️ IMPORTANTE
- `--use-ai --industry Healthcare --locale es` ⚠️ NICE TO HAVE

## 📝 Notas

- Los tests E2E actuales cubren los casos básicos y más comunes
- Faltan tests para comandos `resume`, `status`, y `config`
- Faltan combinaciones de flags importantes, especialmente para CI/CD (`--use-plan`, `--strict`)
- Algunos flags como `--watch` son difíciles de testear en E2E automatizado
- Los tests de `resume` requieren setup previo (deployment fallido)


