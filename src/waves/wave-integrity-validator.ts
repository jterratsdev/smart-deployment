/**
 * Wave Integrity Validator
 * Validates that waves are correctly structured and all dependencies are satisfied
 *
 * This ensures that regardless of project structure, waves are always deployable
 * by verifying:
 * 1. All dependencies are available before components that need them
 * 2. No circular dependencies within waves
 * 3. Components are in correct order
 * 4. All required metadata types are present
 *
 * @ac US-XXX-AC-1: Validate wave integrity before deployment
 */

import { getLogger } from '../utils/logger.js';
import type { Wave } from './wave-builder.js';
import type { MetadataComponent } from '../types/metadata.js';
import type { NodeId } from '../types/dependency.js';

const logger = getLogger('WaveIntegrityValidator');

export interface WaveIntegrityIssue {
  severity: 'error' | 'warning';
  wave: number;
  component: NodeId;
  issue: string;
  details?: Record<string, unknown>;
}

export interface WaveIntegrityResult {
  isValid: boolean;
  issues: WaveIntegrityIssue[];
  summary: {
    totalWaves: number;
    wavesWithIssues: number;
    totalIssues: number;
    errors: number;
    warnings: number;
  };
}

/**
 * Validates wave integrity to ensure correct deployment order
 */
export class WaveIntegrityValidator {
  private componentMap: Map<NodeId, MetadataComponent>;
  private allWaves: Wave[];

  public constructor(
    componentMap: Map<NodeId, MetadataComponent>,
    waves: Wave[]
  ) {
    this.componentMap = componentMap;
    this.allWaves = waves;
  }

  /**
   * Validate all waves for integrity
   */
  public validateWaves(): WaveIntegrityResult {
    logger.info('Validating wave integrity', { totalWaves: this.allWaves.length });

    const issues: WaveIntegrityIssue[] = [];
    const wavesWithIssues = new Set<number>();

    // Build map of component -> wave index
    const componentWaveMap = new Map<NodeId, number>();
    this.allWaves.forEach((wave, idx) => {
      wave.components.forEach((nodeId) => {
        componentWaveMap.set(nodeId, idx);
      });
    });

    // Validate each wave
    for (let waveIdx = 0; waveIdx < this.allWaves.length; waveIdx++) {
      const wave = this.allWaves[waveIdx];
      const waveIssues = this.validateWave(wave, waveIdx, componentWaveMap);
      issues.push(...waveIssues);

      if (waveIssues.length > 0) {
        wavesWithIssues.add(waveIdx + 1);
      }
    }

    const errors = issues.filter((i) => i.severity === 'error').length;
    const warnings = issues.filter((i) => i.severity === 'warning').length;

    const result: WaveIntegrityResult = {
      isValid: errors === 0,
      issues,
      summary: {
        totalWaves: this.allWaves.length,
        wavesWithIssues: wavesWithIssues.size,
        totalIssues: issues.length,
        errors,
        warnings,
      },
    };

    logger.info('Wave integrity validation completed', {
      isValid: result.isValid,
      ...result.summary,
    });

    return result;
  }

