import type { CacheEntry, LockInfo } from './cache-manager.js';

export class CacheEntrySerializer {
  public serialize<T>(entry: CacheEntry<T>): string {
    return JSON.stringify(entry);
  }

  public deserialize(content: string): CacheEntry<unknown> {
    return JSON.parse(content) as CacheEntry<unknown>;
  }

  public serializeLock(lockInfo: LockInfo): string {
    return JSON.stringify(lockInfo, null, 2);
  }

  public deserializeLock(content: string): LockInfo {
    return JSON.parse(content) as LockInfo;
  }
}
