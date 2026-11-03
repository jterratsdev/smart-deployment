# Handoff — smart-deployment (2026-11-03)

## Estado de main

- main incluye #274 (C4 + fixes RC), #275 (minimatch/glob), #277 (zod acotado a @salesforce/core,
  fix Cloudflare) y #276 (ya no se trackean skills/playbooks/reglas generadas).
- npm: `@jterrats/smart-deployment@1.7.0` publicado, con GitHub release `v1.7.0`.
- En una laptop nueva: `git pull` y luego `sf setup-agents local` para regenerar los archivos de agentes.
- Pendiente de confirmar: el deploy de Cloudflare Pages en main tras #277.

## SD-DEV-C1-RULES (run wf-1793266575987-0bc63f, fase release)

- PR: `feature/SD-DEV-C1-RULES-matching-duplicate` -> main. Merge: `gh pr merge <n> --squash --admin`.
- Hecho: BA, architect, developer, security (PASS-WITH-FINDINGS tras re-review), QA (PASS-WITH-RISKS),
  document-review (approve), gate document-review->release aprobada, evidencia de release en
  `docs/releases/SD-DEV-C1-RULES-release-candidate.md`.
- Tras el merge: cerrar la fase release con `sf setup-agents workflow run --story SD-DEV-C1-RULES
--resume wf-1793266575987-0bc63f` y comprobar que semantic-release publique 1.8.0.
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

## Siguiente trabajo (orden)

1. Cerrar la fase release de C1-RULES (arriba).
2. SD-DEV-C1-GRAPH: dependencias tipadas de CustomField/Flow. Toca los mismos archivos que C1-RULES.
3. `plan explain`: mostrar clasificaciones C4 y referencias `target-unknown`.
4. SD-DEV-C2-SOURCES, SD-DEV-PRODUCT-SETTINGS, SD-DEV-P2-PROVIDER-BOUNDARIES.
5. QA: scaffolds de Playwright/wdio (sin dependencias; no van en `src/`).
6. Cerrar el run viejo SD-METADATA-UNKNOWN-VALIDATION (`wf-1792661988648-67a504`) con `workflow abandon`.

## Bugs de setup-agents (repo setup-agents)

- La firma de aprobaciones cambió su payload (`completedAt`) sin subir `v`, y las aprobaciones viejas
  aparecen como "forjadas".
- El check de husky exige que `.husky/_/h` sea ejecutable, pero husky 9 lo crea con permisos 644.
- `yarn install` en worktrees deja `core.hooksPath` con ruta absoluta y eso bloquea los commits.
- La aprobación conversacional a veces no queda registrada, y el diálogo nativo falla si la terminal
  tiene permiso de Accesibilidad. Alternativa: `sf sfps-adp review complete ...` desde una terminal propia.
- Un rebase que reescribe `.setup-agents/state` deja el gate apuntando a un run viejo y bloquea
  incluso Bash de solo lectura. Antes de rebasar, commitear `.setup-agents/state`.
- Agregar `/.claude/worktrees/` al `.gitignore` (el hook no deja que un agente toque `.claude/`).
