# 🚀 Improvement Roadmap - Smart Deployment Plugin

**Last Updated**: December 15, 2025

This document outlines prioritized improvements based on current analysis and user feedback.

---

## 🔴 High Priority Improvements

### 1. Resolución Automática de Dependencias Circulares

**Problema Actual**:
- 179 componentes no se pueden colocar debido a dependencias circulares
- El `WaveBuilder` detecta los ciclos pero no intenta resolverlos automáticamente
- Existe `CircularDependencyDetector` pero no se usa en la generación de waves

**Solución Propuesta**:
- Integrar `CircularDependencyDetector` en `WaveBuilder`
- Implementar estrategia de "romper ciclos" automáticamente:
  - Identificar el edge más débil en cada ciclo (basado en tipo de metadata)
  - Romper el ciclo temporalmente para permitir ordenamiento
  - Agregar los componentes rotos al mismo wave o wave siguiente
- Usar heurísticas: Test classes siempre después de production classes

**Impacto**: Reduciría significativamente los componentes no colocados (de 179 a ~50-100)

**Esfuerzo**: Medio (3-5 días)

---

### 2. Mejora en Detección de Test Classes

**Problema Actual**:
- Muchas clases de prueba (`*_Test`, `*Test`) están creando dependencias circulares
- `TriggerHandler_Test` depende de `TriggerHandler`, pero ambos quedan sin colocar
- No hay lógica especial para manejar la relación Test → Production

**Solución Propuesta**:
- Detectar automáticamente clases de prueba (naming convention: `*_Test`, `*Test`)
- Crear dependencia implícita: Test class siempre después de Production class
- En caso de ciclo, romper automáticamente el edge Test → Production (el test puede esperar)
- Agregar opción para deployar test classes en wave separado

**Impacto**: Resolvería ~50-60 componentes no colocados (test classes)

**Esfuerzo**: Bajo-Medio (2-3 días)

---

### 3. Mejora en Detección de Dependencias en Flow

**Problema Actual**:
- Los Flows pueden tener dependencias complejas (Apex Actions, Subflows, etc.)
- Algunas dependencias pueden no estar siendo detectadas correctamente
- Flows aparecen en componentes no colocados (6 Flows)

**Solución Propuesta**:
- Revisar y mejorar `flow-parser.ts` para detectar:
  - Apex Actions (ya implementado)
  - Subflows (verificar)
  - Custom Metadata Types referenciados
  - Custom Labels usados
- Agregar detección de dependencias transitivas en Flows

**Impacto**: Mejoraría el ordenamiento de Flows en waves y resolvería ~5-10 componentes

**Esfuerzo**: Medio (2-3 días)

**Nota**: Los objetos estándar de Salesforce (`Case`, `Account`, etc.) siempre se asociarán como `CustomObject` en el sistema, ya que son referencias válidas en metadata (Layouts, FlexiPages, PermissionSets, etc.). De la misma manera, los campos estándar se asociarían como `CustomField`. Estos deben permanecer en el grafo de dependencias para el ordenamiento correcto.

---

## 🟡 Medium Priority Improvements

### 4. Mejor Reporte de Componentes No Colocados

**Problema Actual**:
- Solo se muestra el número de componentes no colocados
- No hay información sobre por qué no se pueden colocar
- No hay sugerencias de cómo resolverlos

**Solución Propuesta**:
- Agregar campo `unplacedComponents` al reporte JSON con detalles:
  - Componente
  - Razón (circular dependency, missing dependency, etc.)
  - Ciclo detectado (si aplica)
  - Sugerencias de resolución
- Mejorar output de `analyze` para mostrar:
  - Lista de componentes no colocados agrupados por tipo
  - Ciclos detectados con visualización
  - Sugerencias de cómo romper los ciclos

**Impacto**: Mejoraría la experiencia del usuario y facilitaría la resolución manual

**Esfuerzo**: Medio (2-3 días)

---

### 5. Optimización de Performance

**Problema Actual**:
- El análisis puede ser lento en proyectos grandes
- No hay caching de resultados de parsing
- Se re-parsea todo en cada ejecución

**Solución Propuesta**:
- Implementar cache de resultados de parsing (hash de archivo → resultado)
- Cachear grafo de dependencias si no hay cambios en metadata
- Paralelizar parsing de archivos independientes
- Optimizar algoritmos de detección de ciclos (ya es O(V+E) pero puede mejorarse)

**Impacto**: Reduciría tiempo de análisis en proyectos grandes

