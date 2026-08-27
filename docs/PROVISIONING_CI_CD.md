# 🔄 Data Provisioning in CI/CD

## Problem

In CI/CD there is no user input, but data provisioning (Custom Metadata Records, Custom Settings, etc.) between waves may require:

- Specific data that must be created before deploying dependent metadata
- Validation that data exists before continuing
- Deterministic error handling

## Solution: Automatic and Deterministic Provisioning

### Principles

1. **Automatic Detection**: Provisioning is automatically detected from the project source files
2. **No Pauses**: In CI/CD, provisioning executes automatically without requiring manual input
3. **Included in Plan**: The deployment plan includes provisioning information to ensure determinism
4. **Deterministic Failures**: If provisioning fails, deployment fails in a clear and predictable manner

---

## 📋 Provisioning Flow in CI/CD

### Step 1: Detection During `analyze`

When `sf smart-deployment analyze --save-plan` is executed, the system:

1. **Scans source files** to detect:

   - Custom Metadata Records (`.md-meta.xml` files)
   - Custom Settings (`.settings-meta.xml` files)
   - Record Types (`.recordType-meta.xml` files)
   - Picklist Values (`.field-meta.xml` files with values)

2. **Identifies dependencies** between metadata and data:

   - Which metadata depends on which data?
   - In which wave should provisioning be executed?

3. **Includes provisioning in the plan**:

```json
{
  "metadata": {
    "version": "1.0",
    "generatedAt": "2024-12-14T10:00:00Z",
    "totalComponents": 279,
    "totalWaves": 2
  },
  "waves": [
    {
      "number": 1,
      "components": ["CustomObject:Payment__c"],
      "provisioning": {
        "required": false,
        "records": []
      }
    },
    {
      "number": 2,
      "components": ["ApexClass:PaymentHandler"],
      "provisioning": {
        "required": true,
        "records": [
          {
            "type": "CustomMetadata",
            "name": "Payment__mdt.PaymentConfig",
            "filePath": "force-app/main/default/objects/Payment__mdt/records/PaymentConfig.md-meta.xml",
            "dependsOn": ["CustomObject:Payment__c"]
          }
        ]
      }
    }
  ]
}
```

### Step 2: Automatic Execution During `start`

When `sf smart-deployment start --use-plan` is executed in CI/CD:

1. **After each wave**, checks if provisioning is required:

```typescript
// Pseudocode of the flow
for (const wave of orderedWaves) {
  // 1. Deploy wave metadata
  await deployWave(wave);

  // 2. Check if provisioning is required after this wave
  if (wave.provisioning?.required) {
    // 3. Execute provisioning automatically (no pauses)
    const provisioningResult = await executeProvisioning(wave.provisioning.records, targetOrg);

    // 4. Validate that provisioning was successful
    if (!provisioningResult.success) {
      throw new Error(`Provisioning failed: ${provisioningResult.errors.join(', ')}`);
    }

    // 5. Continue with next wave
  }
}
```

2. **No pauses or manual input**: Everything is automatic and deterministic

3. **Errors are deterministic**: If provisioning fails, deployment fails immediately

---

## 🔧 Technical Implementation

### 1. Extend `DeploymentPlan` to Include Provisioning

```typescript
// src/types/deployment-plan.ts

export interface ProvisioningRecord {
  type: 'CustomMetadata' | 'CustomSettings' | 'RecordType' | 'PicklistValue';
  name: string;
  filePath: string;
  metadata: Record<string, unknown>;
  dependsOn: string[]; // Metadata components this depends on
}

export interface WaveProvisioning {
  required: boolean;
  records: ProvisioningRecord[];
}

export interface DeploymentWave {
  number: number;
  components: string[];
  provisioning?: WaveProvisioning; // New field
  metadata: WaveMetadata;
}
```

### 2. Detect Provisioning During `analyze`

