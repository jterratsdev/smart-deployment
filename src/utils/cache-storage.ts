import fs from 'node:fs/promises';
import path from 'node:path';
import type { CacheConfig, CacheEntry } from './cache-manager.js';
import { CacheEntrySerializer } from './cache-entry-serializer.js';
import { CacheExpiryPolicy } from './cache-expiry-policy.js';
import { CacheKeyDerivation } from './cache-key-derivation.js';
import { cacheLogger } from './cache-logger.js';

type PersistedCacheEntry = {
  key: string;
  entry: CacheEntry<unknown>;
};

export class CacheStorage {
  public constructor(
    private readonly getConfig: () => CacheConfig,
    private readonly keyDerivation: CacheKeyDerivation,
    private readonly serializer: CacheEntrySerializer
  ) {}

  public async persistEntry<T>(key: string, entry: CacheEntry<T>): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      await fs.mkdir(config.cacheDirectory, { recursive: true });
      const fileName = this.keyDerivation.toPersistedFileName(key);
      const filePath = path.join(config.cacheDirectory, fileName);
      await fs.writeFile(filePath, this.serializer.serialize(entry), 'utf-8');
    } catch (error) {
      cacheLogger.warn('Failed to persist cache entry', { error, key, cacheDirectory: config.cacheDirectory });
    }
  }

  public async deletePersistedEntry(key: string): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      const fileName = this.keyDerivation.toPersistedFileName(key);
      const filePath = path.join(config.cacheDirectory, fileName);
      await fs.unlink(filePath);
    } catch {
      // Ignore if file doesn't exist
    }
  }

  public async clearPersistedCache(): Promise<void> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return;
    }

    try {
      await fs.rm(config.cacheDirectory, { recursive: true, force: true });
    } catch (error) {
      cacheLogger.warn('Failed to clear cache directory', { error, cacheDirectory: config.cacheDirectory });
    }
  }

  public async loadEntriesFromDisk(expiryPolicy: CacheExpiryPolicy): Promise<PersistedCacheEntry[]> {
    const config = this.getConfig();
    if (!config.cacheDirectory) {
      return [];
    }

    const files = await fs.readdir(config.cacheDirectory);
    const cacheFiles = files.filter((file) => this.keyDerivation.isPersistedCacheFile(file));
    const results = await Promise.all(cacheFiles.map(async (file) => this.loadPersistedEntry(file, expiryPolicy)));

    return results.filter((result): result is PersistedCacheEntry => result !== null);
  }

  private async loadPersistedEntry(file: string, expiryPolicy: CacheExpiryPolicy): Promise<PersistedCacheEntry | null> {
    const config = this.getConfig();
    try {
      const filePath = path.join(config.cacheDirectory!, file);
      const content = await fs.readFile(filePath, 'utf-8');
      const entry = this.serializer.deserialize(content);

      if (expiryPolicy.isExpired(entry)) {
        await fs.unlink(filePath);
        return null;
      }

      const key = this.keyDerivation.toPersistedKey(file);
      return { key, entry };
    } catch (error) {
      cacheLogger.warn('Skipping invalid cache file', { error, file });
      return null;
    }
  }
}
