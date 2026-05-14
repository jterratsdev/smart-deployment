# Evidence REL-104-NPMTOKEN: command

- Role: devops
- Summary: publish-npm.yml run 25423756929 completed successfully and published @jterrats/smart-deployment@1.0.4
- Path: not applicable
- Command: gh workflow run publish-npm.yml -f tag=v1.0.4 --ref main && gh run view 25423756929 --json status,conclusion,jobs,url
- Exit code: 0
