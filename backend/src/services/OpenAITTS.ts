import { TTSService, TTSOptions } from '../types';
import { globalRateLimiter } from './RateLimiter';
import { TTSCache } from './CacheService';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

export class OpenAITTS implements TTSService {
  private apiKey: string;
  private baseURL: string = 'https://api.openai.com/v1';
  private audioDir: string;
  private cache: TTSCache;
  private maxRetries: number = 3;
  private baseRetryDelay: number = 1000;
  private maxRetryDelay: number = 30000;
  private backoffMultiplier: number = 2;
  private requestTimeout: number = 30000;
  private fallbackToTextMode: boolean = true;
  private enableCaching: boolean = true;
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  constructor(apiKey?: string, cachePath?: string) {
    this.apiKey = apiKey !== undefined ? apiKey : (process.env.OPENAI_API_KEY || '');
    
    // Create audio directory if it doesn't exist
    this.audioDir = path.join(process.cwd(), 'temp', 'audio');
    if (!fs.existsSync(this.audioDir)) {
      fs.mkdirSync(this.audioDir, { recursive: true });
    }

    // Initialize cache
    const defaultCachePath = path.join(process.cwd(), 'temp', 'tts-cache.json');
    this.cache = new TTSCache(cachePath || defaultCachePath);
  }

