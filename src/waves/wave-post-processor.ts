/**
 * Wave Post Processor - Post-processing for wave optimization
 *
 * Applies intelligent post-processing to waves to avoid metadata simplification:
 * - Moves Permission Set Groups after their Permission Sets
 * - Moves Flows to the same wave as their Apex Actions
 * - Moves FlexiPages after their LWC/Flow dependencies
 * - Splits large waves to avoid UNKNOWN_EXCEPTION errors
 *
 * Based on logic from sf_dependency_analyzer.py
 *
 * @ac US-XXX-AC-1: Sync Permission Set Groups with Permission Sets
 * @ac US-XXX-AC-2: Sync Flows with Apex Actions
 * @ac US-XXX-AC-3: Sync FlexiPages with dependencies
 * @ac US-XXX-AC-4: Split large waves
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from './wave-builder.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';

const logger = getLogger('WavePostProcessor');

export interface PostProcessingOptions {
  /** Maximum components per wave before splitting */
  maxComponentsPerWave?: number;
  /** Whether to sync PSG with Permission Sets */
  syncPSG?: boolean;
  /** Whether to sync Flows with Apex Actions */
  syncFlows?: boolean;
  /** Whether to sync FlexiPages with dependencies */
  syncFlexiPages?: boolean;
  /** Whether to split large waves */
  splitLargeWaves?: boolean;
  /** Whether to sync test classes with classes they cover indirectly */
  syncTestClasses?: boolean;
}

/**
 * Wave Post Processor
 *
 * Applies post-processing optimizations to waves to reduce the need for metadata simplification
 */
export class WavePostProcessor {
  private readonly options: Required<PostProcessingOptions>;
  private readonly componentMap: Map<NodeId, MetadataComponent>;

  public constructor(
    componentMap: Map<NodeId, MetadataComponent>,
    options: PostProcessingOptions = {}
  ) {
    this.componentMap = componentMap;
    this.options = {
      maxComponentsPerWave: options.maxComponentsPerWave ?? 300,
      syncPSG: options.syncPSG ?? true,
      syncFlows: options.syncFlows ?? true,
      syncFlexiPages: options.syncFlexiPages ?? true,
      splitLargeWaves: options.splitLargeWaves ?? true,
      syncTestClasses: options.syncTestClasses ?? true,
    };
  }

  /**
   * Apply all post-processing optimizations
   */
  public processWaves(waves: Wave[]): {
    waves: Wave[];
    manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>;
  } {
    logger.info('Starting wave post-processing', {
      initialWaves: waves.length,
      options: this.options,
    });

    let processedWaves = [...waves];
    let manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }> = [];

    // 1. Sync Permission Set Groups with Permission Sets
    if (this.options.syncPSG) {
      processedWaves = this.syncPSGWithPermissionSets(processedWaves);
    }

    // 2. Sync Flows with Apex Actions
    if (this.options.syncFlows) {
      processedWaves = this.syncFlowsWithApexActions(processedWaves);
    }

    // 3. Sync FlexiPages with dependencies
    if (this.options.syncFlexiPages) {
      processedWaves = this.syncFlexiPagesWithDependencies(processedWaves);
    }

    // 4. Sync LightningApps with FlexiPages they depend on (utilityBar)
    processedWaves = this.syncLightningAppsWithFlexiPages(processedWaves);

    // 5. Sync Custom Metadata Records with their Types
    processedWaves = this.syncCustomMetadataRecordsWithTypes(processedWaves);

    // 6. Sync test classes with classes they cover indirectly
    if (this.options.syncTestClasses) {
      processedWaves = this.syncTestClassesWithIndirectCoverage(processedWaves);
    }

    // 7. Sync Apex classes with their dependents (move classes referenced by later waves)
    // Skip critical dependencies as they're already handled above
    processedWaves = this.syncApexClassesWithDependents(processedWaves);

    // 8. Sync Visualforce Pages with Components that reference them
    processedWaves = this.syncVisualforcePagesWithComponents(processedWaves);

    // 9. Split large waves FIRST (before syncing critical dependencies)
    // This ensures we know the final wave structure before moving critical dependencies
    if (this.options.splitLargeWaves) {
      processedWaves = this.splitLargeWaves(processedWaves);
    }

    // 10. Sync critical dependencies with test classes AFTER splitLargeWaves
    // This ensures dependencies are moved to the correct waves after splitting
    // Only move dependencies to waves that actually have test classes
    if (this.options.syncTestClasses) {
      const result = this.syncCriticalDependenciesWithTestClasses(processedWaves);
      processedWaves = result.waves;
      manifestAdjustments = result.manifestAdjustments;
    }

    // Renumber waves
    processedWaves = this.renumberWaves(processedWaves);

    logger.info('Wave post-processing completed', {
      finalWaves: processedWaves.length,
      initialWaves: waves.length,
      manifestAdjustments: manifestAdjustments.length,
    });

