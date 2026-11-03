# Wave Actions

Some deployment steps cannot be represented by Salesforce Metadata API. Smart Deployment can associate those steps with the wave that contains a selected component or metadata type.

Declare `waveActions` in `.smart-deployment.json`:

```json
{
  "waveActions": [
    {
      "id": "seed-account-data",
      "phase": "after",
      "when": {
        "components": ["CustomObject:Account"]
      },
      "action": {
        "kind": "apex-anonymous",
        "script": "scripts/apex/actions/seed-account.apex",
        "description": "Create the records required by later automation."
      }
    },
    {
      "id": "authorize-provider",
      "phase": "before",
      "when": {
        "types": ["Flow"]
      },
      "action": {
        "kind": "manual",
        "instruction": "Authorize the external provider before deploying flows."
      }
    }
  ]
}
```

For Apex-only actions, the rule can live in the script itself under `scripts/apex/actions`:

```apex
// smart-deployment-action: {"id":"seed-account-data","phase":"after","when":{"components":["CustomObject:Account"]},"description":"Create records needed by later automation."}

System.debug('Seed account data');
```

The plugin discovers `.apex` files recursively under `scripts/apex/actions`. That directory is strict: every `.apex` file must contain exactly one valid header. Put auxiliary scripts without deployment metadata under `scripts/apex/library` instead. The header is parsed as JSON and becomes the same `WaveActionRule` contract used by repository configuration. Duplicate IDs between scripts and `.smart-deployment.json`, malformed headers, and multiple headers in one script are rejected.

The selector is resolved after dependency ordering and optional AI prioritization. Component selectors match an exact `Type:Name` identifier; type selectors match every wave containing that metadata type. A rule that matches multiple waves produces one checkpoint: the first matching wave for `before`, or the last matching wave for `after`.

Anonymous Apex script paths must be project-relative, point to an existing file, and end in `.apex`. The plugin hashes the file and stores that hash in the resolved action, so changing the script invalidates a paused deployment. The plugin reports the action and pauses durably at the resolved boundary; it does not execute repository scripts automatically. After completing the action, continue with:

```bash
sf smart-deployment resume --approve-checkpoint required-actions-after-wave-1 --target-org production --json
```

Generated deployment plans expose both `requiresAction` and `requiredActions` for each wave. Explicit checkpoints at the same boundary are preserved and receive the resolved action details.

The same generated checkpoints are included in CI preset artifacts. Checkpoint IDs and action IDs must be unique; incompatible definitions with the same ID are rejected.
