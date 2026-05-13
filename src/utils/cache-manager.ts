import { CacheEntrySerializer } from './cache-entry-serializer.js';
import { CacheExpiryPolicy } from './cache-expiry-policy.js';
import { CacheKeyDerivation } from './cache-key-derivation.js';
import { CacheLockLifecycle } from './cache-lock-lifecycle.js';
import { cacheLogger } from './cache-logger.js';
import { CacheStorage } from './cache-storage.js';

/**
 * Cache entry with TTL (Time To Live)
 */
export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
  createdAt: number;
  hits: number;
};

/**
 * Cache statistics for monitoring
 */
export type CacheStats = {
  hits: number;
  misses: number;
  hitRate: number;
  size: number;
  evictions: number;
  memorySizeBytes: number;
};

/**
 * Cache configuration
 */
export type CacheConfig = {
  /** Max entries in cache */
  maxSize: number;
  /** Time to live in milliseconds */
  ttlMs: number;
  /** Enable persistent cache (disk) */
  enablePersistence: boolean;
  /** Cache directory for persistent cache */
  cacheDirectory?: string;
  /** Enable file locking to prevent concurrent access */
  enableLocking: boolean;
};

/**
 * Default cache configuration
 */
const DEFAULT_CONFIG: CacheConfig = {
  maxSize: 1000,
  ttlMs: 3_600_000, // 1 hour
  enablePersistence: false,
  enableLocking: true,
};

export type LockInfo = {
  pid: number;
  timestamp: string;
  hostname: string;
};

type CacheMutationResult = {
  changed: boolean;
  deletedKeys: string[];
};

/**
 * Singleton Cache Manager with TTL, persistence, and locking
 *
 * **Singleton Pattern**: Ensures only one instance exists per process
 * **File Locking**: Prevents concurrent access across processes
 * **Thread-safe**: Safe for concurrent operations within same process
 *
 * @example
 * ```typescript
 * const cache = CacheManager.getInstance();
 * await cache.set('key', { data: 'value' });
 * const value = await cache.get('key');
 * ```
 */
export class CacheManager {
  private static instance: CacheManager | null = null;

  private cache: Map<string, CacheEntry<unknown>>;
  private config: CacheConfig;
  private stats: CacheStats;
  private readonly storage: CacheStorage;
  private readonly expiryPolicy: CacheExpiryPolicy;
  private readonly lockLifecycle: CacheLockLifecycle;
  private readonly keyDerivation: CacheKeyDerivation;
  private readonly serializer: CacheEntrySerializer;

  /**
   * Private constructor - use getInstance() instead
   * Singleton pattern prevents multiple instances
   */
  private constructor(config?: Partial<CacheConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.cache = new Map();
    this.keyDerivation = new CacheKeyDerivation();
    this.serializer = new CacheEntrySerializer();
    this.expiryPolicy = new CacheExpiryPolicy();
    this.storage = new CacheStorage(() => this.config, this.keyDerivation, this.serializer);
    this.lockLifecycle = new CacheLockLifecycle(() => this.config, this.keyDerivation, this.serializer);
    this.stats = {
      hits: 0,
      misses: 0,
      hitRate: 0,
      size: 0,
      evictions: 0,
      memorySizeBytes: 0,
    };
  }

  /**
   * Get singleton instance
   * Thread-safe within same process
   */
  public static getInstance(config?: Partial<CacheConfig>): CacheManager {
    if (!CacheManager.instance) {
      CacheManager.instance = new CacheManager(config);
    }

    return CacheManager.instance;
  }

  /**
   * Reset singleton (for testing only)
   */
  public static resetInstance(): void {
    CacheManager.instance = null;
  }

  /**
   * Acquire file lock to prevent concurrent access across processes
   *
   * @param orgAlias - Salesforce org alias to lock
   * @returns True if lock acquired, false if already locked
   */
  public async acquireLock(orgAlias: string): Promise<boolean> {
    return this.lockLifecycle.acquireLock(orgAlias);
  }

  /**
   * Release file lock
   */
  public async releaseLock(): Promise<void> {
    await this.lockLifecycle.releaseLock();
  }

  /**
   * Check if another instance is running for the same org
   */
  public async isLocked(orgAlias: string): Promise<false | LockInfo> {
    return this.lockLifecycle.isLocked(orgAlias);
  }

