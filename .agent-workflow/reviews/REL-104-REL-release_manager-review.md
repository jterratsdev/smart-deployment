# Review REL-104-REL: release_manager

- Result: block
- Severity: high
- Findings: GitHub release v1.0.4 already exists but npm publish failed with ENEEDAUTH. @jterrats/smart-deployment@1.0.4 is still unpublished while npm latest is 1.0.3.
- Recommendation: Fix repository secret NPM_TOKEN with publish permission, then run gh workflow run publish-npm.yml -f tag=v1.0.4 --ref main. Do not rerun auto-release.yml for this tag.
