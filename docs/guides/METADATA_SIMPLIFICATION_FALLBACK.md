# Metadata Simplification as Fallback Strategy

**Last Updated**: December 15, 2025

Guía sobre cómo funciona la simplificación de metadata como estrategia de fallback cuando un wave falla por referencias faltantes.

---

## Overview

La simplificación de metadata es un mecanismo de **fallback reactivo** que se activa cuando un wave de deployment falla debido a referencias a componentes que aún no están disponibles.

### Principio

> "Intenta primero con los archivos originales. Solo simplifica si es necesario."

---

## Cuándo se Activa

La simplificación se activa cuando:

1. ✅ Un wave falla durante el deployment
2. ✅ El error indica referencias faltantes (ej: `INVALID_CROSS_REFERENCE`, `MISSING_REFERENCE`)
3. ✅ Los componentes referenciados están en waves posteriores

### Errores que Activan la Simplificación

```typescript
const MISSING_REFERENCE_ERRORS = [
  'INVALID_CROSS_REFERENCE',
  'MISSING_REFERENCE',
  'DEPENDENCY_NOT_FOUND',
  'INVALID_TYPE_FOR_REFERENCE',
  'CANNOT_DEPLOY_COMPONENT',
  'INVALID_FIELD',
  'INVALID_OBJECT',
  'INVALID_CLASS',
  'INVALID_FLOW',
];
```

---

## Flujo de Ejecución

### Paso 1: Deployment Normal

```typescript
// Intento normal con archivos originales
const result = await sfCli.deploy({
  manifestPath: 'wave-003-package.xml',
  targetOrg: 'my-org'
});
```

### Paso 2: Detección de Error

```typescript
if (!result.success) {
  // Verificar si es error de referencia faltante
  if (metadataSimplifier.isMissingReferenceError(result.output)) {
    // Activar simplificación
  }
}
```

### Paso 3: Simplificación

```typescript
// Extraer referencias faltantes del error
const missingRefs = metadataSimplifier.extractMissingReferences(result.output);

// Simplificar archivos del wave
const simplification = await metadataSimplifier.simplifyWaveMetadata(
  wave,
  {
    availableComponents: getAvailableComponents(previousWaves),
    allWaves: orderedWaves,
    currentWaveNumber: wave.number,
    componentMap,
  }
);
```

### Paso 4: Reintento

```typescript
if (simplification.simplified) {
  // Regenerar manifest con archivos simplificados
  const newManifest = await regenerateManifest(wave, simplification.tempFiles);

  // Reintentar deployment
  const retryResult = await sfCli.deploy({
    manifestPath: newManifest.path,
    targetOrg: 'my-org'
  });
}
```

### Paso 5: Actualización Incremental

En waves posteriores, cuando los componentes referenciados están disponibles:

```typescript
// En wave N+1, actualizar archivos simplificados del wave N
if (hasSimplifiedComponents(wave.number - 1)) {
  await updateSimplifiedFiles(wave.number - 1, currentWave);
}
```

---

## Tipos de Metadata que se Pueden Simplificar

### 1. Permission Sets

**Qué se remueve**:
- Referencias a Apex Classes no disponibles
- Referencias a Flows no disponibles
- Referencias a Custom Objects no disponibles (menos común)

**Ejemplo**:

**Original**:
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <classAccesses>
    <apexClass>AccountService</apexClass> <!-- No disponible aún -->
  </classAccesses>
  <flowAccesses>
    <flow>Account_Flow</flow> <!-- No disponible aún -->
  </flowAccesses>
</PermissionSet>
```

**Simplificado** (Wave 3):
```xml
<PermissionSet>
  <objectPermissions>
    <object>Account__c</object>
  </objectPermissions>
  <!-- Removido: classAccesses -->
  <!-- Removido: flowAccesses -->
</PermissionSet>
```

**Actualizado** (Wave 5, después de que ApexClass y Flow están disponibles):
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

### 2. FlexiPages

**Qué se remueve**:
- Referencias a LWC components no disponibles
- Referencias a Flows no disponibles (flowruntime:interview)

**Ejemplo**:

**Original**:
```xml
<FlexiPage>
  <componentInstances>
    <componentName>c:accountSummary</componentName> <!-- LWC no disponible -->
  </componentInstances>
  <componentInstances>
    <componentName>flowruntime:interview</componentName>
    <componentInstanceProperties>
      <name>flowName</name>
      <value>Account_Flow</value> <!-- Flow no disponible -->
    </componentInstanceProperties>
  </componentInstances>
  </FlexiPage>
```

**Simplificado**:
```xml
<FlexiPage>
  <!-- Removido: componentInstances con LWC -->
  <!-- Removido: componentInstances con Flow -->
</FlexiPage>
```

### 3. Profiles

Similar a Permission Sets.

### 4. Layouts

Menos común, pero puede simplificarse removiendo referencias a campos no disponibles.

---

## Archivos Temporales

Los archivos simplificados se guardan como archivos temporales:

```
force-app/main/default/permissionsets/Sales_PS.permissionset-meta.xml.simplified-1234567890
```

Estos archivos:
- ✅ Se usan solo para el deployment del wave actual
- ✅ Se limpian después del deployment exitoso
- ✅ Se actualizan en waves posteriores con nuevas referencias

---

## Integración con el Sistema

### En `start.ts`

```typescript
import { MetadataSimplifier } from '../deployment/metadata-simplifier.js';

// En executeDeployment
const metadataSimplifier = new MetadataSimplifier();

for (const wave of orderedWaves) {
  try {
    const result = await sfCli.deploy({ manifestPath, targetOrg });

    if (!result.success) {
      // Check if it's a missing reference error
      if (metadataSimplifier.isMissingReferenceError(result.output)) {
        // Simplify and retry
        const simplification = await metadataSimplifier.simplifyWaveMetadata(
          wave,
          { /* options */ }
        );

        if (simplification.simplified) {
          // Regenerate manifest and retry
          // ...
        }
      }
    }
  } catch (error) {
    // Handle error
  }
}
```

---

## Ventajas

1. ✅ **No Invasivo**: Solo modifica cuando es necesario
2. ✅ **Mejor Performance**: Evita procesamiento innecesario
3. ✅ **Mantiene Originales**: Archivos fuente no se modifican
4. ✅ **Incremental**: Actualiza archivos en waves posteriores
5. ✅ **Transparente**: Usuario no necesita intervención

---

## Limitaciones

1. ❌ **Solo Ciertos Tipos**: No todos los tipos de metadata se pueden simplificar
2. ❌ **Complejidad**: Requiere parsing y serialización de XML
3. ❌ **Archivos Temporales**: Genera archivos temporales que deben limpiarse
4. ❌ **Detección de Errores**: Depende de mensajes de error de Salesforce

---

## Testing

### Escenarios de Prueba

1. **Permission Set con Apex Class no disponible**
   - Deploy Permission Set antes de Apex Class
   - Verificar que se simplifica y redeploya exitosamente

2. **FlexiPage con LWC no disponible**
   - Deploy FlexiPage antes de LWC
   - Verificar que se simplifica y redeploya exitosamente

3. **Actualización Incremental**
   - Simplificar en Wave 3
   - Verificar que se actualiza en Wave 5 cuando componentes están disponibles

---

## Referencias

- [Wave Generation Complex Dependencies](./WAVE_GENERATION_COMPLEX_DEPENDENCIES.md)
- [Deployment Error Handling](../ERROR_HANDLING_INTEGRATION.md)
- [Retry Handler](../deployment/retry-handler.ts)