```typescript
// src/commands/analyze.ts

// After generating waves
const dataProvisioner = new DataProvisioner();

for (const wave of waves) {
  // Detect provisioning needs for this wave
  const provisioningNeeds = dataProvisioner.detectProvisioningNeeds(wave.components.map((id) => componentMap.get(id)));

  if (provisioningNeeds.length > 0) {
    wave.provisioning = {
      required: true,
      records: provisioningNeeds.map((need) => ({
        type: need.type,
        name: need.name,
        filePath: need.filePath,
        metadata: need.metadata,
        dependsOn: need.dependsOn,
      })),
    };
  }
}
```

### 3. Execute Provisioning Automatically in `start`

```typescript
// src/commands/start.ts

// After deploying each wave
if (wave.provisioning?.required) {
  this.log(`\n📦 Provisioning data for Wave ${wave.number}...`);

  // Change state to PROVISIONING (for tracking, not to pause)
  await stateManager.saveState({
    status: 'provisioning',
    deploymentId,
    targetOrg,
    timestamp: new Date().toISOString(),
    totalWaves: orderedWaves.length,
    completedWaves: Array.from({ length: wave.number }, (_, i) => i + 1),
    currentWave: wave.number,
  });

  // Execute provisioning automatically
  const provisioningResult = await dataProvisioner.executeProvisioning(
    {
      waveNumber: wave.number,
      records: wave.provisioning.records,
      estimatedTime: wave.provisioning.records.length * 1000,
      dependencies: wave.provisioning.records.flatMap((r) => r.dependsOn),
    },
    orgApi // Salesforce connection
  );

  if (!provisioningResult.success) {
    // Fail deterministically
    throw new Error(
      `Provisioning failed for Wave ${wave.number}: ` +
        provisioningResult.errors.map((e) => `${e.record}: ${e.error}`).join(', ')
    );
  }

  this.log(`✅ Provisioned ${provisioningResult.recordsCreated} record(s)`);

  // Continue with next wave (change state to DEPLOYING)
  await stateManager.saveState({
    status: 'deploying',
    // ... rest of state
  });
}
```

---

## 🎯 Operation Modes

### Mode 1: Automatic CI/CD (Recommended)

```bash
# In CI/CD
sf smart-deployment start \
  --target-org prod \
  --use-plan .smart-deployment/deployment-plan.json \
  --strict
```

**Behavior:**

- ✅ Provisioning executes automatically
- ✅ No pauses or manual input
- ✅ Failures are deterministic
- ✅ Everything is included in the plan

### Mode 2: Interactive Development

```bash
# In local development
sf smart-deployment start \
  --target-org dev \
```

**Behavior:**

- ✅ Provisioning executes automatically
- ⚠️ May show warnings if data is missing
- ℹ️ May suggest reviewing data manually (but does not pause)

### Mode 3: Pre-Deploy Validation

```bash
# Validate provisioning before deploying
sf smart-deployment validate \
  --target-org staging \
  --source-path .
```

**Behavior:**

- ✅ Detects provisioning needs
- ✅ Validates that data can be created
- ✅ Does not execute provisioning, only validates

---

## 📊 Complete Example

### Source File: Custom Metadata Record

```xml
<!-- force-app/main/default/objects/Payment__mdt/records/PaymentConfig.md-meta.xml -->
<?xml version="1.0" encoding="UTF-8"?>
<CustomMetadata xmlns="http://soap.sforce.com/2006/04/metadata">
    <label>Payment Configuration</label>
    <protected>false</protected>
    <values>
        <field>Payment__c.Enabled__c</field>
        <value xsi:type="xsd:boolean">true</value>
    </values>
</CustomMetadata>
```

### Deployment Plan Generado

