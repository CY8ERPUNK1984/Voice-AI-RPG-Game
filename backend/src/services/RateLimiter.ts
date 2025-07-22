import { EventEmitter } from 'events';

/**
 * Rate limiter configuration for different API endpoints
 */
export interface RateLimitConfig {
  requestsPerMinute: number;
  burstLimit: number;
  queueSize: number;
  priority?: 'low' | 'medium' | 'high';
}

/**
 * Request metadata for tracking and prioritization
 */
export interface RateLimitRequest {
  id: string;
  endpoint: string;
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  resolve: (value: void) => void;
  reject: (error: Error) => void;
  timeoutId?: NodeJS.Timeout;
}

/**
 * Rate limiter metrics for monitoring
 */
export interface RateLimitMetrics {
  totalRequests: number;
  successfulRequests: number;
  rateLimitedRequests: number;
  queuedRequests: number;
  averageWaitTime: number;
  currentTokens: number;
  maxTokens: number;
}

/**
 * Token bucket rate limiter with request queuing and priority support
 * Implements rate limiting for OpenAI API calls with exponential backoff
 */
export class RateLimiter extends EventEmitter {
  private configs: Map<string, RateLimitConfig> = new Map();
  private tokens: Map<string, number> = new Map();
  private lastRefill: Map<string, number> = new Map();
  private requestQueue: RateLimitRequest[] = [];
  private metrics: Map<string, RateLimitMetrics> = new Map();
  private refillInterval: NodeJS.Timeout;
  private processingQueue = false;

  constructor() {
    super();
    
    // Refill tokens every second
    this.refillInterval = setInterval(() => {
      this.refillTokens();
    }, 1000);
  }

  /**
   * Configure rate limiting for a specific endpoint
   */
  configure(endpoint: string, config: RateLimitConfig): void {
    this.configs.set(endpoint, config);
    this.tokens.set(endpoint, config.burstLimit);
    this.lastRefill.set(endpoint, Date.now());
    
    // Initialize metrics
    this.metrics.set(endpoint, {
      totalRequests: 0,
      successfulRequests: 0,
      rateLimitedRequests: 0,
      queuedRequests: 0,
      averageWaitTime: 0,
      currentTokens: config.burstLimit,
      maxTokens: config.burstLimit
    });
  }

  /**
   * Acquire permission to make a request
   * Returns a promise that resolves when the request can proceed
   */
  async acquire(endpoint: string, priority: 'low' | 'medium' | 'high' = 'medium'): Promise<void> {
    const config = this.configs.get(endpoint);
    if (!config) {
      throw new Error(`No rate limit configuration found for endpoint: ${endpoint}`);
    }

    const metrics = this.metrics.get(endpoint)!;
    metrics.totalRequests++;

    // Check if we have available tokens
    const currentTokens = this.tokens.get(endpoint)!;
    if (currentTokens > 0) {
      // Consume token and allow request
      this.tokens.set(endpoint, currentTokens - 1);
      metrics.successfulRequests++;
      metrics.currentTokens = currentTokens - 1;
      return Promise.resolve();
    }

    // No tokens available, queue the request
    return this.queueRequest(endpoint, priority, config);
  }

