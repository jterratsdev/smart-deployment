# ADR-001: CI/CD-Agnostic Manual Wave Checkpoints

- Status: Accepted
- Date: 2026-08-05
- Decision owners: Smart Deployment maintainers

## Context

Some Salesforce deployments require an action that cannot be completed by a Metadata API deployment. For example, a new Decision Table may need activation before a later wave deploys a Flow that references it. Data Cloud deployments can similarly require connection authorization, stream deployment, or component activation.

CI runners are commonly non-interactive and ephemeral. Waiting for terminal input is therefore not portable across GitHub Actions, Azure DevOps, Bitbucket Pipelines, GitLab CI, and Jenkins.

## Decision

The plugin models required manual actions as explicit checkpoints before or after a deployment wave. Reaching a checkpoint is a successful, durable halt rather than a deployment failure.

Approval orchestration remains the responsibility of the CI/CD platform. The plugin does not call provider-specific approval APIs and does not wait for terminal input.

### Configuration

Checkpoints are declared in `.smart-deployment.json`:

```json
{
  "checkpoints": [
    {
      "id": "activate-decision-table",
      "phase": "after",
      "waveNumber": 2,
      "message": "Activate DecisionTable CustomerEligibility before deploying the dependent Flow."
    }
  ]
}
```

Checkpoint IDs must be unique. Only one checkpoint can target a given phase and wave. Invalid or missing wave references fail before deployment.

### Pause Behavior

When `start` or `resume` reaches an unapproved checkpoint, the plugin:

1. Stops before executing work beyond the checkpoint.
2. Writes `.smart-deployment/deployment-state.json` atomically.
3. Records completed waves, execution position, target org, options, checkpoint details, and a deployment-plan fingerprint.
4. Returns a machine-readable result with `outcome: "paused"` and exit code `0`.

A checkpoint before a wave is persisted before staging or Salesforce calls. A checkpoint after a wave is persisted only after that wave succeeds and its temporary workspace is cleaned.

### Resume Behavior

The continuation command is non-interactive:

```bash
sf smart-deployment resume \
  --source-path . \
  --target-org production \
  --approve-checkpoint activate-decision-table \
  --json
```

Before continuing, the plugin validates:

- the exact checkpoint ID
- the target org
- the ordered wave list
- the source-derived plan fingerprint
- the next execution position

A pre-wave checkpoint resumes from the same wave. A post-wave checkpoint resumes from the first uncompleted wave. Completed waves are not redeployed. A checkpoint after the final wave is acknowledged without another Salesforce deployment.

Cycle-remediation deployments currently reject manual wave checkpoints because their two synthetic phases have separate restoration semantics.

### State Artifact

Ephemeral runners must preserve `.smart-deployment/deployment-state.json` as a pipeline artifact or in an approved external state store. Runtime state must not be committed automatically to Git.

Malformed state is an error; it is not treated as absent state. State includes no Salesforce credentials, but it can include org and deployment identifiers and must be protected accordingly.

### CI/CD Responsibilities

The CI/CD platform is responsible for:

- preserving and restoring the state artifact
- presenting checkpoint instructions
- enforcing approval permissions and separation of duties
- running the manual action
- invoking `resume --approve-checkpoint <id>`

| Platform            | Recommended approval mechanism                     |
| ------------------- | -------------------------------------------------- |
| GitHub Actions      | Protected Environment with required reviewers      |
| Azure DevOps        | Environment approvals/checks or `ManualValidation` |
| Bitbucket Pipelines | Manual deployment step or `trigger: manual`        |
| GitLab CI           | Protected job with `when: manual`                  |
| Jenkins             | Protected `input` stage                            |

### Azure DevOps

```yaml
- stage: DeployUntilCheckpoint
  jobs:
    - job: Deploy
      steps:
        - script: sf smart-deployment start --target-org production --json > deployment-result.json
        - task: PublishPipelineArtifact@1
          inputs:
            targetPath: .smart-deployment/deployment-state.json
            artifact: smart-deployment-state

- stage: ResumeDeployment
  dependsOn: DeployUntilCheckpoint
  jobs:
    - deployment: Resume
      environment: production-manual-approval
      strategy:
        runOnce:
          deploy:
            steps:
              - task: DownloadPipelineArtifact@2
                inputs:
                  artifact: smart-deployment-state
                  path: .smart-deployment
              - script: sf smart-deployment resume --target-org production --approve-checkpoint activate-decision-table --json
```

### Bitbucket Pipelines

```yaml
pipelines:
  custom:
    smart-deployment:
      - step:
          name: Deploy until checkpoint
          script:
            - sf smart-deployment start --target-org production --json > deployment-result.json
          artifacts:
            - .smart-deployment/deployment-state.json
            - deployment-result.json

      - step:
          name: Approve completed manual action
          trigger: manual
          script:
            - echo "Confirm that the checkpoint instructions have been completed."

      - step:
          name: Resume deployment
          script:
            - sf smart-deployment resume --target-org production --approve-checkpoint activate-decision-table --json
```

## Alternatives Rejected

- Waiting for terminal input: non-interactive runners hang or time out.
- Keeping one runner open: consumes capacity and is vulnerable to provider timeouts.
- Provider-specific approval APIs: expands coupling and the security boundary.
- Treating a checkpoint as failure: produces misleading alerts and retry behavior.
- Committing runtime state: creates environment-specific conflicts and unsafe automated commits.

## Consequences

The design is portable and auditable, and completed waves are not repeated after approval. Pipelines must preserve state, and the plugin must maintain a versioned state/result contract. Artifact retention, concurrent deployments, and approvals performed without the manual action remain operational risks.

## Follow-Up Decisions

- Automated command or REST API checkpoint hooks
- External durable state stores and locking
- Source revision verification in addition to the plan fingerprint
- Checkpoints around circular-dependency remediation phases
