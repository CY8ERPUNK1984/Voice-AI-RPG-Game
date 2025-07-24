import * as fs from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

interface CacheEntry<T> {
  key: string;
  data: T;
  timestamp: Date;
  expiresAt: Date;
  compressed: boolean;
  size: number;
  accessCount: number;
  lastAccessed: Date;
}

interface CacheOptions {
  maxSize?: number; // Maximum cache size in bytes
  maxEntries?: number; // Maximum number of entries
  defaultTTL?: number; // Default time to live in milliseconds
  compressionThreshold?: number; // Compress entries larger than this size
  persistPath?: string; // Path to persist cache to disk
  enablePersistence?: boolean;
}

export interface CacheStats {
  totalEntries: number;
  totalSize: number;
  hitRate: number;
  missRate: number;
  totalHits: number;
  totalMisses: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}

export class CacheService<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private stats = {
    hits: 0,
    misses: 0,
    totalSize: 0
  };
  
  private readonly maxSize: number;
  private readonly maxEntries: number;
  private readonly defaultTTL: number;
  private readonly compressionThreshold: number;
  private readonly persistPath?: string;
  private readonly enablePersistence: boolean;
  private persistenceInterval?: NodeJS.Timeout;

  constructor(options: CacheOptions = {}) {
    this.maxSize = options.maxSize || 100 * 1024 * 1024; // 100MB default
    this.maxEntries = options.maxEntries || 1000;
    this.defaultTTL = options.defaultTTL || 60 * 60 * 1000; // 1 hour default
    this.compressionThreshold = options.compressionThreshold || 1024; // 1KB
    this.persistPath = options.persistPath;
    this.enablePersistence = options.enablePersistence || false;

    if (this.enablePersistence && this.persistPath) {
      this.loadFromDisk().catch(error => {
        console.warn('Failed to load cache from disk:', error);
      });
      
      // Persist cache every 5 minutes
      this.persistenceInterval = setInterval(() => {
        this.persistToDisk().catch(error => {
          console.error('Failed to persist cache:', error);
        });
      }, 5 * 60 * 1000);
    }
  }

  /**
   * Generate cache key from input data
   */
  private generateKey(input: any): string {
    const hash = crypto.createHash('sha256');
    hash.update(JSON.stringify(input));
    return hash.digest('hex');
  }

  /**
   * Check if entry is expired
   */
  private isExpired(entry: CacheEntry<T>): boolean {
    return new Date() > entry.expiresAt;
  }

  /**
   * Compress data if it exceeds threshold
   */
  private async compressData(data: T): Promise<{ data: Buffer | T; compressed: boolean }> {
    const serialized = JSON.stringify(data);
    const size = Buffer.byteLength(serialized);
    
    if (size > this.compressionThreshold) {
      const compressed = await gzip(serialized);
      return { data: compressed, compressed: true };
    }
    
    return { data, compressed: false };
  }

  /**
   * Decompress data if compressed
   */
  private async decompressData(entry: CacheEntry<T>): Promise<T> {
    if (entry.compressed && Buffer.isBuffer(entry.data)) {
      const decompressed = await gunzip(entry.data);
      return JSON.parse(decompressed.toString());
    }
    
    return entry.data;
  }

  /**
   * Evict least recently used entries to make space
   */
  private evictLRU(): void {
    if (this.cache.size === 0) return;

    // Sort by last accessed time (oldest first)
    const entries = Array.from(this.cache.entries()).sort(
      ([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime()
    );

    // Remove oldest entries until we're under limits
    let removedSize = 0;
    let removedCount = 0;

    for (const [key, entry] of entries) {
      if (this.cache.size <= this.maxEntries && 
          this.stats.totalSize <= this.maxSize) {
        break;
      }

      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      removedSize += entry.size;
      removedCount++;
    }

    if (removedCount > 0) {
      console.log(`Evicted ${removedCount} cache entries (${removedSize} bytes)`);
    }
  }

  /**
   * Set cache entry
   */
  async set(key: string, data: T, ttl?: number): Promise<void> {
    const actualTTL = ttl || this.defaultTTL;
    const expiresAt = new Date(Date.now() + actualTTL);
    
    // Compress data if needed
    const { data: processedData, compressed } = await this.compressData(data);
    
    const serializedSize = compressed ? 
      (processedData as Buffer).length : 
      Buffer.byteLength(JSON.stringify(data));

    const entry: CacheEntry<T> = {
      key,
      data: processedData as T,
      timestamp: new Date(),
      expiresAt,
      compressed,
      size: serializedSize,
      accessCount: 0,
      lastAccessed: new Date()
    };

    // Remove existing entry if it exists
    const existing = this.cache.get(key);
    if (existing) {
      this.stats.totalSize -= existing.size;
    }

    // Add new entry
    this.cache.set(key, entry);
    this.stats.totalSize += entry.size;

    // Evict if necessary
    this.evictLRU();
  }

  /**
   * Get cache entry
   */
  async get(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    if (this.isExpired(entry)) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      this.stats.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    this.stats.hits++;

    // Decompress if needed
    return await this.decompressData(entry);
  }

  /**
   * Get or set cache entry
   */
  async getOrSet(key: string, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const cached = await this.get(key);
    if (cached !== null) {
      return cached;
    }

    const data = await factory();
    await this.set(key, data, ttl);
    return data;
  }

  /**
   * Generate key and get cached value
   */
  async getCached(input: any): Promise<T | null> {
    const key = this.generateKey(input);
    return await this.get(key);
  }

  /**
   * Generate key and set cached value
   */
  async setCached(input: any, data: T, ttl?: number): Promise<void> {
    const key = this.generateKey(input);
    await this.set(key, data, ttl);
  }

  /**
   * Generate key and get or set cached value
   */
  async getOrSetCached(input: any, factory: () => Promise<T>, ttl?: number): Promise<T> {
    const key = this.generateKey(input);
    return await this.getOrSet(key, factory, ttl);
  }

  /**
   * Delete cache entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.cache.delete(key);
      this.stats.totalSize -= entry.size;
      return true;
    }
    return false;
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.stats.totalSize = 0;
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Clean up expired entries
   */
  cleanup(): number {
    let removedCount = 0;
    const now = new Date();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expiresAt < now) {
        this.cache.delete(key);
        this.stats.totalSize -= entry.size;
        removedCount++;
      }
    }

    return removedCount;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const entries = Array.from(this.cache.values());
    const totalRequests = this.stats.hits + this.stats.misses;
    
    return {
      totalEntries: this.cache.size,
      totalSize: this.stats.totalSize,
      hitRate: totalRequests > 0 ? this.stats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? this.stats.misses / totalRequests : 0,
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      oldestEntry: entries.length > 0 ? 
        new Date(Math.min(...entries.map(e => e.timestamp.getTime()))) : undefined,
      newestEntry: entries.length > 0 ? 
        new Date(Math.max(...entries.map(e => e.timestamp.getTime()))) : undefined
    };
  }

  /**
   * Persist cache to disk
   */
  private async persistToDisk(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const cacheData = {
        entries: Array.from(this.cache.entries()),
        stats: this.stats,
        timestamp: new Date()
      };

      const dir = path.dirname(this.persistPath);
      await fs.mkdir(dir, { recursive: true });

      const tempPath = `${this.persistPath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(cacheData));
      await fs.rename(tempPath, this.persistPath);

      console.log(`Persisted ${this.cache.size} cache entries to ${this.persistPath}`);
    } catch (error) {
      console.error('Failed to persist cache:', error);
      throw error;
    }
  }

  /**
   * Load cache from disk
   */
  private async loadFromDisk(): Promise<void> {
    if (!this.persistPath) return;

    try {
      const data = await fs.readFile(this.persistPath, 'utf8');
      const cacheData = JSON.parse(data);

      this.cache.clear();
      this.stats.totalSize = 0;

      for (const [key, entry] of cacheData.entries) {
        // Convert date strings back to Date objects
        entry.timestamp = new Date(entry.timestamp);
        entry.expiresAt = new Date(entry.expiresAt);
        entry.lastAccessed = new Date(entry.lastAccessed);

        // Skip expired entries
        if (!this.isExpired(entry)) {
          this.cache.set(key, entry);
          this.stats.totalSize += entry.size;
        }
      }

      // Restore stats
      if (cacheData.stats) {
        this.stats.hits = cacheData.stats.hits || 0;
        this.stats.misses = cacheData.stats.misses || 0;
      }

      console.log(`Loaded ${this.cache.size} cache entries from ${this.persistPath}`);
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log('No cache file found, starting with empty cache');
      } else {
        console.error('Failed to load cache from disk:', error);
        throw error;
      }
    }
  }

  /**
   * Shutdown cache service
   */
  async shutdown(): Promise<void> {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = undefined;
    }

    if (this.enablePersistence && this.persistPath) {
      try {
        await this.persistToDisk();
        console.log('Cache persisted successfully during shutdown');
      } catch (error) {
        console.error('Failed to persist cache during shutdown:', error);
      }
    }

    this.clear();
  }
}

// Specialized cache services
export class LLMCache extends CacheService<string> {
  constructor(persistPath?: string) {
    super({
      maxSize: 50 * 1024 * 1024, // 50MB for LLM responses
      maxEntries: 500,
      defaultTTL: 2 * 60 * 60 * 1000, // 2 hours
      compressionThreshold: 512, // Compress responses > 512 bytes
      persistPath,
      enablePersistence: true
    });
  }
}

export class TTSCache extends CacheService<string> {
  constructor(persistPath?: string) {
    super({
      maxSize: 200 * 1024 * 1024, // 200MB for audio files
      maxEntries: 1000,
      defaultTTL: 24 * 60 * 60 * 1000, // 24 hours (audio can be reused longer)
      compressionThreshold: 2048, // Don't compress small audio URLs
      persistPath,
      enablePersistence: true
    });
  }
}