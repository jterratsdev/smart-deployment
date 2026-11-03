# Handoff — smart-deployment (2026-11-03, actualizado tras v1.8.0)

## Estado de main

- main incluye #274 (C4 + fixes RC), #275 (minimatch/glob), #276 (tooling de agentes generado fuera del
  tracking) y #277 (zod acotado a `@salesforce/core`). La integración local quedó en `2f931e9`.
- npm/GitHub: `@jterrats/smart-deployment@1.8.0` (`v1.8.0`) publicado.
- Los archivos generados de agentes permanecen como estado local y no forman parte del producto versionado.
- La confirmación del deploy de Cloudflare tras #277 queda como verificación operativa de CI, no como trabajo
  de producto prioritario.

## SD-DEV-C1-RULES — completado en v1.8.0

- PR: `feature/SD-DEV-C1-RULES-matching-duplicate` -> main. Merge: `gh pr merge <n> --squash --admin`.
- Hecho: BA, architect, developer, security (PASS-WITH-FINDINGS tras re-review), QA (PASS-WITH-RISKS),
  document-review (approve), gate document-review->release aprobada, evidencia de release en
  `docs/releases/SD-DEV-C1-RULES-release-candidate.md`.
- Cambio de comportamiento: `ci-publish` es all-or-nothing (cualquier error del plan bloquea todo).
- Docs: `docs/architecture/c1-rules-matching-duplicate-design.md`, `docs/reviews/SD-DEV-C1-RULES-*`,
  `docs/testing/SD-DEV-C1-RULES-*`, `docs/known-limitations.md`.

## Riesgos y TBDs

- AC-004: MatchingRules/DuplicateRule siguen bloqueados para deploy; falta un org desechable en API 67.0.
- `minimumApiVersion` de ambos tipos sin confirmar (hoy 61.0).
- C4: el naming VBT `Type_SubType_Language` no está verificado contra un export real.
- Cobertura de branches 82.6%, por debajo del 90% de `.nycrc` (el umbral no se aplica).
- La rama `feat/wave-deployment-order-contracts` (prior art de C1) se cierra tras el merge;
  su commit `45d5cd3` (Retail Execution) pasa a SD-DEV-PRODUCT-SETTINGS.

## Backlog activo (orden de prioridad)

1. **Scope seguro — #270/#272 (P0).** Reproducir y corregir omisiones o inclusiones indebidas en despliegues
   acotados. Separar la semántica de commits, `--scope-manifest` y `package.xml`; cualquier discrepancia debe
   fallar cerrado.
2. **FlexiPage action override — #273 (P0).** Resolver el conflicto real `CustomObject` → `FlexiPage` con un
   plan de activación por etapas probado; no cambiar prioridades arbitrariamente ni eliminar el edge.
3. **SD-DEV-C1-GRAPH (P0).** Añadir dependencias tipadas de `CustomField`/`Flow`, normalizar `NodeId` y conservar
   las salidas `local`, `local-missing` y `target-unknown`. Preservar el executor de FlexiPage bloqueado.
4. **`plan explain` (P1).** Exponer clasificaciones C4, referencias `target-unknown` y motivos de bloqueo en el
   contrato JSON y en la salida humana.
5. **SD-DEV-C2-SOURCES (P1).** Prompt templates, `DataSourceObject`, `DataStreamDefinition` y `AiAuthoringBundle`,
   sin inferir readiness de providers.
6. **SD-DEV-PRODUCT-SETTINGS (P1).** C3/C5/C6/C7 con fixtures de identidad, raíces XML y dependencias explícitas.
7. **SD-DEV-P2-PROVIDER-BOUNDARIES (P2).** Fail-closed, redacción, versionado y recuperación; sin importar ni
   ejecutar DataPacks administrados todavía.

El backlog técnico de [`docs/technical-refactor-backlog.md`](../technical-refactor-backlog.md) se retoma después
de los P0. El primer refactor recomendado es `dependency-graph-builder`, como parte de C1-GRAPH, no como una
reescritura independiente.

## Trabajo deliberadamente fuera del próximo ciclo

- Los scaffolds de Playwright/Wdio fueron eliminados y no se deben reintroducir.
- MatchingRules/DuplicateRule continúan bloqueados para deploy hasta disponer de evidencia en un org desechable
  API 67; el guard fail-closed sí está completo.
- La importación ejecutable de OmniStudio DataPacks, la provisión de datos de negocio y la remediación automática
  de ciclos complejos requieren historias separadas y evidencia de provider/org.
- Wave actions/Apex anónimo queda como checkpoint manual durable: el plugin detecta, pausa y permite reanudar;
  no ejecuta scripts del repositorio automáticamente.

## Notas operativas históricas

- La firma de aprobaciones cambió su payload (`completedAt`) sin subir `v`, y las aprobaciones viejas
  aparecen como "forjadas".
- El check de husky exige que `.husky/_/h` sea ejecutable, pero husky 9 lo crea con permisos 644.
- `yarn install` en worktrees deja `core.hooksPath` con ruta absoluta y eso bloquea los commits.
- La aprobación conversacional a veces no queda registrada, y el diálogo nativo falla si la terminal
  tiene permiso de Accesibilidad. Alternativa: `sf sfps-adp review complete ...` desde una terminal propia.
- Un rebase que reescribe `.setup-agents/state` deja el gate apuntando a un run viejo y bloquea
  incluso Bash de solo lectura. Antes de rebasar, commitear `.setup-agents/state`.
- Agregar `/.claude/worktrees/` al `.gitignore` (el hook no deja que un agente toque `.claude/`).

Estas notas no forman parte del backlog activo y no deben bloquear el trabajo de producto.
