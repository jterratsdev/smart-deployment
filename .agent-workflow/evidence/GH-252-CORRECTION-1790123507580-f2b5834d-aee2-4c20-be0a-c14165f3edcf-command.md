# Evidence GH-252-CORRECTION: command

- Role: developer
- Summary: Node 24/Yarn 1 final sequential validation passed with stable package and lock hashes.
- Path: not applicable
- Command: npm run release:contracts; node --test test/ci/\*.test.mjs; npm run release:analyze; yarn install --frozen-lockfile --offline; yarn build; yarn test; yarn test:nuts; yarn test:clean-install; actionlint; shellcheck
- Exit code: 0
- Diff excerpt: not applicable
- Verifier contract: not applicable
- Automation surface: cli
- Assertions: exit code: 0; stdout: 22 CI tests pass, analyzer reports 1.6.1, build and unit pass, 41 NUTs pass, isolated plugin 1.5.0 discovers validate and ci-publish; stderr: warnings only; artifact: scripts/ci/release-contract.mjs, test/ci/release-contract.test.mjs, yarn.lock, npm-shrinkwrap.json; final state: package hash dc1b0fab811df90cb0635d8d8952d0aad2bcd66b800a462c89764a1be0c7fe99, yarn hash b86e9da1b6e563984ab935aba0c545c75f82216e98d03459ba050bcc91d217f7, shrinkwrap hash 51dc02923af9506248f82e6abb1600339903e7cbf6ec0d776b1483cdd5399144.
- External validation: not provided
- Deferred owner: not applicable
- Deferred rationale: not applicable
- Deferred environment: not applicable
- Deferred next command: not applicable
- Observable outcome: yes
- Gaps: none
