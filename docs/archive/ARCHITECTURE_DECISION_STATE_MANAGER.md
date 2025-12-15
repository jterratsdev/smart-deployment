# Architecture Decision: State Manager Approach

> ⚠️ **DEPRECATED**: This document describes the original state machine approach.  
> **Current Implementation**: See [ARCHITECTURE_DECISION_STATE_MANAGER_V2.md](./ARCHITECTURE_DECISION_STATE_MANAGER_V2.md) for the simplified approach that was actually implemented.  
> **Status**: This document is kept for historical reference only.

## Context
The `StateManager` needs to track deployment lifecycle for resume capability (US-089).

## Critical Requirements

### Data Provisioning Between Waves (US-107)
- **REQUIRED**: When wave N+1 depends on data from wave N, deployment MUST pause in `PROVISIONING` state
- **Cannot skip**: Deployment cannot continue until provisioning completes
- **State affects behavior**: `canContinue()` returns false during provisioning

### Manual Intervention (Settings, etc.)
- **REQUIRED**: When manual intervention is needed (e.g., enable a setting), deployment MUST pause in `PAUSED` state
- **Cannot skip**: Deployment cannot continue until user completes manual action
- **State affects behavior**: `canContinue()` returns false when paused

## Decision: Formal State Machine (APPROVED)

**Why State Machine is Required:**

1. **States affect behavior**: `PROVISIONING` and `PAUSED` block deployment continuation
2. **Cannot skip states**: Validation prevents skipping critical states
3. **Conditional transitions**: Transitions depend on provisioning needs and manual intervention
4. **Resume capability**: Need to know exact state to resume correctly

## State Machine Design

### States
- `IDLE`: No deployment active
- `INITIALIZING`: Deployment starting, scanning metadata
- `ANALYZING`: Analyzing dependencies and generating waves
- `DEPLOYING`: Actively deploying waves
- `PROVISIONING`: **REQUIRED** - Data provisioning between waves (cannot skip)
- `PAUSED`: **REQUIRED** - Manual intervention needed (cannot skip)
- `FAILED`: Deployment failed (can resume)
- `COMPLETED`: All waves deployed successfully
- `CANCELLED`: Deployment cancelled by user

### Critical Transitions

```
DEPLOYING -> PROVISIONING (when data provisioning needed)
PROVISIONING -> DEPLOYING (after provisioning completes)
DEPLOYING -> PAUSED (when manual intervention needed)
PAUSED -> DEPLOYING (after manual intervention completes)
```

### Validation Rules

1. **Cannot skip PROVISIONING**: If provisioning is needed, must transition to PROVISIONING
2. **Cannot skip PAUSED**: If manual intervention needed, must transition to PAUSED
3. **Cannot continue during PROVISIONING**: `canContinue()` returns false
4. **Cannot continue during PAUSED**: `canContinue()` returns false

## Implementation

### State Machine Methods

```typescript
// Check if deployment can continue
canContinue(): boolean {
  return ['DEPLOYING', 'INITIALIZING', 'ANALYZING'].includes(currentState);
}

// Check if provisioning is required
isProvisioning(): boolean {
  return currentState === 'PROVISIONING';
}

// Check if manual intervention is required
requiresManualIntervention(): boolean {
  return currentState === 'PAUSED';
}
```

### Integration with DataProvisioner

```typescript
// After deploying wave N
if (needsProvisioningBeforeNextWave(waveN, waveN+1)) {
  stateMachine.transitionTo('PROVISIONING');
  await dataProvisioner.executeProvisioning(provisioningWave);
  stateMachine.transitionTo('DEPLOYING'); // Can now continue
}
```

### Integration with Manual Intervention

```typescript
// When manual intervention is detected
if (requiresManualSetting(wave)) {
  stateMachine.transitionTo('PAUSED');
  this.log('⏸️  Deployment paused. Please enable setting X and run: sf smart deploy resume');
  return; // Wait for user
}
```

## Conclusion

**State Machine is REQUIRED** because:
- States affect deployment behavior (blocking vs non-blocking)
- Cannot skip critical states (PROVISIONING, PAUSED)
- Need formal validation to prevent invalid states
- Resume capability requires exact state tracking
