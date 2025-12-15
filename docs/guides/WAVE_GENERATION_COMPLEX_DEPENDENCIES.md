# Wave Generation con Dependencias Complejas

**Last Updated**: December 15, 2025

Análisis del comportamiento del sistema de wave generation en escenarios complejos con múltiples tipos de metadata interconectados.

---

## Escenario de Ejemplo

Consideremos el siguiente escenario de deployment:

```
CustomObject (Account__c)
    ↓
Layout (Account__c-Account Layout)
    ↓
FlexiPage (Account_Record_Page)
    ├─→ LWC (accountSummary) ──→ Apex (AccountService)
    └─→ Flow (Account_Flow) ────→ Apex (AccountService)
    ↓
PermissionSetGroup (Sales_PSG)
    └─→ PermissionSet (Sales_PS)
        ├─→ CustomObject (Account__c)
        ├─→ ApexClass (AccountService)
        └─→ Flow (Account_Flow)
```

---

## Comportamiento Actual del Sistema

### 1. Detección de Dependencias

El sistema detecta correctamente todas las dependencias:

- **FlexiPage → LWC**: Detectado por `flexipage-parser.ts` (componentInstance)
- **FlexiPage → Flow**: Detectado por `flexipage-parser.ts` (flowruntime:interview)
- **LWC → Apex**: Detectado por `lwc-parser.ts` (import statements)
- **Flow → Apex**: Detectado por `flow-parser.ts` (apex_action)
- **PermissionSet → CustomObject**: Detectado por `permission-set-parser.ts` (objectPermissions)
- **PermissionSet → ApexClass**: Detectado por `permission-set-parser.ts` (apexClassAccesses)
- **PermissionSet → Flow**: Detectado por `permission-set-parser.ts` (flowAccesses)

### 2. Orden de Deployment (TYPE_DEPLOYMENT_ORDER)

El sistema respeta el siguiente orden:

```typescript
const TYPE_DEPLOYMENT_ORDER = [
  'CustomObject',      // Wave 1
  'Layout',           // Wave 2
  'PermissionSet',    // Wave 3 (antes de Apex/Flow)
  'ApexClass',        // Wave 4
  'Flow',             // Wave 5
  'FlexiPage',        // Wave 6 (después de LWC/Flow)
];
```

### 3. Generación de Waves (Topological Sort)

El algoritmo de topological sort asegura que:

1. **Wave 1**: CustomObject (sin dependencias)
2. **Wave 2**: Layout (depende de CustomObject)
3. **Wave 3**: PermissionSet (depende de CustomObject, pero se deploya antes de Apex/Flow)
4. **Wave 4**: ApexClass (base para LWC y Flow)
5. **Wave 5**: Flow (depende de ApexClass)
6. **Wave 6**: LWC (depende de ApexClass)
7. **Wave 7**: FlexiPage (depende de LWC y Flow)

**⚠️ PROBLEMA IDENTIFICADO**: El PermissionSet se deploya en Wave 3, pero tiene referencias a ApexClass y Flow que están en Waves 4 y 5.

---

## Problema: Permission Sets con Referencias Multi-Wave

### El Problema

Cuando un **Permission Set** tiene referencias a múltiples tipos de metadata que están en diferentes waves:

```
PermissionSet (Wave 3)
    ├─→ CustomObject (Wave 1) ✅ Disponible
    ├─→ ApexClass (Wave 4) ❌ No disponible aún
    └─→ Flow (Wave 5) ❌ No disponible aún
```

Salesforce puede rechazar el deployment del Permission Set si intenta referenciar componentes que aún no existen.

### Comportamiento de Salesforce

Salesforce tiene dos comportamientos posibles:

1. **Permite referencias a componentes inexistentes**: El Permission Set se deploya pero las referencias a ApexClass/Flow no funcionan hasta que esos componentes se deployen.

2. **Rechaza el deployment**: Salesforce valida que todas las referencias existan, causando un error de deployment.

**En la práctica**: Salesforce generalmente **permite** el deployment de Permission Sets con referencias a componentes que aún no existen, pero estas referencias no se activan hasta que los componentes se deployen.

---

## Solución Propuesta: Simplificación de Referencias

### Concepto

La idea es generar **versiones simplificadas** de los archivos de metadata para cada wave, removiendo referencias a componentes que aún no están disponibles.

### Ejemplo: Permission Set Simplificado

**Archivo Original** (`Sales_PS.permissionset-meta.xml`):
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <classAccesses>
    <apexClass>AccountService</apexClass>
  </classAccesses>
  <flowAccesses>
    <flow>Account_Flow</flow>
  </flowAccesses>
</PermissionSet>
```

**Wave 3 (Simplificado)** - Solo CustomObject:
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <!-- Removido: classAccesses (ApexClass en Wave 4) -->
  <!-- Removido: flowAccesses (Flow en Wave 5) -->
</PermissionSet>
```

**Wave 4 (Actualizado)** - Agregar ApexClass:
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <classAccesses>
    <apexClass>AccountService</apexClass>
  </classAccesses>
  <!-- Removido: flowAccesses (Flow en Wave 5) -->
