# Insights del Analizador Python - Aplicación a Simplificación

**Last Updated**: December 15, 2025

Análisis de la lógica del analizador Python (`sf_dependency_analyzer.py`) y cómo puede ayudar con la implementación de simplificación de metadata.

---

## Archivo Analizado

**Ruta**: `~/dev/grg-ss-agentforce/scripts/python/sf_dependency_analyzer.py`
**Líneas**: 3610
**Última modificación**: December 14, 2025

---

## Lógica Relevante Encontrada

### 1. Detección de Dependencias en Permission Sets

**Ubicación**: `_analyze_permission_sets()` (líneas 727-772)

**Lógica**:
```python
# Buscar accesos a Apex classes
for apex in root.findall('.//sf:apexClass', ns):
    apex_name = apex.text
    if apex_name:
        self._add_dependency('PermissionSet', ps_name, 'ApexClass', apex_name)

# Buscar accesos a Flows
for flow in root.findall('.//sf:flow', ns):
    flow_name = flow.text
    if flow_name:
        self._add_dependency('PermissionSet', ps_name, 'Flow', flow_name)

# Buscar accesos a Custom Objects
for obj in root.findall('.//sf:object', ns):
    obj_name = obj.text
    if obj_name and obj_name.endswith('__c'):
        self._add_dependency('PermissionSet', ps_name, 'CustomObject', obj_name)
```

**Aplicación**: Esta lógica confirma que nuestra detección de dependencias en `permission-set-parser.ts` es correcta. Podemos usar los mismos selectores XPath para simplificar.

---

### 2. Detección de Dependencias en FlexiPages

**Ubicación**: `_analyze_flexipages()` (líneas 2036-2100)

**Lógica**:
```python
# 1. DETECTAR LWC (Lightning Web Components)
for lwc_component in root.findall('.//sf:componentInstance/sf:componentName', ns):
    component_name = lwc_component.text
    if component_name and ':' in component_name:
        namespace, comp_name = component_name.split(':', 1)
        if namespace == 'c':
            self._add_dependency('FlexiPage', page_name, 'LightningComponentBundle', comp_name)

# 2. DETECTAR FLOWS EMBEBIDOS
for instance in root.findall('.//sf:componentInstance', ns):
    comp_name = instance.find('sf:componentName', ns)
    if comp_name is not None and comp_name.text == 'flowruntime:interview':
        # Buscar el nombre del flow en los parámetros
        for param in instance.findall('.//sf:componentInstanceProperties', ns):
            param_name = param.find('sf:name', ns)
            param_value = param.find('sf:value', ns)
            if param_name is not None and param_value is not None:
                if param_name.text == 'flowName':
                    flow_name = param_value.text
                    if flow_name:
                        self._add_dependency('FlexiPage', page_name, 'Flow', flow_name)
```

**Aplicación**: Esta lógica es más detallada que la nuestra. Podemos mejorar `flexipage-parser.ts` para detectar flows embebidos de la misma manera.

---

### 3. Post-Procesamiento de Waves

**Ubicación**: `generate_deployment_order()` y funciones `_sync_*` y `_merge_*`

**Funciones de Post-Procesamiento Encontradas**:

1. `_merge_test_classes_with_production()` - Mueve Test Classes a la misma wave que Production Classes
2. `_merge_triggers_with_handlers()` - Mueve Triggers con Handlers
3. `_sync_services_with_tests()` - Sincroniza Services con Tests
4. `_merge_test_classes_with_triggers()` - Mueve Test Classes con Triggers
5. `_sync_production_with_moved_tests()` - Sincroniza Production Classes con Tests movidos
6. `_sync_fields_with_objects()` - Sincroniza Fields con Objects
7. **`_sync_psg_with_permission_sets()`** - Mueve Permission Set Groups después de Permission Sets
8. **`_sync_flows_with_apex_actions()`** - Mueve Flows a la misma wave que Apex Actions
9. `_split_large_waves()` - Divide waves grandes (>300 componentes)

#### a) Mover Test Classes con Production Classes
```python
def _merge_test_classes_with_production(self, waves: List[List[str]]) -> List[List[str]]:
    """
    Mueve Test Classes Apex a la misma ola que su Production Class principal.
    Esto garantiza que cuando se ejecutan los tests, ya tengan el código actualizado.
    """
```

**Aplicación**: Esta lógica asegura que los tests se ejecuten contra el código correcto. Podemos aplicar un concepto similar: **mover componentes simplificados a waves donde sus dependencias están disponibles**.

#### b) Dividir Waves Grandes
```python
# POST-PROCESAMIENTO 4: Dividir waves grandes (>300 componentes) para evitar UNKNOWN_EXCEPTION
deployment_waves = self._split_large_waves(deployment_waves, max_components=300)
```

**Aplicación**: Podemos usar esta lógica para evitar waves demasiado grandes que puedan causar problemas.