    return { waves: processedWaves, manifestAdjustments };
  }

  /**
   * Sync Permission Set Groups with Permission Sets
   *
   * Moves Permission Set Groups to the wave AFTER the latest wave containing their Permission Sets.
   * A PSG cannot be installed without ALL its PS being deployed first.
   *
   * Based on _sync_psg_with_permission_sets() from sf_dependency_analyzer.py
   */
  public syncPSGWithPermissionSets(waves: Wave[]): Wave[] {
    logger.debug('Syncing Permission Set Groups with Permission Sets');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedPSGs = 0;

    // Process each wave
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      const psgsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'PermissionSetGroup') {
          continue;
        }

        // Find all Permission Sets this PSG depends on
        const psWaves: number[] = [];
        for (const dep of component.dependencies) {
          const depComponent = this.componentMap.get(dep);
          if (depComponent?.type === 'PermissionSet') {
            const psWave = componentWaveMap.get(dep);
            if (psWave !== undefined) {
              psWaves.push(psWave);
            }
          }
        }

        if (psWaves.length > 0) {
          // Find the latest wave containing Permission Sets
          const maxPSWave = Math.max(...psWaves);

          // PSG must be in the wave AFTER the latest PS wave
          const targetWave = maxPSWave + 1;

          // If PSG is already in a later wave, don't move it
          if (waveIdx > maxPSWave) {
            continue;
          }

          // If PSG is in the same wave or before any PS, move it
          if (waveIdx <= maxPSWave) {
            psgsToMove.push({ nodeId, targetWave });
            movedPSGs++;
            logger.debug('Moving PSG', {
              psg: component.name,
              fromWave: waveIdx + 1,
              toWave: targetWave + 1,
              maxPSWave: maxPSWave + 1,
            });
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of psgsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        // Ensure target wave exists
        while (targetWave >= waves.length) {
          waves.push({
            number: waves.length + 1,
            components: [],
            metadata: {
              componentCount: 0,
              types: [],
              maxDepth: 0,
              hasCircularDeps: false,
              estimatedTime: 0,
            },
          });
        }
        waves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
      }
    }

    // Remove empty waves
    const filteredWaves = waves.filter((wave) => wave.components.length > 0);

    if (movedPSGs > 0) {
      logger.info('Permission Set Groups synced', { movedPSGs });
    }

    return filteredWaves;
  }

  /**
   * Sync Flows with Apex Actions
   *
   * Moves Flows to the same wave as their critical Apex Actions.
   * Flows that use Apex Actions must be in the same wave or after to avoid errors.
   *
   * Based on _sync_flows_with_apex_actions() from sf_dependency_analyzer.py
   */
  public syncFlowsWithApexActions(waves: Wave[]): Wave[] {
    logger.debug('Syncing Flows with Apex Actions');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedFlows = 0;

    // Process each wave
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      const flowsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'Flow') {
          continue;
        }

        // Find all Apex Class dependencies
        const apexWaves: number[] = [];
        for (const dep of component.dependencies) {
          const depComponent = this.componentMap.get(dep);
          if (depComponent?.type === 'ApexClass') {
            const apexWave = componentWaveMap.get(dep);
            if (apexWave !== undefined) {
              apexWaves.push(apexWave);
            }
          }
        }

        if (apexWaves.length > 0) {
          // Find the latest wave containing Apex Classes
          const maxApexWave = Math.max(...apexWaves);

          // Flow should be in the same wave as its Apex Actions
          // If Flow is in a different wave, move it to the Apex wave
          if (waveIdx !== maxApexWave) {
            flowsToMove.push({ nodeId, targetWave: maxApexWave });
            movedFlows++;
            logger.debug('Moving Flow', {
              flow: component.name,
              fromWave: waveIdx + 1,
              toWave: maxApexWave + 1,
            });
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of flowsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        // Ensure target wave exists
        while (targetWave >= waves.length) {
          waves.push({
            number: waves.length + 1,
            components: [],
            metadata: {
              componentCount: 0,
              types: [],
              maxDepth: 0,
              hasCircularDeps: false,
              estimatedTime: 0,
            },
          });
        }
        waves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
      }
    }

    // Remove empty waves
    const filteredWaves = waves.filter((wave) => wave.components.length > 0);

    if (movedFlows > 0) {
      logger.info('Flows synced with Apex Actions', { movedFlows });
    }

    return filteredWaves;
  }

  /**
   * Sync FlexiPages with dependencies
   *
   * Moves FlexiPages to the wave AFTER the latest wave containing their LWC/Flow dependencies.
   * FlexiPages cannot be deployed without their referenced components.
   *
   * Similar logic to syncPSGWithPermissionSets but for FlexiPages
   */
  public syncFlexiPagesWithDependencies(waves: Wave[]): Wave[] {
    logger.debug('Syncing FlexiPages with dependencies');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedFlexiPages = 0;

    // Process each wave
    for (let waveIdx = 0; waveIdx < waves.length; waveIdx++) {
      const wave = waves[waveIdx];
      const flexiPagesToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'FlexiPage') {
          continue;
        }

        // Find LWC and Flow dependencies
        const dependencyWaves: number[] = [];
        for (const dep of component.dependencies) {
          // Check if dependency is LWC (format: c:componentName)
          if (dep.startsWith('c:')) {
            const lwcName = dep.substring(2);
            const lwcNodeId = `LightningComponentBundle:${lwcName}`;
            const lwcWave = componentWaveMap.get(lwcNodeId);
            if (lwcWave !== undefined) {
              dependencyWaves.push(lwcWave);
            }
          }
          // Check if dependency is Flow
          else {
            const depComponent = this.componentMap.get(dep);
            if (depComponent?.type === 'Flow') {
              const flowWave = componentWaveMap.get(dep);
              if (flowWave !== undefined) {
                dependencyWaves.push(flowWave);
              }
            }
          }
        }

        if (dependencyWaves.length > 0) {
          // Find the latest wave containing dependencies
          const maxDepWave = Math.max(...dependencyWaves);

          // FlexiPage should be in the wave AFTER the latest dependency wave
          const targetWave = maxDepWave + 1;

          // If FlexiPage is already in a later wave, don't move it
          if (waveIdx > maxDepWave) {
            continue;
          }

          // If FlexiPage is in the same wave or before any dependency, move it
          if (waveIdx <= maxDepWave) {
            flexiPagesToMove.push({ nodeId, targetWave });
            movedFlexiPages++;
            logger.debug('Moving FlexiPage', {
              flexipage: component.name,
              fromWave: waveIdx + 1,
              toWave: targetWave + 1,
              maxDepWave: maxDepWave + 1,
            });
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of flexiPagesToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        // Ensure target wave exists
        while (targetWave >= waves.length) {
          waves.push({
            number: waves.length + 1,
            components: [],
            metadata: {
              componentCount: 0,
              types: [],
              maxDepth: 0,
              hasCircularDeps: false,
              estimatedTime: 0,
            },
          });
        }
        waves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
      }
    }

    // Remove empty waves
    const filteredWaves = waves.filter((wave) => wave.components.length > 0);

    if (movedFlexiPages > 0) {
      logger.info('FlexiPages synced with dependencies', { movedFlexiPages });
    }

    return filteredWaves;
  }

  /**
   * Split large waves to avoid UNKNOWN_EXCEPTION errors
   *
   * Divides waves that exceed maxComponentsPerWave into multiple smaller waves.
   *
   * Based on _split_large_waves() from sf_dependency_analyzer.py
   */
  public splitLargeWaves(waves: Wave[]): Wave[] {
    logger.debug('Splitting large waves', { maxComponents: this.options.maxComponentsPerWave });

    const splitWaves: Wave[] = [];
    let waveNumber = 1;

    for (const wave of waves) {
      if (wave.components.length <= this.options.maxComponentsPerWave) {
        splitWaves.push({ ...wave, number: waveNumber++ });
      } else {
        // Split wave into multiple waves
        logger.debug('Splitting large wave', {
          wave: wave.number,
          components: wave.components.length,
          maxComponents: this.options.maxComponentsPerWave,
        });

        for (let i = 0; i < wave.components.length; i += this.options.maxComponentsPerWave) {
          const chunk = wave.components.slice(i, i + this.options.maxComponentsPerWave);
          splitWaves.push({
            number: waveNumber++,
            components: chunk,
            metadata: this.generateWaveMetadata(chunk),
          });
        }
      }
    }

    if (splitWaves.length > waves.length) {
      logger.info('Large waves split', {
        initialWaves: waves.length,
        finalWaves: splitWaves.length,
      });
    }

    return splitWaves;
  }

  /**
   * Sync LightningApps with FlexiPages they depend on (utilityBar)
   * LightningApps should be deployed after their utilityBar FlexiPages
   */
  public syncLightningAppsWithFlexiPages(waves: Wave[]): Wave[] {
    logger.debug('Syncing LightningApps with FlexiPages');
    const componentWaveMap = this.buildComponentWaveMap(waves);
    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));
    let movedApps = 0;

    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const appsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'LightningApp') {
          continue;
        }

        // Find FlexiPage dependencies (utilityBar)
        let maxFlexiPageWave = -1;
        for (const dep of component.dependencies) {
          if (dep.startsWith('FlexiPage:')) {
            const flexiPageWave = componentWaveMap.get(dep);
            if (flexiPageWave !== undefined && flexiPageWave > maxFlexiPageWave) {
              maxFlexiPageWave = flexiPageWave;
            }
          }
        }

        // If LightningApp depends on FlexiPages, move it after the latest FlexiPage wave
        if (maxFlexiPageWave !== -1 && waveIdx <= maxFlexiPageWave) {
          const targetWave = maxFlexiPageWave + 1;
          appsToMove.push({ nodeId, targetWave });
          movedApps++;
          logger.debug('Moving LightningApp', {
            app: component.name,
            fromWave: waveIdx + 1,
            toWave: targetWave + 1,
            maxFlexiPageWave: maxFlexiPageWave + 1,
          });
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of appsToMove) {
        const currentWaveComponents = newWaves[waveIdx].components;
        const index = currentWaveComponents.indexOf(nodeId);
        if (index > -1) {
          currentWaveComponents.splice(index, 1);

          // Ensure target wave exists
          while (targetWave >= newWaves.length) {
            newWaves.push({
              number: newWaves.length + 1,
              components: [],
              metadata: this.generateWaveMetadata([]),
            });
          }
          newWaves[targetWave].components.push(nodeId);
        }
      }
    }

    if (movedApps > 0) {
      logger.info('LightningApps synced with FlexiPages', { movedApps });
    }

    return newWaves.filter(w => w.components.length > 0);
  }

  /**
   * Sync Custom Metadata Records with their Types
   *
   * Ensures that Custom Metadata Records are deployed in the same wave as their Custom Metadata Type.
   * This is critical because Apex classes may read these records immediately after the type is deployed.
   */
  public syncCustomMetadataRecordsWithTypes(waves: Wave[]): Wave[] {
    logger.debug('Syncing Custom Metadata Records with Types');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedRecords = 0;
    const recordsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

    // Find all CustomMetadataRecord components and their CustomMetadata type dependencies
    for (const [nodeId, component] of this.componentMap.entries()) {
      if (component.type !== 'CustomMetadataRecord') {
        continue;
      }

      // Extract type name from record name (format: TypeName.RecordName)
      const dotIndex = component.name.indexOf('.');
      if (dotIndex === -1) {
        logger.warn(`Invalid Custom Metadata Record name format: ${component.name}`);
        continue;
      }

      let typeName = component.name.substring(0, dotIndex);
      // Custom Metadata Types (__mdt) are CustomObject, not CustomMetadata
      let typeNodeId = `CustomObject:${typeName}` as NodeId;

      // Find the wave where the type is located
      let typeWave = componentWaveMap.get(typeNodeId);

      // If type not found, try with __mdt suffix (records may use type name without __mdt)
      if (typeWave === undefined) {
        const typeNameWithMdt = `${typeName}__mdt`;
        typeNodeId = `CustomObject:${typeNameWithMdt}` as NodeId;
        typeWave = componentWaveMap.get(typeNodeId);

        if (typeWave !== undefined) {
          typeName = typeNameWithMdt; // Use the full type name
        }
      }

      if (typeWave === undefined) {
        logger.warn(`Custom Metadata Type ${typeName} (or ${typeName}__mdt) not found in waves for record ${component.name}`);
        continue;
      }

      // Find the wave where the record is currently located
      const recordWave = componentWaveMap.get(nodeId);
      if (recordWave === undefined) {
        continue; // Record not in any wave (shouldn't happen)
      }

      // If record is in a different wave than its type, move it to the type's wave
      if (recordWave !== typeWave) {
        recordsToMove.push({ nodeId, targetWave: typeWave });
        movedRecords++;
        logger.debug('Moving Custom Metadata Record to type wave', {
          record: component.name,
          type: typeName,
          fromWave: recordWave + 1,
          toWave: typeWave + 1,
        });
      }
    }

    // Apply movements
    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));

    for (const { nodeId, targetWave } of recordsToMove) {
      // Remove from current wave
      const currentWave = componentWaveMap.get(nodeId);
      if (currentWave !== undefined && currentWave < newWaves.length) {
        const currentWaveComponents = newWaves[currentWave].components;
        const index = currentWaveComponents.indexOf(nodeId);
        if (index !== -1) {
          currentWaveComponents.splice(index, 1);
        }
      }

      // Add to target wave
      if (targetWave < newWaves.length) {
        newWaves[targetWave].components.push(nodeId);
      }
    }

    if (movedRecords > 0) {
      logger.info('Synced Custom Metadata Records with Types', {
        movedRecords,
      });
    }

    return newWaves;
  }

  /**
   * Sync test classes with classes they cover indirectly
   *
   * Moves test classes to the same wave as classes that receive indirect coverage.
   * For example:
   * - TestClass covers ServiceClass directly
   * - HandlerClass depends on ServiceClass
   * - Therefore, TestClass covers HandlerClass indirectly
   * - If HandlerClass is in Wave 1 and TestClass is in Wave 3,
   *   move TestClass to Wave 1
   *
   * This ensures that Handler classes, Wrapper classes, and other classes that
   * receive indirect coverage are deployed with their test coverage available.
   */
  public syncTestClassesWithIndirectCoverage(waves: Wave[]): Wave[] {
    logger.debug('Syncing test classes with indirect coverage');

    const componentWaveMap = this.buildComponentWaveMap(waves);
    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));
    let movedTests = 0;

    // Build reverse dependency map: for each class, find all classes that depend on it
    const dependentsMap = new Map<NodeId, Set<NodeId>>();
    for (const [nodeId, component] of this.componentMap.entries()) {
      if (component.type !== 'ApexClass') continue;

      for (const dep of component.dependencies) {
        if (!dependentsMap.has(dep)) {
          dependentsMap.set(dep, new Set());
        }
        dependentsMap.get(dep)!.add(nodeId);
      }
    }

    // Process each wave to find test classes
    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const testsToMove: Array<{ nodeId: NodeId; targetWave: number; reason: string; depsToMove: NodeId[] }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'ApexClass') {
          continue;
        }

        // Check if it's a test class
        const className = component.name;
        const isTest = this.isTestClass(className);
        if (!isTest) {
          continue;
        }

        // Find classes this test covers directly (dependencies of the test)
        const directlyCoveredClasses = new Set<NodeId>();
        for (const dep of component.dependencies) {
          const depComponent = this.componentMap.get(dep);
          if (depComponent?.type === 'ApexClass') {
            directlyCoveredClasses.add(dep);
          }
        }

        // For each directly covered class:
        // 1. Find classes that depend on it (Handler → Service pattern)
        // 2. Find classes it depends on that might be Wrappers/Helpers (Service → Wrapper pattern)
        let earliestIndirectWave = -1;
        let earliestIndirectClass: NodeId | null = null;

        for (const coveredClass of directlyCoveredClasses) {
          const coveredComponent = this.componentMap.get(coveredClass);
          if (!coveredComponent) continue;

          // Pattern 1: Find classes that depend on the covered class (Handler → Service)
          // Example: HandlerClass depends on ServiceClass
          const dependents = dependentsMap.get(coveredClass);
          if (dependents) {
            for (const dependent of dependents) {
              const dependentComponent = this.componentMap.get(dependent);
              if (!dependentComponent || dependentComponent.type !== 'ApexClass') {
                continue;
              }

              // Skip if the dependent is the test class itself or another test class
              const dependentName = dependentComponent.name;
              if (this.isTestClass(dependentName)) {
                continue;
              }

              // Find the wave of this dependent
              const dependentWave = componentWaveMap.get(dependent);
              if (dependentWave !== undefined && dependentWave < waveIdx) {
                // This dependent is in an earlier wave and needs indirect coverage
                if (earliestIndirectWave === -1 || dependentWave < earliestIndirectWave) {
                  earliestIndirectWave = dependentWave;
                  earliestIndirectClass = dependent;
                }
              }
            }
          }

          // Pattern 2: Find classes that the covered class depends on (Service → Wrapper)
          // Example: ServiceClass depends on WrapperClass
          // If ServiceTest covers ServiceClass, it also covers WrapperClass indirectly
          for (const dep of coveredComponent.dependencies) {
            const depComponent = this.componentMap.get(dep);
            if (!depComponent || depComponent.type !== 'ApexClass') {
              continue;
            }

            // Check if this dependency is a Wrapper/Helper/Utility class
            const depName = depComponent.name.toLowerCase();
            const isWrapperOrHelper =
              depName.includes('wrapper') ||
              depName.includes('helper') ||
              depName.includes('util') ||
              depName.includes('utility');

            if (isWrapperOrHelper) {
              const depWave = componentWaveMap.get(dep);
              if (depWave !== undefined && depWave < waveIdx) {
                // This wrapper/helper is in an earlier wave and needs indirect coverage
                if (earliestIndirectWave === -1 || depWave < earliestIndirectWave) {
                  earliestIndirectWave = depWave;
                  earliestIndirectClass = dep;
                }
              }
            }
          }
        }

        // If we found a class that needs indirect coverage in an earlier wave, check dependencies
        if (earliestIndirectWave !== -1 && earliestIndirectWave < waveIdx) {
          // Collect dependencies that need to be moved with the test class
          const depsToMove: Array<{ nodeId: NodeId; currentWave: number }> = [];
          let latestRequiredDepWave = earliestIndirectWave;
          let canMove = true;

          for (const dep of component.dependencies) {
            const depComponent = this.componentMap.get(dep);
            if (!depComponent || depComponent.type !== 'ApexClass') {
              continue;
            }

            const depWave = componentWaveMap.get(dep);
            if (depWave !== undefined) {
              // If dependency is in a later wave than target, we need to move it too
              if (depWave > earliestIndirectWave) {
                // Check if this is a critical dependency that should be moved (DataFactory, Helper, etc.)
                const depName = depComponent.name.toLowerCase();
                const isCriticalDep =
                  depName.includes('datafactory') ||
                  depName.includes('helper') ||
                  depName.includes('util') ||
                  depName.includes('wrapper') ||
                  depName.includes('mock');

                // Also check if this is the class being tested (the test covers it directly)
                // In that case, we can't move it - it must stay in its current wave
                const isClassBeingTested = directlyCoveredClasses.has(dep);

                if (isCriticalDep && !isClassBeingTested) {
                  // Mark this dependency to be moved with the test
                  depsToMove.push({ nodeId: dep, currentWave: depWave });
                  logger.debug('Dependency needs to be moved with test class', {
                    testClass: className,
                    dependency: depComponent.name,
                    dependencyWave: depWave + 1,
                    targetWave: earliestIndirectWave + 1,
                  });
                } else if (!isCriticalDep && !isClassBeingTested) {
                  // Non-critical dependency in later wave - can't move test
                  canMove = false;
                  logger.debug('Cannot move test class - non-critical dependency in later wave', {
                    testClass: className,
                    dependency: depComponent.name,
                    dependencyWave: depWave + 1,
                    targetWave: earliestIndirectWave + 1,
                  });
                  break;
                }
                // If it's the class being tested, we allow it (it will stay in its wave)
              }
              // Track the latest wave where a dependency exists
              if (depWave > latestRequiredDepWave) {
                latestRequiredDepWave = depWave;
              }
            }
          }

          // Only move if all non-critical dependencies are available
          if (canMove) {
            // Move to the latest required dependency wave (or earliest indirect wave if no deps need moving)
            const targetWave = depsToMove.length > 0
              ? Math.max(...depsToMove.map(d => d.currentWave), earliestIndirectWave)
              : latestRequiredDepWave;

            const indirectClassName = earliestIndirectClass?.split(':')[1] || 'Unknown';
            testsToMove.push({
              nodeId,
              targetWave,
              reason: `Covers ${indirectClassName} indirectly${depsToMove.length > 0 ? ` (moving ${depsToMove.length} dependencies)` : ''}`,
              depsToMove: depsToMove.map(d => d.nodeId),
            });

            movedTests++;
            logger.debug('Moving test class for indirect coverage', {
              testClass: className,
              fromWave: waveIdx + 1,
              toWave: targetWave + 1,
              indirectClass: indirectClassName,
              dependenciesToMove: depsToMove.length,
            });
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave, depsToMove } of testsToMove) {
        const currentWaveComponents = newWaves[waveIdx].components;
        const index = currentWaveComponents.indexOf(nodeId);
        if (index > -1) {
          currentWaveComponents.splice(index, 1);

          // Ensure target wave exists
          while (targetWave >= newWaves.length) {
            newWaves.push({
              number: newWaves.length + 1,
              components: [],
              metadata: this.generateWaveMetadata([]),
            });
          }
          newWaves[targetWave].components.push(nodeId);
          componentWaveMap.set(nodeId, targetWave);

          // Also move critical dependencies to the same wave
          for (const depNodeId of depsToMove) {
            const depCurrentWave = componentWaveMap.get(depNodeId);
            if (depCurrentWave !== undefined && depCurrentWave !== targetWave) {
              const depWaveComponents = newWaves[depCurrentWave].components;
              const depIndex = depWaveComponents.indexOf(depNodeId);
              if (depIndex > -1) {
                depWaveComponents.splice(depIndex, 1);
                newWaves[targetWave].components.push(depNodeId);
                componentWaveMap.set(depNodeId, targetWave);
                logger.debug('Moving dependency with test class', {
                  dependency: depNodeId.split(':')[1],
                  fromWave: depCurrentWave + 1,
                  toWave: targetWave + 1,
                  testClass: nodeId.split(':')[1],
                });
              }
            }
          }
        }
      }
    }

    if (movedTests > 0) {
      logger.info('Test classes synced with indirect coverage', { movedTests });
    }

    // Filter empty waves and renumber to ensure wave.number matches array index + 1
    const filteredWaves = newWaves.filter(w => w.components.length > 0);
    return filteredWaves.map((wave, idx) => ({
      ...wave,
      number: idx + 1,
    }));
  }

  /**
   * Moves critical dependencies (DataFactory, Helper, etc.) to waves that have test classes.
   * Only moves dependencies to waves that actually contain test classes that need them.
   * This avoids the need to adjust manifestAdjustments after splitLargeWaves.
   *
   * Uses a Map with key "nombrePadre-nombreDependencia" to handle multiple occurrences
   */
  public syncCriticalDependenciesWithTestClasses(waves: Wave[]): {
    waves: Wave[];
    manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>;
  } {
    logger.info('Syncing critical dependencies with test classes');

    // Build component wave map from the CURRENT state of waves (after syncTestClassesWithIndirectCoverage)
    const componentWaveMap = this.buildComponentWaveMap(waves);

    // Identify which waves have test classes
    const wavesWithTestClasses = new Map<number, boolean>();
    const testClassesByWave = new Map<number, string[]>();

    for (const [nodeId, waveIdx] of componentWaveMap.entries()) {
      const component = this.componentMap.get(nodeId);
      if (component?.type === 'ApexClass' && this.isTestClass(component.name)) {
        wavesWithTestClasses.set(waveIdx, true);
        if (!testClassesByWave.has(waveIdx)) {
          testClassesByWave.set(waveIdx, []);
        }
        testClassesByWave.get(waveIdx)!.push(component.name);
      }
    }

    logger.info('Waves with test classes identified', {
      wavesWithTests: Array.from(wavesWithTestClasses.keys()).map(w => w + 1),
      testClassesByWave: Array.from(testClassesByWave.entries()).map(([w, classes]) => ({
        wave: w + 1,
        testClasses: classes.slice(0, 5), // Limit for logging
        total: classes.length,
      })),
    });

    // Debug: Log test classes locations to verify they were moved correctly
    const testClassesInMap = Array.from(componentWaveMap.entries())
      .filter(([nodeId]) => {
        const component = this.componentMap.get(nodeId);
        return component?.type === 'ApexClass' && this.isTestClass(component.name);
      })
      .map(([nodeId, waveIdx]) => ({
        testClass: nodeId.split(':')[1],
        wave: waveIdx + 1,
      }));

    // Debug: Log specific test classes we're looking for
    const targetTestClasses = ['SC_SS_EntitlementsForCases_Test', 'SC_ContentVersion_Service_Test', 'SC_ContentDocument_Service_Test'];
    const foundTestClasses = testClassesInMap.filter(t => targetTestClasses.includes(t.testClass));

    // Also verify by checking waves directly
    const foundInWaves: Array<{ wave: number; testClass: string; nodeId: string }> = [];
    waves.forEach((wave, idx) => {
      wave.components.forEach(nodeId => {
        const component = this.componentMap.get(nodeId);
        if (component?.type === 'ApexClass' && targetTestClasses.includes(component.name)) {
          foundInWaves.push({ wave: wave.number, testClass: component.name, nodeId });
        }
      });
    });

    // Also check componentWaveMap entries for these test classes
    const testClassNodeIds = targetTestClasses.map(name => `ApexClass:${name}`);
    const foundInMap: Array<{ testClass: string; wave: number; nodeId: string }> = [];
    testClassNodeIds.forEach(nodeId => {
      const waveIdx = componentWaveMap.get(nodeId);
      if (waveIdx !== undefined) {
        const component = this.componentMap.get(nodeId);
        foundInMap.push({ testClass: component?.name || nodeId, wave: waveIdx + 1, nodeId });
      }
    });

    // Debug: Check all entries in componentWaveMap that match our test classes
    const allMatchingEntries = Array.from(componentWaveMap.entries())
      .filter(([nodeId]) => {
        const name = nodeId.split(':')[1];
        return targetTestClasses.includes(name);
      })
      .map(([nodeId, waveIdx]) => ({ nodeId, wave: waveIdx + 1 }));

    // Debug: Check all test class entries in componentWaveMap to see their actual nodeId format
    const allTestClassEntries = Array.from(componentWaveMap.entries())
      .filter(([nodeId]) => {
        const component = this.componentMap.get(nodeId);
        return component?.type === 'ApexClass' && this.isTestClass(component.name);
      })
      .slice(0, 20) // Limit to first 20 for logging
      .map(([nodeId, waveIdx]) => ({
        nodeId,
        componentName: this.componentMap.get(nodeId)?.name || 'unknown',
        wave: waveIdx + 1
      }));

    // Debug: Check componentWaveMap size and sample entries
    const componentWaveMapSize = componentWaveMap.size;
    const sampleEntries = Array.from(componentWaveMap.entries()).slice(0, 10).map(([nodeId, waveIdx]) => ({
      nodeId,
      wave: waveIdx + 1,
      componentName: this.componentMap.get(nodeId)?.name || 'unknown',
    }));

    logger.info('Target test classes locations after syncTestClassesWithIndirectCoverage', {
      foundTestClasses,
      foundInWaves,
      foundInMap,
      allMatchingEntries,
      allTestClassEntries,
      componentWaveMapSize,
      sampleEntries,
      wavesReceived: waves.length,
      waveNumbers: waves.map(w => w.number),
      waveIndexes: waves.map((w, idx) => ({ waveNumber: w.number, arrayIndex: idx })),
      testClassNodeIds,
    });

    logger.debug('Test classes locations after syncTestClassesWithIndirectCoverage', {
      testClasses: testClassesInMap.slice(0, 10),
      total: testClassesInMap.length,
    });

    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));
    const manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }> = [];
    let movedDeps = 0;

    // First pass: Collect all critical dependencies using Map: "nombrePadre-nombreDependencia" -> nombreDependencia
    // This allows tracking multiple occurrences of the same dependency from different test classes
    const criticalDepsMap = new Map<string, {
      dependencyId: NodeId;
      dependencyName: string;
      lastWave: number;
      firstWave: number;
      testClasses: Map<number, string[]>;
    }>();

    // Process each wave that has test classes
    // Only move critical dependencies to waves that actually have test classes
    for (const [waveIdx, hasTestClasses] of wavesWithTestClasses.entries()) {
      if (!hasTestClasses) {
        continue; // Skip waves without test classes
      }

      const testClassesInWave = testClassesByWave.get(waveIdx) || [];
      logger.info('Processing wave with test classes', {
        wave: waveIdx + 1,
        testClasses: testClassesInWave.slice(0, 5),
        totalTestClasses: testClassesInWave.length,
      });

      // Find all test classes in this wave
      const testClassNodeIdsInWave = Array.from(componentWaveMap.entries())
        .filter(([nodeId, wave]) => {
          if (wave !== waveIdx) return false;
          const component = this.componentMap.get(nodeId);
          return component?.type === 'ApexClass' && this.isTestClass(component.name);
        })
        .map(([nodeId]) => nodeId);

      // Process each test class in this wave
      for (const nodeId of testClassNodeIdsInWave) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'ApexClass') {
          continue;
        }

        const className = component.name;

        // Find critical dependencies that are in different waves
        for (const dep of component.dependencies) {
          const depComponent = this.componentMap.get(dep);
          if (!depComponent || depComponent.type !== 'ApexClass') {
            continue;
          }

          const depWave = componentWaveMap.get(dep);
          const depName = depComponent.name.toLowerCase();
          const isCriticalDep =
            depName.includes('datafactory') ||
            depName.includes('helper') ||
            depName.includes('util') ||
            depName.includes('wrapper') ||
            depName.includes('mock');

          // Debug: Log if we find SC_DataFactory as a dependency
          if (depComponent.name === 'SC_DataFactory') {
            logger.info('Found SC_DataFactory as dependency', {
              testClass: className,
              testClassWave: waveIdx + 1,
              depWave: depWave !== undefined ? depWave + 1 : 'not found',
              willMove: depWave !== undefined && depWave !== waveIdx,
            });
          }

          // Move if dependency is in a different wave than where the test class is
          // We want to move critical dependencies to the wave where the test class that needs them is located
          if (depWave !== undefined && depWave !== waveIdx && isCriticalDep) {

            // Don't move the class being tested directly (it's a dependency of the test)
            const depNameUpper = depComponent.name;
            const testNameBase = className.replace(/Test$/, '').replace(/_Test$/, '');
            const isClassBeingTested = depNameUpper === testNameBase ||
              depNameUpper.includes(testNameBase) ||
              testNameBase.includes(depNameUpper);

            if (isCriticalDep && !isClassBeingTested) {
              // Use "nombrePadre-nombreDependencia" as key, value is nombreDependencia
              const mapKey = `${className}-${depComponent.name}`;

              const existing = criticalDepsMap.get(mapKey);

              if (!existing) {
                // Move to the wave where the test class is (waveIdx)
                criticalDepsMap.set(mapKey, {
                  dependencyId: dep,
                  dependencyName: depComponent.name, // Value: nombreDependencia
                  lastWave: waveIdx, // Last wave where this dependency is needed
                  firstWave: waveIdx, // First wave where this dependency is needed (where first test class is)
                  testClasses: new Map([[waveIdx, [className]]]),
                });
                logger.debug('Tracking critical dependency occurrence', {
                  mapKey, // Key: nombrePadre-nombreDependencia
                  dependencyName: depComponent.name, // Value: nombreDependencia
                  testClass: className,
                  testClassWave: waveIdx + 1,
                  depCurrentWave: depWave + 1,
                  willMoveToWave: waveIdx + 1,
                });
              } else {
                // Update lastWave to the latest wave where this dependency is needed
                if (waveIdx > existing.lastWave) {
                  existing.lastWave = waveIdx;
                }
                // Update firstWave to the earliest wave where this dependency is needed
                if (waveIdx < existing.firstWave) {
                  existing.firstWave = waveIdx;
                }
                if (!existing.testClasses.has(waveIdx)) {
                  existing.testClasses.set(waveIdx, []);
                }
                existing.testClasses.get(waveIdx)!.push(className);
              }
            }
          }
        }
      }
    }

    // Second pass: Consolidate dependencies and move to their last required wave
    // Group by dependencyId to handle multiple test classes referencing the same dependency
    const dependencyConsolidation = new Map<NodeId, {
      lastWave: number;
      firstWave: number;
      testClasses: Map<number, string[]>;
    }>();

    for (const [, depInfo] of criticalDepsMap.entries()) {
      const { dependencyId, lastWave, firstWave, testClasses } = depInfo;
      const existing = dependencyConsolidation.get(dependencyId);
      if (!existing) {
        // Recalculate firstWave based on test classes (not the original depWave)
        const testWaveNumbers = Array.from(testClasses.keys());
        const actualFirstWave = testWaveNumbers.length > 0 ? Math.min(...testWaveNumbers) : firstWave;
        dependencyConsolidation.set(dependencyId, {
          lastWave,
          firstWave: actualFirstWave,
          testClasses: new Map(testClasses),
        });
      } else {
        // Update to the latest lastWave and earliest firstWave across all occurrences
        if (lastWave > existing.lastWave) {
          existing.lastWave = lastWave;
        }
        // Merge test classes first
        for (const [waveIdx, classes] of testClasses.entries()) {
          if (!existing.testClasses.has(waveIdx)) {
            existing.testClasses.set(waveIdx, []);
          }
          existing.testClasses.get(waveIdx)!.push(...classes);
        }
        // Recalculate firstWave based on all test classes (minimum of all test class waves)
        // This must be done AFTER merging to ensure we have all test classes
        const allTestWaves = Array.from(existing.testClasses.keys());
        if (allTestWaves.length > 0) {
          const earliestTestWave = Math.min(...allTestWaves);
          existing.firstWave = earliestTestWave; // Always update to the earliest test wave
        }
      }
    }

    // Third pass: Move critical dependencies to their first required wave (where first test class needs it)
    logger.debug('Critical dependencies map size', { size: dependencyConsolidation.size });
    const movedDependencies: Array<{ depNodeId: NodeId; originalFirstWave: number; originalLastWave: number }> = [];

    for (const [depNodeId, { lastWave, firstWave, testClasses }] of dependencyConsolidation.entries()) {
      const depCurrentWave = componentWaveMap.get(depNodeId);
      const depName = depNodeId.split(':')[1];

      // Move to firstWave (where first test class needs it), not lastWave
      if (depCurrentWave !== undefined && depCurrentWave !== firstWave) {
        // Remove from current wave
        const currentWaveComponents = newWaves[depCurrentWave].components;
        const depIndex = currentWaveComponents.indexOf(depNodeId);
        if (depIndex > -1) {
          currentWaveComponents.splice(depIndex, 1);

          // Ensure target wave exists
          while (firstWave >= newWaves.length) {
            newWaves.push({
              number: newWaves.length + 1,
              components: [],
              metadata: this.generateWaveMetadata([]),
            });
          }

          // Add to first wave (where first test class needs it)
          newWaves[firstWave].components.push(depNodeId);
          componentWaveMap.set(depNodeId, firstWave);
          movedDeps++;

          // Store original values for recalculation
          movedDependencies.push({
            depNodeId,
            originalFirstWave: firstWave,
            originalLastWave: lastWave,
          });

          const firstWaveTestClasses = testClasses.get(firstWave) || [];
          logger.debug('Moving critical dependency to first test wave', {
            dependency: depName,
            fromWave: depCurrentWave + 1,
            toWave: firstWave + 1,
            lastWave: lastWave + 1,
            testClasses: firstWaveTestClasses.slice(0, 3),
            totalOccurrences: Array.from(testClasses.values()).flat().length,
          });
        }
      }
    }

    // Fourth pass: Recalculate firstWave and lastWave based on actual test class locations after moving dependencies
    // This ensures manifestAdjustments reflect the correct wave numbers
    const recalculatedAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }> = [];

    // Rebuild component wave map after all movements
    const finalComponentWaveMap = this.buildComponentWaveMap(newWaves);

    for (const { depNodeId, originalFirstWave, originalLastWave } of movedDependencies) {
      const depInfo = dependencyConsolidation.get(depNodeId);
      if (!depInfo) continue;

      // Find where test classes that need this dependency actually are now
      const testClassWaves: number[] = [];
      for (const [nodeId, component] of this.componentMap.entries()) {
        if (component.type !== 'ApexClass' || !this.isTestClass(component.name)) {
          continue;
        }

        // Check if this test class depends on the critical dependency
        if (component.dependencies.has(depNodeId)) {
          const testClassWave = finalComponentWaveMap.get(nodeId);
          if (testClassWave !== undefined) {
            testClassWaves.push(testClassWave);
          }
        }
      }

      if (testClassWaves.length > 0) {
        // Recalculate firstWave (earliest wave where test class needs it)
        const recalculatedFirstWave = Math.min(...testClassWaves);
        // Recalculate lastWave (latest wave where test class needs it)
        const recalculatedLastWave = Math.max(...testClassWaves);

        recalculatedAdjustments.push({
          componentId: depNodeId,
          firstWave: recalculatedFirstWave,
          lastWave: recalculatedLastWave,
        });

        const depName = depNodeId.split(':')[1];
        logger.debug('Recalculated manifest adjustment after moving dependency', {
          dependency: depName,
          originalFirstWave: originalFirstWave + 1,
          recalculatedFirstWave: recalculatedFirstWave + 1,
          originalLastWave: originalLastWave + 1,
          recalculatedLastWave: recalculatedLastWave + 1,
        });
      } else {
        // Fallback to original values if no test classes found
        recalculatedAdjustments.push({
          componentId: depNodeId,
          firstWave: originalFirstWave,
          lastWave: originalLastWave,
        });
      }
    }

    // Replace manifestAdjustments with recalculated values
    manifestAdjustments.length = 0;
    manifestAdjustments.push(...recalculatedAdjustments);

    if (movedDeps > 0) {
      logger.info('Critical dependencies synced with test classes', {
        movedDeps,
        manifestAdjustments: manifestAdjustments.length,
      });
    }

    // Debug: Log critical deps map contents AFTER recalculation
    // Use finalComponentWaveMap and recalculated adjustments for accurate logging
    const dataFactoryEntry = Array.from(dependencyConsolidation.entries()).find(([dep]) => dep.includes('DataFactory'));
    if (dataFactoryEntry) {
      const [depNodeId] = dataFactoryEntry;
      const adjustment = manifestAdjustments.find(a => a.componentId === depNodeId);
      const finalWave = finalComponentWaveMap.get(depNodeId);

      // Find test classes that depend on DataFactory
      const testClassWaves: Array<{ wave: number; classes: string[] }> = [];
      for (const [nodeId, component] of this.componentMap.entries()) {
        if (component.type !== 'ApexClass' || !this.isTestClass(component.name)) {
          continue;
        }
        if (component.dependencies.has(depNodeId)) {
          const testWave = finalComponentWaveMap.get(nodeId);
          if (testWave !== undefined) {
            const existing = testClassWaves.find(t => t.wave === testWave);
            if (existing) {
              existing.classes.push(component.name);
            } else {
              testClassWaves.push({ wave: testWave, classes: [component.name] });
            }
          }
        }
      }

      logger.info('SC_DataFactory in critical deps map (after recalculation)', {
        finalWave: finalWave !== undefined ? finalWave + 1 : 'not found',
        adjustmentFirstWave: adjustment ? adjustment.firstWave + 1 : 'not found',
        adjustmentLastWave: adjustment ? adjustment.lastWave + 1 : 'not found',
        testClassesByWave: testClassWaves.map(({ wave, classes }) => ({
          wave: wave + 1,
          classes: classes.slice(0, 3),
        })),
        totalTestClasses: testClassWaves.reduce((sum, t) => sum + t.classes.length, 0),
      });
    } else {
      logger.warn('SC_DataFactory NOT found in critical deps map');
    }

    // Filter empty waves and renumber to ensure wave.number matches array index + 1
    const filteredWaves = newWaves.filter(w => w.components.length > 0);
    const renumberedWaves = filteredWaves.map((wave, idx) => ({
      ...wave,
      number: idx + 1,
    }));

    return {
      waves: renumberedWaves,
      manifestAdjustments,
    };
  }

  /**
   * Sync Apex classes with their dependents (move classes referenced by later waves)
   *
   * If a class is referenced by classes in later waves, move it to the same wave as
   * the earliest dependent class to ensure proper coverage and avoid deployment issues.
   */
  public syncApexClassesWithDependents(waves: Wave[]): Wave[] {
    logger.info('Syncing Apex classes with their dependents', { waveCount: waves.length });

    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));
    let movedClasses = 0;

    // Build component wave map from current waves state
    const componentWaveMap = this.buildComponentWaveMap(newWaves);

    // Build reverse dependency map: for each class, find all classes that depend on it
    const dependentsMap = new Map<NodeId, Set<NodeId>>();
    for (const [nodeId, component] of this.componentMap.entries()) {
      if (component.type !== 'ApexClass') continue;

      for (const dep of component.dependencies) {
        // Only track Apex class dependencies
        if (!dep.startsWith('ApexClass:')) continue;

        if (!dependentsMap.has(dep)) {
          dependentsMap.set(dep, new Set());
        }
        dependentsMap.get(dep)!.add(nodeId);
      }
    }

    logger.debug('Built dependents map for Apex classes', {
      totalDependents: dependentsMap.size,
    });

    // Process each wave to find classes that should be moved
    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const classesToMove: Array<{ nodeId: NodeId; targetWave: number; reason: string }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'ApexClass') {
          continue;
        }

        // Skip test classes (they're handled separately)
        if (this.isTestClass(component.name)) {
          continue;
        }

        // Find all classes that depend on this class
        const dependents = dependentsMap.get(nodeId);
        if (!dependents || dependents.size === 0) {
          continue;
        }

        // Find the earliest wave containing a dependent class (first reference)
        // Move to the first wave where it's referenced, regardless of current position
        let earliestDependentWave = -1;
        let earliestDependentName = '';

        for (const dependent of dependents) {
          const dependentWave = componentWaveMap.get(dependent);
          if (dependentWave !== undefined) {
            // Find the earliest wave (first reference), even if it's before current wave
            if (earliestDependentWave === -1 || dependentWave < earliestDependentWave) {
              earliestDependentWave = dependentWave;
              const depComponent = this.componentMap.get(dependent);
              earliestDependentName = depComponent?.name || dependent.split(':')[1];
            }
          }
        }

        // Skip critical dependencies ONLY if they're referenced by test classes
        // Critical dependencies referenced by production classes should be moved normally
        const componentNameLower = component.name.toLowerCase();
        const isCriticalDependency =
          componentNameLower.includes('datafactory') ||
          componentNameLower.includes('helper') ||
          componentNameLower.includes('util') ||
          componentNameLower.includes('wrapper') ||
          componentNameLower.includes('mock');

        if (isCriticalDependency) {
          // Check if any dependent is a test class
          let hasTestClassDependent = false;
          for (const dependent of dependents) {
            const dependentComponent = this.componentMap.get(dependent);
            if (dependentComponent && dependentComponent.type === 'ApexClass') {
              if (this.isTestClass(dependentComponent.name)) {
                hasTestClassDependent = true;
                break;
              }
            }
          }

          // Only skip if referenced by test classes - production references should be handled normally
          if (hasTestClassDependent) {
            // Don't move critical dependencies here - they're handled by syncCriticalDependenciesWithTestClasses
            continue;
          }
        }

        // Move this class to the earliest wave where it's referenced (first reference)
        // This ensures it's available when first needed
        if (earliestDependentWave !== -1 && earliestDependentWave !== waveIdx) {
          classesToMove.push({
            nodeId,
            targetWave: earliestDependentWave,
            reason: `Referenced by ${earliestDependentName} (Wave ${earliestDependentWave + 1})`,
          });
          movedClasses++;
          logger.info('Moving Apex class to dependent wave', {
            className: component.name,
            fromWave: waveIdx + 1,
            toWave: earliestDependentWave + 1,
            dependent: earliestDependentName,
            isCritical: isCriticalDependency,
          });
        } else if (earliestDependentWave === -1 && component.name === 'SC_AccountWrapper') {
          // Debug: Log why SC_AccountWrapper is not being moved
          logger.warn('SC_AccountWrapper not moved - no dependents found', {
            dependents: Array.from(dependents).map(d => {
              const depComp = this.componentMap.get(d);
              return depComp?.name || d;
            }),
            dependentsMapSize: dependentsMap.size,
          });
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of classesToMove) {
        const currentWaveComponents = newWaves[waveIdx].components;
        const index = currentWaveComponents.indexOf(nodeId);
        if (index > -1) {
          currentWaveComponents.splice(index, 1);

          // Ensure target wave exists
          while (targetWave >= newWaves.length) {
            newWaves.push({
              number: newWaves.length + 1,
              components: [],
              metadata: this.generateWaveMetadata([]),
            });
          }
          newWaves[targetWave].components.push(nodeId);
          componentWaveMap.set(nodeId, targetWave);
        }
      }
    }

    if (movedClasses > 0) {
      logger.info('Apex classes synced with their dependents', { movedClasses });
    }

    return newWaves.filter(w => w.components.length > 0);
  }

  /**
   * Check if a class name indicates it's a test class
   */
  private isTestClass(className: string): boolean {
    const lowerName = className.toLowerCase();
    return (
      lowerName.includes('test') ||
      lowerName.endsWith('_test') ||
      lowerName.endsWith('test') ||
      className.endsWith('Test')
    );
  }

  /**
   * Build a map of component to wave index
   * Uses array index directly - waves should be renumbered before calling this
   * to ensure wave.number === waveIdx + 1
   */
  private buildComponentWaveMap(waves: Wave[]): Map<NodeId, number> {
    const map = new Map<NodeId, number>();
    let totalComponentsAdded = 0;
    waves.forEach((wave, waveIdx) => {
      // Use array index directly - waves should be renumbered before calling this
      // to ensure wave.number === waveIdx + 1
      wave.components.forEach((nodeId) => {
        map.set(nodeId, waveIdx);
        totalComponentsAdded++;
      });
    });
    logger.info('buildComponentWaveMap completed', {
      wavesProcessed: waves.length,
      totalComponentsAdded,
      mapSize: map.size,
      sampleEntries: Array.from(map.entries()).slice(0, 5).map(([nodeId, waveIdx]) => ({
        nodeId,
        wave: waveIdx + 1,
        componentName: this.componentMap.get(nodeId)?.name || 'unknown',
      })),
    });
    return map;
  }

  /**
   * Build a mapping from old wave numbers to new wave numbers after splitLargeWaves
   * This finds where test classes that were in old waves ended up after splitting
   */
  private buildWaveMappingAfterSplit(
    splitWaves: Wave[],
    manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>
  ): Map<number, number> {
    const mapping = new Map<number, number>();

    // Build component wave map from split waves
    const componentWaveMap = this.buildComponentWaveMap(splitWaves);

    // For each adjustment, find where the test classes that need this component are now
    // firstWave and lastWave refer to where test classes are, not where the critical dependency is
    for (const adjustment of manifestAdjustments) {
      const criticalDep = this.componentMap.get(adjustment.componentId);
      if (!criticalDep) continue;

      // Find all test classes that depend on this critical dependency
      const testClassWaves: number[] = [];
      for (const [nodeId, component] of this.componentMap.entries()) {
        if (component.type !== 'ApexClass' || !this.isTestClass(component.name)) {
          continue;
        }

        // Check if this test class depends on the critical dependency
        if (component.dependencies.has(adjustment.componentId)) {
          const testClassWave = componentWaveMap.get(nodeId);
          if (testClassWave !== undefined) {
            testClassWaves.push(testClassWave + 1); // Convert to 1-based
          }
        }
      }

      if (testClassWaves.length > 0) {
        // Map old firstWave (1-based) to new firstWave (earliest wave where test class needs it)
        const oldFirstWave1Based = adjustment.firstWave + 1;
        const newFirstWave = Math.min(...testClassWaves);
        if (!mapping.has(oldFirstWave1Based) || mapping.get(oldFirstWave1Based)! > newFirstWave) {
          mapping.set(oldFirstWave1Based, newFirstWave);
          logger.debug('Mapping firstWave after split', {
            componentId: adjustment.componentId,
            componentName: adjustment.componentId.split(':')[1],
            oldFirstWave: oldFirstWave1Based,
            newFirstWave,
            testClassWaves,
          });
        }

        // Map old lastWave (1-based) to new lastWave (latest wave where test class needs it)
        const oldLastWave1Based = adjustment.lastWave + 1;
        const newLastWave = Math.max(...testClassWaves);
        if (!mapping.has(oldLastWave1Based) || mapping.get(oldLastWave1Based)! < newLastWave) {
          mapping.set(oldLastWave1Based, newLastWave);
          logger.debug('Mapping lastWave after split', {
            componentId: adjustment.componentId,
            componentName: adjustment.componentId.split(':')[1],
            oldLastWave: oldLastWave1Based,
            newLastWave,
            testClassWaves,
          });
        }
      } else {
        logger.warn('No test classes found for critical dependency after split', {
          componentId: adjustment.componentId,
          componentName: adjustment.componentId.split(':')[1],
        });
      }
    }

    logger.info('Built wave mapping after split', {
      mapping: Array.from(mapping.entries()).map(([old, new_]) => ({ old, new: new_ })),
      adjustmentsProcessed: manifestAdjustments.length,
    });

    return mapping;
  }

  /**
   * Adjust manifest adjustments after wave splitting
   * Updates firstWave and lastWave to reflect new wave numbers after splitLargeWaves
   */
  private adjustManifestAdjustmentsForSplit(
    manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>,
    waveMapping: Map<number, number>
  ): Array<{ componentId: NodeId; firstWave: number; lastWave: number }> {
    if (waveMapping.size === 0) {
      return manifestAdjustments;
    }

    const adjusted = manifestAdjustments.map(adjustment => {
      // Convert to 1-based for mapping lookup
      const oldFirstWave1Based = adjustment.firstWave + 1;
      const oldLastWave1Based = adjustment.lastWave + 1;

      const newFirstWave1Based = waveMapping.get(oldFirstWave1Based) ?? oldFirstWave1Based;
      const newLastWave1Based = waveMapping.get(oldLastWave1Based) ?? oldLastWave1Based;

      if (newFirstWave1Based !== oldFirstWave1Based || newLastWave1Based !== oldLastWave1Based) {
        logger.info('Adjusting manifest adjustment after wave split', {
          componentId: adjustment.componentId,
          componentName: adjustment.componentId.split(':')[1],
          oldFirstWave: oldFirstWave1Based,
          newFirstWave: newFirstWave1Based,
          oldLastWave: oldLastWave1Based,
          newLastWave: newLastWave1Based,
        });
      }

      return {
        ...adjustment,
        firstWave: newFirstWave1Based - 1, // Convert back to 0-based for internal use
        lastWave: newLastWave1Based - 1,
      };
    });

    return adjusted;
  }

  /**
   * Renumber waves sequentially
   */
  private renumberWaves(waves: Wave[]): Wave[] {
    return waves.map((wave, idx) => ({
      ...wave,
      number: idx + 1,
    }));
  }

  /**
   * Generate wave metadata for a set of components
   */
  private generateWaveMetadata(components: NodeId[]): Wave['metadata'] {
    const types = new Set<MetadataType>();
    let maxDepth = 0;

    for (const nodeId of components) {
      const component = this.componentMap.get(nodeId);
      if (component) {
        types.add(component.type);
        // Calculate depth (simplified)
        maxDepth = Math.max(maxDepth, component.dependencies.size);
      }
    }

    return {
      componentCount: components.length,
      types: Array.from(types),
      maxDepth,
      hasCircularDeps: false,
      estimatedTime: components.length * 0.5, // Simple estimation
    };
  }

  /**
   * Sync Visualforce Pages with Components that reference them
   *
   * Moves Visualforce Pages to the earliest wave where they are referenced by a Visualforce Component.
   * This ensures that pages like ForgotPassword are available when SiteLogin component is deployed.
   *
   * Example: SiteLogin component references $Page.ForgotPassword, so ForgotPassword should be
   * in the same wave or earlier than SiteLogin.
   */
  public syncVisualforcePagesWithComponents(waves: Wave[]): Wave[] {
    logger.debug('Syncing Visualforce Pages with Components');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedPages = 0;

    // Find all Visualforce Components and their VisualforcePage dependencies
    const pageReferences = new Map<NodeId, Set<NodeId>>(); // pageId -> Set of componentIds that reference it

    for (const [nodeId, component] of this.componentMap.entries()) {
      if (component.type === 'VisualforceComponent') {
        // Find VisualforcePage dependencies
        for (const dep of component.dependencies) {
          const depComponent = this.componentMap.get(dep);
          if (depComponent?.type === 'VisualforcePage') {
            if (!pageReferences.has(dep)) {
              pageReferences.set(dep, new Set());
            }
            pageReferences.get(dep)!.add(nodeId);
          }
        }
      }
    }

    // For each VisualforcePage, find the earliest wave where it's referenced
    const pagesToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

    for (const [pageId, referencingComponents] of pageReferences.entries()) {
      const pageWave = componentWaveMap.get(pageId);
      if (pageWave === undefined) {
        continue; // Page not in any wave
      }

      // Find the earliest wave where any referencing component is located
      let earliestReferencerWave = Infinity;
      for (const componentId of referencingComponents) {
        const componentWave = componentWaveMap.get(componentId);
        if (componentWave !== undefined && componentWave < earliestReferencerWave) {
          earliestReferencerWave = componentWave;
        }
      }

      // If the page is in a later wave than the earliest referencer, move it earlier
      if (earliestReferencerWave !== Infinity && pageWave > earliestReferencerWave) {
        pagesToMove.push({ nodeId: pageId, targetWave: earliestReferencerWave });
        movedPages++;
        const pageComponent = this.componentMap.get(pageId);
        logger.debug('Moving Visualforce Page', {
          page: pageComponent?.name || pageId,
          fromWave: pageWave + 1,
          toWave: earliestReferencerWave + 1,
          referencedBy: Array.from(referencingComponents).map((id) => {
            const comp = this.componentMap.get(id);
            return comp?.name || id;
          }),
        });
      }
    }

    // Apply movements
    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));

    for (const { nodeId, targetWave } of pagesToMove) {
      // Remove from current wave
      const currentWave = componentWaveMap.get(nodeId);
      if (currentWave !== undefined) {
        newWaves[currentWave].components = newWaves[currentWave].components.filter((id) => id !== nodeId);
      }

      // Ensure target wave exists
      while (targetWave >= newWaves.length) {
        newWaves.push({
          number: newWaves.length + 1,
          components: [],
          metadata: this.generateWaveMetadata([]),
        });
      }
      newWaves[targetWave].components.push(nodeId);
      componentWaveMap.set(nodeId, targetWave);
    }

    // Remove empty waves
    const filteredWaves = newWaves.filter((wave) => wave.components.length > 0);

    if (movedPages > 0) {
      logger.info('Visualforce Pages synced with Components', { movedPages });
    }

    return filteredWaves;
  }
}

