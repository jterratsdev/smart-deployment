# E2E Test Coverage Analysis

## 📊 Comandos Disponibles

### 1. `analyze`

**Flags:**

- `--source-path` (char: `-p`, default: `.`) ✅ Cubierto
- `--save-plan` ✅ Cubierto
- `--plan-path` ❌ NO cubierto
- `--output` (char: `-o`) ❌ NO cubierto
- `--format` (default: `json`) ❌ NO cubierto

**Tests actuales:**

- ✅ Test 1: `analyze --source-path .`
- ✅ Test 2: `analyze --source-path . --save-plan`
- ✅ Test 6: `analyze --source-path . --target-org`

**Falta cubrir:**

- `analyze --plan-path custom/path.json`
- `analyze --output report.json`
- `analyze --format html`

### 2. `start`

**Flags:**

- `--target-org` (char: `-o`, required) ✅ Cubierto
- `--dry-run` (char: `-d`) ✅ Cubierto
- `--validate-only` (char: `-v`) ✅ Cubierto
- `--skip-tests` (deprecated) ⚠️ Mencionado pero no probado explícitamente
- `--no-test-run` ✅ Cubierto (Test 8)
- `--run-wave-test` ✅ Cubierto (Test 9)
- `--use-plan` ❌ NO cubierto
- `--strict` ❌ NO cubierto
- `--source-path` (char: `-p`) ❌ NO cubierto

**Tests actuales:**

- ✅ Test 4: `start --target-org X --dry-run`
- ✅ Test 5: `start --target-org X --validate-only`
- ✅ Test 7: `start --target-org X --dry-run`
- ✅ Test 8: `start --target-org X --dry-run --no-test-run` (org-aware)
- ✅ Test 9: `start --target-org X --dry-run --run-wave-test`
- ✅ Test 10: `start --target-org X --dry-run` (default)

**Falta cubrir:**

- `start --target-org X --use-plan plan.json`
- `start --target-org X --strict --use-plan plan.json`
- `start --target-org X --dry-run --source-path custom/path`
- Combinaciones conflictivas: `--no-test-run` + `--run-wave-test` (debería fallar o priorizar)

### 3. `validate`

**Flags:**

- `--target-org` (char: `-o`, required) ✅ Cubierto
- `--source-path` (char: `-p`) ✅ Cubierto

**Tests actuales:**

- ✅ Test 3: `validate --target-org X --source-path .`

**Falta cubrir:**

### 4. `resume`

**Flags:**

- `--target-org` (char: `-o`, required) ✅ Cubierto
- `--source-path` (char: `-p`) ✅ Cubierto

**Tests actuales:**

- ✅ Test 13: `resume --target-org X` sin deployment fallido
- ✅ Test 21: `resume --target-org X --source-path .`
- ✅ Integración local: estado fallido real, regeneración de manifests y retry transitorio

**Falta cubrir:**

- La frontera real con Salesforce CLI y una org autenticada

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

| Comando    | Flags Totales | Flags Cubiertos | Cobertura | Tests Actuales |
| ---------- | ------------- | --------------- | --------- | -------------- |
| `analyze`  | 6             | 3               | 50%       | 3              |
| `start`    | 11            | 6               | 55%       | 6              |
| `validate` | 3             | 2               | 67%       | 1              |
| `resume`   | 2             | 2               | 100%      | 2              |
| `status`   | 2             | 0               | 0%        | 0              |
| `config`   | 2             | 0               | 0%        | 0              |
| **TOTAL**  | **28**        | **13**          | **46%**   | **12**         |

## 🎯 Prioridades para Agregar Tests

### Alta Prioridad (Funcionalidad Crítica)

1. ✅ `start --use-plan` (CI/CD workflow crítico)
2. ✅ `start --strict --use-plan` (CI/CD safety)
3. ✅ `resume` command (resume functionality)
4. ✅ `status` command (monitoring)

### Media Prioridad (Funcionalidad Importante)

6. ✅ `analyze --plan-path` (custom plan paths)
7. ✅ `config` command (configuration management)

### Baja Prioridad (Nice to Have)

8. ⚠️ `analyze --format html` (output formats)
9. ⚠️ `start --source-path` (custom paths)
10. ⚠️ Combinaciones de múltiples flags

## 🔍 Combinaciones de Flags Críticas a Probar

### `start` command:

- `--dry-run --use-plan plan.json` ✅ CRÍTICO
- `--strict --use-plan plan.json` ✅ CRÍTICO
- `--no-test-run --run-wave-test` (conflicto) ⚠️ IMPORTANTE

### `analyze` command:

- `--save-plan --plan-path custom/path.json` ⚠️ IMPORTANTE

## 📝 Notas

- Los tests E2E actuales cubren los casos básicos y más comunes
- Faltan tests para comandos `status` y `config`; `resume` ya tiene integración local con estado fallido real
- Faltan combinaciones de flags importantes, especialmente para CI/CD (`--use-plan`, `--strict`)
- Algunos flags como `--watch` son difíciles de testear en E2E automatizado
- El happy path, la ausencia de estado y la reanudación local desde un fallo real están cubiertos
