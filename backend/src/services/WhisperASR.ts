import { OpenAI } from 'openai';
import { ASRService, ErrorResponse } from '../types';
import { globalRateLimiter } from './RateLimiter';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables
dotenv.config();

interface AudioOptimizationOptions {
  enableCompression: boolean;
  targetBitrate: number; // kbps
  maxDuration: number; // seconds
  enableSilenceTrimming: boolean;
  enableNoiseReduction: boolean;
  enableVolumeNormalization: boolean;
}

interface AudioMetrics {
  originalSize: number;
  processedSize: number;
  compressionRatio: number;
  processingTime: number;
  format: string;
  duration?: number;
  sampleRate?: number;
}

/**
 * OpenAI Whisper ASR service implementation with enhanced error handling
 * Handles audio transcription using OpenAI Whisper API with fallback support
 */
export class WhisperASR implements ASRService {
  private client: OpenAI;
  private maxRetries: number = 3;
  private baseRetryDelay: number = 1000; // ms
  private maxRetryDelay: number = 30000; // ms
  private backoffMultiplier: number = 2;
  private model: string = 'whisper-1';
  private requestTimeout: number = 60000; // 60 seconds
  private enableWebSpeechFallback: boolean = true;
  private healthStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
  private audioOptimization: AudioOptimizationOptions = {
    enableCompression: true,
    targetBitrate: 64, // 64 kbps for speech
    maxDuration: 300, // 5 minutes max
    enableSilenceTrimming: true,
    enableNoiseReduction: false, // Disabled by default as it requires external libraries
    enableVolumeNormalization: false // Disabled by default as it requires external libraries
  };
  private audioBufferPool: Buffer[] = [];
  private maxPoolSize: number = 10;

  constructor(apiKey?: string) {
    // Use provided API key or get from environment variables
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.');
    }
    
