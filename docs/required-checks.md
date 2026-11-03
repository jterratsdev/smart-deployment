# Required Check Contract

Pull request CI validates `.github/required-checks.json` against the job contexts that repository workflows can emit for a pull request targeting `main`. This committed contract is the deterministic source used in CI because the standard `GITHUB_TOKEN` cannot read repository rulesets.

The contract currently mirrors the active `main` ruleset, which requires the exact context `nuts`.

## Updating Required Checks

1. Change the GitHub ruleset through the normal repository administration process.
2. Update `.github/required-checks.json` in the same change so `requiredContexts` exactly matches the active ruleset.
3. Run `node scripts/ci/check-required-contexts.mjs` to validate workflows against the committed contract.
4. Verify the contract against GitHub with a fine-grained PAT or GitHub App token that has repository Administration read permission:

   ```bash
   RULESET_READ_TOKEN=... GITHUB_REPOSITORY=jterratsdev/smart-deployment \
     node scripts/ci/check-required-contexts.mjs --verify-remote
   ```

Remote verification is intentionally opt-in and is not run with the workflow `GITHUB_TOKEN`.
