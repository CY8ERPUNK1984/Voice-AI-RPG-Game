import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CacheService, LLMCache, TTSCache } from '../CacheService';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('CacheService', () => {
  let cache: CacheService<string>;
  let testCachePath: string;

  beforeEach(() => {
    testCachePath = path.join(process.cwd(), 'temp', 'test-cache.json');
    cache = new CacheService<string>({
      maxSize: 1024 * 1024, // 1MB
      maxEntries: 100,
      defaultTTL: 60000, // 1 minute
      compressionThreshold: 100,
      persistPath: testCachePath,
      enablePersistence: true
    });
  });

  afterEach(async () => {
    await cache.shutdown();
    
    // Cleanup test files
    try {
      await fs.unlink(testCachePath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  describe('basic operations', () => {
    it('should set and get cache entries', async () => {
      await cache.set('test-key', 'test-value');
      const value = await cache.get('test-key');
      
      expect(value).toBe('test-value');
    });

    it('should return null for non-existent keys', async () => {
      const value = await cache.get('non-existent');
      expect(value).toBeNull();
    });

    it('should handle TTL expiration', async () => {
      await cache.set('expire-key', 'expire-value', 100); // 100ms TTL
      
      // Should exist immediately
      let value = await cache.get('expire-key');
      expect(value).toBe('expire-value');
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 150));
      
      // Should be expired
      value = await cache.get('expire-key');
      expect(value).toBeNull();
    });

    it('should delete cache entries', async () => {
      await cache.set('delete-key', 'delete-value');
      
      expect(await cache.get('delete-key')).toBe('delete-value');
      
      const deleted = cache.delete('delete-key');
      expect(deleted).toBe(true);
      
      expect(await cache.get('delete-key')).toBeNull();
    });

    it('should clear all cache entries', async () => {
      await cache.set('key1', 'value1');
      await cache.set('key2', 'value2');
      
      cache.clear();
      
      expect(await cache.get('key1')).toBeNull();
      expect(await cache.get('key2')).toBeNull();
    });
  });

  describe('getOrSet functionality', () => {
    it('should get existing value', async () => {
      await cache.set('existing-key', 'existing-value');
      
      const factory = vi.fn().mockResolvedValue('factory-value');
      const value = await cache.getOrSet('existing-key', factory);
      
      expect(value).toBe('existing-value');
      expect(factory).not.toHaveBeenCalled();
    });

    it('should set new value using factory', async () => {
      const factory = vi.fn().mockResolvedValue('factory-value');
      const value = await cache.getOrSet('new-key', factory);
      
      expect(value).toBe('factory-value');
      expect(factory).toHaveBeenCalledOnce();
      
      // Should be cached now
      const cachedValue = await cache.get('new-key');
      expect(cachedValue).toBe('factory-value');
    });
  });

  describe('cached operations with input hashing', () => {
    it('should cache based on input hash', async () => {
      const input = { prompt: 'test', context: 'game' };
      
      await cache.setCached(input, 'cached-response');
      const value = await cache.getCached(input);
      
      expect(value).toBe('cached-response');
    });

    it('should return different values for different inputs', async () => {
      const input1 = { prompt: 'test1', context: 'game' };
      const input2 = { prompt: 'test2', context: 'game' };
      
      await cache.setCached(input1, 'response1');
      await cache.setCached(input2, 'response2');
      
      expect(await cache.getCached(input1)).toBe('response1');
      expect(await cache.getCached(input2)).toBe('response2');
    });

    it('should use getOrSetCached with factory', async () => {
      const input = { prompt: 'factory-test', context: 'game' };
      const factory = vi.fn().mockResolvedValue('factory-response');
      
      const value = await cache.getOrSetCached(input, factory);
      
      expect(value).toBe('factory-response');
      expect(factory).toHaveBeenCalledOnce();
      
      // Should be cached now
      const cachedValue = await cache.getCached(input);
      expect(cachedValue).toBe('factory-response');
    });
  });

  describe('compression', () => {
    it('should compress large data', async () => {
      const largeData = 'x'.repeat(200); // Larger than compression threshold
      
      await cache.set('large-key', largeData);
      const value = await cache.get('large-key');
      
      expect(value).toBe(largeData);
    });

    it('should not compress small data', async () => {
      const smallData = 'small';
      
      await cache.set('small-key', smallData);
      const value = await cache.get('small-key');
      
      expect(value).toBe(smallData);
    });
  });

  describe('eviction and limits', () => {
    it('should evict entries when max entries exceeded', async () => {
      const smallCache = new CacheService<string>({
        maxEntries: 3,
        defaultTTL: 60000
      });
      
      try {
        // Add entries up to limit
        await smallCache.set('key1', 'value1');
        await smallCache.set('key2', 'value2');
        await smallCache.set('key3', 'value3');
        
        // All should exist
        expect(await smallCache.get('key1')).toBe('value1');
        expect(await smallCache.get('key2')).toBe('value2');
        expect(await smallCache.get('key3')).toBe('value3');
        
        // Add one more to trigger eviction
        await smallCache.set('key4', 'value4');
        
        // Oldest entry should be evicted
        expect(await smallCache.get('key1')).toBeNull();
        expect(await smallCache.get('key4')).toBe('value4');
      } finally {
        await smallCache.shutdown();
      }
    });
  });

  describe('cleanup', () => {
    it('should cleanup expired entries', async () => {
      await cache.set('expire1', 'value1', 50); // 50ms TTL
      await cache.set('expire2', 'value2', 50); // 50ms TTL
      await cache.set('keep', 'value3', 60000); // 1 minute TTL
      
      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const cleanedCount = cache.cleanup();
      
      expect(cleanedCount).toBe(2);
      expect(await cache.get('expire1')).toBeNull();
      expect(await cache.get('expire2')).toBeNull();
      expect(await cache.get('keep')).toBe('value3');
    });
  });

  describe('statistics', () => {
    it('should track cache statistics', async () => {
      // Generate some hits and misses
      await cache.set('hit-key', 'hit-value');
      
      await cache.get('hit-key'); // Hit
      await cache.get('hit-key'); // Hit
      await cache.get('miss-key'); // Miss
      
      const stats = cache.getStats();
      
      expect(stats.totalEntries).toBe(1);
      expect(stats.totalHits).toBe(2);
      expect(stats.totalMisses).toBe(1);
      expect(stats.hitRate).toBe(2/3);
      expect(stats.missRate).toBe(1/3);
      expect(stats.totalSize).toBeGreaterThan(0);
    });
  });

  describe('persistence', () => {
    it('should persist and load cache', async () => {
      // Add some data
      await cache.set('persist1', 'value1');
      await cache.set('persist2', 'value2');
      
      // Force persistence
      await cache.shutdown();
      
      // Create new cache instance and load
      const newCache = new CacheService<string>({
        persistPath: testCachePath,
        enablePersistence: true
      });
      
      try {
        // Wait a bit for loading to complete
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Data should be loaded
        expect(await newCache.get('persist1')).toBe('value1');
        expect(await newCache.get('persist2')).toBe('value2');
      } finally {
        await newCache.shutdown();
      }
    });
  });
});

describe('LLMCache', () => {
  let llmCache: LLMCache;
  let testCachePath: string;

  beforeEach(() => {
    testCachePath = path.join(process.cwd(), 'temp', 'test-llm-cache.json');
    llmCache = new LLMCache(testCachePath);
  });

  afterEach(async () => {
    await llmCache.shutdown();
    
    try {
      await fs.unlink(testCachePath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  it('should cache LLM responses', async () => {
    const input = {
      prompt: 'What is the weather?',
      context: { story: 'adventure' }
    };
    
    await llmCache.setCached(input, 'It is sunny today.');
    const response = await llmCache.getCached(input);
    
    expect(response).toBe('It is sunny today.');
  });

  it('should have appropriate settings for LLM caching', async () => {
    const stats = llmCache.getStats();
    
    // Should start empty
    expect(stats.totalEntries).toBe(0);
    expect(stats.totalSize).toBe(0);
  });
});

describe('TTSCache', () => {
  let ttsCache: TTSCache;
  let testCachePath: string;

  beforeEach(() => {
    testCachePath = path.join(process.cwd(), 'temp', 'test-tts-cache.json');
    ttsCache = new TTSCache(testCachePath);
  });

  afterEach(async () => {
    await ttsCache.shutdown();
    
    try {
      await fs.unlink(testCachePath);
    } catch (error) {
      // File might not exist, ignore
    }
  });

  it('should cache TTS audio URLs', async () => {
    const input = {
      text: 'Hello world',
      voice: 'alloy',
      speed: 1.0
    };
    
    await ttsCache.setCached(input, '/api/audio/test.mp3');
    const audioUrl = await ttsCache.getCached(input);
    
    expect(audioUrl).toBe('/api/audio/test.mp3');
  });

  it('should have appropriate settings for TTS caching', async () => {
    const stats = ttsCache.getStats();
    
    // Should start empty
    expect(stats.totalEntries).toBe(0);
    expect(stats.totalSize).toBe(0);
  });
});