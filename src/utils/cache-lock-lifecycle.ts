import fs from 'node:fs/promises';
import os from 'node:os';
import type { CacheConfig, LockInfo } from './cache-manager.js';
import { CacheEntrySerializer } from './cache-entry-serializer.js';
import { CacheKeyDerivation } from './cache-key-derivation.js';
import { cacheLogger } from './cache-logger.js';

export class CacheLockLifecycle {
  private lockFilePath: string | null = null;
  private lockFileHandle: fs.FileHandle | null = null;

  public constructor(
    private readonly getConfig: () => CacheConfig,
    private readonly keyDerivation: CacheKeyDerivation,
    private readonly serializer: CacheEntrySerializer
  ) {}

  public hasActiveLock(): boolean {
    return this.lockFileHandle !== null;
  }

  public async acquireLock(orgAlias: string): Promise<boolean> {
    if (!this.getConfig().enableLocking) {
      return true;
    }

    try {
      const lockDir = this.keyDerivation.resolveLockDirectory();
      await fs.mkdir(lockDir, { recursive: true });

      this.lockFilePath = this.keyDerivation.resolveLockFilePath(orgAlias);
      this.lockFileHandle = await fs.open(this.lockFilePath, 'wx');

      const lockInfo = {
        pid: process.pid,
        timestamp: new Date().toISOString(),
        hostname: os.hostname(),
      };

      await this.lockFileHandle.writeFile(this.serializer.serializeLock(lockInfo));
      return true;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
        return false;
      }

      cacheLogger.warn('Failed to acquire lock, continuing without locking', { error, orgAlias });
      return true;
    }
  }

  public async releaseLock(): Promise<void> {
    if (!this.lockFileHandle || !this.lockFilePath) {
      return;
    }

    const lockFilePath = this.lockFilePath;

    try {
      await this.lockFileHandle.close();
      await fs.unlink(lockFilePath);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        cacheLogger.warn('Failed to release lock', { error, lockFilePath });
      }
    } finally {
      this.lockFileHandle = null;
      this.lockFilePath = null;
    }
  }

  public async isLocked(orgAlias: string): Promise<false | LockInfo> {
    if (!this.getConfig().enableLocking) {
      return false;
    }

    try {
      const lockFilePath = this.keyDerivation.resolveLockFilePath(orgAlias);
      const lockContent = await fs.readFile(lockFilePath, 'utf-8');
      const lockInfo = this.serializer.deserializeLock(lockContent);

      try {
        process.kill(lockInfo.pid, 0);
        return lockInfo;
      } catch {
        await fs.unlink(lockFilePath);
        return false;
      }
    } catch {
      return false;
    }
  }
}
