import { mkdir, open, rename, unlink } from 'node:fs/promises';
import * as path from 'node:path';

const DEFAULT_REPORT_DIRECTORY = '.smart-deployment/reports';
const RELEASE_REPORT_FILE_NAME = 'release-report.json';

export type ReleaseReportStoreResult = { kind: 'written'; path: string } | { kind: 'unavailable'; warning: string };

export type ReleaseReportStoreOptions = {
  projectRoot: string;
  reportDir?: string;
};

type AtomicFileHandle = {
  writeFile: (content: string, encoding: BufferEncoding) => Promise<void>;
  sync: () => Promise<void>;
  close: () => Promise<void>;
};

export type ReleaseReportFileSystem = {
  mkdir: (directory: string) => Promise<void>;
  openExclusive: (filePath: string) => Promise<AtomicFileHandle>;
  rename: (source: string, destination: string) => Promise<void>;
  unlink: (filePath: string) => Promise<void>;
};

let temporarySequence = 0;

const NODE_FILE_SYSTEM: ReleaseReportFileSystem = {
  mkdir: async (directory) => mkdir(directory, { recursive: true }).then(() => undefined),
  openExclusive: async (filePath) => open(filePath, 'wx'),
  rename,
  unlink,
};

export class ReleaseReportStore {
  public constructor(
    private readonly fileSystem: ReleaseReportFileSystem = NODE_FILE_SYSTEM,
    private readonly temporaryPathFactory: (finalPath: string) => string = defaultTemporaryPath
  ) {}

  public resolvePath(options: ReleaseReportStoreOptions): string {
    const directory = options.reportDir
      ? path.resolve(options.projectRoot, options.reportDir)
      : path.resolve(options.projectRoot, DEFAULT_REPORT_DIRECTORY);
    return path.join(directory, RELEASE_REPORT_FILE_NAME);
  }

  public async write(serializedReport: string, options: ReleaseReportStoreOptions): Promise<ReleaseReportStoreResult> {
    const finalPath = this.resolvePath(options);
    const temporaryPath = this.temporaryPathFactory(finalPath);
    let handle: AtomicFileHandle | undefined;

    try {
      await this.fileSystem.mkdir(path.dirname(finalPath));
      handle = await this.fileSystem.openExclusive(temporaryPath);
      await handle.writeFile(serializedReport, 'utf8');
      await handle.sync();
      await handle.close();
      handle = undefined;
      await this.fileSystem.rename(temporaryPath, finalPath);
      return { kind: 'written', path: finalPath };
    } catch {
      await closeBestEffort(handle);
      await this.fileSystem.unlink(temporaryPath).catch(() => undefined);
      return {
        kind: 'unavailable',
        warning: 'Release report persistence is unavailable; the underlying operation result is unchanged.',
      };
    }
  }
}

async function closeBestEffort(handle: AtomicFileHandle | undefined): Promise<void> {
  if (handle) await handle.close().catch(() => undefined);
}

function defaultTemporaryPath(finalPath: string): string {
  temporarySequence += 1;
  return `${finalPath}.${process.pid}.${temporarySequence}.tmp`;
}
