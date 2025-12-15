# Wave Integrity Guarantees

**Last Updated**: December 15, 2025

Este documento explica cómo el sistema garantiza que los waves siempre tengan una estructura correcta, independientemente de la estructura del proyecto.

---

## Garantías del Sistema

### 1. **Detección Completa de Dependencias**

El sistema utiliza múltiples estrategias para detectar todas las dependencias:

- **Parsers Específicos**: Cada tipo de metadata tiene un parser especializado que extrae dependencias del XML/metadata
- **Análisis Estático**: Análisis de código fuente (Apex, LWC, Flows) para detectar referencias
- **AI Inference**: Usa Agentforce para inferir dependencias adicionales basadas en patrones
- **Heurísticas**: Patrones de nombres, convenciones de Salesforce, etc.

**Ejemplo**:
```typescript
// FlexiPage parser detecta:
- LWC components (c:componentName)
- Flows (flowruntime:interview)
- Apex Actions
- Visualforce Pages
- Custom Objects (sobjectType)
```

### 2. **Post-Procesamiento Multi-Capa**

El sistema aplica múltiples capas de post-procesamiento en orden específico:

1. **Sync Permission Set Groups** → Después de Permission Sets
2. **Sync Flows** → Después de Apex Actions
3. **Sync Custom Metadata Records** → Después de Custom Metadata Types
4. **Sync Test Classes** → Con las clases que cubren
5. **Sync Apex Classes** → Con sus dependents
6. **Sync Visualforce Pages** → Con componentes que las referencian
7. **Sync Custom Objects** → Después de FlexiPages que referencian
8. **Resolve Dependency Conflicts** → Genéricamente para todos los tipos
9. **Sync FlexiPages** → **DESPUÉS** de resolver conflictos (garantiza orden correcto)

**Orden Crítico**: El orden de ejecución es crucial. Por ejemplo, `syncFlexiPagesWithDependencies` debe ejecutarse DESPUÉS de `resolveDependencyConflicts` para asegurar que todas las dependencias están posicionadas correctamente.

### 3. **Resolución de Conflictos Genérica**

Cuando hay conflictos de dependencias (componente necesita estar antes por algunas dependencias pero después por otras):

- **Intenta mover dependencias antes** cuando es posible
- **Marca componentes para simplificación preventiva** cuando no se puede resolver
- **Aplica a cualquier tipo de metadata**, no solo tipos específicos

### 4. **Validación de Integridad Pre-Deployment**

Antes de desplegar, el sistema valida:

- ✅ Todas las dependencias están disponibles antes de los componentes que las necesitan
- ✅ No hay dependencias circulares dentro de un wave
- ✅ Componentes están en orden correcto dentro de cada wave
- ✅ Todos los componentes referenciados existen

**Ejemplo de Validación**:
```
Wave 12:
  ❌ FlexiPage:SC_GRG_CaseRecordPage depende de LightningComponentBundle:grgGetStatusVoucher
     pero grgGetStatusVoucher está en Wave 19
```

### 5. **Simplificación Reactiva y Preventiva**

- **Reactiva**: Si un wave falla por referencias faltantes, simplifica automáticamente
- **Preventiva**: Componentes marcados con conflictos no resolubles se simplifican antes del deployment

### 6. **Validación de Manifests**

- Verifica que todos los componentes en manifests existen en el proyecto
- Detecta componentes faltantes en manifests
- Valida estructura XML de manifests

---

## Limitaciones y Cómo se Manejan

### Limitación 1: Dependencias No Detectadas

**Problema**: Si un parser no detecta una dependencia, el componente puede desplegarse antes de su dependencia.

**Solución**:
- Validación de integridad detecta estas situaciones antes del deployment
- Simplificación reactiva maneja casos donde la validación no detecta el problema
- Logging extensivo ayuda a identificar parsers que necesitan mejoras

### Limitación 2: Dependencias Externas

**Problema**: Componentes que dependen de metadata no incluido en el proyecto (packages instalados, metadata estándar).