#### c) Sincronizar Permission Set Groups con Permission Sets

**Ubicación**: `_sync_psg_with_permission_sets()` (líneas 2794-2865)

**Lógica**:
```python
def _sync_psg_with_permission_sets(self, waves: List[List[str]]) -> List[List[str]]:
    """
    Mueve Permission Set Groups a la wave DESPUÉS de la wave más tardía de sus Permission Sets.
    Un PSG no se puede instalar sin que TODOS sus PS estén desplegados primero.
    """
    # Encontrar la wave más tardía donde están los Permission Sets
    max_ps_wave = max(ps_wave for _, ps_wave in ps_waves)

    # El PSG debe estar en la wave DESPUÉS de la más tardía de sus PS
    target_wave = max_ps_wave + 1
```

**Aplicación**: Esta lógica es **crítica** para nuestro escenario. Los PSG deben deployarse después de todos sus PS. Esto evita tener que simplificar PSG.

#### d) Sincronizar Flows con Apex Actions

**Ubicación**: `_sync_flows_with_apex_actions()` (líneas 2937-3002)

**Lógica**:
```python
def _sync_flows_with_apex_actions(self, waves: List[List[str]]) -> List[List[str]]:
    """
    Mueve Flows a la misma wave que sus Apex Actions críticas.
    Los Flows que usan Apex Actions deben estar en la misma wave o después para evitar errores.
    """
    # Encontrar la wave más tardía donde están las clases Apex
    max_apex_wave = max(apex_wave for _, apex_wave in apex_deps)

    # El Flow debe estar en la misma wave que sus Apex Actions críticas
    target_wave = max_apex_wave
```

**Aplicación**: Esta lógica asegura que Flows se deployen con sus Apex Actions, evitando errores de referencias faltantes.

---

## Mejoras Propuestas para Nuestra Implementación

### 1. Mejorar Detección de Flows en FlexiPages

**Actual** (`flexipage-parser.ts`):
- Detecta `flowruntime:interview` pero no extrae el nombre del flow

**Mejora Propuesta**:
```typescript
// En flexipage-parser.ts
function extractFlows(regions: FlexiPageRegion[]): string[] {
  const flows: string[] = [];

  for (const region of regions) {
    for (const instance of region.componentInstances || []) {
      // Detectar flowruntime:interview
      if (instance.componentName === 'flowruntime:interview') {
        // Buscar parámetro flowName
        const flowNameProp = instance.componentInstanceProperties?.find(
          (prop) => prop.name === 'flowName'
        );
        if (flowNameProp?.value) {
          flows.push(flowNameProp.value);
        }
      }
    }
  }

  return flows;
}
```

---

### 2. Aplicar Lógica de Post-Procesamiento (ALTA PRIORIDAD)

**Concepto**: En lugar de simplificar preventivamente, podemos usar post-procesamiento para:

1. **Detectar componentes con dependencias en waves futuros**
2. **Moverlos a waves donde sus dependencias están disponibles** (si es posible)
3. **Solo simplificar si mover no es posible**

**Funciones Críticas a Implementar**:

#### a) Sincronizar Permission Set Groups
```typescript
class WavePostProcessor {
  /**
   * Mueve Permission Set Groups a la wave DESPUÉS de la wave más tardía de sus Permission Sets
   * Similar a _sync_psg_with_permission_sets() del Python
   */
  syncPSGWithPermissionSets(waves: Wave[]): Wave[] {
    const componentWaveMap = new Map<NodeId, number>();

    // Crear mapa de dónde está cada componente
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    // Buscar PSG y moverlos
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      const psgsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of wave.components) {
        const component = componentMap.get(nodeId);
        if (component?.type !== 'PermissionSetGroup') continue;

        // Buscar todos sus Permission Sets
        const psWaves: number[] = [];
        for (const dep of component.dependencies) {
          const depComponent = componentMap.get(dep);
          if (depComponent?.type === 'PermissionSet') {
            const psWave = componentWaveMap.get(dep);
            if (psWave !== undefined) {
              psWaves.push(psWave);
            }
          }
        }

        if (psWaves.length > 0) {
          // Encontrar la wave más tardía
          const maxPSWave = Math.max(...psWaves);

          // PSG debe estar DESPUÉS de la wave más tardía
          const targetWave = maxPSWave + 1;

          if (waveIdx <= maxPSWave) {
            psgsToMove.push({ nodeId, targetWave });
          }
        }
      }

      // Aplicar movimientos
      for (const { nodeId, targetWave } of psgsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        while (targetWave >= waves.length) {
          waves.push({ number: waves.length + 1, components: [], metadata: /* ... */ });
        }
        waves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
      }
    }

    return waves.filter((wave) => wave.components.length > 0);
  }
}
```

