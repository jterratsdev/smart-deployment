import { access, copyFile, mkdir, mkdtemp, readFile, rm } from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { glob } from 'glob';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';

export type ForceIgnoreStagingOptions = {
  projectRoot: string;
};

export type DeploymentWorkspace = {
  projectRoot: string;
  isStaged: boolean;
  cleanup: () => Promise<void>;
};

type SfdxProject = {
  packageDirectories?: Array<{ path?: string }>;
};

const PROJECT_ROOT_MARKERS = ['sfdx-project.json', '.forceignore'] as const;
const DEFAULT_PACKAGE_DIRECTORY = 'force-app';
const PROJECT_FILES = ['sfdx-project.json', '.forceignore'] as const;

export class ForceIgnoreStagingService {
  public async prepare(options: ForceIgnoreStagingOptions): Promise<DeploymentWorkspace> {
    const projectRoot = await findProjectRoot(options.projectRoot);
    const parser = new ForceIgnoreParser();
    const loadResult = await parser.load(projectRoot);

    if (!loadResult.found || parser.getRules().length === 0) {
      return originalWorkspace(projectRoot);
    }

    const packageDirectories = await readPackageDirectories(projectRoot);
    const sourceFiles = await listSourceFiles(projectRoot, packageDirectories);
    const filteredSourceFiles = sourceFiles.filter((file) => !parser.isIgnored(path.join(projectRoot, file)));

    if (filteredSourceFiles.length === sourceFiles.length) {
      return originalWorkspace(projectRoot);
    }

    const stagingRoot = await mkdtemp(path.join(os.tmpdir(), 'smart-deployment-forceignore-'));
    try {
      await copyProjectFiles(projectRoot, stagingRoot);
      await copyFiles(projectRoot, stagingRoot, filteredSourceFiles);
      return {
        projectRoot: stagingRoot,
        isStaged: true,
        cleanup: async (): Promise<void> => {
          await rm(stagingRoot, { recursive: true, force: true });
        },
      };
    } catch (error) {
      await rm(stagingRoot, { recursive: true, force: true });
      throw error;
    }
  }
}

function originalWorkspace(projectRoot: string): DeploymentWorkspace {
  return {
    projectRoot,
    isStaged: false,
    cleanup: () => Promise.resolve(),
  };
}

async function findProjectRoot(startPath: string): Promise<string> {
  let current = path.resolve(startPath);

  while (current !== path.dirname(current)) {
    for (const marker of PROJECT_ROOT_MARKERS) {
      if (await exists(path.join(current, marker))) {
        return current;
      }
    }

    current = path.dirname(current);
  }

  return path.resolve(startPath);
}

async function readPackageDirectories(projectRoot: string): Promise<string[]> {
  const projectFile = path.join(projectRoot, 'sfdx-project.json');
  if (!(await exists(projectFile))) {
    return [DEFAULT_PACKAGE_DIRECTORY];
  }

  const parsed = JSON.parse(await readFile(projectFile, 'utf8')) as SfdxProject;
  const directories = parsed.packageDirectories
    ?.map((directory) => directory.path)
    .filter((directory): directory is string => typeof directory === 'string' && directory.length > 0)
    .map((directory) => normalizePackageDirectory(projectRoot, directory));

  return directories && directories.length > 0 ? directories : [DEFAULT_PACKAGE_DIRECTORY];
}

async function listSourceFiles(projectRoot: string, packageDirectories: readonly string[]): Promise<string[]> {
  const files = await Promise.all(
    packageDirectories.map((directory) =>
      glob(`${normalizeGlobSegment(directory)}/**/*`, {
        cwd: projectRoot,
        nodir: true,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**', '**/.smart-deployment/**'],
      })
    )
  );

  return [...new Set(files.flat().map(normalizeRelativePath))].sort();
}

async function copyProjectFiles(projectRoot: string, stagingRoot: string): Promise<void> {
  for (const file of PROJECT_FILES) {
    const source = path.join(projectRoot, file);
    if (await exists(source)) {
      await copyFile(source, path.join(stagingRoot, file));
    }
  }
}

async function copyFiles(projectRoot: string, stagingRoot: string, files: readonly string[]): Promise<void> {
  for (const file of files) {
    const source = path.join(projectRoot, file);
    const destination = path.join(stagingRoot, file);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeGlobSegment(segment: string): string {
  return normalizeRelativePath(segment).replace(/[?*[\\\]]/gu, '\\$&');
}

function normalizePackageDirectory(projectRoot: string, directory: string): string {
  const absoluteDirectory = path.resolve(projectRoot, directory);
  const relativeDirectory = path.relative(projectRoot, absoluteDirectory);
  if (relativeDirectory.startsWith('..') || path.isAbsolute(relativeDirectory)) {
    throw new Error(`Package directory must stay inside the Salesforce project: ${directory}`);
  }

  return normalizeRelativePath(relativeDirectory);
}

function normalizeRelativePath(filePath: string): string {
  return filePath.split(path.sep).join('/');
}
