![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# Release Workflow

Author: Salesforce Professional Services

Version: 1.1

This repository uses a single npm publishing workflow:

- `.github/workflows/publish-npm.yml`

## Prepare a New Release

A release can be prepared either by pushing a `package.json` version bump to `main` or by running **Publish to npm** manually without a `tag` input.

- A `package.json` push uses the version already committed and creates the matching tag/release.
- `bump=patch|minor|major` updates `package.json` from the current version when run manually.
- `version=x.y.z` can be used instead of `bump` when an exact version is required.
- The workflow verifies that the target Git tag and npm version do not already exist.
- The workflow runs install, build, tests, lint, runtime dependency audit, and `npm pack --dry-run`.
- The workflow commits the version bump, creates the annotated tag, creates the GitHub Release, publishes to npm with provenance, verifies npm availability, and checks the `latest` dist-tag.

## CI Minute Policy

The release workflow runs on release events, manual dispatch, and pushes to `main` that modify `package.json`. Heavy release validation remains inside this workflow because npm publication uses elevated permissions and secrets, while the path filter avoids running it on unrelated pushes.

Set `CI_LINUX_RUNNER=github-hosted` only as a temporary fallback when the trusted self-hosted Linux runner is unavailable.

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

Pull-request CI also runs `yarn release:analyze`, which directly invokes only semantic-release's commit analyzer. It reads commits since the latest semantic-version tag, independently checks the configured release rules, and asserts the expected next release type and version. The analyzer process does not load npm or GitHub publication plugins, use a release remote, or need release credentials, so pull-request analysis cannot publish artifacts.

## Packed Plugin Installation Contract

`yarn test:clean-install` packs the current checkout and installs that tarball into a temporary Salesforce CLI installation. The harness isolates `HOME`, npm cache/config, XDG directories, and Salesforce CLI cache/config/plugin data; it then verifies the exact `package.json` version and help discovery for `smart-deployment validate` and `smart-deployment ci-publish`. It does not authenticate to a Salesforce org or read from the npm registry for the plugin under test.

The package is an unsigned community plugin, so Salesforce CLI asks for confirmation. The harness sends `y` to that single install invocation rather than changing a global allowlist or relying on `--force` (which controls npm fetching, not signature consent).

Some developer machines and runners set npm `min-release-age` to delay newly published dependencies. CI sets `npm_config_min_release_age=0` only for its frozen dependency install, and the tarball test applies an equivalent invocation-scoped override only while Salesforce CLI installs the local plugin tarball. Neither path edits user or global npm configuration; normal installs retain the configured policy.

## Safe Rerun Behavior

Rerunning the workflow for an already-published version must not republish the package.

- The workflow sets `already_published=true` when npm already has the version.
- The publish step is skipped.
- Publication verification exits successfully after confirming the version exists.
- The `latest` dist-tag assertion is skipped for already-published reruns because old tags may not be the current latest version.