**Solución**:
- El sistema identifica componentes estándar de Salesforce (siempre disponibles)
- Warnings para dependencias no encontradas (pueden ser externas)
- El usuario puede revisar warnings antes del deployment

### Limitación 3: Orden Dentro del Mismo Wave

**Problema**: Salesforce puede requerir orden específico dentro de un wave.

**Solución**:
- Validación detecta cuando dependencias están en el mismo wave pero en orden incorrecto
- Warnings alertan sobre posibles problemas
- Simplificación puede ayudar en algunos casos

### Limitación 4: Dependencias Circulares

**Problema**: Componentes que dependen circularmente entre sí.

**Solución**:
- Detección de ciclos durante wave generation
- Resolución automática rompiendo ciclos cuando es posible
- Componentes problemáticos se agregan al mismo wave (Salesforce puede manejar algunos casos)

---

## Mejores Prácticas para Garantizar Estructura Correcta

### 1. **Revisar Validación de Integridad**

Siempre revisa el reporte de validación de integridad antes del deployment:

```bash
sf smart-deployment start --target-org myorg --dry-run
```

### 2. **Usar --dry-run Primero**

Ejecuta con `--dry-run` para validar sin desplegar:

```bash
sf smart-deployment start --target-org myorg --dry-run
```

### 3. **Revisar Warnings**

Los warnings indican posibles problemas que pueden resolverse manualmente o requieren atención.

### 4. **Monitorear Logs**

El sistema genera logs extensivos que ayudan a entender por qué los componentes están en ciertos waves.

### 5. **Reportar Problemas**

Si encuentras casos donde el sistema no detecta dependencias correctamente, reporta el problema para mejorar los parsers.

---

## Casos de Uso Específicos

### Caso 1: FlexiPage con LWC

**Garantía**: FlexiPage siempre se despliega después de sus LWC dependencies.

**Implementación**:
- Parser detecta LWC en FlexiPage XML
- `syncFlexiPagesWithDependencies` mueve FlexiPage después del último LWC
- Validación verifica que no hay LWC en waves posteriores

### Caso 2: Custom Object con FlexiPage

**Garantía**: Custom Object se despliega después del FlexiPage que referencia (o en el mismo wave si hay conflictos).

**Implementación**:
- Parser detecta `actionOverrides` con tipo `Flexipage`
- `syncCustomObjectsWithFlexiPages` mueve Custom Object después del FlexiPage
- Si hay conflictos, `resolveDependencyConflicts` intenta mover FlexiPage antes
- Si no se puede resolver, se marca para simplificación preventiva

### Caso 3: Test Classes con Production Classes

**Garantía**: Test classes se despliegan en el mismo wave o después de las clases que cubren.

**Implementación**:
- `syncTestClassesWithDirectCoverage` detecta clases cubiertas por nombre y dependencias directas
- Mueve test classes al wave de la clase cubierta
- Considera dependencias bloqueantes antes de mover

---

## Métricas y Monitoreo

El sistema reporta:

- **Total de waves generados**
- **Waves con issues** (errores o warnings)
- **Total de issues** (errores vs warnings)
- **Componentes marcados para simplificación**

Estas métricas ayudan a identificar proyectos con estructuras complejas que pueden necesitar atención manual.

---

## Conclusión

El sistema garantiza una estructura correcta mediante:

1. ✅ **Detección completa** de dependencias (múltiples estrategias)
2. ✅ **Post-procesamiento ordenado** (múltiples capas en orden específico)
3. ✅ **Resolución de conflictos** (genérica para todos los tipos)
4. ✅ **Validación preventiva** (antes del deployment)
5. ✅ **Simplificación reactiva** (cuando falla)
6. ✅ **Logging extensivo** (para debugging y mejoras)

Sin embargo, **ningún sistema es perfecto**. Siempre revisa:
- Reportes de validación de integridad
- Warnings antes del deployment
- Logs para entender decisiones del sistema

Si encuentras casos donde el sistema no garantiza estructura correcta, reporta el problema para mejorar los parsers y la lógica de post-procesamiento.

