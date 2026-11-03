import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { RECOMMENDED_API_VERSION } from '../constants/api-version.js';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';
import { buildDataQualityRuleGuardError, isDataQualityRuleType } from './data-quality-rule-guard.js';

export type WaveManifestParams = {
  baseDir: string;
  waveNumber: number;
  components: NodeId[];
  componentMap: ReadonlyMap<NodeId, MetadataComponent>;
  apiVersion?: string;
};

export type DestructiveWaveManifestResult = {
  packagePath: string;
  destructiveChangesPath: string;
};

export class WaveManifestService {
  public async generateManifest(params: WaveManifestParams): Promise<string> {
    this.assertNoDataQualityRules(params);
    const manifestDir = await this.ensureManifestDir(params.baseDir);
    const manifestPath = path.join(manifestDir, `wave-${String(params.waveNumber).padStart(3, '0')}.xml`);
    await writeFile(manifestPath, this.buildPackageXml(params), 'utf8');
    return manifestPath;
  }

  public async generateDestructiveManifest(params: WaveManifestParams): Promise<DestructiveWaveManifestResult> {
    this.assertNoDataQualityRules(params);
    if (params.components.some((nodeId) => params.componentMap.get(nodeId)?.type === 'CustomLabels')) {
      throw new Error('CustomLabels container cannot be used in a destructive manifest');
    }
    const manifestDir = await this.ensureManifestDir(params.baseDir);
    const waveName = `wave-${String(params.waveNumber).padStart(3, '0')}`;
    const packagePath = path.join(manifestDir, `${waveName}-package.xml`);
    const destructiveChangesPath = path.join(manifestDir, `${waveName}-destructiveChanges.xml`);

    await Promise.all([
      writeFile(packagePath, this.buildPackageXml({ ...params, components: [] }), 'utf8'),
      writeFile(destructiveChangesPath, this.buildPackageXml(params), 'utf8'),
    ]);

    return { packagePath, destructiveChangesPath };
  }

  /**
   * C1-RULES AC-004: MatchingRules and DuplicateRule stay blocked from deployment until
   * target-org retrieve, validate, and rule-behavior evidence is attached. Scan, plan,
   * analyze and `plan explain` still show these nodes, their edges, and reference outcomes;
   * only manifest generation is guarded here.
   */
  private assertNoDataQualityRules(params: WaveManifestParams): void {
    const blocked = params.components.filter((nodeId) => {
      const type = params.componentMap.get(nodeId)?.type;
      return type !== undefined && isDataQualityRuleType(type);
    });
    if (blocked.length > 0) {
      throw new Error(buildDataQualityRuleGuardError(blocked));
    }
  }

  private async ensureManifestDir(baseDir: string): Promise<string> {
    const manifestDir = path.join(baseDir, '.smart-deployment', 'manifests');
    await mkdir(manifestDir, { recursive: true });
    return manifestDir;
  }

  private buildPackageXml(params: WaveManifestParams): string {
    const typeBlocks = this.buildTypeBlocks(params.components, params.componentMap);
    const lines = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<Package xmlns="http://soap.sforce.com/2006/04/metadata">',
      ...typeBlocks,
      `    <version>${params.apiVersion ?? RECOMMENDED_API_VERSION.toFixed(1)}</version>`,
      '</Package>',
      '',
    ];

    return lines.join('\n');
  }

  private buildTypeBlocks(components: NodeId[], componentMap: ReadonlyMap<NodeId, MetadataComponent>): string[] {
    const grouped = new Map<MetadataType, Set<string>>();
    for (const nodeId of components) {
      const component = componentMap.get(nodeId);
      if (!component) {
        continue;
      }

      if (!grouped.has(component.type)) {
        grouped.set(component.type, new Set());
      }
      grouped.get(component.type)!.add(component.type === 'CustomLabels' ? '*' : component.name);
    }

    return [...grouped.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([type, members]) => {
        const memberLines = [...members]
          .sort((left, right) => left.localeCompare(right))
          .map((member) => `        <members>${member}</members>`);

        return ['    <types>', ...memberLines, `        <name>${type}</name>`, '    </types>'].join('\n');
      });
  }
}