  async synthesizeSpeech(text: string, options: TTSOptions = { voice: 'alloy', speed: 1.0, pitch: 1.0 }): Promise<string> {
    if (!this.isAvailable()) {
      if (this.fallbackToTextMode) {
        console.warn('OpenAI TTS service not available - falling back to text-only mode');
        return this.createTextFallback(text);
      }
      throw new Error('OpenAI TTS service not available - missing API key');
    }

    // Create cache key from text and options
    const cacheKey = this.createCacheKey(text, options);
    
    // Try to get cached audio URL first
    if (this.enableCaching) {
      const cachedUrl = await this.cache.get(cacheKey);
      if (cachedUrl) {
        // Verify the cached audio file still exists
        const audioPath = this.getAudioFilePathFromUrl(cachedUrl);
        if (fs.existsSync(audioPath)) {
          console.log('TTS response served from cache');
          return cachedUrl;
        } else {
          // Remove invalid cache entry
          this.cache.delete(cacheKey);
        }
      }
    }

    let attempts = 0;
    let lastError: any;

    while (attempts < this.maxRetries) {
      try {
        // Acquire rate limit permission
        await globalRateLimiter.acquire('openai-tts', 'medium');
        
        // Call TTS API with timeout
        const audioUrl = await this.callTTSWithTimeout(text, options);
        
        // Cache the audio URL if caching is enabled
        if (this.enableCaching && !audioUrl.startsWith('TEXT_ONLY:')) {
          await this.cache.set(cacheKey, audioUrl);
        }
        
        return audioUrl;
      } catch (error: any) {
        attempts++;
        lastError = error;
        
        const errorType = this.classifyError(error);
        console.error(`OpenAI TTS error (attempt ${attempts}/${this.maxRetries}):`, {
          type: errorType,
          message: error.message,
          status: error.response?.status
        });
        
        // Update health status
        this.updateHealthStatus(errorType);
        
        // If we've reached max retries, handle fallback
        if (attempts >= this.maxRetries) {
          return this.handlePersistentFailure(error, text);
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          return this.handleNonRetryableError(error, text);
        }
        
        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(attempts, errorType);
        console.log(`Retrying TTS in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Fallback if all retries failed
    return this.handlePersistentFailure(lastError, text);
  }

  isAvailable(): boolean {
    return !!this.apiKey;
  }

  /**
   * Map generic voice names to OpenAI voice names
   */
  private mapVoice(voice: string): string {
    const voiceMap: Record<string, string> = {
      'alloy': 'alloy',
      'echo': 'echo',
      'fable': 'fable',
      'onyx': 'onyx',
      'nova': 'nova',
      'shimmer': 'shimmer',
      'default': 'alloy',
      'male': 'onyx',
      'female': 'nova'
    };

    return voiceMap[voice.toLowerCase()] || 'alloy';
  }

  /**
   * Clean up old audio files
   */
  cleanupOldFiles(maxAgeMinutes: number = 60): number {
    const cutoffTime = Date.now() - maxAgeMinutes * 60 * 1000;
    let cleanedCount = 0;

    try {
      const files = fs.readdirSync(this.audioDir);
      
      for (const file of files) {
        const filePath = path.join(this.audioDir, file);
        const stats = fs.statSync(filePath);
        
        if (stats.mtime.getTime() < cutoffTime) {
          fs.unlinkSync(filePath);
          cleanedCount++;
        }
      }
    } catch (error) {
      console.error('Error cleaning up audio files:', error);
    }

    return cleanedCount;
  }

  /**
   * Get audio file path for serving
   */
  getAudioFilePath(audioId: string): string {
    return path.join(this.audioDir, `${audioId}.mp3`);
  }

  /**
   * Call TTS API with timeout handling
   */
  private async callTTSWithTimeout(text: string, options: TTSOptions): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('TTS request timeout'));
      }, this.requestTimeout);

      try {
        const result = await this.callTTSAPI(text, options);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Call OpenAI TTS API
   */
  private async callTTSAPI(text: string, options: TTSOptions): Promise<string> {
    // Validate input
    if (!text || text.trim().length === 0) {
      throw new Error('Text input is empty');
    }

    // Check text length (OpenAI has a 4096 character limit)
    if (text.length > 4096) {
      console.warn(`Text too long (${text.length} chars), truncating to 4096 characters`);
      text = text.substring(0, 4096);
    }

    const response = await axios.post(
      `${this.baseURL}/audio/speech`,
      {
        model: 'tts-1',
        input: text,
        voice: this.mapVoice(options.voice),
        speed: Math.max(0.25, Math.min(4.0, options.speed)) // OpenAI speed range
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'arraybuffer',
        timeout: this.requestTimeout
      }
    );

    // Save audio to temporary file
    const audioId = uuidv4();
    const audioPath = path.join(this.audioDir, `${audioId}.mp3`);
    
    try {
      fs.writeFileSync(audioPath, response.data);
    } catch (error) {
      console.error('Failed to save audio file:', error);
      throw new Error('Failed to save generated audio');
    }

    // Return URL path that can be served by the web server
    return `/api/audio/${audioId}.mp3`;
  }

  /**
   * Classify error type for appropriate handling
   */
  private classifyError(error: any): 'rate_limit' | 'timeout' | 'auth' | 'server' | 'network' | 'file_system' | 'unknown' {
    if (error.message === 'TTS request timeout') {
      return 'timeout';
    }
    
    if (error.message?.includes('save audio file') || error.message?.includes('ENOSPC') || error.message?.includes('EACCES')) {
      return 'file_system';
    }
    
    if (error.response?.status) {
      switch (error.response.status) {
        case 429:
          return 'rate_limit';
        case 401:
        case 403:
          return 'auth';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'server';
        default:
          return 'unknown';
      }
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return 'network';
    }
    
    return 'unknown';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorType = this.classifyError(error);
    
    // Non-retryable errors
    if (errorType === 'auth' || errorType === 'file_system') {
      return false;
    }
    
    // Client errors (4xx) except rate limiting are generally not retryable
    if (error.response?.status && error.response.status >= 400 && error.response.status < 500 && error.response.status !== 429) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, errorType: string): number {
    let baseDelay = this.baseRetryDelay;
    
    // Longer delays for rate limiting
    if (errorType === 'rate_limit') {
      baseDelay = Math.max(baseDelay, 5000); // Minimum 5 seconds for rate limits
    }
    
    // Exponential backoff
    const delay = baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, this.maxRetryDelay);
  }

  /**
   * Handle non-retryable errors
   */
  private async handleNonRetryableError(error: any, text: string): Promise<string> {
    const errorType = this.classifyError(error);
    
    if (errorType === 'auth') {
      console.error('Authentication error with OpenAI TTS API. Check API key.');
      if (this.fallbackToTextMode) {
        return this.createTextFallback(text);
      }
      throw new Error('TTS authentication failed');
    }
    
    if (errorType === 'file_system') {
      console.error('File system error in TTS service:', error.message);
      if (this.fallbackToTextMode) {
        return this.createTextFallback(text);
      }
      throw new Error('TTS file system error');
    }
    
    // For other non-retryable errors, fallback to text mode
    if (this.fallbackToTextMode) {
      return this.createTextFallback(text);
    }
    
    throw error;
  }

  /**
   * Handle persistent failures after all retries
   */
  private async handlePersistentFailure(error: any, text: string): Promise<string> {
    const errorType = this.classifyError(error);
    
    console.error('OpenAI TTS persistent failure:', {
      type: errorType,
      message: error.message,
      status: error.response?.status
    });
    
    // Log for monitoring
    this.logFailure(error, text);
    
    // Update health status
    this.healthStatus = 'unhealthy';
    
    // Fallback to text-only mode
    if (this.fallbackToTextMode) {
      return this.createTextFallback(text);
    }
    
    throw new Error(`TTS service failed after ${this.maxRetries} attempts: ${error.message}`);
  }

  /**
   * Create text fallback when TTS is unavailable
   */
  private createTextFallback(text: string): string {
    console.log('TTS fallback: returning text-only response');
    
    // Return a special indicator that this is text-only
    return `TEXT_ONLY:${text}`;
  }

  /**
   * Update health status based on error type
   */
  private updateHealthStatus(errorType: string): void {
    switch (errorType) {
      case 'rate_limit':
        this.healthStatus = 'degraded';
        break;
      case 'timeout':
      case 'network':
        if (this.healthStatus === 'healthy') {
          this.healthStatus = 'degraded';
        }
        break;
      case 'server':
      case 'auth':
      case 'file_system':
        this.healthStatus = 'unhealthy';
        break;
    }
  }

  /**
   * Log failure for monitoring and debugging
   */
  private logFailure(error: any, text: string): void {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'OpenAI-TTS',
      error: {
        type: this.classifyError(error),
        message: error.message,
        status: error.response?.status,
        code: error.code
      },
      context: {
        textLength: text.length,
        textPreview: text.substring(0, 100) + (text.length > 100 ? '...' : '')
      }
    };
    
    console.error('TTS Service Failure:', JSON.stringify(logData, null, 2));
  }

  /**
   * Configure retry settings
   */
  configureRetries(maxRetries: number, baseRetryDelay: number, maxRetryDelay?: number, backoffMultiplier?: number): void {
    this.maxRetries = maxRetries;
    this.baseRetryDelay = baseRetryDelay;
    if (maxRetryDelay) this.maxRetryDelay = maxRetryDelay;
    if (backoffMultiplier) this.backoffMultiplier = backoffMultiplier;
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): void {
    this.requestTimeout = timeout;
  }

  /**
   * Enable or disable fallback to text-only mode
   */
  setFallbackMode(enabled: boolean): void {
    this.fallbackToTextMode = enabled;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      // Try a simple TTS call to check health
      await globalRateLimiter.acquire('openai-tts', 'low');
      
      const testResponse = await axios.post(
        `${this.baseURL}/audio/speech`,
        {
          model: 'tts-1',
          input: 'test',
          voice: 'alloy',
          speed: 1.0
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer',
          timeout: 5000
        }
      );
      
      // Clean up test audio immediately
      if (testResponse.data) {
        // Don't save test audio, just verify we got a response
      }
      
      this.healthStatus = 'healthy';
      
      return {
        status: 'healthy',
        details: {
          rateLimiter: globalRateLimiter.getMetrics('openai-tts'),
          fallbackMode: this.fallbackToTextMode,
          audioDir: this.audioDir
        }
      };
    } catch (error: any) {
      const errorType = this.classifyError(error);
      this.updateHealthStatus(errorType);
      
      return {
        status: this.healthStatus,
        details: {
          error: error.message,
          type: errorType,
          rateLimiter: globalRateLimiter.getMetrics('openai-tts'),
          fallbackMode: this.fallbackToTextMode
        }
      };
    }
  }

  /**
   * Create cache key from text and options
   */
  private createCacheKey(text: string, options: TTSOptions): string {
    const cacheInput = {
      text: text.trim(),
      voice: this.mapVoice(options.voice),
      speed: Math.max(0.25, Math.min(4.0, options.speed)),
      model: 'tts-1'
    };
    
    return JSON.stringify(cacheInput);
  }

  /**
   * Get audio file path from URL
   */
  private getAudioFilePathFromUrl(url: string): string {
    const filename = path.basename(url);
    return path.join(this.audioDir, filename);
  }

  /**
   * Enable or disable caching
   */
  setCachingEnabled(enabled: boolean): void {
    this.enableCaching = enabled;
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return this.cache.getStats();
  }

  /**
   * Cleanup expired cache entries
   */
  cleanupCache(): number {
    return this.cache.cleanup();
  }

  /**
   * Perform cleanup and recovery operations
   */
  async performMaintenance(): Promise<{ cleaned: number; errors: string[]; cacheStats: any }> {
    const errors: string[] = [];
    let cleaned = 0;
    
    try {
      // Clean up old audio files
      cleaned = this.cleanupOldFiles(60); // Clean files older than 1 hour
      
      // Clean up expired cache entries
      const expiredCacheEntries = this.cleanupCache();
      if (expiredCacheEntries > 0) {
        console.log(`Cleaned up ${expiredCacheEntries} expired TTS cache entries`);
      }
      
      // Verify audio directory is writable
      const testFile = path.join(this.audioDir, 'test-write.tmp');
      try {
        fs.writeFileSync(testFile, 'test');
        fs.unlinkSync(testFile);
      } catch (error) {
        errors.push(`Audio directory not writable: ${error}`);
      }
      
      // Reset health status if no recent errors
      if (errors.length === 0) {
        this.healthStatus = 'healthy';
      }
      
    } catch (error) {
      errors.push(`Maintenance error: ${error}`);
    }
    
    return { 
      cleaned, 
      errors, 
      cacheStats: this.cache.getStats() 
    };
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown(): Promise<void> {
    await this.cache.shutdown();
  }
}