  /**
   * Get value from cache
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      this.recordMiss();
      return null;
    }

    if (this.expiryPolicy.isExpired(entry)) {
      this.cache.delete(key);
      this.recordMiss();
      return null;
    }

    entry.hits++;
    this.recordHit();

    return entry.value;
  }

  /**
   * Set value in cache with TTL
   */
  public async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    const ttl = ttlMs ?? this.config.ttlMs;
    if (this.cache.size >= this.config.maxSize) {
      this.evictOldest();
    }

    const entry = this.expiryPolicy.createEntry(value, ttl);
    this.cache.set(key, entry as CacheEntry<unknown>);
    this.stats.size = this.cache.size;

    if (this.config.enablePersistence) {
      await this.storage.persistEntry(key, entry);
    }
  }

  /**
   * Check if key exists and is not expired
   */
  public has(key: string): boolean {
    const value = this.get(key);
    return value !== null;
  }

  /**
   * Delete specific key
   */
  public async delete(key: string): Promise<boolean> {
    const deleted = this.deleteFromMemory(key).changed;
    this.stats.size = this.cache.size;

    if (deleted && this.config.enablePersistence) {
      await this.storage.deletePersistedEntry(key);
    }

    return deleted;
  }

  /**
   * Clear all cache entries
   */
  public async clear(): Promise<void> {
    this.cache.clear();
    this.stats.size = 0;
    this.stats.evictions = 0;

    if (this.config.enablePersistence && this.config.cacheDirectory) {
      await this.storage.clearPersistedCache();
    }
  }

  /**
   * Get cache statistics
   */
  public getStats(): CacheStats {
    this.updateMemorySize();
    return { ...this.stats };
  }

  /**
   * Load cache from disk
   */
  public async loadFromDisk(): Promise<number> {
    if (!this.config.enablePersistence || !this.config.cacheDirectory) {
      return 0;
    }

    try {
      const results = await this.storage.loadEntriesFromDisk(this.expiryPolicy);
      let loaded = 0;
      for (const result of results) {
        this.cache.set(result.key, result.entry);
        loaded++;
      }

      this.stats.size = this.cache.size;
      return loaded;
    } catch (error) {
      cacheLogger.error('Failed to load cache from disk', { error, cacheDirectory: this.config.cacheDirectory });
      return 0;
    }
  }

  /**
   * Clean expired entries (garbage collection)
   */
  public async cleanExpired(): Promise<number> {
    const expiredKeys = this.expiryPolicy.collectExpiredKeys(this.cache);
    this.deleteManyFromMemory(expiredKeys);

    if (this.config.enablePersistence && expiredKeys.length > 0) {
      await Promise.all(expiredKeys.map(async (key) => this.storage.deletePersistedEntry(key)));
    }

    this.stats.size = this.cache.size;
    return expiredKeys.length;
  }

  /**
   * Get all keys in cache
   */
  public keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Get cache size
   */
  public size(): number {
    return this.cache.size;
  }

  /**
   * Update configuration
   */
  public configure(config: Partial<CacheConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Evict oldest entry (LRU-like)
   */
  private evictOldest(): void {
    const oldestKey = this.expiryPolicy.selectOldestKey(this.cache);
    if (oldestKey) {
      this.deleteFromMemory(oldestKey);
      this.stats.evictions++;
    }
  }

  private deleteFromMemory(key: string): CacheMutationResult {
    const changed = this.cache.delete(key);
    return {
      changed,
      deletedKeys: changed ? [key] : [],
    };
  }

  private deleteManyFromMemory(keys: readonly string[]): CacheMutationResult {
    let changed = false;
    const deletedKeys: string[] = [];

    for (const key of keys) {
      if (this.cache.delete(key)) {
        changed = true;
        deletedKeys.push(key);
      }
    }

    return {
      changed,
      deletedKeys,
    };
  }

  private recordHit(): void {
    this.stats.hits++;
    this.updateHitRate();
  }

  private recordMiss(): void {
    this.stats.misses++;
    this.updateHitRate();
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Estimate memory size
   */
  private updateMemorySize(): void {
    let totalSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      // Rough estimation: key + JSON stringified value
      totalSize += key.length * 2; // UTF-16
      totalSize += JSON.stringify(entry.value).length * 2;
      totalSize += 64; // Overhead for metadata
    }

    this.stats.memorySizeBytes = totalSize;
  }
}

/**
 * Get default cache instance (singleton)
 */
export function getCacheManager(config?: Partial<CacheConfig>): CacheManager {
  return CacheManager.getInstance(config);
}
