# Oclif Plugin Development

Use this skill when a task designs, implements, tests, packages, or reviews an
Open Orchestra plugin based on oclif, TypeScript, React, Vite, hooks, manifests,
or CLI command extensions.

## When To Load

- Trigger: `oclif`
- Trigger: `plugin`
- Trigger: `cli plugin`
- Trigger: `command plugin`
- Trigger: `hook`
- Trigger: `manifest`
- Trigger: `package exports`
- Trigger: `npm plugin`
- Trigger: `React/Vite plugin UI`
- Trigger: `TypeScript plugin package`

## Architecture

- Treat plugin specialization as an on-demand skill, not as a permanent role
  profile. Developer, Architect, QA, Security, DevOps, UX, or Tech Lead can use
  this skill when the task requires plugin work.
- Keep command classes or command modules nearly logicless: parse flags/args,
  call one service/use-case, format output, and map expected errors to
  user-safe messages.
- Put business rules, workflow policy, persistence, batching, retries, plugin
  discovery, and registry mutations in domain services or use-cases.
- Define public plugin contracts before implementation: plugin id, supported
  host version, commands, hooks, capabilities, permissions, configuration,
  outputs, evidence expectations, and compatibility constraints.
- Prefer typed registries and manifest-derived metadata over hardcoded command
  or hook lists. Load `collection-standards` when plugin work repeats commands,
  hooks, providers, roles, statuses, selectors, fixtures, or validators.

## Oclif CLI Standards

- Use TypeScript and typed flags/args.
- Keep stdout, stderr, exit code, and JSON output stable and testable.
- Provide JSON output for machine consumers when a command returns structured
  data.
- Keep help, examples, aliases, deprecations, and hidden/internal command status
  explicit.
- Treat hooks as integration points with clear ordering, idempotency, timeout,
  failure, and observability behavior.
- Do not hide network calls, filesystem writes, shell execution, or destructive
  actions inside command parsing.

## Package Standards

- Prefer ESM-first package structure unless compatibility requires otherwise.
- Define `exports`, `types`, files included in the package, and supported Node
  versions.
- Keep package metadata, command metadata, plugin manifest data, and docs
  derived from one source where possible.
- Validate install/link/package smoke behavior before release.
- Use semantic versioning and document host compatibility or migration needs.

## Plugin Capability Manifest

A plugin capability contract should declare:

- plugin id and display name;
- commands and command surfaces;
- hooks and lifecycle events;
- capabilities and activation triggers;
- required permissions;
- configuration schema and defaults;
- UI contributions, if any;
- evidence types expected for QA/release;
- compatibility with host Open Orchestra version;
- security constraints and tenant/regulatory limitations;
- ownership, support, and deprecation policy.

## React/Vite UI Contributions

- Use React + TypeScript conventions for UI plugin surfaces.
- Use Vite for local dev/build when the host package supports it.
- Separate presentation, state, API access, and domain logic.
- Keep UI mobile-first, accessible, and covered with loading, empty, error,
  success, and recovery states.
- Add Playwright evidence for user-visible plugin UI flows.

## QA Evidence

Plugin QA should prove:

- command exit code, stdout, stderr, and JSON contract;
- flags/args validation and help output;
- generated files or workflow events;
- hook invocation, ordering, idempotency, and failure behavior;
- install/link/package smoke;
- compatibility with the declared host version;
- Playwright screenshots/traces when UI is involved;
- API side effects or external integration outcomes when the plugin triggers
  them.

## Security

- Use `spawn`/`execFile` with args arrays for shell execution. Never interpolate
  shell strings.
- Validate file paths and reject traversal.
- Validate URLs before network calls.
- Do not hardcode secrets or write credentials to plugin manifests.
- Define least-privilege plugin permissions and review them before release.
- Treat third-party plugins and plugin-provided config as untrusted input.
- Run secret scanning, dependency audit, static analysis, duplicate-code checks,
  and package provenance checks before release.

## Handoff Checklist

- Plugin contract or manifest updated.
- Command/hook behavior covered by tests.
- Security-sensitive surfaces reviewed.
- Evidence attached for CLI/API/UI behavior.
- Package/install smoke completed or explicitly deferred.
- Compatibility and release notes updated when user-facing behavior changes.