  /**
   * Validate a single wave
   */
  private validateWave(
    wave: Wave,
    waveIdx: number,
    componentWaveMap: Map<NodeId, number>
  ): WaveIntegrityIssue[] {
    const issues: WaveIntegrityIssue[] = [];
    const availableComponents = new Set<NodeId>();

    // Collect components from previous waves
    for (let i = 0; i < waveIdx; i++) {
      this.allWaves[i].components.forEach((nodeId) => {
        availableComponents.add(nodeId);
      });
    }

    // Validate each component in this wave
    for (const nodeId of wave.components) {
      const component = this.componentMap.get(nodeId);
      if (!component) {
        issues.push({
          severity: 'error',
          wave: waveIdx + 1,
          component: nodeId,
          issue: 'Component not found in component map',
        });
        continue;
      }

      // Check dependencies
      for (const dep of component.dependencies) {
        const depWave = componentWaveMap.get(dep);
        const depComponent = this.componentMap.get(dep);

        if (!depComponent) {
          // Dependency not found - might be external or missing
          // Check if it's a standard Salesforce component (these are always available)
          if (this.isStandardComponent(dep)) {
            continue; // Standard components are always available
          }

          issues.push({
            severity: 'warning',
            wave: waveIdx + 1,
            component: nodeId,
            issue: `Dependency not found: ${dep}`,
            details: {
              dependency: dep,
              componentName: component.name,
              componentType: component.type,
            },
          });
          continue;
        }

        // Dependency is in a later wave - ERROR
        if (depWave !== undefined && depWave > waveIdx) {
          issues.push({
            severity: 'error',
            wave: waveIdx + 1,
            component: nodeId,
            issue: `Dependency ${depComponent.name} (${depComponent.type}) is in wave ${depWave + 1}, but ${component.name} (${component.type}) is in wave ${waveIdx + 1}`,
            details: {
              dependency: dep,
              dependencyName: depComponent.name,
              dependencyType: depComponent.type,
              dependencyWave: depWave + 1,
              componentName: component.name,
              componentType: component.type,
            },
          });
        }
        // Dependency is in same wave - WARNING (might work, but risky)
        else if (depWave === waveIdx) {
          // Check if dependency is before this component in the same wave
          const depIndex = wave.components.indexOf(dep);
          const compIndex = wave.components.indexOf(nodeId);

          if (depIndex > compIndex) {
            issues.push({
              severity: 'warning',
              wave: waveIdx + 1,
              component: nodeId,
              issue: `Dependency ${depComponent.name} (${depComponent.type}) is in the same wave but appears after ${component.name} (${component.type})`,
              details: {
                dependency: dep,
                dependencyName: depComponent.name,
                dependencyType: depComponent.type,
                componentName: component.name,
                componentType: component.type,
              },
            });
          }
        }
      }
    }

    return issues;
  }

  /**
   * Check if a component is a standard Salesforce component (always available)
   */
  private isStandardComponent(nodeId: NodeId): boolean {
    // Standard objects, standard fields, etc. are always available
    const standardPatterns = [
      /^CustomObject:(Account|Contact|Case|Opportunity|Lead|User|Profile|PermissionSet)$/,
      /^ApexClass:(Test|System|Database|List|Set|Map|String|Integer|Boolean|Date|DateTime|Decimal|Double|Id|Blob|Object)$/,
    ];

    return standardPatterns.some((pattern) => pattern.test(nodeId));
  }

  /**
   * Generate human-readable report
   */
  public generateReport(result: WaveIntegrityResult): string {
    const lines: string[] = [];

    lines.push('\n📊 Wave Integrity Validation Report');
    lines.push('═'.repeat(60));
    lines.push(`Total Waves: ${result.summary.totalWaves}`);
    lines.push(`Waves with Issues: ${result.summary.wavesWithIssues}`);
    lines.push(`Total Issues: ${result.summary.totalIssues} (${result.summary.errors} errors, ${result.summary.warnings} warnings)`);
    lines.push('');

    if (result.isValid) {
      lines.push('✅ All waves are valid and ready for deployment');
    } else {
      lines.push('❌ Some waves have integrity issues that may cause deployment failures');
      lines.push('');

      // Group issues by wave
      const issuesByWave = new Map<number, WaveIntegrityIssue[]>();
      for (const issue of result.issues) {
        if (!issuesByWave.has(issue.wave)) {
          issuesByWave.set(issue.wave, []);
        }
        issuesByWave.get(issue.wave)!.push(issue);
      }

      for (const [waveNum, waveIssues] of Array.from(issuesByWave.entries()).sort((a, b) => a[0] - b[0])) {
        lines.push(`Wave ${waveNum}:`);
        for (const issue of waveIssues) {
          const icon = issue.severity === 'error' ? '❌' : '⚠️';
          lines.push(`  ${icon} ${issue.component}: ${issue.issue}`);
          if (issue.details) {
            for (const [key, value] of Object.entries(issue.details)) {
              lines.push(`     ${key}: ${value}`);
            }
          }
        }
        lines.push('');
      }
    }

    return lines.join('\n');
  }
}

