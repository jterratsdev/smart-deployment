# Collection Standards

Use this skill when a task touches repeated collections, option sets, fixtures,
command matrices, selectors, validators, or collection-processing complexity.
It applies to product code, QA automation, scripts, CI/CD, IaC helpers,
operational tooling, and generated code.

## When To Load

- Developer, QA/SDET, DevOps, Platform, SRE, or Performance work writes code,
  scripts, tests, generated options, or automation helpers.
- A module-boundary or god-file review finds repeated hardcoded values in
  commands, controllers, services, tests, or generated option builders.
- The task mentions hardcoded values, arrays, maps, key/value pairs, options,
  fixtures, selectors, command cases, provider lists, CI matrices, roles,
  statuses, validators, bulk/batch processing, O(n), N+1, nested loops, or
  complexity.
- A review finds duplicated collections or repeated scans across files.

## Single Source Of Truth

- If the same list, map, enum-like set, key/value collection, option list,
  validator set, selector set, fixture set, provider list, role/status list,
  script argument collection, or CI matrix is needed in more than one place,
  define one typed source of truth.
- Prefer the smallest project-native shape: exported constant, typed union,
  registry, builder, factory, fixture helper, page object, or config-derived
  adapter.
- Derive all arrays, lookup maps, dropdown options, validators, test data,
  command arguments, docs examples, and automation config from that source.
- Do not maintain parallel copies in product code, tests, QA scripts, DevOps
  scripts, generated docs, or UI controls. If duplication is unavoidable across
  packages, add a sync test.

## Collection Complexity

- Default to O(n) or explicitly bounded collection processing for normal code,
  CLI commands, QA automation, CI scripts, and operational tools.
- Avoid nested scans, repeated full-list filters, N+1 calls, unbounded log
  scans, and synchronous work over large collections.
- For joins or repeated lookups, build a `Map`, dictionary, index, page object,
  or normalized structure once, then use O(1) lookups.
- Paginate, stream, batch, or bound large data sources. Do not load unbounded
  result sets into memory.
- If O(n^2) or another higher-complexity approach is intentional, document the
  input bound or measured trade-off and attach representative multi-item
  evidence.

## Review Checklist

- What collection is authoritative?
- Which consumers derive from it?
- Are tests, scripts, UI controls, validators, and docs using the same source?
- Are joins/lookups linear or bounded?
- Is there evidence with more than one item, including empty and multi-item
  cases when the workflow supports collections?

## Evidence

- `file`: changed source-of-truth module, registry, builder, fixture helper, or
  page object.
- `command`: focused test, E2E, script, lint, or build proving the derived
  consumers work.
- `report`: reviewer note or benchmark when complexity is intentionally higher
  than O(n).
