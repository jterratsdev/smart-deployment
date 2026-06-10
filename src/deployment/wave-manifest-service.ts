import { mkdir, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import type { NodeId } from '../types/dependency.js';
import type { MetadataComponent, MetadataType } from '../types/metadata.js';

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
    const manifestDir = await this.ensureManifestDir(params.baseDir);
    const manifestPath = path.join(manifestDir, `wave-${String(params.waveNumber).padStart(3, '0')}.xml`);
    await writeFile(manifestPath, this.buildPackageXml(params), 'utf8');
    return manifestPath;
  }

  public async generateDestructiveManifest(params: WaveManifestParams): Promise<DestructiveWaveManifestResult> {
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
      `    <version>${params.apiVersion ?? '66.0'}</version>`,
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
      grouped.get(component.type)!.add(component.name);
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
