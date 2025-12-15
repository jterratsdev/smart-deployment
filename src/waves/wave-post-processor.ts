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

    // 6. Sync test classes with classes they cover indirectly (before split)
    if (this.options.syncTestClasses) {
      processedWaves = this.syncTestClassesWithIndirectCoverage(processedWaves);
    }

    // 7. Sync Apex classes with their dependents (move classes referenced by later waves)
    // Skip critical dependencies as they're already handled above
    processedWaves = this.syncApexClassesWithDependents(processedWaves);

    // 8. Sync Visualforce Pages with Components that reference them
    processedWaves = this.syncVisualforcePagesWithComponents(processedWaves);

    // 8b. Sync Custom Objects with FlexiPages they reference
    processedWaves = this.syncCustomObjectsWithFlexiPages(processedWaves);

    // 8c. Resolve dependency conflicts generically for all metadata types
    processedWaves = this.resolveDependencyConflicts(processedWaves);

    // 9. Split large waves FIRST (before syncing test classes with direct coverage)
    // This ensures we know the final wave structure before moving tests
    if (this.options.splitLargeWaves) {
      processedWaves = this.splitLargeWaves(processedWaves);
    }

    // 10. Sync test classes with classes they cover DIRECTLY AFTER splitLargeWaves
    // This ensures tests are moved to the correct waves after splitting
    if (this.options.syncTestClasses) {
      processedWaves = this.syncTestClassesWithDirectCoverage(processedWaves);
    }

    // 11. Sync critical dependencies with test classes AFTER splitLargeWaves
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
   * Sync Custom Objects with FlexiPages they reference
   *
   * Moves Custom Objects that have actionOverrides referencing FlexiPages
   * to the wave AFTER the latest wave containing those FlexiPages.
   *
   * Example: Case object has actionOverride referencing SC_GRG_CaseRecordPage FlexiPage
   * - If Case is in Wave 12 and SC_GRG_CaseRecordPage is in Wave 20,
   * move Case to Wave 21 (after FlexiPage)
   *
   * This ensures that when a Custom Object is deployed, its referenced FlexiPages exist.
   */
  public syncCustomObjectsWithFlexiPages(waves: Wave[]): Wave[] {
    logger.debug('Syncing Custom Objects with FlexiPages');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    let movedObjects = 0;
    const newWaves = waves.map((w) => ({ ...w, components: [...w.components] }));

    // Process each wave to find Custom Objects
    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const objectsToMove: Array<{ nodeId: NodeId; targetWave: number }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component || component.type !== 'CustomObject') {
          continue;
        }

        // Find FlexiPage dependencies
        const flexiPageWaves: number[] = [];
        for (const dep of component.dependencies) {
          if (dep.startsWith('FlexiPage:')) {
            const flexiPageWave = componentWaveMap.get(dep);
            if (flexiPageWave !== undefined) {
              flexiPageWaves.push(flexiPageWave);
            }
          }
        }

        if (flexiPageWaves.length > 0) {
          // Find the latest wave containing FlexiPage dependencies
          const maxFlexiPageWave = Math.max(...flexiPageWaves);

          // Custom Object should be in the wave AFTER the latest FlexiPage wave
          const targetWave = maxFlexiPageWave + 1;

          // If Custom Object is already in a later wave, don't move it
          if (waveIdx > maxFlexiPageWave) {
            continue;
          }

          // Check if moving the Custom Object would break other dependencies
          // Find components that depend on this Custom Object
          let hasBlockingDependents = false;
          const blockingDependents: Array<{ name: string; wave: number }> = [];

          for (const [depNodeId, depComponent] of this.componentMap.entries()) {
            if (depComponent.dependencies.has(nodeId)) {
              const depWave = componentWaveMap.get(depNodeId);
              if (depWave !== undefined && depWave < targetWave) {
                // This dependent is in a wave before the target wave
                // Moving the Custom Object would break this dependency
                hasBlockingDependents = true;
                blockingDependents.push({ name: depComponent.name, wave: depWave });
              }
            }
          }

          // If Custom Object is in the same wave or before any FlexiPage, move it
          // BUT only if it won't break other dependencies
          if (waveIdx <= maxFlexiPageWave && !hasBlockingDependents) {
            objectsToMove.push({ nodeId, targetWave });
            movedObjects++;
            logger.debug('Moving Custom Object after FlexiPage', {
              object: component.name,
              fromWave: waveIdx + 1,
              toWave: targetWave + 1,
              maxFlexiPageWave: maxFlexiPageWave + 1,
            });
          } else if (hasBlockingDependents) {
            logger.warn('Cannot move Custom Object - would break dependencies', {
              object: component.name,
              currentWave: waveIdx + 1,
              targetWave: targetWave + 1,
              blockingDependents,
              note: 'Custom Object must stay in current wave due to other dependencies',
            });

            // Alternative: Try to move FlexiPage earlier instead
            // Find the FlexiPage dependencies and try to move them before the Custom Object
            for (const dep of component.dependencies) {
              if (dep.startsWith('FlexiPage:')) {
                const flexiPageWave = componentWaveMap.get(dep);
                if (flexiPageWave !== undefined && flexiPageWave > waveIdx) {
                  // Try to move FlexiPage to the same wave as Custom Object or earlier
                  // But only if FlexiPage doesn't have dependencies that require it to be later
                  const flexiPageComponent = this.componentMap.get(dep);
                  if (flexiPageComponent) {
                    let canMoveFlexiPageEarlier = true;
                    const flexiPageBlockingDeps: Array<{ name: string; wave: number }> = [];

                    // Check FlexiPage dependencies (LWC, Flows)
                    for (const flexiDep of flexiPageComponent.dependencies) {
                      let flexiDepWave: number | undefined;

                      // Check if it's an LWC (format: c:componentName)
                      if (flexiDep.startsWith('c:')) {
                        const lwcName = flexiDep.substring(2);
                        const lwcNodeId = `LightningComponentBundle:${lwcName}`;
                        flexiDepWave = componentWaveMap.get(lwcNodeId);
                      } else {
                        flexiDepWave = componentWaveMap.get(flexiDep);
                      }

                      if (flexiDepWave !== undefined && flexiDepWave > waveIdx) {
                        // FlexiPage dependency is in a wave after Custom Object
                        // Cannot move FlexiPage earlier
                        canMoveFlexiPageEarlier = false;
                        const depComponent = this.componentMap.get(flexiDep);
                        if (depComponent) {
                          flexiPageBlockingDeps.push({ name: depComponent.name, wave: flexiDepWave });
                        }
                      }
                    }

                    if (canMoveFlexiPageEarlier && flexiPageWave > waveIdx) {
                      // Move FlexiPage to the same wave as Custom Object
                      const flexiPageNodeId = dep;
                      const flexiPageCurrentWave = newWaves[flexiPageWave];
                      const flexiPageIndex = flexiPageCurrentWave.components.indexOf(flexiPageNodeId);

                      if (flexiPageIndex > -1) {
                        flexiPageCurrentWave.components.splice(flexiPageIndex, 1);
                        newWaves[waveIdx].components.push(flexiPageNodeId);
                        componentWaveMap.set(flexiPageNodeId, waveIdx);
                        movedObjects++; // Count as moved for logging
                        logger.info('Moved FlexiPage earlier to match Custom Object', {
                          flexipage: flexiPageComponent.name,
                          fromWave: flexiPageWave + 1,
                          toWave: waveIdx + 1,
                          object: component.name,
                          reason: 'Custom Object cannot be moved due to dependencies',
                        });
                      }
                    } else if (!canMoveFlexiPageEarlier) {
                      logger.warn('Cannot move FlexiPage earlier - would break dependencies', {
                        flexipage: flexiPageComponent.name,
                        currentWave: flexiPageWave + 1,
                        targetWave: waveIdx + 1,
                        blockingDependencies: flexiPageBlockingDeps,
                        object: component.name,
                        note: 'Both Custom Object and FlexiPage have conflicting dependencies - deployment may fail',
                      });
                    }
                  }
                }
              }
            }
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of objectsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        // Ensure target wave exists
        while (targetWave >= newWaves.length) {
          newWaves.push({
            number: newWaves.length + 1,
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
        newWaves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
      }
    }

    // Remove empty waves
    const filteredWaves = newWaves.filter((wave) => wave.components.length > 0);

    if (movedObjects > 0) {
      logger.info('Custom Objects synced with FlexiPages', { movedObjects });
    }

    return filteredWaves;
  }

  /**
   * Resolve dependency conflicts generically for all metadata types
   *
   * This function detects when a component needs to be in a later wave due to some dependencies
   * but cannot be moved because other components depend on it and are in earlier waves.
   *
   * When such conflicts are detected, it attempts to resolve them by:
   * 1. Moving the dependency to the same wave as the component (if possible)
   * 2. Moving the component to the earliest possible wave that satisfies all constraints
   * 3. Logging warnings for unresolvable conflicts
   *
   * This applies to any metadata type, not just Custom Objects and FlexiPages.
   *
   * @example
   * - Component A needs to be after Component B (B is dependency)
   * - But Component C depends on A and is in an earlier wave
   * - Solution: Try to move B to the same wave as A, or move A to earliest wave that satisfies both
   */
  public resolveDependencyConflicts(waves: Wave[]): Wave[] {
    logger.debug('Resolving dependency conflicts for all metadata types');

    // Create map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    waves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    const newWaves = waves.map((w) => ({ ...w, components: [...w.components] }));
    let resolvedConflicts = 0;
    const unresolvedConflicts: Array<{
      component: string;
      componentType: string;
      needsAfterWave: number;
      blockedBy: Array<{ name: string; wave: number }>;
    }> = [];

    // Process each wave to find components with dependency conflicts
    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const componentsToMove: Array<{ nodeId: NodeId; targetWave: number; reason: string }> = [];

      for (const nodeId of [...wave.components]) {
        const component = this.componentMap.get(nodeId);
        if (!component) {
          continue;
        }

        // Find dependencies that require this component to be in a later wave
        const dependencyWaves: number[] = [];
        const dependencyDetails: Array<{ nodeId: NodeId; wave: number; name: string }> = [];

        for (const dep of component.dependencies) {
          const depWave = componentWaveMap.get(dep);
          if (depWave !== undefined && depWave > waveIdx) {
            dependencyWaves.push(depWave);
            const depComponent = this.componentMap.get(dep);
            if (depComponent) {
              dependencyDetails.push({
                nodeId: dep,
                wave: depWave,
                name: depComponent.name,
              });
            }
          }
        }

        if (dependencyWaves.length > 0) {
          // Component needs to be after its dependencies
          const maxDepWave = Math.max(...dependencyWaves);
          const targetWave = maxDepWave + 1;

          // Check if moving would break other dependencies
          let hasBlockingDependents = false;
          const blockingDependents: Array<{ name: string; wave: number }> = [];

          for (const [depNodeId, depComponent] of this.componentMap.entries()) {
            if (depComponent.dependencies.has(nodeId)) {
              const depWave = componentWaveMap.get(depNodeId);
              if (depWave !== undefined && depWave < targetWave) {
                hasBlockingDependents = true;
                blockingDependents.push({ name: depComponent.name, wave: depWave });
              }
            }
          }

          if (!hasBlockingDependents) {
            // Can move safely
            if (waveIdx < maxDepWave) {
              componentsToMove.push({
                nodeId,
                targetWave,
                reason: `Needs to be after dependencies: ${dependencyDetails.map((d) => d.name).join(', ')}`,
              });
            }
          } else {
            // Conflict detected - try to resolve by moving dependencies earlier
            let resolved = false;

            for (const depDetail of dependencyDetails) {
              const depComponent = this.componentMap.get(depDetail.nodeId);
              if (!depComponent) {
                continue;
              }

              // Check if dependency can be moved to the same wave as the component
              let canMoveDependency = true;
              const depBlockingDeps: Array<{ name: string; wave: number }> = [];

              // Check dependency's own dependencies
              for (const depDep of depComponent.dependencies) {
                const depDepWave = componentWaveMap.get(depDep);
                if (depDepWave !== undefined && depDepWave > waveIdx) {
                  canMoveDependency = false;
                  const depDepComponent = this.componentMap.get(depDep);
                  if (depDepComponent) {
                    depBlockingDeps.push({ name: depDepComponent.name, wave: depDepWave });
                  }
                }
              }

              if (canMoveDependency && depDetail.wave > waveIdx) {
                // Move dependency to the same wave as the component
                const depCurrentWave = newWaves[depDetail.wave];
                const depIndex = depCurrentWave.components.indexOf(depDetail.nodeId);

                if (depIndex > -1) {
                  depCurrentWave.components.splice(depIndex, 1);
                  newWaves[waveIdx].components.push(depDetail.nodeId);
                  componentWaveMap.set(depDetail.nodeId, waveIdx);
                  resolvedConflicts++;
                  resolved = true;
                  logger.info('Resolved dependency conflict by moving dependency earlier', {
                    component: component.name,
                    componentType: component.type,
                    dependency: depComponent.name,
                    dependencyType: depComponent.type,
                    fromWave: depDetail.wave + 1,
                    toWave: waveIdx + 1,
                  });
                  break; // Resolved one conflict, move on
                }
              }
            }

            if (!resolved) {
              // Could not resolve - log warning
              unresolvedConflicts.push({
                component: component.name,
                componentType: component.type,
                needsAfterWave: maxDepWave + 1,
                blockedBy: blockingDependents,
              });
              logger.warn('Unresolvable dependency conflict detected', {
                component: component.name,
                componentType: component.type,
                currentWave: waveIdx + 1,
                needsAfterWave: maxDepWave + 1,
                blockingDependents,
                note: 'Component cannot be moved due to conflicting dependencies',
              });
            }
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of componentsToMove) {
        wave.components = wave.components.filter((id) => id !== nodeId);
        while (targetWave >= newWaves.length) {
          newWaves.push({
            number: newWaves.length + 1,
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
        newWaves[targetWave].components.push(nodeId);
        componentWaveMap.set(nodeId, targetWave);
        resolvedConflicts++;
      }
    }

    // Remove empty waves
    const filteredWaves = newWaves.filter((wave) => wave.components.length > 0);

    if (resolvedConflicts > 0) {
      logger.info('Dependency conflicts resolved', { resolvedConflicts });
    }

    if (unresolvedConflicts.length > 0) {
      logger.warn('Unresolved dependency conflicts', {
        count: unresolvedConflicts.length,
        conflicts: unresolvedConflicts,
      });
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
   * Sync test classes with classes they cover DIRECTLY
   *
   * Moves test classes to the same wave as the classes they test directly.
   * For example:
   * - SC_Account_HandlerTest covers SC_Account_Handler directly
   * - If SC_Account_HandlerTest is in Wave 8 and SC_Account_Handler is in Wave 19,
   * move SC_Account_HandlerTest to Wave 19
   *
   * This ensures that when a wave is deployed, both the class and its test
   * are available together.
   */
  public syncTestClassesWithDirectCoverage(waves: Wave[]): Wave[] {
    logger.debug('Syncing test classes with direct coverage');

    // Build component wave map - this should include ALL components from ALL waves
    const componentWaveMap = this.buildComponentWaveMap(waves);

    // Verify that key classes are in the map (for debugging)
    const testClassesToCheck = [
      'SC_Account_Handler',
      'SC_Case_Service',
      'SC_ContactPointDuplicateValidator',
      'SC_ContentDocument_Service',
      'SC_ContentVersion_Service',
    ];

    for (const className of testClassesToCheck) {
      const nodeId = `ApexClass:${className}`;
      if (this.componentMap.has(nodeId) && !componentWaveMap.has(nodeId)) {
        logger.warn('Class exists in componentMap but not in componentWaveMap', {
          className,
          nodeId,
        });
      }
    }

    const newWaves = waves.map(w => ({ ...w, components: [...w.components] }));
    let movedTests = 0;

    // Process each wave to find test classes
    for (let waveIdx = 0; waveIdx < newWaves.length; waveIdx++) {
      const wave = newWaves[waveIdx];
      const testsToMove: Array<{ nodeId: NodeId; targetWave: number; reason: string }> = [];

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

        // Find components this test covers directly (ApexClass and Flow dependencies)
        const directlyCoveredClasses: Array<{ nodeId: NodeId; wave: number }> = [];
        const coveredNodeIds = new Set<NodeId>();
        let inferredCoveredClass: { nodeId: NodeId; wave: number } | null = null;

        // 1. Infer covered component from test name FIRST (this is the primary class the test covers)
        // This takes priority over direct dependencies
        const testName = className;

        // Pattern 1: ClassName_Test → ClassName (e.g., SC_Account_Handler_Test → SC_Account_Handler)
        if (testName.endsWith('_Test')) {
          const prodName = testName.slice(0, -5);
          // Try ApexClass first
          let prodNodeId: NodeId | undefined = `ApexClass:${prodName}`;
          let prodComponent = this.componentMap.get(prodNodeId);

          // If not found as ApexClass, try Flow
          if (!prodComponent) {
            prodNodeId = `Flow:${prodName}`;
            prodComponent = this.componentMap.get(prodNodeId);
          }

          // Pattern 1b: If ClassName_Something_Test doesn't match, try ClassName
          // e.g., SC_Case_Service_AComerClub_Test → SC_Case_Service
          if (!prodComponent && prodName.includes('_')) {
            // Try to find a base class name by removing the suffix
            // Look for patterns like SC_Case_Service_Something → SC_Case_Service
            const parts = prodName.split('_');
            for (let i = parts.length - 1; i > 0; i--) {
              const baseName = parts.slice(0, i).join('_');
              prodNodeId = `ApexClass:${baseName}`;
              prodComponent = this.componentMap.get(prodNodeId);
              if (prodComponent && !this.isTestClass(prodComponent.name)) {
                logger.debug('Inferred covered component from test name (pattern 1b)', {
                  testClass: className,
                  inferredComponent: prodComponent.name,
                  componentType: prodComponent.type,
                  triedFullName: prodName,
                  matchedBaseName: baseName,
                });
                break;
              }
              // Try Flow too
              if (!prodComponent) {
                prodNodeId = `Flow:${baseName}`;
                prodComponent = this.componentMap.get(prodNodeId);
                if (prodComponent && !this.isTestClass(prodComponent.name)) {
                  logger.debug('Inferred covered component from test name (pattern 1b - Flow)', {
                    testClass: className,
                    inferredComponent: prodComponent.name,
                    componentType: prodComponent.type,
                    triedFullName: prodName,
                    matchedBaseName: baseName,
                  });
                  break;
                }
              }
            }
          }

          if (prodComponent && !this.isTestClass(prodComponent.name) && !coveredNodeIds.has(prodNodeId)) {
            const prodWave = componentWaveMap.get(prodNodeId);
            if (prodWave !== undefined) {
              inferredCoveredClass = { nodeId: prodNodeId, wave: prodWave };
              coveredNodeIds.add(prodNodeId);
              logger.debug('Inferred covered component from test name', {
                testClass: className,
                inferredComponent: prodComponent.name,
                componentType: prodComponent.type,
                componentWave: prodWave + 1,
                testWave: waveIdx + 1,
              });
            } else {
              // Component exists but not in wave map - might be in unplaced components
              logger.warn('Inferred component not in wave map', {
                testClass: className,
                inferredComponent: prodComponent.name,
                componentType: prodComponent.type,
                nodeId: prodNodeId,
                componentExists: true,
              });
            }
          } else if (!prodComponent) {
            logger.debug('Inferred component not found in component map', {
              testClass: className,
              inferredName: prodName,
              pattern: 'endsWith(_Test)',
              triedApexClass: `ApexClass:${prodName}`,
              triedFlow: `Flow:${prodName}`,
            });
          }
        }
        // Pattern 2: ClassNameTest → ClassName (e.g., AccountHandlerTest → AccountHandler)
        else if (testName.endsWith('Test') && !testName.endsWith('_Test')) {
          const prodName = testName.slice(0, -4);
          // Try ApexClass first
          let prodNodeId: NodeId | undefined = `ApexClass:${prodName}`;
          let prodComponent = this.componentMap.get(prodNodeId);

          // If not found as ApexClass, try Flow
          if (!prodComponent) {
            prodNodeId = `Flow:${prodName}`;
            prodComponent = this.componentMap.get(prodNodeId);
          }

          if (prodComponent && !this.isTestClass(prodComponent.name) && !coveredNodeIds.has(prodNodeId)) {
            const prodWave = componentWaveMap.get(prodNodeId);
            if (prodWave !== undefined) {
              directlyCoveredClasses.push({ nodeId: prodNodeId, wave: prodWave });
              coveredNodeIds.add(prodNodeId);
              logger.debug('Inferred covered component from test name', {
                testClass: className,
                inferredComponent: prodComponent.name,
                componentType: prodComponent.type,
                componentWave: prodWave + 1,
                testWave: waveIdx + 1,
              });
            } else {
              logger.warn('Inferred component not in wave map', {
                testClass: className,
                inferredComponent: prodComponent.name,
                componentType: prodComponent.type,
                nodeId: prodNodeId,
                componentExists: true,
              });
            }
          } else if (!prodComponent) {
            logger.debug('Inferred component not found in component map', {
              testClass: className,
              inferredName: prodName,
              pattern: 'endsWith(Test)',
              triedApexClass: `ApexClass:${prodName}`,
              triedFlow: `Flow:${prodName}`,
            });
          }
        }

        // Add inferred class to directlyCoveredClasses if found (with highest priority)
        if (inferredCoveredClass) {
          directlyCoveredClasses.unshift(inferredCoveredClass); // Add at the beginning for priority
        }

        // If test covers classes in different waves, move it to the earliest wave
        if (directlyCoveredClasses.length > 0) {
          // Find the earliest wave where a covered class exists
          const earliestWave = Math.min(...directlyCoveredClasses.map(c => c.wave));
          const coveredClassNames = directlyCoveredClasses
            .map(c => this.componentMap.get(c.nodeId)?.name || 'Unknown')
            .join(', ');

          logger.debug('Found covered classes for test', {
            testClass: className,
            currentWave: waveIdx + 1,
            earliestWave: earliestWave + 1,
            coveredClasses: coveredClassNames,
            coveredClassesCount: directlyCoveredClasses.length,
          });

          // Only move if the test is not already in the same wave as the earliest covered class
          if (earliestWave !== waveIdx) {
            // Check if all dependencies are available
            let canMove = true;
            const blockingDeps: Array<{ name: string; wave: number }> = [];

            // If moving to an earlier wave, allow it (dependencies will be deployed before)
            // If moving to a later wave, check that dependencies are available
            const isMovingEarlier = earliestWave < waveIdx;

            logger.debug('Evaluating test class movement', {
              testClass: className,
              currentWave: waveIdx + 1,
              targetWave: earliestWave + 1,
              isMovingEarlier,
              coveredClasses: coveredClassNames,
            });

            if (!isMovingEarlier) {
              // Moving to a later wave - check dependencies
              for (const dep of component.dependencies) {
                const depWave = componentWaveMap.get(dep);
                if (depWave !== undefined && depWave > earliestWave) {
                  const depComponent = this.componentMap.get(dep);
                  // Allow moving if the dependency is a test class or a utility class
                  if (depComponent) {
                    const depName = depComponent.name.toLowerCase();
                    const isUtilityOrTest =
                      this.isTestClass(depComponent.name) ||
                      depName.includes('datafactory') ||
                      depName.includes('helper') ||
                      depName.includes('util') ||
                      depName.includes('wrapper') ||
                      depName.includes('mock');

                    if (!isUtilityOrTest && depComponent.type === 'ApexClass') {
                      // Non-utility dependency in later wave - can't move test yet
                      canMove = false;
                      blockingDeps.push({ name: depComponent.name, wave: depWave });
                      logger.debug('Cannot move test class - dependency in later wave', {
                        testClass: className,
                        dependency: depComponent.name,
                        dependencyWave: depWave + 1,
                        targetWave: earliestWave + 1,
                      });
                      break;
                    }
                  }
                }
              }
            }
            // If moving earlier, always allow (dependencies deploy in order)

            if (!canMove && blockingDeps.length > 0) {
              logger.debug('Test class movement blocked', {
                testClass: className,
                fromWave: waveIdx + 1,
                toWave: earliestWave + 1,
                blockingDependencies: blockingDeps,
              });
            }

            if (canMove) {
              const coveredClassNamesForMove = directlyCoveredClasses
                .map(c => this.componentMap.get(c.nodeId)?.name || 'Unknown')
                .join(', ');

              testsToMove.push({
                nodeId,
                targetWave: earliestWave,
                reason: `Covers ${coveredClassNamesForMove} directly`,
              });

              movedTests++;
              logger.debug('Moving test class to match directly covered class', {
                testClass: className,
                fromWave: waveIdx + 1,
                toWave: earliestWave + 1,
                coveredClasses: coveredClassNames,
              });
            } else {
              logger.debug('Cannot move test class - blocked by dependencies', {
                testClass: className,
                fromWave: waveIdx + 1,
                targetWave: earliestWave + 1,
                coveredClasses: directlyCoveredClasses
                  .map(c => this.componentMap.get(c.nodeId)?.name || 'Unknown')
                  .join(', '),
              });
            }
          }
        }
      }

      // Apply movements
      for (const { nodeId, targetWave } of testsToMove) {
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

    if (movedTests > 0) {
      logger.info('Test classes synced with direct coverage', { movedTests });
    }

    // Filter empty waves and renumber to ensure wave.number matches array index + 1
    const filteredWaves = newWaves.filter(w => w.components.length > 0);
    return filteredWaves.map((wave, idx) => ({
      ...wave,
      number: idx + 1,
    }));
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
   * move TestClass to Wave 1
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

    // Build wavesWithTests array efficiently for logging
    const wavesWithTests: number[] = [];
    for (const waveIdx of wavesWithTestClasses.keys()) {
      wavesWithTests.push(waveIdx + 1);
    }
    logger.info('Waves with test classes identified', {
      wavesWithTests,
      testClassesByWave: ((): Array<{ wave: number; testClasses: string[]; total: number }> => {
        // Use iterator to avoid creating full array in memory
        const result: Array<{ wave: number; testClasses: string[]; total: number }> = [];
        for (const [w, classes] of testClassesByWave.entries()) {
          result.push({
            wave: w + 1,
            testClasses: classes.slice(0, 5), // Limit for logging
            total: classes.length,
          });
        }
        return result;
      })(),
    });

    // Debug: Log test classes locations to verify they were moved correctly
    // Use iterator to avoid creating full array in memory
    const testClassesInMap: Array<{ testClass: string; wave: number }> = [];
    for (const [nodeId, waveIdx] of componentWaveMap.entries()) {
      const component = this.componentMap.get(nodeId);
      if (component?.type === 'ApexClass' && this.isTestClass(component.name)) {
        testClassesInMap.push({
          testClass: nodeId.split(':')[1],
          wave: waveIdx + 1,
        });
      }
    }

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
    // Use iterator to avoid creating full array in memory
    const allMatchingEntries: Array<{ nodeId: string; wave: number }> = [];
    for (const [nodeId, waveIdx] of componentWaveMap.entries()) {
      const name = nodeId.split(':')[1];
      if (targetTestClasses.includes(name)) {
        allMatchingEntries.push({ nodeId, wave: waveIdx + 1 });
      }
    }

    // Debug: Check all test class entries in componentWaveMap to see their actual nodeId format
    // Use iterator to avoid creating full array in memory, limit to first 20
    const allTestClassEntries: Array<{ nodeId: string; componentName: string; wave: number }> = [];
    for (const [nodeId, waveIdx] of componentWaveMap.entries()) {
      if (allTestClassEntries.length >= 20) break;
      const component = this.componentMap.get(nodeId);
      if (component?.type === 'ApexClass' && this.isTestClass(component.name)) {
        allTestClassEntries.push({
          nodeId,
          componentName: component.name || 'unknown',
          wave: waveIdx + 1
        });
      }
    }

    // Debug: Check componentWaveMap size and sample entries
    // Use iterator to avoid creating full array in memory, limit to first 10
    const componentWaveMapSize = componentWaveMap.size;
    const sampleEntries: Array<{ nodeId: string; wave: number; componentName: string }> = [];
    for (const [nodeId, waveIdx] of componentWaveMap.entries()) {
      if (sampleEntries.length >= 10) break;
      sampleEntries.push({
        nodeId,
        wave: waveIdx + 1,
        componentName: this.componentMap.get(nodeId)?.name || 'unknown',
      });
    }

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
      // Use iterator to avoid creating full array in memory
      const testClassNodeIdsInWave: NodeId[] = [];
      for (const [nodeId, wave] of componentWaveMap.entries()) {
        if (wave !== waveIdx) continue;
        const component = this.componentMap.get(nodeId);
        if (component?.type === 'ApexClass' && this.isTestClass(component.name)) {
          testClassNodeIdsInWave.push(nodeId);
        }
      }

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
        // Use iterator to avoid creating intermediate array
        let actualFirstWave = firstWave;
        let hasTestWaves = false;
        for (const waveIdx of testClasses.keys()) {
          if (!hasTestWaves || waveIdx < actualFirstWave) {
            actualFirstWave = waveIdx;
            hasTestWaves = true;
          }
        }
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
        // Use iterator to avoid creating intermediate array
        let earliestTestWave: number | undefined;
        for (const waveIdx of existing.testClasses.keys()) {
          if (earliestTestWave === undefined || waveIdx < earliestTestWave) {
            earliestTestWave = waveIdx;
          }
        }
        if (earliestTestWave !== undefined) {
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
          // Calculate total occurrences without creating temporary arrays
          let totalOccurrences = 0;
          for (const testClassArray of testClasses.values()) {
            totalOccurrences += testClassArray.length;
          }
          logger.debug('Moving critical dependency to first test wave', {
            dependency: depName,
            fromWave: depCurrentWave + 1,
            toWave: firstWave + 1,
            lastWave: lastWave + 1,
            testClasses: firstWaveTestClasses.slice(0, 3),
            totalOccurrences,
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
    // Use iterator to avoid creating full array in memory
    let dataFactoryEntry: [NodeId, { lastWave: number; firstWave: number; testClasses: Map<number, string[]> }] | undefined;
    for (const entry of dependencyConsolidation.entries()) {
      if (entry[0].includes('DataFactory')) {
        dataFactoryEntry = entry;
        break;
      }
    }
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
    // Use iterator to avoid creating full array in memory, limit to first 5
    const sampleEntries: Array<{ nodeId: string; wave: number; componentName: string }> = [];
    for (const [nodeId, waveIdx] of map.entries()) {
      if (sampleEntries.length >= 5) break;
      sampleEntries.push({
        nodeId,
        wave: waveIdx + 1,
        componentName: this.componentMap.get(nodeId)?.name || 'unknown',
      });
    }

    logger.info('buildComponentWaveMap completed', {
      wavesProcessed: waves.length,
      totalComponentsAdded,
      mapSize: map.size,
      sampleEntries,
    });
    return map;
  }

  /**
   * Build a mapping from old wave numbers to new wave numbers after splitLargeWaves
   * This finds where test classes that were in old waves ended up after splitting
   *
   * @deprecated Currently unused - kept for potential future use
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  // @ts-expect-error - Unused but kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _buildWaveMappingAfterSplit(
    _splitWaves: Wave[],
    _manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>
  ): Map<number, number> {
    const mapping = new Map<number, number>();

    // Build component wave map from split waves
    const componentWaveMap = this.buildComponentWaveMap(_splitWaves);

    // For each adjustment, find where the test classes that need this component are now
    // firstWave and lastWave refer to where test classes are, not where the critical dependency is
    for (const adjustment of _manifestAdjustments) {
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

    // Use iterator to avoid creating full array in memory
    const mappingArray: Array<{ old: number; new: number }> = [];
    for (const [old, new_] of mapping.entries()) {
      mappingArray.push({ old, new: new_ });
    }

    logger.info('Built wave mapping after split', {
      mapping: mappingArray,
      adjustmentsProcessed: _manifestAdjustments.length,
    });

    return mapping;
  }

  /**
   * Adjust manifest adjustments after wave splitting
   * Updates firstWave and lastWave to reflect new wave numbers after splitLargeWaves
   */
  // @ts-expect-error - Unused but kept for potential future use
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private _adjustManifestAdjustmentsForSplit(
    _manifestAdjustments: Array<{ componentId: NodeId; firstWave: number; lastWave: number }>,
    _waveMapping: Map<number, number>
  ): Array<{ componentId: NodeId; firstWave: number; lastWave: number }> {
    if (_waveMapping.size === 0) {
      return _manifestAdjustments;
    }

    const adjusted = _manifestAdjustments.map(adjustment => {
      // Convert to 1-based for mapping lookup
      const oldFirstWave1Based = adjustment.firstWave + 1;
      const oldLastWave1Based = adjustment.lastWave + 1;

      const newFirstWave1Based = _waveMapping.get(oldFirstWave1Based) ?? oldFirstWave1Based;
      const newLastWave1Based = _waveMapping.get(oldLastWave1Based) ?? oldLastWave1Based;

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

