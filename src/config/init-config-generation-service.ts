import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { SfdxProjectDetector } from '../scanner/sfdx-project-detector.js';
import type { DeploymentConfig } from './repo-config.js';

export type InitValidationMode = 'strict' | 'warn-only' | 'local-only';

export type InitConfigGenerationOptions = {
  startPath?: string;
  force?: boolean;
  cacheEnabled?: boolean;
  validationMode?: InitValidationMode;
  reportDir?: string;
  skipTests?: boolean;
};

export type InitConfigGenerationResult = {
  success: boolean;
  created: boolean;
  overwritten: boolean;
  configPath: string;
  projectRoot: string;
  sourcePath: string;
  packageDirectories: string[];
  config: DeploymentConfig;
  warnings: string[];
};

const DEFAULT_REPORT_DIR = '.smart-deployment/reports/start-dry-run';
const DEFAULT_GRAPH_REPORT_DIR = '.smart-deployment/reports/graph-export';

export class InitConfigGenerationService {
  public async generate(options: InitConfigGenerationOptions = {}): Promise<InitConfigGenerationResult> {
    const detection = await SfdxProjectDetector.detect(options.startPath ?? process.cwd());
    const projectRoot = detection.detected ? detection.projectRoot : path.resolve(options.startPath ?? process.cwd());
    const configPath = path.join(projectRoot, '.smart-deployment.json');
    const existingConfig = await this.readExistingConfig(configPath);

    if (existingConfig.exists && options.force !== true) {
      throw new Error('Smart Deployment config already exists. Re-run with --force to overwrite it.');
    }

    const sourcePath = this.resolveSourcePath(projectRoot, detection.defaultPackageDirectory, options.startPath);
    const packageDirectories = detection.packageDirectories.map(
      (packageDirectory) => path.relative(projectRoot, packageDirectory) || '.'
    );
    const config = this.createConfig({
      sourcePath,
      packageDirectories,
      apiVersion: detection.apiVersion,
      cacheEnabled: options.cacheEnabled ?? true,
      validationMode: options.validationMode ?? 'strict',
      reportDir: options.reportDir ?? DEFAULT_REPORT_DIR,
      skipTests: options.skipTests ?? false,
    });

    await mkdir(path.dirname(configPath), { recursive: true });
    await writeFile(configPath, JSON.stringify(config, null, 2) + '\n', 'utf8');

    return {
      success: true,
      created: !existingConfig.exists,
      overwritten: existingConfig.exists,
      configPath,
      projectRoot,
      sourcePath,
      packageDirectories,
      config,
      warnings: detection.warnings,
    };
  }

  private async readExistingConfig(configPath: string): Promise<{ exists: boolean; config?: DeploymentConfig }> {
    try {
      await access(configPath);
    } catch (error) {
      if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
        return { exists: false };
      }

      throw error;
    }

    const content = await readFile(configPath, 'utf8');
    return { exists: true, config: JSON.parse(content) as DeploymentConfig };
  }

  private resolveSourcePath(projectRoot: string, defaultPackageDirectory?: string, startPath?: string): string {
    if (defaultPackageDirectory) {
      return path.relative(projectRoot, defaultPackageDirectory) || '.';
    }

    if (startPath) {
      const relativeStartPath = path.relative(projectRoot, path.resolve(startPath));
      return relativeStartPath && !relativeStartPath.startsWith('..') ? relativeStartPath : 'force-app';
    }

    return 'force-app';
  }

  private createConfig(options: {
    sourcePath: string;
    packageDirectories: string[];
    apiVersion?: string;
    cacheEnabled: boolean;
    validationMode: InitValidationMode;
    reportDir: string;
    skipTests: boolean;
  }): DeploymentConfig {
    return {
      source: {
        path: options.sourcePath,
        packageDirectories: options.packageDirectories,
        apiVersion: options.apiVersion,
      },
      cache: {
        enabled: options.cacheEnabled,
        strategy: 'file-hash',
      },
      ci: {
        preset: {
          validationMode: options.validationMode,
          skipTests: options.skipTests,
          reportDir: options.reportDir,
        },
      },
      reports: {
        planDir: options.reportDir,
        graphDir: DEFAULT_GRAPH_REPORT_DIR,
      },
    };
  }
}
