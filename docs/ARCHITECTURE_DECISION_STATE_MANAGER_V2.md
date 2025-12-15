# Architecture Decision: State Manager Approach (Revised)

## Real Usage Analysis

### Current Usage in Code

```typescript
// In start.ts - controlled sequential flow
stateMachine.transitionTo('INITIALIZING');
stateMachine.transitionTo('ANALYZING');
stateMachine.transitionTo('DEPLOYING');
// ... wave loop ...
stateMachine.transitionTo('DEPLOYING'); // each wave
stateMachine.transitionTo('COMPLETED'); // at the end
```

**Observation**: Transitions are **sequential and controlled**. There's no complex logic that depends on validating transitions.

### Real Cases We Need to Handle

#### 1. Data Provisioning
```typescript
// Option A: With state machine
stateMachine.transitionTo('PROVISIONING');
await provisioner.execute();
stateMachine.transitionTo('DEPLOYING');

// Option B: Without state machine (simpler)
await provisioner.execute(); // If provisioning needed, it does it
// Continue normally
```

**Do we need to validate that you can't skip PROVISIONING?**
- In practice, code controls the flow
- If there's provisioning, it executes before continuing
- Validation only prevents programming errors, not logic errors

#### 2. Manual Intervention
```typescript
// Option A: With state machine
stateMachine.transitionTo('PAUSED');
// Save state and exit
// User runs resume

// Option B: Without state machine (simpler)
if (needsManualIntervention) {
  await saveState({ status: 'paused', reason: 'manual_intervention' });
  this.log('Please enable setting X and run: sf smart deploy resume');
  return; // Exit
}
```

**Do we need to validate transitions for this?**
- Code simply saves state and exits
- No risk of invalid transitions because code controls the flow

## Conclusion: Formal State Machine NOT Required

### Reasons

1. **Sequential Flow**: Deployment is a linear flow controlled by code
2. **States are for Persistence**: States are primarily used for save/load for resume
3. **Validation is Redundant**: Validation only prevents programming errors, not business logic errors
4. **Complexity vs Benefit**: ~300 lines of code to validate obvious transitions

### Simple Alternative (Recommended)

```typescript
type DeploymentStatus =
  | 'idle'
  | 'initializing'
  | 'analyzing'
  | 'deploying'
  | 'paused'           // For tracking, not for validation
  | 'provisioning'    // For tracking, not for validation
  | 'failed'
  | 'completed'
  | 'cancelled';

interface DeploymentState {
  status: DeploymentStatus;
  currentWave?: number;
  completedWaves: number[];
  failedWave?: { waveNumber: number; error: string; timestamp: string };
  // ... other fields
}

// Simple save/load
async function saveState(state: DeploymentState): Promise<void> {
  // Basic validation: status must be valid enum value
  if (!VALID_STATUSES.includes(state.status)) {
    throw new Error(`Invalid status: ${state.status}`);
  }
  await fs.writeFile(STATE_FILE, JSON.stringify(state, null, 2));
}

// Conditional logic for provisioning
async function deployWave(wave: Wave, nextWave?: Wave): Promise<void> {
  // Deploy wave
  await deploy(wave);

  // If next wave needs provisioning, do it
  if (needsProvisioning(wave, nextWave)) {
    await saveState({ ...currentState, status: 'provisioning' });
    await provisioner.execute();
    await saveState({ ...currentState, status: 'deploying' });
  }
}
```

### Benefits of Simple Alternative

1. **Less code**: ~50 lines vs ~300 lines
2. **Easier to understand**: Explicit logic vs implicit validation
3. **Equally safe**: Code controls the flow anyway
4. **More flexible**: Easy to add new states without modifying validations

## Decision

**Do NOT use formal state machine**. Use simple enum + basic validation + explicit conditional logic.

## Implementation

See `src/deployment/state-manager.ts` for the simplified implementation.

---

**Status**: ✅ Implemented
**Date**: December 2025
**Supersedes**: [ARCHITECTURE_DECISION_STATE_MANAGER.md](./archive/ARCHITECTURE_DECISION_STATE_MANAGER.md)