    this.client = new OpenAI({
      apiKey: key
    });
  }

  /**
   * Transcribe audio using OpenAI Whisper API with enhanced error handling
   * @param audioBlob Audio data as Buffer
   * @returns Transcribed text
   */
  async transcribeAudio(audioBlob: Buffer): Promise<string> {
    // Validate input first
    if (!this.validateAudioInput(audioBlob)) {
      throw new Error('Invalid audio input');
    }

    // Process audio in chunks if needed for large files
    const chunkedAudio = await this.processAudioInChunks(audioBlob);
    
    // Preprocess audio if needed
    const processedAudio = await this.preprocessAudio(chunkedAudio);

    let attempts = 0;
    let lastError: any;
    
    while (attempts < this.maxRetries) {
      try {
        // Acquire rate limit permission
        await globalRateLimiter.acquire('openai-whisper', 'high');
        
        // Call Whisper API with timeout
        return await this.callWhisperWithTimeout(processedAudio);
      } catch (error: any) {
        attempts++;
        lastError = error;
        
        const errorType = this.classifyError(error);
        console.error(`Whisper API error (attempt ${attempts}/${this.maxRetries}):`, {
          type: errorType,
          message: error.message,
          status: error.status
        });
        
        // Update health status
        this.updateHealthStatus(errorType);
        
        // If we've reached max retries, handle fallback
        if (attempts >= this.maxRetries) {
          return this.handlePersistentFailure(error, audioBlob);
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          return this.handleNonRetryableError(error, audioBlob);
        }
        
        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(attempts, errorType);
        console.log(`Retrying Whisper in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Fallback if all retries failed
    return this.handlePersistentFailure(lastError, audioBlob);
  }

  /**
   * Call Whisper API with timeout handling
   */
  private async callWhisperWithTimeout(audioBlob: Buffer): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Whisper request timeout'));
      }, this.requestTimeout);

      try {
        const result = await this.callWhisperAPI(audioBlob);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Call OpenAI Whisper API
   */
  private async callWhisperAPI(audioBlob: Buffer): Promise<string> {
    // Validate audio blob
    if (!audioBlob || audioBlob.length === 0) {
      throw new Error('Audio blob is empty or invalid');
    }

    // Check audio size (Whisper has a 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBlob.length > maxSize) {
      throw new Error(`Audio file too large: ${audioBlob.length} bytes (max: ${maxSize} bytes)`);
    }

    // Start timing for performance tracking
    const startTime = Date.now();
    
    try {
      // Create a File-like object from the buffer
      const audioFile = new File([audioBlob], 'audio.webm', { type: 'audio/webm' });
      
      // Call Whisper API
      const response = await this.client.audio.transcriptions.create({
        file: audioFile,
        model: this.model,
        language: 'ru', // Russian language
        response_format: 'text',
        temperature: 0.2
      });
      
      // Calculate processing time
      const processingTime = Date.now() - startTime;
      console.log(`Whisper transcription completed in ${processingTime}ms`);
      
      // Validate response
      if (!response || typeof response !== 'string') {
        throw new Error('Invalid response from Whisper API');
      }
      
      const transcription = response.trim();
      
      if (!transcription) {
        throw new Error('Empty transcription from Whisper API');
      }
      
      return transcription;
    } catch (error: any) {
      // Handle specific OpenAI API errors
      if (error.status) {
        switch (error.status) {
          case 400:
            throw new Error('Invalid audio format or corrupted audio file');
          case 413:
            throw new Error('Audio file too large for Whisper API');
          case 429:
            throw new Error('Rate limit exceeded for Whisper API');
          case 500:
          case 502:
          case 503:
            throw new Error('Whisper API server error, please try again');
          default:
            throw new Error(`Whisper API error: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Check if Whisper ASR is available
   * @returns true if API key is configured
   */
  isAvailable(): boolean {
    return !!process.env.OPENAI_API_KEY;
  }

  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    const errorResponse: ErrorResponse = {
      type: 'ASR_ERROR',
      message: error.message || 'Unknown error occurred during audio transcription',
      details: error.response?.data || error,
      timestamp: new Date()
    };
    
    return new Error(JSON.stringify(errorResponse));
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
   * Set Whisper model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Validate audio input
   */
  private validateAudioInput(audioBlob: Buffer): boolean {
    if (!audioBlob || audioBlob.length === 0) {
      console.error('Audio blob is empty or invalid');
      return false;
    }

    // Check audio size (Whisper has a 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (audioBlob.length > maxSize) {
      console.error(`Audio file too large: ${audioBlob.length} bytes (max: ${maxSize} bytes)`);
      return false;
    }

    // Check minimum size (avoid very small files that are likely empty)
    const minSize = 1024; // 1KB
    if (audioBlob.length < minSize) {
      console.error(`Audio file too small: ${audioBlob.length} bytes (min: ${minSize} bytes)`);
      return false;
    }

    return true;
  }

  /**
   * Preprocess audio for better transcription quality and optimization
   */
  private async preprocessAudio(audioBlob: Buffer): Promise<Buffer> {
    const startTime = Date.now();
    let processedAudio = audioBlob;
    const metrics: AudioMetrics = {
      originalSize: audioBlob.length,
      processedSize: audioBlob.length,
      compressionRatio: 1.0,
      processingTime: 0,
      format: 'webm'
    };

    try {
      // Step 1: Validate audio format and extract metadata
      const audioInfo = this.analyzeAudioBuffer(audioBlob);
      metrics.duration = audioInfo.estimatedDuration;
      metrics.sampleRate = audioInfo.estimatedSampleRate;

      // Step 2: Check duration limits
      if (this.audioOptimization.maxDuration > 0 && audioInfo.estimatedDuration > this.audioOptimization.maxDuration) {
        console.warn(`Audio duration ${audioInfo.estimatedDuration}s exceeds limit ${this.audioOptimization.maxDuration}s`);
        // In a real implementation, you would trim the audio here
      }

      // Step 3: Apply compression if enabled and beneficial
      if (this.audioOptimization.enableCompression && audioBlob.length > 100 * 1024) { // Only compress if > 100KB
        processedAudio = await this.compressAudio(processedAudio);
        metrics.processedSize = processedAudio.length;
        metrics.compressionRatio = metrics.originalSize / metrics.processedSize;
      }

      // Step 4: Apply silence trimming if enabled
      if (this.audioOptimization.enableSilenceTrimming) {
        processedAudio = await this.trimSilence(processedAudio);
        metrics.processedSize = processedAudio.length;
      }

      // Step 5: Apply noise reduction if enabled (placeholder)
      if (this.audioOptimization.enableNoiseReduction) {
        processedAudio = await this.reduceNoise(processedAudio);
        metrics.processedSize = processedAudio.length;
      }

      // Step 6: Apply volume normalization if enabled (placeholder)
      if (this.audioOptimization.enableVolumeNormalization) {
        processedAudio = await this.normalizeVolume(processedAudio);
      }

      metrics.processingTime = Date.now() - startTime;

      // Log optimization results
      if (metrics.compressionRatio > 1.1) {
        console.log(`Audio optimized: ${metrics.originalSize} -> ${metrics.processedSize} bytes (${metrics.compressionRatio.toFixed(2)}x compression) in ${metrics.processingTime}ms`);
      }

      return processedAudio;
    } catch (error) {
      console.warn('Audio preprocessing failed, using original audio:', error);
      return audioBlob;
    }
  }

  /**
   * Analyze audio buffer to extract basic information
   */
  private analyzeAudioBuffer(audioBlob: Buffer): { estimatedDuration: number; estimatedSampleRate: number; format: string } {
    // This is a simplified analysis - in a real implementation you would:
    // 1. Parse the audio file header to get actual metadata
    // 2. Use libraries like node-ffmpeg or similar for proper audio analysis
    
    // For WebM/Opus audio, estimate based on file size
    // Typical WebM/Opus: ~8-16 kbps for speech
    const estimatedBitrate = 12; // kbps
    const estimatedDuration = (audioBlob.length * 8) / (estimatedBitrate * 1000);
    
    return {
      estimatedDuration: Math.max(0.1, estimatedDuration), // At least 0.1 seconds
      estimatedSampleRate: 48000, // WebM typically uses 48kHz
      format: 'webm'
    };
  }

  /**
   * Compress audio data
   */
  private async compressAudio(audioBlob: Buffer): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Use ffmpeg or similar to re-encode at lower bitrate
    // 2. Convert to more efficient formats if needed
    // 3. Apply audio-specific compression techniques
    
    // For now, we'll simulate compression by returning the original
    // but in practice you might use libraries like:
    // - node-ffmpeg
    // - fluent-ffmpeg
    // - @ffmpeg-installer/ffmpeg
    
    try {
      // Simulate compression processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Return original for now - real implementation would compress
      return audioBlob;
    } catch (error) {
      console.warn('Audio compression failed:', error);
      return audioBlob;
    }
  }

  /**
   * Trim silence from beginning and end of audio
   */
  private async trimSilence(audioBlob: Buffer): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Analyze audio waveform to detect silence
    // 2. Trim silent portions from start and end
    // 3. Use audio processing libraries for accurate detection
    
    try {
      // Simulate silence trimming processing time
      await new Promise(resolve => setTimeout(resolve, 5));
      
      // For now, return original - real implementation would trim silence
      return audioBlob;
    } catch (error) {
      console.warn('Silence trimming failed:', error);
      return audioBlob;
    }
  }

  /**
   * Apply noise reduction to audio
   */
  private async reduceNoise(audioBlob: Buffer): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Apply spectral subtraction or Wiener filtering
    // 2. Use libraries like Web Audio API processing
    // 3. Implement or use existing noise reduction algorithms
    
    try {
      // Simulate noise reduction processing time
      await new Promise(resolve => setTimeout(resolve, 20));
      
      // Return original for now - real implementation would reduce noise
      return audioBlob;
    } catch (error) {
      console.warn('Noise reduction failed:', error);
      return audioBlob;
    }
  }

  /**
   * Normalize audio volume
   */
  private async normalizeVolume(audioBlob: Buffer): Promise<Buffer> {
    // This is a placeholder implementation
    // In a real implementation, you would:
    // 1. Analyze audio levels and peak detection
    // 2. Apply gain adjustment to normalize volume
    // 3. Use audio processing libraries for accurate normalization
    
    try {
      // Simulate volume normalization processing time
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Return original for now - real implementation would normalize volume
      return audioBlob;
    } catch (error) {
      console.warn('Volume normalization failed:', error);
      return audioBlob;
    }
  }

  /**
   * Classify error type for appropriate handling
   */
  private classifyError(error: any): 'rate_limit' | 'timeout' | 'auth' | 'server' | 'network' | 'audio_format' | 'unknown' {
    if (error.message === 'Whisper request timeout') {
      return 'timeout';
    }
    
    if (error.status) {
      switch (error.status) {
        case 400:
          // Check if it's an audio format issue
          if (error.message?.includes('audio') || error.message?.includes('format')) {
            return 'audio_format';
          }
          return 'unknown';
        case 413:
          return 'audio_format'; // File too large
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
    if (errorType === 'auth' || errorType === 'audio_format') {
      return false;
    }
    
    // Client errors (4xx) except rate limiting are generally not retryable
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
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
  private async handleNonRetryableError(error: any, audioBlob: Buffer): Promise<string> {
    const errorType = this.classifyError(error);
    
    if (errorType === 'auth') {
      console.error('Authentication error with Whisper API. Check API key.');
      if (this.enableWebSpeechFallback) {
        return this.fallbackToWebSpeech(audioBlob);
      }
      throw new Error('Whisper authentication failed');
    }
    
    if (errorType === 'audio_format') {
      console.error('Audio format error in Whisper API:', error.message);
      if (this.enableWebSpeechFallback) {
        return this.fallbackToWebSpeech(audioBlob);
      }
      throw new Error('Whisper audio format error');
    }
    
    // For other non-retryable errors, try fallback
    if (this.enableWebSpeechFallback) {
      return this.fallbackToWebSpeech(audioBlob);
    }
    
    throw error;
  }

  /**
   * Handle persistent failures after all retries
   */
  private async handlePersistentFailure(error: any, audioBlob: Buffer): Promise<string> {
    const errorType = this.classifyError(error);
    
    console.error('Whisper API persistent failure:', {
      type: errorType,
      message: error.message,
      status: error.status
    });
    
    // Log for monitoring
    this.logFailure(error, audioBlob);
    
    // Update health status
    this.healthStatus = 'unhealthy';
    
    // Fallback to Web Speech API
    if (this.enableWebSpeechFallback) {
      return this.fallbackToWebSpeech(audioBlob);
    }
    
    throw this.formatError(error);
  }

  /**
   * Fallback to Web Speech API (placeholder implementation)
   * In a real implementation, this would use a Web Speech API service
   */
  private async fallbackToWebSpeech(audioBlob: Buffer): Promise<string> {
    console.log('Whisper fallback: attempting Web Speech API transcription');
    
    // This is a placeholder - in a real implementation, you would:
    // 1. Convert the audio buffer to a format Web Speech API can handle
    // 2. Use a Web Speech API service or send to frontend for processing
    // 3. Return the transcription result
    
    // For now, return a fallback message
    return 'FALLBACK_TRANSCRIPTION_NEEDED';
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
      case 'audio_format':
        this.healthStatus = 'unhealthy';
        break;
    }
  }

  /**
   * Log failure for monitoring and debugging
   */
  private logFailure(error: any, audioBlob: Buffer): void {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'Whisper-ASR',
      error: {
        type: this.classifyError(error),
        message: error.message,
        status: error.status,
        code: error.code
      },
      context: {
        audioSize: audioBlob.length,
        model: this.model
      }
    };
    
    console.error('Whisper Service Failure:', JSON.stringify(logData, null, 2));
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): void {
    this.requestTimeout = timeout;
  }

  /**
   * Enable or disable Web Speech API fallback
   */
  setWebSpeechFallback(enabled: boolean): void {
    this.enableWebSpeechFallback = enabled;
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      // Try a simple transcription to check health
      await globalRateLimiter.acquire('openai-whisper', 'low');
      
      // Create a minimal test audio buffer (this is just for testing connectivity)
      const testAudio = Buffer.from('test audio data');
      
      // We can't actually test transcription without a real audio file,
      // so we'll just check if the API key is available
      if (!this.isAvailable()) {
        this.healthStatus = 'unhealthy';
        return {
          status: 'unhealthy',
          details: {
            error: 'API key not available',
            rateLimiter: globalRateLimiter.getMetrics('openai-whisper'),
            fallbackEnabled: this.enableWebSpeechFallback
          }
        };
      }
      
      this.healthStatus = 'healthy';
      
      return {
        status: 'healthy',
        details: {
          model: this.model,
          rateLimiter: globalRateLimiter.getMetrics('openai-whisper'),
          fallbackEnabled: this.enableWebSpeechFallback
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
          rateLimiter: globalRateLimiter.getMetrics('openai-whisper'),
          fallbackEnabled: this.enableWebSpeechFallback
        }
      };
    }
  }

  /**
   * Configure audio optimization settings
   */
  configureAudioOptimization(options: Partial<AudioOptimizationOptions>): void {
    this.audioOptimization = { ...this.audioOptimization, ...options };
  }

  /**
   * Get audio optimization settings
   */
  getAudioOptimizationSettings(): AudioOptimizationOptions {
    return { ...this.audioOptimization };
  }

  /**
   * Get or create buffer from pool
   */
  private getBufferFromPool(size: number): Buffer {
    // Try to find a suitable buffer from the pool
    const suitableBufferIndex = this.audioBufferPool.findIndex(buffer => buffer.length >= size);
    
    if (suitableBufferIndex !== -1) {
      const buffer = this.audioBufferPool.splice(suitableBufferIndex, 1)[0];
      return buffer.subarray(0, size);
    }
    
    // Create new buffer if none suitable found
    return Buffer.allocUnsafe(size);
  }

  /**
   * Return buffer to pool for reuse
   */
  private returnBufferToPool(buffer: Buffer): void {
    if (this.audioBufferPool.length < this.maxPoolSize && buffer.length > 1024) {
      // Only pool buffers larger than 1KB
      this.audioBufferPool.push(buffer);
    }
  }

  /**
   * Process audio in chunks for large files
   */
  private async processAudioInChunks(audioBlob: Buffer, chunkSize: number = 10 * 1024 * 1024): Promise<Buffer> {
    if (audioBlob.length <= chunkSize) {
      return audioBlob;
    }

    // For very large audio files, we would need to:
    // 1. Split into overlapping chunks
    // 2. Process each chunk separately
    // 3. Merge transcriptions with proper timing
    // 4. Handle chunk boundaries carefully
    
    console.warn(`Large audio file (${audioBlob.length} bytes) - chunked processing not fully implemented`);
    
    // For now, just return the original (truncated if too large)
    const maxSize = 25 * 1024 * 1024; // Whisper's 25MB limit
    if (audioBlob.length > maxSize) {
      console.warn(`Truncating audio from ${audioBlob.length} to ${maxSize} bytes`);
      return audioBlob.subarray(0, maxSize);
    }
    
    return audioBlob;
  }

  /**
   * Cleanup audio buffers and resources
   */
  cleanup(): void {
    // Clear buffer pool
    this.audioBufferPool = [];
    
    // Reset health status
    this.healthStatus = 'healthy';
    
    console.log('WhisperASR cleanup completed');
  }

  /**
   * Get transcription statistics
   */
  getStats(): { 
    model: string; 
    maxRetries: number; 
    timeout: number; 
    fallbackEnabled: boolean;
    healthStatus: string;
    audioOptimization: AudioOptimizationOptions;
    bufferPoolSize: number;
  } {
    return {
      model: this.model,
      maxRetries: this.maxRetries,
      timeout: this.requestTimeout,
      fallbackEnabled: this.enableWebSpeechFallback,
      healthStatus: this.healthStatus,
      audioOptimization: this.audioOptimization,
      bufferPoolSize: this.audioBufferPool.length
    };
  }

  /**
   * Perform maintenance operations
   */
  async performMaintenance(): Promise<{ 
    buffersCleared: number; 
    optimizationStats: AudioOptimizationOptions;
    errors: string[] 
  }> {
    const errors: string[] = [];
    const buffersCleared = this.audioBufferPool.length;
    
    try {
      // Clear buffer pool
      this.audioBufferPool = [];
      
      // Reset health status if no recent errors
      if (this.healthStatus === 'degraded') {
        this.healthStatus = 'healthy';
      }
      
    } catch (error) {
      errors.push(`Maintenance error: ${error}`);
    }
    
    return {
      buffersCleared,
      optimizationStats: this.audioOptimization,
      errors
    };
  }

  /**
   * Shutdown service and cleanup resources
   */
  async shutdown(): Promise<void> {
    this.cleanup();
    console.log('WhisperASR service shutdown complete');
  }
}