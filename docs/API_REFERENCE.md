# 📚 API Reference - Smart Deployment Plugin

**Version**: 1.0.0
**Last Updated**: December 14, 2025

Complete TypeScript API reference for the Smart Deployment Plugin.

---

## 📋 Table of Contents

- [Services](#services)
- [Wave Generation](#wave-generation)
- [Deployment](#deployment)
- [AI Services](#ai-services)
- [Dependencies](#dependencies)
- [Parsers](#parsers)
- [Utilities](#utilities)
- [Types](#types)

---

## Services

### MetadataScannerService

Scans Salesforce project metadata and builds dependency graph.

**Location**: `src/services/metadata-scanner-service.ts`

#### Methods

##### `scan(options: ScanOptions): Promise<ScanResult>`

Scans project metadata and builds dependency graph.

**Parameters**:
- `options.sourcePath?: string` - Source path (default: `.`)
- `options.ignorePatterns?: string[]` - Patterns to ignore

**Returns**: `Promise<ScanResult>`

**Example**:
```typescript
import { MetadataScannerService } from './services/metadata-scanner-service.js';

const scanner = new MetadataScannerService();
const result = await scanner.scan({ sourcePath: 'force-app' });

console.log(`Found ${result.components.length} components`);
console.log(`Found ${result.dependencyResult.stats.totalDependencies} dependencies`);
```

**ScanResult**:
```typescript
interface ScanResult {
  components: MetadataComponent[];
  dependencyResult: {
    graph: DependencyGraph;
    stats: DependencyStats;
  };
  errors: string[];
  warnings: string[];
}
```

---

## Wave Generation

### WaveBuilder

Generates deployment waves from dependency graph.

**Location**: `src/waves/wave-builder.ts`

#### Methods

##### `generateWaves(graph: DependencyGraph): WaveGenerationResult`

Generates deployment waves using topological sort.

**Parameters**:
- `graph: DependencyGraph` - Dependency graph

**Returns**: `WaveGenerationResult`

**Example**:
```typescript
import { WaveBuilder } from './waves/wave-builder.js';

const builder = new WaveBuilder();
const result = builder.generateWaves(dependencyGraph);

console.log(`Generated ${result.waves.length} waves`);
result.waves.forEach(wave => {
  console.log(`Wave ${wave.number}: ${wave.components.length} components`);
});
```

**WaveGenerationResult**:
```typescript
interface WaveGenerationResult {
  waves: Wave[];
  stats: {
    totalWaves: number;
    totalComponents: number;
    averageComponentsPerWave: number;
  };
}
```

### WaveSplitter

Splits large waves to comply with Salesforce limits.

**Location**: `src/waves/wave-splitter.ts`

#### Methods

##### `splitWave(wave: Wave, options?: SplitOptions): Wave[]`

Splits a wave into multiple smaller waves.

**Parameters**:
- `wave: Wave` - Wave to split
- `options.maxComponents?: number` - Max components per wave (default: 300)
- `options.maxCmtRecords?: number` - Max CMT records per wave (default: 200)

**Returns**: `Wave[]`

**Example**:
```typescript
import { WaveSplitter } from './waves/wave-splitter.js';

const splitter = new WaveSplitter();
const splitWaves = splitter.splitWave(largeWave, {
  maxComponents: 300,
  maxCmtRecords: 200
});
```

### WaveValidator

Validates deployment waves.

**Location**: `src/waves/wave-validator.ts`

#### Methods

##### `validateWaves(waves: Wave[], graph: DependencyGraph): ValidationResult`

Validates waves for correctness.

**Parameters**:
- `waves: Wave[]` - Waves to validate
- `graph: DependencyGraph` - Dependency graph

**Returns**: `ValidationResult`

**Example**:
```typescript
import { WaveValidator } from './waves/wave-validator.js';

const validator = new WaveValidator();
const result = validator.validateWaves(waves, graph);

if (result.errors.length > 0) {
  console.error('Validation errors:', result.errors);
}
```

---

## Deployment

### ManifestGenerator

Generates `package.xml` files for deployment waves.

**Location**: `src/deployment/manifest-generator.ts`

#### Methods

##### `generateManifests(waves: Wave[], options?: ManifestOptions): Promise<ManifestGenerationResult>`

Generates manifests for all waves.

**Parameters**:
- `waves: Wave[]` - Deployment waves
- `options.sourcePath?: string` - Source path
- `options.validateFiles?: boolean` - Validate files exist
- `options.agentforceService?: AgentforceService` - AI service for type mapping

**Returns**: `Promise<ManifestGenerationResult>`

**Example**:
```typescript
import { ManifestGenerator } from './deployment/manifest-generator.js';

const generator = new ManifestGenerator();
const result = await generator.generateManifests(waves, {
  sourcePath: 'force-app',
  validateFiles: true
});

result.manifests.forEach(manifest => {
  console.log(`Wave ${manifest.waveNumber}: ${manifest.path}`);
});
```

### ManifestValidator

Validates generated manifests against source.

**Location**: `src/deployment/manifest-validator.ts`

#### Methods

##### `validateManifest(manifest: Manifest, sourcePath: string): Promise<ValidationResult>`

Validates manifest against source project.

**Parameters**:
- `manifest: Manifest` - Manifest to validate
- `sourcePath: string` - Source path

**Returns**: `Promise<ValidationResult>`

**Example**:
```typescript
import { ManifestValidator } from './deployment/manifest-validator.js';

const validator = new ManifestValidator();
const result = await validator.validateManifest(manifest, 'force-app');

if (result.errors.length > 0) {
  console.error('Manifest validation errors:', result.errors);
}
```

### SfCliIntegration

Integrates with Salesforce CLI for deployments.

**Location**: `src/deployment/sf-cli-integration.ts`

#### Methods

##### `deploy(options: DeploymentOptions): Promise<DeploymentResult>`

Executes deployment via SF CLI.

**Parameters**:
- `options.targetOrg: string` - Target org
- `options.sourcePath?: string` - Source path
- `options.manifestPath?: string` - Manifest path
- `options.testLevel?: TestLevel` - Test level
- `options.testClasses?: string[]` - Test classes
- `options.dryRun?: boolean` - Dry run mode

**Returns**: `Promise<DeploymentResult>`

**Example**:
```typescript
import { SfCliIntegration } from './deployment/sf-cli-integration.js';

const sfCli = new SfCliIntegration();
const result = await sfCli.deploy({
  targetOrg: 'myorg',
  manifestPath: '.smart-deployment/wave-1/package.xml',
  testLevel: 'RunSpecifiedTests',
  testClasses: ['MyTestClass']
});
```

### StateManager

Manages deployment state for resume capability.

**Location**: `src/deployment/state-manager.ts`

#### Methods

##### `saveState(state: DeploymentState): Promise<void>`

Saves deployment state.

**Parameters**:
- `state: DeploymentState` - Deployment state

**Returns**: `Promise<void>`

**Example**:
```typescript
import { StateManager } from './deployment/state-manager.js';

const stateManager = new StateManager();
await stateManager.saveState({
  status: 'deploying',
  deploymentId: 'deploy-123',
  targetOrg: 'myorg',
  currentWave: 3,
  completedWaves: [1, 2]
});
```

##### `loadState(): Promise<DeploymentState | null>`

Loads deployment state.

**Returns**: `Promise<DeploymentState | null>`

##### `hasFailedDeployment(): Promise<boolean>`

Checks if there's a failed deployment.

**Returns**: `Promise<boolean>`

---

## AI Services

### AgentforceService

Core Agentforce AI service.

**Location**: `src/ai/agentforce-service.ts`

#### Methods

##### `inferDependencies(components: MetadataComponent[], options?: InferenceOptions): Promise<DependencyInferenceResult>`

Infers dependencies using AI.

**Parameters**:
- `components: MetadataComponent[]` - Components to analyze
- `options.orgType?: string` - Org type
- `options.industry?: string` - Industry context

**Returns**: `Promise<DependencyInferenceResult>`

**Example**:
```typescript
import { AgentforceService } from './ai/agentforce-service.js';

const service = new AgentforceService();
const result = await service.inferDependencies(components, {
  orgType: 'Production',
  industry: 'Fintech'
});
```

### DependencyInferenceService

Service for AI-powered dependency inference.

**Location**: `src/ai/dependency-inference-service.ts`

#### Methods

##### `inferDependencies(components: MetadataComponent[], options?: InferenceOptions): Promise<InferenceResult>`

Infers dependencies using Agentforce.

**Parameters**:
- `components: MetadataComponent[]` - Components
- `options.orgType?: string` - Org type
- `options.industry?: string` - Industry

**Returns**: `Promise<InferenceResult>`

### AgentforcePriorityService

Service for AI-powered priority weighting.

**Location**: `src/ai/agentforce-priority-service.ts`

#### Methods

##### `calculatePriorities(components: MetadataComponent[], options?: PriorityOptions): Promise<PriorityResult>`

Calculates component priorities using AI.

**Parameters**:
- `components: MetadataComponent[]` - Components
- `options.orgType?: string` - Org type
- `options.industry?: string` - Industry

**Returns**: `Promise<PriorityResult>`

---

## Dependencies

### DependencyGraphBuilder

Builds dependency graph from components.

**Location**: `src/dependencies/dependency-graph-builder.ts`

#### Methods

##### `buildGraph(components: MetadataComponent[]): DependencyGraph`

Builds dependency graph.

**Parameters**:
- `components: MetadataComponent[]` - Components

**Returns**: `DependencyGraph`

### CircularDependencyDetector

Detects circular dependencies.

**Location**: `src/dependencies/circular-dependency-detector.ts`

#### Methods

##### `detectCycles(graph: DependencyGraph): Cycle[]`

Detects circular dependencies.

**Parameters**:
- `graph: DependencyGraph` - Dependency graph

**Returns**: `Cycle[]`

### DependencyMerger

Merges static and AI-inferred dependencies.

**Location**: `src/dependencies/dependency-merger.ts`

#### Methods

##### `merge(staticDeps: DependencyGraph, aiDeps: DependencyGraph, options?: MergeOptions): DependencyGraph`

Merges dependency graphs.

**Parameters**:
- `staticDeps: DependencyGraph` - Static dependencies
- `aiDeps: DependencyGraph` - AI-inferred dependencies
- `options.conflictResolution?: 'static' | 'ai' | 'merge'` - Conflict resolution

**Returns**: `DependencyGraph`

---

## Parsers

### ErrorResilientParser

Base parser with error resilience.

**Location**: `src/parsers/error-resilient-parser.ts`

#### Methods

##### `parse(filePath: string, content: string): Promise<ParseResult>`

Parses metadata file with error handling.

**Parameters**:
- `filePath: string` - File path
- `content: string` - File content

**Returns**: `Promise<ParseResult>`

### ApexClassParser

Parses Apex class files.

**Location**: `src/parsers/apex-class-parser.ts`

#### Methods

##### `parse(filePath: string, content: string): Promise<ApexClassMetadata>`

Parses Apex class.

**Parameters**:
- `filePath: string` - File path
- `content: string` - Class content

**Returns**: `Promise<ApexClassMetadata>`

---

## Utilities

### Logger

Structured logging utility.

**Location**: `src/utils/logger.ts`

#### Methods

##### `getLogger(name: string): Logger`

Gets logger instance.

**Parameters**:
- `name: string` - Logger name

**Returns**: `Logger`

**Example**:
```typescript
import { getLogger } from './utils/logger.js';

const logger = getLogger('MyService');
logger.info('Operation started', { userId: 123 });
logger.error('Operation failed', { error });
```

### ErrorAggregator

Aggregates and reports errors.

**Location**: `src/utils/error-aggregator.ts`

#### Methods

##### `addError(error: ErrorInfo): void`

Adds error to aggregation.

**Parameters**:
- `error: ErrorInfo` - Error information

##### `generateReport(): ErrorReport`

Generates error report.

**Returns**: `ErrorReport`

### RetryHandler

Handles retries with exponential backoff.

**Location**: `src/deployment/retry-handler.ts`

#### Methods

##### `executeWithRetry<T>(fn: () => Promise<T>, operation: string): Promise<T>`

Executes function with retry logic.

**Parameters**:
- `fn: () => Promise<T>` - Function to execute
- `operation: string` - Operation name

**Returns**: `Promise<T>`

---

## Types

### MetadataComponent

```typescript
interface MetadataComponent {
  type: MetadataType;
  name: string;
  filePath: string;
  apiVersion?: string;
  dependencies?: string[];
  metadata?: Record<string, unknown>;
}
```

### Wave

```typescript
interface Wave {
  number: number;
  components: MetadataComponent[];
  dependencies: string[];
  testClasses?: string[];
  metadata?: WaveMetadata;
}
```

### DeploymentState

```typescript
interface DeploymentState {
  status: DeploymentStatus;
  deploymentId: string;
  targetOrg: string;
  timestamp: string;
  totalWaves: number;
  completedWaves: number[];
  currentWave?: number;
  failedWave?: {
    waveNumber: number;
    error: string;
    timestamp: string;
  };
  metadata?: Record<string, unknown>;
}
```

### DependencyGraph

```typescript
interface DependencyGraph {
  nodes: Map<string, MetadataComponent>;
  edges: Map<string, string[]>;
  stats: DependencyStats;
}
```

---

## Related Documentation

- [User Guide](./USER_GUIDE.md) - Getting started
- [CLI Reference](./CLI_REFERENCE.md) - Command reference
- [Architecture](./architecture/ARCHITECTURE.md) - Architecture overview

---

**Last Updated**: December 14, 2025








