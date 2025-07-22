import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../RateLimiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  afterEach(() => {
    rateLimiter.destroy();
  });

  describe('Configuration', () => {
    it('should configure rate limiting for an endpoint', () => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 10,
        queueSize: 20
      });

      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics).toBeDefined();
      expect(metrics?.maxTokens).toBe(10);
      expect(metrics?.currentTokens).toBe(10);
    });

    it('should throw error for unconfigured endpoint', async () => {
      await expect(rateLimiter.acquire('unknown-endpoint')).rejects.toThrow(
        'No rate limit configuration found for endpoint: unknown-endpoint'
      );
    });
  });

  describe('Token Management', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 3,
        queueSize: 10
      });
    });

    it('should allow requests when tokens are available', async () => {
      await expect(rateLimiter.acquire('test-endpoint')).resolves.toBeUndefined();
      
      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.currentTokens).toBe(2);
      expect(metrics?.successfulRequests).toBe(1);
    });

    it('should consume all available tokens', async () => {
      // Use all 3 tokens
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');

      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.currentTokens).toBe(0);
      expect(metrics?.successfulRequests).toBe(3);
    });

    it('should refill tokens over time', async () => {
      // Use all tokens
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');

      expect(rateLimiter.getMetrics('test-endpoint')?.currentTokens).toBe(0);

      // Wait for 1.1 seconds for token refill (60 requests/minute = 1 per second)
      await new Promise(resolve => setTimeout(resolve, 1100));

      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.currentTokens).toBe(1);
    });
  });

  describe('Request Queuing', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 5
      });
    });

    it('should queue requests when no tokens available', async () => {
      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      // This should be queued
      const queuedPromise = rateLimiter.acquire('test-endpoint');
      
      // Wait a bit for the request to be queued
      await new Promise(resolve => setImmediate(resolve));
      
      const queueStatus = rateLimiter.getQueueStatus();
      expect(queueStatus).toHaveLength(1);
      expect(queueStatus[0].endpoint).toBe('test-endpoint');
      expect(queueStatus[0].queueSize).toBe(1);

      // Wait for token refill (1.1 seconds)
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Queued request should resolve
      await expect(queuedPromise).resolves.toBeUndefined();
    });

    it('should respect queue size limits', async () => {
      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      // Fill the queue (5 requests)
      const queuedPromises = [];
      for (let i = 0; i < 5; i++) {
        queuedPromises.push(rateLimiter.acquire('test-endpoint'));
      }

      // This should be rejected due to queue size limit
      await expect(rateLimiter.acquire('test-endpoint')).rejects.toThrow(
        'Request queue full for endpoint: test-endpoint'
      );
    });

    it('should handle request timeouts', () => {
      // Create a rate limiter with shorter timeout for testing
      const testRateLimiter = new RateLimiter();
      
      // Override the timeout to be shorter for testing
      const originalQueueRequest = testRateLimiter['queueRequest'];
      testRateLimiter['queueRequest'] = function(endpoint: string, priority: 'low' | 'medium' | 'high', config: any) {
        return new Promise((resolve, reject) => {
          const request = {
            id: 'test-req',
            endpoint,
            priority,
            timestamp: new Date(),
            resolve,
            reject,
            timeoutId: setTimeout(() => {
              reject(new Error(`Request timeout for endpoint: ${endpoint}`));
            }, 100) // 100ms timeout for testing
          };
          
          this.requestQueue.push(request);
        });
      };
      
      testRateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 5
      });

      return testRateLimiter.acquire('test-endpoint').then(async () => {
        // Use the only available token, next request should timeout
        await expect(testRateLimiter.acquire('test-endpoint')).rejects.toThrow(
          'Request timeout for endpoint: test-endpoint'
        );
        
        testRateLimiter.destroy();
      });
    });
  });

  describe('Priority Handling', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 10
      });
    });

    it('should prioritize high priority requests', async () => {
      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      const resolveOrder: string[] = [];

      // Queue requests with different priorities
      const lowPromise = rateLimiter.acquire('test-endpoint', 'low').then(() => {
        resolveOrder.push('low');
      });
      
      const highPromise = rateLimiter.acquire('test-endpoint', 'high').then(() => {
        resolveOrder.push('high');
      });
      
      const mediumPromise = rateLimiter.acquire('test-endpoint', 'medium').then(() => {
        resolveOrder.push('medium');
      });

      // Wait for all requests to be queued
      await new Promise(resolve => setImmediate(resolve));

      // Wait for tokens to refill (3.5 seconds should give us 3 tokens)
      await new Promise(resolve => setTimeout(resolve, 3500));

      await Promise.all([lowPromise, highPromise, mediumPromise]);

      // High priority should be processed first
      expect(resolveOrder[0]).toBe('high');
      expect(resolveOrder[1]).toBe('medium');
      expect(resolveOrder[2]).toBe('low');
    });
  });

  describe('Metrics', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 2,
        queueSize: 5
      });
    });

    it('should track successful requests', async () => {
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');

      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.totalRequests).toBe(2);
      expect(metrics?.successfulRequests).toBe(2);
      expect(metrics?.rateLimitedRequests).toBe(0);
    });

    it('should track rate limited requests', async () => {
      // Use all tokens
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('test-endpoint');

      // Fill the queue
      for (let i = 0; i < 5; i++) {
        rateLimiter.acquire('test-endpoint').catch(() => {});
      }

      // This should be rate limited
      try {
        await rateLimiter.acquire('test-endpoint');
      } catch (error) {
        // Expected to fail
      }

      const metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.rateLimitedRequests).toBe(1);
    });

    it('should reset metrics', () => {
      rateLimiter.acquire('test-endpoint');
      
      let metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.totalRequests).toBe(1);

      rateLimiter.resetMetrics('test-endpoint');
      
      metrics = rateLimiter.getMetrics('test-endpoint');
      expect(metrics?.totalRequests).toBe(0);
    });
  });

  describe('Queue Management', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 5
      });
    });

    it('should clear queue for specific endpoint', async () => {
      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      // Queue some requests
      const promises = [
        rateLimiter.acquire('test-endpoint').catch(() => 'cleared'),
        rateLimiter.acquire('test-endpoint').catch(() => 'cleared')
      ];

      rateLimiter.clearQueue('test-endpoint');

      const results = await Promise.all(promises);
      expect(results).toEqual(['cleared', 'cleared']);
    });

    it('should clear all queues', async () => {
      rateLimiter.configure('another-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 5
      });

      // Use tokens
      await rateLimiter.acquire('test-endpoint');
      await rateLimiter.acquire('another-endpoint');

      // Queue requests
      const promises = [
        rateLimiter.acquire('test-endpoint').catch(() => 'cleared'),
        rateLimiter.acquire('another-endpoint').catch(() => 'cleared')
      ];

      rateLimiter.clearQueue();

      const results = await Promise.all(promises);
      expect(results).toEqual(['cleared', 'cleared']);
    });
  });

  describe('Events', () => {
    beforeEach(() => {
      rateLimiter.configure('test-endpoint', {
        requestsPerMinute: 60,
        burstLimit: 1,
        queueSize: 5
      });
    });

    it('should emit requestQueued event', async () => {
      const eventSpy = vi.fn();
      rateLimiter.on('requestQueued', eventSpy);

      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      // This should trigger the event
      rateLimiter.acquire('test-endpoint');

      expect(eventSpy).toHaveBeenCalledWith({
        endpoint: 'test-endpoint',
        queueSize: 1
      });
    });

    it('should emit requestProcessed event', async () => {
      const eventSpy = vi.fn();
      rateLimiter.on('requestProcessed', eventSpy);

      // Use the only available token
      await rateLimiter.acquire('test-endpoint');

      // Queue a request
      const queuedPromise = rateLimiter.acquire('test-endpoint');

      // Wait for token refill and processing
      await new Promise(resolve => setTimeout(resolve, 1100));

      await queuedPromise;

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          endpoint: 'test-endpoint',
          waitTime: expect.any(Number)
        })
      );
    });
  });
});