# Release Workflow

This repository uses a single npm publishing workflow:

- `.github/workflows/publish-npm.yml`

## Prepare a New Release

Run **Publish to npm with Provenance** manually without a `tag` input.

- `bump=patch|minor|major` updates `package.json` from the current version.
- `version=x.y.z` can be used instead of `bump` when an exact version is required.
- The workflow verifies that the target Git tag and npm version do not already exist.
- The workflow runs install, build, tests, lint, runtime dependency audit, and `npm pack --dry-run`.
- The workflow commits the version bump, creates the annotated tag, creates the GitHub Release, publishes to npm with provenance, verifies npm availability, and checks the `latest` dist-tag.

## Publish an Existing Tag

Run the same workflow with `tag=vX.Y.Z`, or publish a GitHub Release for an existing tag.

- The workflow checks out the tag.
- `package.json` version must match the tag without the `v` prefix.
- The workflow runs install, build, tests, lint, package-content checks, and npm publication.
- If the version is already published, npm publish is skipped and the run succeeds as a safe rerun.

## Required Evidence

Every release run should leave evidence for:

- runtime dependency audit: `npm audit --omit=dev --json`
- pack contents: `npm pack --dry-run`
- version target checks: existing Git tag and npm version
- npm publication verification: `npm view <package>@<version> version`
- dist-tag verification: `npm view <package> dist-tags.latest`

## Safe Rerun Behavior

Rerunning the workflow for an already-published version must not republish the package.

- The workflow sets `already_published=true` when npm already has the version.
- The publish step is skipped.
- Publication verification exits successfully after confirming the version exists.
- The `latest` dist-tag assertion is skipped for already-published reruns because old tags may not be the current latest version.
