# Public Site Content Workflow

The public Vite site is generated from repository documentation. Markdown files
under `docs/` and the root `README.md` remain the source of truth; React renders
the generated content module.

## Source Of Truth

- `docs/site-manifest.json` defines navigation, public documentation sources,
  headings, command examples, architecture labels, and link targets.
- `scripts/generate-site-content.js` reads the manifest and referenced markdown,
  validates that required headings exist, extracts concise public summaries, and
  writes `site/src/generated-site-content.ts`.
- `site/src/main.tsx` consumes `siteContent` from the generated module. It should
  not own long-form public copy, command lists, documentation summaries, or
  public navigation directly.

## Local Commands

Regenerate generated site content:

```bash
npm run site:content
```

Run the public site locally:

```bash
npm run site:dev
```

Build the public site:

```bash
npm run site:build
```

The `site` package regenerates content before `dev` and `build`, so local
preview and production builds use the same path.

## Retired Jekyll Surface

Jekyll-specific GitHub Pages files have been removed. Do not add `_config.yml`,
`_layouts/`, `_includes/`, or page-only markdown wrappers for the public site.
Add or update normal markdown docs instead, then map the relevant headings in
`docs/site-manifest.json`.
