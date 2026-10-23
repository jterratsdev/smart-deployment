# Evidence SD-VERSION-MANIFEST-AUDIT: command

- Role: developer
- Summary: Parent verified git show v1.6.2:package.json, v1.6.3:package.json and origin/main:package.json all report 1.5.0; matching npm-shrinkwrap top-level versions also 1.5.0. npm view @jterrats/smart-deployment@1.6.2 confirms published 1.6.2, npm view @jterrats/smart-deployment version reports latest 1.6.3. .releaserc.json uses @semantic-release/npm and @semantic-release/git assets package.json/npm-shrinkwrap.json; publish-npm.yml runs npm run release on main push. Local sf plugins link reports version from checkout package.json, hence 1.5.0. No version files edited due to ambiguity between requested 1.6.2 and actual latest 1.6.3.
- Path: not applicable
- Command: not applicable
- Exit code: not applicable
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: not declared
