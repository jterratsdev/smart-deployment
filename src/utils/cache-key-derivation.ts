import os from 'node:os';
import path from 'node:path';

export class CacheKeyDerivation {
  private static readonly CACHE_FILE_PREFIX = 'cache_';
  private static readonly CACHE_FILE_SUFFIX = '.json';
  private static readonly LOCK_DIRECTORY_NAME = 'sf-smart-deployment-locks';

  public toPersistedFileName(key: string): string {
    const hash = Buffer.from(key).toString('base64').replaceAll(/[/+=]/g, '_');
    return `${CacheKeyDerivation.CACHE_FILE_PREFIX}${hash}${CacheKeyDerivation.CACHE_FILE_SUFFIX}`;
  }

  public isPersistedCacheFile(fileName: string): boolean {
    return (
      fileName.startsWith(CacheKeyDerivation.CACHE_FILE_PREFIX) &&
      fileName.endsWith(CacheKeyDerivation.CACHE_FILE_SUFFIX)
    );
  }

  public toPersistedKey(fileName: string): string {
    return fileName.replace(CacheKeyDerivation.CACHE_FILE_PREFIX, '').replace(CacheKeyDerivation.CACHE_FILE_SUFFIX, '');
  }

  public sanitizeLockTarget(orgAlias: string): string {
    return orgAlias.replaceAll(/[^\w-]/g, '_');
  }

  public resolveLockDirectory(): string {
    return path.join(os.tmpdir(), CacheKeyDerivation.LOCK_DIRECTORY_NAME);
  }

  public resolveLockFilePath(orgAlias: string): string {
    return path.join(this.resolveLockDirectory(), `${this.sanitizeLockTarget(orgAlias)}.lock`);
  }
}
