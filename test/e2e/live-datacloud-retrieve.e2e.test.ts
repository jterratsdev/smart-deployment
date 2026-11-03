import { execFile } from 'node:child_process';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { expect } from 'chai';
import { afterEach, describe, it } from 'mocha';
import { MetadataScannerService } from '../../src/services/metadata-scanner-service.js';
import { WaveBuilder } from '../../src/waves/wave-builder.js';

const execFileAsync = promisify(execFile);
const LIVE_TARGET_ORG = process.env.SMART_DEPLOYMENT_DATACLOUD_ORG;
const NON_CLIENT_APPROVAL = process.env.SMART_DEPLOYMENT_DATACLOUD_NON_CLIENT_APPROVED === 'true';
const maybeLiveIt = LIVE_TARGET_ORG && NON_CLIENT_APPROVAL ? it : it.skip;
const DATA_CLOUD_TYPES = ['DataPackageKitDefinition', 'DataPackageKitObject', 'DataSourceObject'] as const;

type MetadataListResult = {
  result?: Array<{ fullName?: string; type?: string }>;
};

describe('E2E: read-only Data Cloud metadata retrieve', () => {
  let tempDir: string | undefined;

  afterEach(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
      tempDir = undefined;
    }
  });

  maybeLiveIt('retrieves available Data Kit metadata and analyzes it without modifying the org', async function () {
    this.timeout(120_000);
    const targetOrg = LIVE_TARGET_ORG ?? '';
    tempDir = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-datacloud-retrieve-'));
    await writeProjectConfig(tempDir, 'force-app');
    await mkdir(path.join(tempDir, 'force-app'), { recursive: true });
    await mkdir(path.join(tempDir, 'retrieved'), { recursive: true });

    const available = new Map<string, string[]>();
    for (const metadataType of DATA_CLOUD_TYPES) {
      const listed = await runSfJson<MetadataListResult>(
        ['org', 'list', 'metadata', '--target-org', targetOrg, '--metadata-type', metadataType, '--json'],
        tempDir
      );
      const names = (listed.result ?? [])
        .map((entry) => entry.fullName)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
      available.set(metadataType, names);

      if (names[0]) {
        await runSfJson(
          [
            'project',
            'retrieve',
            'start',
            '--target-org',
            targetOrg,
            '--metadata',
            `${metadataType}:${names[0]}`,
            '--output-dir',
            'retrieved',
            '--api-version',
            '67.0',
            '--wait',
            '10',
            '--json',
          ],
          tempDir
        );
      }
    }

    await writeProjectConfig(tempDir, 'retrieved');

    const scanResult = await new MetadataScannerService().scan({ sourcePath: tempDir });
    const waveResult = new WaveBuilder({ dependencyEdges: scanResult.dependencyResult.edges }).generateWaves(
      scanResult.dependencyResult.graph
    );
    const scannedTypes = new Set(scanResult.components.map((component) => component.type));

    for (const [metadataType, names] of available) {
      if (names.length > 0) {
        expect(scannedTypes.has(metadataType as (typeof DATA_CLOUD_TYPES)[number])).to.equal(true);
      }
    }
    expect(scanResult.errors).to.deep.equal([]);

    const kitObjects = scanResult.components.filter((component) => component.type === 'DataPackageKitObject');
    for (const kitObject of kitObjects) {
      const parentId = [...kitObject.dependencies].find((dependency) =>
        dependency.startsWith('DataPackageKitDefinition:')
      );
      expect(parentId).to.be.a('string');
      expect(scanResult.dependencyResult.components.has(parentId!)).to.equal(true);
      const objectId = `DataPackageKitObject:${kitObject.name}`;
      const parentWave = waveResult.waves.find((wave) => wave.components.includes(parentId!))?.number;
      const objectWave = waveResult.waves.find((wave) => wave.components.includes(objectId))?.number;
      expect(parentWave).to.be.a('number');
      expect(objectWave).to.be.a('number');
      expect(parentWave!).to.be.lessThan(objectWave!);
    }
  });
});

async function runSfJson<T = unknown>(args: string[], cwd: string): Promise<T> {
  try {
    const { stdout } = await execFileAsync('sf', args, {
      cwd,
      env: { ...process.env, FORCE_COLOR: '0', NO_COLOR: '1', SF_DISABLE_TELEMETRY: 'true' },
      maxBuffer: 10 * 1024 * 1024,
    });
    return JSON.parse(stdout) as T;
  } catch (error) {
    const failure = error as Error & { stdout?: string };
    if (failure.stdout) {
      const parsed = JSON.parse(failure.stdout) as { message?: string };
      throw new Error(parsed.message ?? failure.message);
    }
    throw error;
  }
}

async function writeProjectConfig(projectRoot: string, packagePath: string): Promise<void> {
  await writeFile(
    path.join(projectRoot, 'sfdx-project.json'),
    JSON.stringify({ packageDirectories: [{ path: packagePath, default: true }], sourceApiVersion: '67.0' }),
    'utf8'
  );
}