</PermissionSet>
```

**Wave 5 (Completo)** - Agregar Flow:
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <classAccesses>
    <apexClass>AccountService</apexClass>
  </classAccesses>
  <flowAccesses>
    <flow>Account_Flow</flow>
  </flowAccesses>
</PermissionSet>
```

### Otros Casos de Uso

#### FlexiPage Simplificado

**Wave 6 (Simplificado)** - Sin LWC ni Flow:
```xml
<FlexiPage>
  <!-- Removido: componentInstance para LWC (Wave 6) -->
  <!-- Removido: flowruntime:interview para Flow (Wave 5) -->
  <!-- Solo estructura básica -->
</FlexiPage>
```

**Wave 7 (Actualizado)** - Agregar LWC y Flow:
```xml
<FlexiPage>
  <componentInstance>
    <componentName>c:accountSummary</componentName>
  </componentInstance>
  <componentInstance>
    <componentName>flowruntime:interview</componentName>
    <componentInstanceProperties>
      <name>flowName</name>
      <value>Account_Flow</value>
    </componentInstanceProperties>
  </componentInstance>
</FlexiPage>
```

---

## Implementación Propuesta

### 1. Wave-Aware Manifest Generation

Modificar `ManifestGenerator` para generar versiones simplificadas de archivos:

```typescript
class ManifestGenerator {
  async generateWaveManifest(
    wave: Wave,
    options: ManifestGenerationOptions,
    apiVersion: string,
    outputDir: string
  ): Promise<Manifest | null> {
    // Para cada componente en el wave
    for (const nodeId of wave.components) {
      const component = options.componentMap.get(nodeId);

      // Si el componente tiene dependencias en waves futuros
      const futureDependencies = this.getFutureDependencies(
        component,
        wave.number,
        options.waves
      );

      if (futureDependencies.length > 0) {
        // Generar versión simplificada del archivo
        const simplifiedContent = await this.simplifyMetadataFile(
          component,
          futureDependencies
        );

        // Guardar versión simplificada temporalmente
        await this.saveSimplifiedFile(component, simplifiedContent, outputDir);
      }
    }
  }

  private async simplifyMetadataFile(
    component: MetadataComponent,
    futureDependencies: NodeId[]
  ): Promise<string> {
    // Parsear archivo XML
    const xmlContent = await readFile(component.filePath, 'utf-8');
    const parser = new XMLParser();
    const parsed = parser.parse(xmlContent);

    // Remover referencias a componentes en waves futuros
    const simplified = this.removeFutureReferences(parsed, futureDependencies);

    // Serializar de vuelta a XML
    const builder = new XMLBuilder();
    return builder.build(simplified);
  }
}
```

### 2. Actualización Incremental

En waves posteriores, actualizar los archivos con las referencias que ahora están disponibles:

```typescript
async updateMetadataFiles(
  wave: Wave,
  previousWaves: Wave[],
  options: ManifestGenerationOptions
): Promise<void> {
  // Para cada componente que fue simplificado en waves anteriores
  const componentsToUpdate = this.findSimplifiedComponents(previousWaves);

  for (const component of componentsToUpdate) {
    // Verificar si ahora tiene dependencias disponibles en este wave
    const nowAvailableDependencies = this.getNowAvailableDependencies(
      component,
      wave
    );

    if (nowAvailableDependencies.length > 0) {
      // Actualizar archivo con nuevas referencias
      await this.addReferencesToFile(component, nowAvailableDependencies);
    }
  }
}
```

### 3. Validación de Referencias

Validar que todas las referencias estén disponibles antes de agregarlas:

```typescript
private validateReferencesAvailable(
  component: MetadataComponent,
  references: NodeId[],
  availableComponents: Set<NodeId>
): boolean {
  for (const ref of references) {
    if (!availableComponents.has(ref)) {
      return false;
    }
  }
  return true;
}
```

---

## Ventajas y Desventajas

### Ventajas

1. ✅ **Deployment Exitoso**: Evita errores de referencias faltantes
2. ✅ **Waves Más Pequeños**: Permite deployment incremental
3. ✅ **Mejor Manejo de Errores**: Si un wave falla, los anteriores ya están deployados
4. ✅ **Compatibilidad con Salesforce**: Respeta las limitaciones de Salesforce

### Desventajas

1. ❌ **Complejidad**: Requiere modificar archivos XML dinámicamente
2. ❌ **Mantenimiento**: Archivos temporales que deben limpiarse
3. ❌ **Riesgo**: Modificar archivos puede introducir errores
4. ❌ **Performance**: Parsing y serialización adicional de XML

---

## Alternativa: Deployment en Dos Fases

Una alternativa más simple es usar **deployment en dos fases**:

### Fase 1: Componentes Base
- CustomObject
- Layout
- ApexClass
- Flow
- LWC

### Fase 2: Componentes que Referencian
- FlexiPage (con todas sus referencias)
- PermissionSet (con todas sus referencias)

Esto simplifica el proceso pero puede resultar en waves más grandes.

---

## Estrategia Implementada: Simplificación como Fallback

### Concepto