#### b) Sincronizar Flows con Apex Actions
```typescript
/**
 * Mueve Flows a la misma wave que sus Apex Actions críticas
 * Similar a _sync_flows_with_apex_actions() del Python
 */
syncFlowsWithApexActions(waves: Wave[]): Wave[] {
  // Similar lógica pero para Flows → ApexClass
  // Mover Flow a la wave de su Apex Action más tardía
}
```

#### c) Sincronizar FlexiPages con LWC/Flow
```typescript
/**
 * Mueve FlexiPages a la wave DESPUÉS de sus LWC y Flow más tardíos
 * Similar lógica a PSG pero para FlexiPages
 */
syncFlexiPagesWithDependencies(waves: Wave[]): Wave[] {
  // Mover FlexiPage a la wave después de sus LWC/Flow más tardíos
}
```

**Implementación Propuesta**:
```typescript
class WavePostProcessor {
  /**
   * Mueve componentes a waves donde sus dependencias están disponibles
   */
  moveComponentsToDependencyWaves(waves: Wave[]): Wave[] {
    const componentWaveMap = new Map<NodeId, number>();

    // Crear mapa de dónde está cada componente
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    // Buscar componentes con dependencias en waves futuros
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      const componentsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of wave.components) {
        const component = componentMap.get(nodeId);
        if (!component) continue;

        // Verificar si tiene dependencias en waves futuros
        for (const dep of component.dependencies) {
          const depWaveIdx = componentWaveMap.get(dep);
          if (depWaveIdx !== undefined && depWaveIdx > waveIdx) {
            // Mover componente a la wave de su dependencia más tardía
            const latestDepWave = Math.max(
              ...Array.from(component.dependencies)
                .map((d) => componentWaveMap.get(d) ?? -1)
                .filter((w) => w > waveIdx)
            );

            if (latestDepWave > waveIdx) {
              componentsToMove.push({ nodeId, targetWave: latestDepWave });
            }
          }
        }
      }

      // Aplicar movimientos
      for (const { nodeId, targetWave } of componentsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        if (targetWave < waves.length) {
          waves[targetWave].components.push(nodeId);
          componentWaveMap.set(nodeId, targetWave);
        }
      }
    }

    return waves.filter((wave) => wave.components.length > 0);
  }
}
```

---

### 3. Dividir Waves Grandes

**Implementación Propuesta**:
```typescript
class WaveSplitter {
  /**
   * Divide waves grandes para evitar UNKNOWN_EXCEPTION
   */
  splitLargeWaves(waves: Wave[], maxComponents: number = 300): Wave[] {
    const splitWaves: Wave[] = [];
    let waveNumber = 1;

    for (const wave of waves) {
      if (wave.components.length <= maxComponents) {
        splitWaves.push({ ...wave, number: waveNumber++ });
      } else {
        // Dividir wave en múltiples waves
        for (let i = 0; i < wave.components.length; i += maxComponents) {
          const chunk = wave.components.slice(i, i + maxComponents);
          splitWaves.push({
            number: waveNumber++,
            components: chunk,
            metadata: this.generateWaveMetadata(chunk),
          });
        }
      }
    }

    return splitWaves;
  }
}
```

---

## Estrategia Combinada

### Flujo Propuesto

```
1. Generar waves iniciales (topological sort)
   ↓
2. Post-procesar waves:
   - Mover componentes a waves donde dependencias están disponibles
   - Dividir waves grandes
   ↓
3. Intentar deployment con waves post-procesadas
   ↓
4. Si falla con referencias faltantes:
   - Simplificar metadata (fallback)
   - Reintentar
   ↓
5. En waves posteriores:
   - Actualizar archivos simplificados con nuevas referencias
```

---

## Ventajas de Esta Estrategia

1. ✅ **Menos Simplificación**: Mover componentes reduce la necesidad de simplificar
2. ✅ **Mejor Orden**: Waves más lógicos basados en dependencias reales
3. ✅ **Menos Archivos Temporales**: Solo simplificar cuando es absolutamente necesario
4. ✅ **Mejor Performance**: Waves más pequeños y mejor organizados

---

## Implementación Priorizada

### Fase 1: Mejorar Detección (Alta Prioridad)
- ✅ Mejorar detección de flows en FlexiPages
- ✅ Validar detección de dependencias en Permission Sets

### Fase 2: Post-Procesamiento (Media Prioridad)
- ⏳ Implementar `WavePostProcessor` para mover componentes
- ⏳ Implementar `WaveSplitter` para dividir waves grandes

### Fase 3: Simplificación como Fallback (Ya Implementado)
- ✅ `MetadataSimplifier` ya implementado
- ⏳ Integrar con flujo de deployment

---

## Referencias

- [Metadata Simplification Fallback](./METADATA_SIMPLIFICATION_FALLBACK.md)
- [Wave Generation Complex Dependencies](./WAVE_GENERATION_COMPLEX_DEPENDENCIES.md)
- Python Analyzer: `sf_dependency_analyzer.py` (líneas 727-2224)

