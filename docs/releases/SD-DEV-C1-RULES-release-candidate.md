![Salesforce Cloud](https://cdn.prod.website-files.com/691f4b0505409df23e191b87/69416b267de7ae6888996981_logo.svg)

# SD-DEV-C1-RULES — Release Candidate Note

Author: Salesforce Professional Services (release-manager profile)

Version: 1.0

- Run: wf-1793266575987-0bc63f · Phase: `release` · task `setup-agents-task-1793717675387-32163962`
- Repo: `@jterrats/smart-deployment` (TypeScript `sf` CLI plugin — **not** a Salesforce org project)
- Branch: `feature/SD-DEV-C1-RULES-matching-duplicate`, rebased on `main` `7bdebcd`
- Current published tag: `v1.7.0`

## What changed

- `MatchingRules` and `DuplicateRule` are scanned with strict parsers. A `MatchingRules` file is
  supported only when its real `<MatchingRules>` container root parses; an empty container is still a
  component with no local rules.
- `DuplicateRule` references are classified `local`, `local-missing` or `target-unknown`.
  `local-missing` blocks the plan; `target-unknown` is recorded as a fact with no dependency and no
  readiness claim.
- Gap analysis reports these two types as supported only when every detected file parses.
- Deployment of both types stays blocked (AC-004) in `WaveManifestService` and in the `ci-publish`
  core phase, through the shared `src/deployment/data-quality-rule-guard.ts`, until target-org
  evidence exists.

## Behaviour change for users

`ci-publish` is now all-or-nothing: any plan error (C4 OmniStudio blocked paths, AI evaluation
precheck, the data-quality rule guard) stops every phase, and the command reports that it was
blocked before any command ran. See `docs/known-limitations.md`.

## Evidence (HEAD of this branch)

| Check                                            | Result                                                     |
| ------------------------------------------------ | ---------------------------------------------------------- |
| `yarn build`                                     | pass                                                       |
| Full unit suite (`c8 mocha "test/**/*.test.ts"`) | 1866 passing, 8 pending, 0 failing                         |
| `npm audit --omit=dev`                           | 0 vulnerabilities                                          |
| `yarn release:contracts`                         | valid                                                      |
| `yarn release:analyze` (dry)                     | next release `minor` → `1.8.0` (13 commits since `v1.7.0`) |

Reviews: `docs/reviews/SD-DEV-C1-RULES-security-review.md` (PASS-WITH-FINDINGS after re-review),
`docs/testing/SD-DEV-C1-RULES-qa-report.md` (PASS-WITH-RISKS),
`docs/reviews/SD-DEV-C1-RULES-document-review.json` (approve).

## Residual risks

- No target-org evidence for AC-004; deployment of both types remains blocked by design.
- `minimumApiVersion` for both types is unconfirmed (kept at `61.0`).

## Rollback

Revert the squash commit of this PR. Scanning and gap analysis return to suffix-only detection,
and `ci-publish` returns to running unblocked phases when another phase has errors.

## Pending human steps

1. Merge the PR with `gh pr merge <number> --squash --admin` (`main` requires one review).
2. semantic-release publishes from `main`.