**Esfuerzo**: Medio-Alto (4-5 días)

---

### 6. Mejora en Detección de Dependencias en PermissionSet

**Problema Actual**:
- Permission Sets pueden referenciar muchos tipos de metadata
- Algunas referencias pueden no estar siendo detectadas
- 10 Permission Sets aparecen en componentes no colocados

**Solución Propuesta**:
- Revisar y mejorar `permission-set-parser.ts` para detectar:
  - Custom Applications (LightningApp) - ya implementado
  - Flows - ya implementado
  - Custom Metadata Types
  - Custom Permissions
  - Field Permissions (CustomObject dependencies)
- Verificar que todas las referencias se están extrayendo correctamente

**Impacto**: Mejoraría el ordenamiento de Permission Sets

**Esfuerzo**: Bajo-Medio (1-2 días)

---

## 🟢 Low Priority Improvements

### 8. Mejora en Reportes HTML

**Problema Actual**:
- El reporte HTML es básico
- No hay visualización interactiva del grafo de dependencias
- No hay filtros o búsqueda

**Solución Propuesta**:
- Usar librería de visualización de grafos (D3.js, vis.js, o similar)
- Agregar visualización interactiva del grafo de dependencias
- Agregar filtros por tipo, wave, estado
- Agregar búsqueda de componentes
- Mostrar ciclos detectados visualmente

**Impacto**: Mejoraría la experiencia de análisis visual

**Esfuerzo**: Alto (5-7 días)

---

### 9. Validación de Metadata Types Desconocidos

**Problema Actual**:
- Algunos componentes pueden aparecer como "Unknown"
- No hay validación proactiva de tipos no soportados

**Solución Propuesta**:
- Agregar validación durante el scanning
- Detectar tipos desconocidos y reportarlos
- Sugerir implementación de parser para tipos desconocidos
- Mantener lista de tipos conocidos pero no implementados

**Impacto**: Facilitaría la extensión del plugin

**Esfuerzo**: Bajo (1 día)

---

### 10. Mejora en Manejo de Dependencias Opcionales

**Problema Actual**:
- Todas las dependencias se tratan como requeridas
- Algunas dependencias pueden ser opcionales (ej: Custom Labels en Flows)

**Solución Propuesta**:
- Agregar concepto de "dependencia opcional" en el parser
- Marcar dependencias opcionales en el grafo
- Permitir que componentes con solo dependencias opcionales se coloquen antes
- Documentar qué dependencias son opcionales por tipo

**Impacto**: Mejoraría el ordenamiento en casos edge

**Esfuerzo**: Medio (3-4 días)

---

## 📊 Resumen de Impacto Esperado

| Mejora | Componentes Resueltos | Esfuerzo | Prioridad |
|--------|----------------------|----------|-----------|
| Resolución automática de ciclos | ~80-100 | Medio | 🔴 Alta |
| Mejora en test classes | ~50-60 | Bajo-Medio | 🔴 Alta |
| Flow dependencies | ~5-10 | Medio | 🔴 Alta |
| Mejor reporte | N/A | Medio | 🟡 Media |
| Performance | N/A | Medio-Alto | 🟡 Media |
| PermissionSet dependencies | ~5-10 | Bajo-Medio | 🟡 Media |
| Reportes HTML | N/A | Alto | 🟢 Baja |
| Validación Unknown | N/A | Bajo | 🟢 Baja |
| Dependencias opcionales | ~5-10 | Medio | 🟢 Baja |

**Total estimado de componentes resueltos**: ~135-170 de 179

---

## 🎯 Recomendación de Implementación

**Fase 1 (Inmediata - 1 semana)**:
1. Mejora en detección de test classes
2. Mejora en detección de Flow dependencies
3. Mejor reporte de componentes no colocados

**Fase 2 (Corto plazo - 2 semanas)**:
4. Resolución automática de dependencias circulares
5. Mejora en detección de PermissionSet dependencies
6. Optimización de performance

**Fase 3 (Mediano plazo - 1 mes)**:
7. Optimización de performance
8. Mejora en reportes HTML
9. Validación de tipos desconocidos
10. Manejo de dependencias opcionales

---

## 📝 Notas Adicionales

- Las mejoras están basadas en análisis del proyecto `grg-ss-agentforce`
- Los números son estimaciones y pueden variar según el proyecto
- Se recomienda implementar mejoras incrementales y validar contra el ambiente real
- Considerar feedback del usuario después de cada fase