En lugar de simplificar preventivamente, el sistema ahora usa la simplificación como **mecanismo de fallback** cuando un wave falla:

1. **Intento Normal**: Deploy wave con archivos originales
2. **Detección de Error**: Si falla con errores de referencias faltantes
3. **Simplificación Reactiva**: Simplificar archivos removiendo referencias problemáticas
4. **Reintento**: Regenerar manifest y reintentar deployment
5. **Actualización Incremental**: En waves posteriores, actualizar archivos con referencias ahora disponibles

### Flujo de Ejecución

```
Wave Deployment Flow:
├─ 1. Generate manifest with original files
├─ 2. Deploy wave
├─ 3. Check result
│   ├─ ✅ Success → Continue to next wave
│   └─ ❌ Failure
│       ├─ Check if error is "missing reference"
│       ├─ If yes:
│       │   ├─ Simplify metadata files
│       │   ├─ Regenerate manifest
│       │   └─ Retry deployment
│       └─ If no → Fail deployment
└─ 4. In later waves, update simplified files with new references
```

### Ventajas de Esta Estrategia

1. ✅ **Menos Invasivo**: Solo modifica archivos cuando es necesario
2. ✅ **Mejor Performance**: Evita procesamiento innecesario
3. ✅ **Más Seguro**: Solo simplifica cuando hay evidencia de problema
4. ✅ **Mantiene Originales**: Archivos originales no se modifican permanentemente
5. ✅ **Incremental**: Actualiza archivos en waves posteriores

### Implementación

El servicio `MetadataSimplifier` se integra con el flujo de deployment:

```typescript
// En start.ts o deployment executor
const result = await sfCli.deploy({ manifestPath, targetOrg });

if (!result.success) {
  // Check if error is missing reference
  if (metadataSimplifier.isMissingReferenceError(result.output)) {
    // Extract missing references
    const missingRefs = metadataSimplifier.extractMissingReferences(result.output);

    // Simplify wave metadata
    const simplification = await metadataSimplifier.simplifyWaveMetadata(
      wave,
      {
        availableComponents: getAvailableComponents(previousWaves),
        allWaves: orderedWaves,
        currentWaveNumber: wave.number,
        componentMap,
      }
    );

    if (simplification.simplified) {
      // Regenerate manifest with simplified files
      const newManifest = await regenerateManifest(wave, simplification.tempFiles);

      // Retry deployment
      const retryResult = await sfCli.deploy({
        manifestPath: newManifest.path,
        targetOrg
      });

      if (retryResult.success) {
        // Success! Continue with next wave
        // Note: Simplified files will be updated in later waves
      }
    }
  }
}
```

### Actualización Incremental

En waves posteriores, cuando componentes referenciados están disponibles:

```typescript
// When deploying wave N+1, check if wave N had simplified components
const previousSimplified = getSimplifiedComponents(wave.number - 1);

if (previousSimplified.length > 0) {
  // Update simplified files with newly available references
  await updateSimplifiedFiles(previousSimplified, currentWave);
}
```

---

## Recomendación

### ✅ Opción Implementada: Simplificación como Fallback (Recomendado)

**Cuándo usar**:
- Escenarios muy complejos con muchas interdependencias
- Cuando Salesforce rechaza deployments por referencias faltantes
- Cuando se necesita deployment incremental muy granular

**Esfuerzo**: Alto (2-3 semanas de desarrollo)

### Opción 2: Mejorar Detección de Dependencias (Simple)

**Cuándo usar**:
- La mayoría de los casos
- Cuando Salesforce permite referencias a componentes inexistentes
- Cuando se quiere mantener simplicidad

**Esfuerzo**: Bajo (mejorar orden de waves)

### Opción 3: Deployment en Dos Fases (Intermedio)

**Cuándo usar**:
- Casos intermedios
- Cuando se quiere balance entre simplicidad y funcionalidad

**Esfuerzo**: Medio (agregar lógica de fases)

---

## Estado Actual del Sistema

**Comportamiento Actual**:
- ✅ Detecta dependencias correctamente
- ✅ Genera waves usando topological sort
- ✅ Respeta orden de tipos de metadata
- ❌ No simplifica referencias para waves tempranos
- ❌ Asume que Salesforce permite referencias a componentes inexistentes

**Riesgo**:
- Bajo para la mayoría de los casos (Salesforce generalmente permite referencias faltantes)
- Medio para Permission Sets complejos
- Alto para FlexiPages con muchas referencias

---

## Próximos Pasos

1. **Validar Comportamiento**: Probar el escenario descrito en un org de prueba
2. **Documentar Casos Edge**: Identificar casos donde Salesforce rechaza deployments
3. **Implementar Solución**: Elegir entre las opciones propuestas
4. **Agregar Tests**: Crear tests E2E para escenarios complejos

---

## Referencias

- [Wave Builder](./WAVE_BUILDER.md)
- [Manifest Generator](./MANIFEST_GENERATOR.md)
- [Dependency Detection](./DEPENDENCY_DETECTION.md)
- [Salesforce Deployment Best Practices](https://developer.salesforce.com/docs/atlas.en-us.api_meta.meta/api_meta/meta_deploy.htm)