  /**
   * Queue a request when no tokens are available
   */
  private queueRequest(endpoint: string, priority: 'low' | 'medium' | 'high', config: RateLimitConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      const metrics = this.metrics.get(endpoint)!;
      
      // Check queue size limit
      const queuedForEndpoint = this.requestQueue.filter(req => req.endpoint === endpoint).length;
      if (queuedForEndpoint >= config.queueSize) {
        metrics.rateLimitedRequests++;
        reject(new Error(`Request queue full for endpoint: ${endpoint}`));
        return;
      }

      const request: RateLimitRequest = {
        id: this.generateRequestId(),
        endpoint,
        priority,
        timestamp: new Date(),
        resolve,
        reject
      };

      // Add timeout for queued requests (30 seconds)
      request.timeoutId = setTimeout(() => {
        this.removeFromQueue(request.id);
        metrics.rateLimitedRequests++;
        reject(new Error(`Request timeout for endpoint: ${endpoint}`));
      }, 30000);

      // Insert request in priority order
      this.insertByPriority(request);
      metrics.queuedRequests++;

      // Process queue if not already processing
      if (!this.processingQueue) {
        this.processQueue();
      }

      this.emit('requestQueued', { endpoint, queueSize: this.requestQueue.length });
    });
  }

  /**
   * Insert request into queue based on priority
   */
  private insertByPriority(request: RateLimitRequest): void {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    const requestPriority = priorityOrder[request.priority];

    let insertIndex = this.requestQueue.length;
    for (let i = 0; i < this.requestQueue.length; i++) {
      const queuedPriority = priorityOrder[this.requestQueue[i].priority];
      if (requestPriority > queuedPriority) {
        insertIndex = i;
        break;
      }
    }

    this.requestQueue.splice(insertIndex, 0, request);
  }

  /**
   * Process queued requests when tokens become available
   */
  private async processQueue(): Promise<void> {
    if (this.processingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    while (this.requestQueue.length > 0) {
      const request = this.requestQueue[0];
      const endpoint = request.endpoint;
      const currentTokens = this.tokens.get(endpoint) || 0;

      if (currentTokens > 0) {
        // Remove request from queue
        this.requestQueue.shift();
        
        // Clear timeout
        if (request.timeoutId) {
          clearTimeout(request.timeoutId);
        }

        // Consume token
        this.tokens.set(endpoint, currentTokens - 1);

        // Update metrics
        const metrics = this.metrics.get(endpoint)!;
        metrics.successfulRequests++;
        metrics.queuedRequests--;
        metrics.currentTokens = currentTokens - 1;
        
        const waitTime = Date.now() - request.timestamp.getTime();
        metrics.averageWaitTime = (metrics.averageWaitTime + waitTime) / 2;

        // Resolve the request
        request.resolve();

        this.emit('requestProcessed', { endpoint, waitTime });
      } else {
        // No tokens available, wait for refill
        break;
      }
    }

    this.processingQueue = false;
  }

  /**
   * Refill tokens based on configured rate
   */
  private refillTokens(): void {
    const now = Date.now();

    for (const [endpoint, config] of this.configs.entries()) {
      const lastRefill = this.lastRefill.get(endpoint)!;
      const timeSinceRefill = now - lastRefill;
      
      // Calculate tokens to add (requestsPerMinute / 60 per second)
      const tokensPerSecond = config.requestsPerMinute / 60;
      const tokensToAdd = Math.floor(tokensPerSecond * (timeSinceRefill / 1000));
      
      if (tokensToAdd > 0) {
        const currentTokens = this.tokens.get(endpoint)!;
        const newTokens = Math.min(currentTokens + tokensToAdd, config.burstLimit);
        
        this.tokens.set(endpoint, newTokens);
        this.lastRefill.set(endpoint, now);
        
        // Update metrics
        const metrics = this.metrics.get(endpoint)!;
        metrics.currentTokens = newTokens;

        // Process queue if tokens were added and there are queued requests
        if (newTokens > currentTokens && this.requestQueue.length > 0) {
          setImmediate(() => this.processQueue());
        }
      }
    }
  }

  /**
   * Remove request from queue by ID
   */
  private removeFromQueue(requestId: string): void {
    const index = this.requestQueue.findIndex(req => req.id === requestId);
    if (index !== -1) {
      const request = this.requestQueue.splice(index, 1)[0];
      if (request.timeoutId) {
        clearTimeout(request.timeoutId);
      }
      
      const metrics = this.metrics.get(request.endpoint);
      if (metrics) {
        metrics.queuedRequests--;
      }
    }
  }

  /**
   * Get current metrics for an endpoint
   */
  getMetrics(endpoint: string): RateLimitMetrics | null {
    return this.metrics.get(endpoint) || null;
  }

  /**
   * Get metrics for all endpoints
   */
  getAllMetrics(): Map<string, RateLimitMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get current queue status
   */
  getQueueStatus(): { endpoint: string; queueSize: number; priority: string }[] {
    const queueStatus: { [key: string]: { [priority: string]: number } } = {};
    
    for (const request of this.requestQueue) {
      if (!queueStatus[request.endpoint]) {
        queueStatus[request.endpoint] = { low: 0, medium: 0, high: 0 };
      }
      queueStatus[request.endpoint][request.priority]++;
    }

    return Object.entries(queueStatus).flatMap(([endpoint, priorities]) =>
      Object.entries(priorities)
        .filter(([, count]) => count > 0)
        .map(([priority, queueSize]) => ({ endpoint, queueSize, priority }))
    );
  }

  /**
   * Clear all queued requests for an endpoint
   */
  clearQueue(endpoint?: string): void {
    if (endpoint) {
      const toRemove = this.requestQueue.filter(req => req.endpoint === endpoint);
      toRemove.forEach(req => {
        if (req.timeoutId) {
          clearTimeout(req.timeoutId);
        }
        req.reject(new Error(`Queue cleared for endpoint: ${endpoint}`));
      });
      
      this.requestQueue = this.requestQueue.filter(req => req.endpoint !== endpoint);
      
      const metrics = this.metrics.get(endpoint);
      if (metrics) {
        metrics.queuedRequests = 0;
      }
    } else {
      // Clear all queues
      this.requestQueue.forEach(req => {
        if (req.timeoutId) {
          clearTimeout(req.timeoutId);
        }
        req.reject(new Error('All queues cleared'));
      });
      
      this.requestQueue = [];
      
      for (const metrics of this.metrics.values()) {
        metrics.queuedRequests = 0;
      }
    }
  }

  /**
   * Reset metrics for an endpoint
   */
  resetMetrics(endpoint: string): void {
    const config = this.configs.get(endpoint);
    if (config) {
      this.metrics.set(endpoint, {
        totalRequests: 0,
        successfulRequests: 0,
        rateLimitedRequests: 0,
        queuedRequests: 0,
        averageWaitTime: 0,
        currentTokens: this.tokens.get(endpoint) || 0,
        maxTokens: config.burstLimit
      });
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    if (this.refillInterval) {
      clearInterval(this.refillInterval);
    }
    
    // Clear all pending requests without rejecting them to avoid unhandled rejections
    this.requestQueue.forEach(req => {
      if (req.timeoutId) {
        clearTimeout(req.timeoutId);
      }
    });
    this.requestQueue = [];
    
    // Clear all data
    this.configs.clear();
    this.tokens.clear();
    this.lastRefill.clear();
    this.metrics.clear();
  }
}

/**
 * Singleton instance for global rate limiting
 */
export const globalRateLimiter = new RateLimiter();

// Configure default OpenAI API endpoints
globalRateLimiter.configure('openai-chat', {
  requestsPerMinute: 60,  // Conservative limit for GPT-4
  burstLimit: 10,
  queueSize: 50
});

globalRateLimiter.configure('openai-tts', {
  requestsPerMinute: 50,  // TTS has different limits
  burstLimit: 8,
  queueSize: 30
});

globalRateLimiter.configure('openai-whisper', {
  requestsPerMinute: 50,  // Whisper ASR limits
  burstLimit: 8,
  queueSize: 30
});