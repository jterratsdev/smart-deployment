# Workflow Estimate

Declare a t-shirt size delivery estimate for a story before handing off to implementation.

## When To Load

- Trigger: `estimate`
- Trigger: `t-shirt`
- Trigger: `sizing`
- Trigger: `workflow estimate`
- Trigger: `architect handoff`
- Trigger: `baseline`

## Procedure

1. Check whether an estimate already exists (idempotent):

   ```bash
   sf setup-agents workflow benchmark --story <storyId>
   ```

   If an estimate row appears, skip — do not overwrite.

2. Assess sizing based on technical tasking and design complexity:

   | Label | Solo effort |
   | ----- | ----------- |
   | xs    | ≤ 0.5 days  |
   | s     | ≤ 1 day     |
   | m     | ≤ 3 days    |
   | l     | ≤ 5 days    |
   | xl    | > 5 days    |

3. Declare the estimate:

   ```bash
   sf setup-agents workflow estimate \
     --story <storyId> \
     --sizing <xs|s|m|l|xl> \
     --solo-days <n> \
     --ai-unguided-days <n> \
     --confidence <low|medium|high> \
     --declared-by architect
   ```

4. Record evidence:
   ```bash
   sf setup-agents evidence add \
     --task <id> \
     --type metric \
     --summary "estimate declared: sizing=<label> solo=<n>d ai-unguided=<n>d"
   ```

## Evidence

- `command`
- `metric`