```json
{
  "waves": [
    {
      "number": 1,
      "components": ["CustomObject:Payment__c"],
      "provisioning": {
        "required": false,
        "records": []
      }
    },
    {
      "number": 2,
      "components": ["ApexClass:PaymentHandler"],
      "provisioning": {
        "required": true,
        "records": [
          {
            "type": "CustomMetadata",
            "name": "Payment__mdt.PaymentConfig",
            "filePath": "force-app/main/default/objects/Payment__mdt/records/PaymentConfig.md-meta.xml",
            "dependsOn": ["CustomObject:Payment__c"],
            "metadata": {
              "label": "Payment Configuration",
              "protected": false,
              "values": {
                "Payment__c.Enabled__c": true
              }
            }
          }
        ]
      }
    }
  ]
}
```

### Execution in CI/CD

```bash
$ sf smart-deployment start --target-org prod --use-plan plan.json --strict

🌊 Deploying Wave 1/2 (1 components)...
   ✅ Deployed 1 components

🌊 Deploying Wave 2/2 (1 components)...
   ✅ Deployed 1 components

📦 Provisioning data for Wave 2...
   ✅ Provisioned 1 record(s) (Payment__mdt.PaymentConfig)

✅ All waves deployed successfully!
```

---

## 🛡️ Error Handling

### Error: Missing Data

```bash
❌ Error: Provisioning failed for Wave 2:
   Payment__mdt.PaymentConfig: Custom Metadata Type 'Payment__mdt' not found

💡 Ensure CustomObject:Payment__c is deployed before provisioning records
```

**Solution:** The plan must ensure that objects/metadata are in previous waves.

### Error: Duplicate Data

```bash
⚠️  Warning: Custom Metadata Record 'PaymentConfig' already exists
   Skipping creation (idempotent behavior)
```

**Behavior:** Provisioning is idempotent - if data already exists, it continues without error.

### Error: Validation Failed

```bash
❌ Error: Provisioning validation failed:
   PaymentConfig: Required field 'Enabled__c' is missing

💡 Review Custom Metadata record definition
```

**Solution:** The plan must validate that data can be created before including it.

---

## 🔍 Pre-Deploy Validation

### Validate Provisioning Before Deploying

```bash
# Validate that provisioning can be executed
sf smart-deployment validate \
  --target-org staging \
  --source-path .
```

**Output:**

```
📊 Validating deployment...
✅ Found 279 components
✅ Generated 2 waves
📦 Validating provisioning requirements...

Wave 1: No provisioning required ✅
Wave 2: Provisioning required
   ✅ Payment__mdt.PaymentConfig: Can be created
   ✅ Payment__mdt.OtherConfig: Can be created

✅ All provisioning requirements validated
```

---

## 📝 Configuration

### `.smart-deployment.json`

```json
{
  "provisioning": {
    "autoExecute": true,
    "validateBeforeDeploy": true,
    "idempotent": true,
    "failOnError": true
  }
}
```

### Variables de Entorno

```bash
# CI/CD
export SF_PROVISIONING_AUTO_EXECUTE=true
export SF_PROVISIONING_FAIL_ON_ERROR=true
```

---

## ✅ Advantages of This Approach

1. **Deterministic**: Everything is in the plan, no surprises in CI/CD
2. **Automatic**: Does not require manual input in CI/CD
3. **Auditable**: Provisioning is versioned in the plan
4. **Predictable**: Errors are clear and deterministic
5. **Idempotent**: Can be executed multiple times without issues

---

## 🚨 Current Limitations

1. **Custom Settings**: Requires complete implementation of creation via SOAP/REST API
2. **Record Types**: Requires validation that parent object exists
3. **Picklist Values**: Requires validation that field exists

**Note:** These limitations will be resolved in future implementations.

---

## 📚 Referencias

- [US-107: Data Provisioning Between Waves](./USER_STORIES.md#us-107-data-provisioning-between-waves)
- [CI/CD Deployment Guide](./CI_CD_DEPLOYMENT.md)
- [State Manager Architecture](./ARCHITECTURE_DECISION_STATE_MANAGER.md)
