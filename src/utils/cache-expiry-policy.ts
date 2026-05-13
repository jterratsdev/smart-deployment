import type { CacheEntry } from './cache-manager.js';

export class CacheExpiryPolicy {
  public createEntry<T>(value: T, ttlMs: number, now = Date.now()): CacheEntry<T> {
    return {
      value,
      expiresAt: now + ttlMs,
      createdAt: now,
      hits: 0,
    };
  }

  public isExpired(entry: CacheEntry<unknown>, now = Date.now()): boolean {
    return now > entry.expiresAt;
  }

  public collectExpiredKeys(cache: ReadonlyMap<string, CacheEntry<unknown>>, now = Date.now()): string[] {
    const expiredKeys: string[] = [];

    for (const [key, entry] of cache.entries()) {
      if (this.isExpired(entry, now)) {
        expiredKeys.push(key);
      }
    }

    return expiredKeys;
  }

  public selectOldestKey(cache: ReadonlyMap<string, CacheEntry<unknown>>): string | null {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of cache.entries()) {
      if (entry.createdAt < oldestTime) {
        oldestTime = entry.createdAt;
        oldestKey = key;
      }
    }

    return oldestKey;
  }
}
