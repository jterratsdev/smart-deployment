import { execFile } from 'node:child_process';
import { readFile, rm, writeFile } from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { glob } from 'glob';
import { ForceIgnoreParser } from '../scanner/forceignore-parser.js';

const execFileAsync = promisify(execFile);

export type RetrieveForceIgnoreOptions = {
  projectRoot?: string;
  targetOrg?: string;
  metadata?: string[];
  manifest?: string;
  wait?: number;
  strictIgnore?: boolean;
  normalizeMeta?: boolean;
};

export type RetrieveForceIgnoreResult = {
  success: boolean;
  projectRoot: string;
  retrieveOutput: string;
  changedPaths: string[];
  protectedPaths: string[];
  restoredPaths: string[];
  normalizedPaths: string[];
  strictViolation: boolean;
  architecturalConcerns: {
    inherited: string[];
    selfImposed: string[];
  };
};

export type GitStatusEntry = {
  path: string;
  indexStatus: string;
  workingTreeStatus: string;
  untracked: boolean;
};

type RetrieveForceIgnoreServiceDependencies = {
  sfRetrieveRunner?: Pick<SfRetrieveRunner, 'retrieve'>;
  gitProvider?: Pick<GitWorkspaceProvider, 'listChangedPaths' | 'restorePaths'>;
};

export class RetrieveForceIgnoreService {
  private readonly sfRetrieveRunner: Pick<SfRetrieveRunner, 'retrieve'>;
  private readonly gitProvider: Pick<GitWorkspaceProvider, 'listChangedPaths' | 'restorePaths'>;

  public constructor(dependencies: RetrieveForceIgnoreServiceDependencies = {}) {
    this.sfRetrieveRunner = dependencies.sfRetrieveRunner ?? new SfRetrieveRunner();
    this.gitProvider = dependencies.gitProvider ?? new GitWorkspaceProvider();
  }

  public async retrieve(options: RetrieveForceIgnoreOptions = {}): Promise<RetrieveForceIgnoreResult> {
    const projectRoot = path.resolve(options.projectRoot ?? process.cwd());
    const retrieveOutput = await this.sfRetrieveRunner.retrieve(projectRoot, options);
    const normalizedPaths = options.normalizeMeta === true ? await normalizeDigitalExperienceMeta(projectRoot) : [];
    const parser = new ForceIgnoreParser();
    const loadResult = await parser.load(projectRoot);
    const changedEntries = await this.gitProvider.listChangedPaths(projectRoot);
    const changedPaths = changedEntries.map((entry) => entry.path).sort();
    const protectedEntries = loadResult.found
      ? changedEntries.filter((entry) => parser.isIgnored(path.join(projectRoot, entry.path)))
      : [];
    const protectedPaths = protectedEntries.map((entry) => entry.path).sort();
    const restoredPaths =
      protectedPaths.length > 0 ? await this.gitProvider.restorePaths(projectRoot, protectedEntries) : [];
    const strictViolation = options.strictIgnore === true && protectedPaths.length > 0;

    return {
      success: !strictViolation,
      projectRoot,
      retrieveOutput,
      changedPaths,
      protectedPaths,
      restoredPaths,
      normalizedPaths,
      strictViolation,
      architecturalConcerns: {
        inherited: [
          'Salesforce CLI may retrieve composite bundle sub-paths even when .forceignore excludes leaf paths.',
        ],
        selfImposed: [
          'Adds a retrieve wrapper that enforces .forceignore after the Salesforce CLI writes files because the underlying CLI does not expose reliable leaf-level bundle filtering.',
        ],
      },
    };
  }
}

export class SfRetrieveRunner {
  public async retrieve(projectRoot: string, options: RetrieveForceIgnoreOptions): Promise<string> {
    const args = ['project', 'retrieve', 'start', '--json'];

    for (const metadata of options.metadata ?? []) {
      args.push('--metadata', metadata);
    }

    if (options.manifest) {
      args.push('--manifest', options.manifest);
    }

    if (options.targetOrg) {
      args.push('--target-org', options.targetOrg);
    }

    if (options.wait !== undefined) {
      args.push('--wait', String(options.wait));
    }

    const { stdout, stderr } = await execFileAsync('sf', args, { cwd: projectRoot });
    return stdout + stderr;
  }
}

export class GitWorkspaceProvider {
  public async listChangedPaths(projectRoot: string): Promise<GitStatusEntry[]> {
    const { stdout } = await execFileAsync('git', ['status', '--porcelain', '--untracked-files=all'], {
      cwd: projectRoot,
    });
    return parseGitStatus(stdout);
  }

  public async restorePaths(projectRoot: string, entries: GitStatusEntry[]): Promise<string[]> {
    const restored = await entries.reduce<Promise<string[]>>(async (previous, entry) => {
      const restoredPaths = await previous;
      await restoreGitStatusEntry(projectRoot, entry);
      return [...restoredPaths, entry.path];
    }, Promise.resolve([]));

    return restored.sort();
  }
}

async function restoreGitStatusEntry(projectRoot: string, entry: GitStatusEntry): Promise<void> {
  const absolutePath = path.join(projectRoot, entry.path);
  if (entry.untracked) {
    await rm(absolutePath, { recursive: true, force: true });
    return;
  }

  await execFileAsync('git', ['checkout', 'HEAD', '--', entry.path], { cwd: projectRoot });
}

function parseGitStatus(output: string): GitStatusEntry[] {
  return output
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const indexStatus = line[0] ?? ' ';
      const workingTreeStatus = line[1] ?? ' ';
      const rawPath = line.slice(3);
      const filePath = rawPath.includes(' -> ') ? rawPath.split(' -> ').at(-1)! : rawPath;
      return {
        path: normalizeGitPath(filePath),
        indexStatus,
        workingTreeStatus,
        untracked: indexStatus === '?' && workingTreeStatus === '?',
      };
    });
}

async function normalizeDigitalExperienceMeta(projectRoot: string): Promise<string[]> {
  const files = await glob('**/digitalExperiences/**/*_meta.json', {
    cwd: projectRoot,
    absolute: true,
    nodir: true,
    dot: true,
    ignore: ['**/node_modules/**', '**/.git/**'],
  });
  const normalizedPaths = await Promise.all(
    files.map(async (file) => {
      const raw = await readFile(file, 'utf8');
      const normalized = JSON.stringify(JSON.parse(raw), null, 2) + '\n';
      if (raw === normalized) {
        return undefined;
      }

      await writeFile(file, normalized, 'utf8');
      return normalizeRelativePath(projectRoot, file);
    })
  );

  return normalizedPaths.filter((filePath): filePath is string => filePath !== undefined).sort();
}

function normalizeGitPath(filePath: string): string {
  const unquoted = filePath.startsWith('"') && filePath.endsWith('"') ? (JSON.parse(filePath) as string) : filePath;
  return unquoted.split(path.sep).join('/');
}

function normalizeRelativePath(projectRoot: string, filePath: string): string {
  const relativePath = path.relative(projectRoot, filePath);
  return relativePath.split(path.sep).join('/');
}

export const retrieveForceIgnoreInternals = {
  parseGitStatus,
};
