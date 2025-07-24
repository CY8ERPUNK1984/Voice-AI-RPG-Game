import { WebSpeechTTS } from './WebSpeechTTS';
import { TTSService, TTSOptions, AudioSettings } from '@/types';
import { AudioStreamer, AudioMemoryManager, analyzeAudioQuality, generateQualityFeedback } from '@/utils/audioOptimization';
import { throttle } from '@/utils/debounce';

interface TTSQueueItem {
  text: string;
  options?: TTSOptions;
  priority: 'low' | 'normal' | 'high';
  timestamp: number;
  retryCount: number;
}

interface TTSPerformanceMetrics {
  averageResponseTime: number;
  successRate: number;
  errorCount: number;
  totalRequests: number;
  cacheHitRate: number;
}

export class TTSIntegration {
  private ttsService: WebSpeechTTS;
  private settings: AudioSettings;
  private audioQueue: TTSQueueItem[] = [];
  private isProcessing = false;
  private audioStreamer: AudioStreamer | null = null;
  private throttledMemoryCleanup: () => void;
  private performanceMetrics: TTSPerformanceMetrics;
  private maxRetries = 2;
  private fallbackEnabled = true;

  constructor(settings: AudioSettings) {
    this.ttsService = new WebSpeechTTS();
    this.settings = settings;
    this.audioStreamer = new AudioStreamer({
      chunkSize: 8192,
      bufferSize: 4096,
      enableStreaming: true
    });
    
    this.performanceMetrics = {
      averageResponseTime: 0,
      successRate: 1.0,
      errorCount: 0,
      totalRequests: 0,
      cacheHitRate: 0
    };
    
    // Throttled memory cleanup to prevent excessive cleanup calls
    this.throttledMemoryCleanup = throttle(() => {
      this.cleanupMemory();
    }, 30000); // Cleanup every 30 seconds max
    
    this.initializeTTSService();
  }

  private async initializeTTSService(): Promise<void> {
    try {
      // Auto-select optimal voice for Russian
      this.ttsService.autoSelectVoiceForLanguage('ru-RU');
      
      // Preload common game phrases
      const commonPhrases = [
        'Добро пожаловать в игру!',
        'Ваш ход.',
        'Подождите, я думаю...',
        'Отличный выбор!',
        'Попробуйте еще раз.',
        'Игра окончена.'
      ];
      
      await this.ttsService.preloadCommonPhrases(commonPhrases, {
        speed: this.settings.voiceSpeed,
        volume: this.settings.ttsVolume
      });
      
      console.log('TTS service initialized successfully');
    } catch (error) {
      console.warn('TTS service initialization failed:', error);
    }
  }

  /**
   * Update TTS settings
   */
  updateSettings(settings: AudioSettings): void {
    this.settings = settings;
  }

  /**
   * Check if TTS is available and enabled
   */
  isAvailable(): boolean {
    return this.settings.ttsEnabled && this.ttsService.isAvailable();
  }

  /**
   * Synthesize speech for AI response with quality assessment and fallback
   */
  async synthesizeAIResponse(text: string, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string | null> {
    if (!this.isAvailable()) {
      if (this.fallbackEnabled) {
        return this.handleTTSFallback(text);
      }
      return null;
    }

    try {
      // Assess TTS quality before synthesis
      const qualityMetrics = this.ttsService.assessTTSQuality({
        speed: this.settings.voiceSpeed,
        volume: this.settings.ttsVolume
      });

      console.log('TTS quality assessment:', qualityMetrics);

      // Adjust options based on quality assessment
      const options: TTSOptions = {
        speed: this.optimizeSpeed(this.settings.voiceSpeed, qualityMetrics),
        volume: this.settings.ttsVolume,
        pitch: this.optimizePitch(qualityMetrics)
      };

      // Add to queue for sequential processing
      return await this.addToQueue(text, options, priority);
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      this.updatePerformanceMetrics(false, 0);
      
      if (this.fallbackEnabled) {
        return this.handleTTSFallback(text);
      }
      return null;
    }
  }

  private optimizeSpeed(baseSpeed: number, qualityMetrics: any): number {
    // Adjust speed based on voice quality
    let optimizedSpeed = baseSpeed;
    
    if (qualityMetrics.voiceQuality < 0.5) {
      // Slower speed for lower quality voices
      optimizedSpeed *= 0.9;
    }
    
    if (qualityMetrics.naturalness < 0.5) {
      // Slightly slower for less natural voices
      optimizedSpeed *= 0.95;
    }
    
    return Math.max(0.5, Math.min(2.0, optimizedSpeed));
  }

  private optimizePitch(qualityMetrics: any): number {
    // Optimize pitch based on voice characteristics
    let pitch = 1.0;
    
    if (qualityMetrics.voiceQuality > 0.8) {
      // High quality voices can handle slight pitch variations
      pitch = 1.05;
    }
    
    return Math.max(0.5, Math.min(1.5, pitch));
  }

  private async handleTTSFallback(text: string): Promise<string | null> {
    console.log('TTS fallback: returning text for display only');
    
    // In a real implementation, this might:
    // 1. Try alternative TTS service
    // 2. Use pre-recorded audio
    // 3. Return text for visual display only
    
    return `[TTS недоступен] ${text}`;
  }

  private updatePerformanceMetrics(success: boolean, responseTime: number): void {
    this.performanceMetrics.totalRequests++;
    
    if (success) {
      // Update average response time with exponential moving average
      this.performanceMetrics.averageResponseTime = 
        this.performanceMetrics.averageResponseTime * 0.8 + responseTime * 0.2;
      
      // Update success rate
      this.performanceMetrics.successRate = 
        this.performanceMetrics.successRate * 0.9 + 0.1;
    } else {
      this.performanceMetrics.errorCount++;
      this.performanceMetrics.successRate = 
        this.performanceMetrics.successRate * 0.9;
    }
  }

  /**
   * Add text to TTS queue for sequential processing with priority
   */
  private async addToQueue(text: string, options?: TTSOptions, priority: 'low' | 'normal' | 'high' = 'normal'): Promise<string | null> {
    return new Promise((resolve) => {
      const queueItem: TTSQueueItem = {
        text,
        options,
        priority,
        timestamp: Date.now(),
        retryCount: 0
      };

      // Insert based on priority
      if (priority === 'high') {
        this.audioQueue.unshift(queueItem);
      } else if (priority === 'low') {
        this.audioQueue.push(queueItem);
      } else {
        // Insert normal priority items before low priority ones
        const lowPriorityIndex = this.audioQueue.findIndex(item => item.priority === 'low');
        if (lowPriorityIndex !== -1) {
          this.audioQueue.splice(lowPriorityIndex, 0, queueItem);
        } else {
          this.audioQueue.push(queueItem);
        }
      }
      
      if (!this.isProcessing) {
        this.processQueue().then(() => resolve('queued'));
      } else {
        resolve('queued');
      }
    });
  }

  /**
   * Process TTS queue sequentially with retry logic
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.audioQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift();
      if (!item) continue;

      const startTime = Date.now();
      let success = false;

      try {
        await this.ttsService.synthesizeSpeech(item.text, item.options);
        success = true;
        
        const responseTime = Date.now() - startTime;
        this.updatePerformanceMetrics(true, responseTime);
        
        console.log(`TTS synthesis completed in ${responseTime}ms`);
      } catch (error) {
        console.error('TTS queue processing error:', error);
        
        // Retry logic
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          console.log(`Retrying TTS synthesis (attempt ${item.retryCount}/${this.maxRetries})`);
          
          // Add back to queue with delay
          setTimeout(() => {
            this.audioQueue.unshift(item);
          }, 1000 * item.retryCount); // Exponential backoff
        } else {
          console.error(`TTS synthesis failed after ${this.maxRetries} retries`);
          this.updatePerformanceMetrics(false, Date.now() - startTime);
          
          // Try fallback if available
          if (this.fallbackEnabled) {
            await this.handleTTSFallback(item.text);
          }
        }
      }
      
      // Trigger memory cleanup periodically
      if (success) {
        this.throttledMemoryCleanup();
      }
    }

    this.isProcessing = false;
  }

  /**
   * Stop current TTS playback and clear queue
   */
  stop(): void {
    this.ttsService.stop();
    this.audioQueue = [];
    this.isProcessing = false;
    
    if (this.audioStreamer) {
      this.audioStreamer.stop();
    }
    
    // Trigger memory cleanup
    this.throttledMemoryCleanup();
  }

  /**
   * Pause current TTS playback
   */
  pause(): void {
    if (this.ttsService instanceof WebSpeechTTS) {
      this.ttsService.pause();
    }
  }

  /**
   * Resume paused TTS playback
   */
  resume(): void {
    if (this.ttsService instanceof WebSpeechTTS) {
      this.ttsService.resume();
    }
  }

  /**
   * Check if TTS is currently speaking
   */
  isSpeaking(): boolean {
    if (this.ttsService instanceof WebSpeechTTS) {
      return this.ttsService.isSpeaking();
    }
    return false;
  }

  /**
   * Create audio URL from text (for Message component)
   * This creates a data URL that can be used by AudioPlayer
   */
  async createAudioUrl(text: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      // For Web Speech API, we can't get actual audio data
      // Instead, we'll create a special URL that indicates TTS should be used
      return `tts:${encodeURIComponent(text)}`;
    } catch (error) {
      console.error('Failed to create audio URL:', error);
      return null;
    }
  }

  /**
   * Play TTS from a special TTS URL
   */
  async playFromUrl(url: string): Promise<void> {
    if (!url.startsWith('tts:')) {
      throw new Error('Invalid TTS URL');
    }

    const text = decodeURIComponent(url.substring(4));
    await this.synthesizeAIResponse(text);
  }

  /**
   * Memory cleanup for audio buffers
   */
  private cleanupMemory(): void {
    const memoryUsage = AudioMemoryManager.getMemoryUsage();
    console.log(`TTS Memory usage: ${memoryUsage.bufferCount} buffers, ~${memoryUsage.estimatedSizeKB}KB`);
    
    // Clear cache if memory usage is high
    if (memoryUsage.estimatedSizeKB > 5000) { // 5MB threshold
      AudioMemoryManager.clearCache();
      console.log('TTS audio cache cleared due to high memory usage');
    }
  }

  /**
   * Get available voices with quality ratings
   */
  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return await this.ttsService.getAvailableVoices();
  }

  /**
   * Get voice profiles with detailed information
   */
  getVoiceProfiles(): any[] {
    return this.ttsService.getVoiceProfiles();
  }

  /**
   * Set preferred voice
   */
  setPreferredVoice(voiceName: string): boolean {
    return this.ttsService.setPreferredVoice(voiceName);
  }

  /**
   * Get current preferred voice
   */
  getPreferredVoice(): SpeechSynthesisVoice | null {
    return this.ttsService.getPreferredVoice();
  }

  /**
   * Auto-select best voice for language
   */
  autoSelectVoiceForLanguage(language: string): SpeechSynthesisVoice | null {
    return this.ttsService.autoSelectVoiceForLanguage(language);
  }

  /**
   * Get TTS performance metrics
   */
  getPerformanceMetrics(): TTSPerformanceMetrics {
    return { ...this.performanceMetrics };
  }

  /**
   * Get TTS cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return this.ttsService.getCacheStats();
  }

  /**
   * Clear TTS cache
   */
  clearCache(): void {
    this.ttsService.clearCache();
  }

  /**
   * Enable or disable fallback mode
   */
  setFallbackEnabled(enabled: boolean): void {
    this.fallbackEnabled = enabled;
    console.log(`TTS fallback ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Set maximum retry attempts
   */
  setMaxRetries(maxRetries: number): void {
    this.maxRetries = Math.max(0, Math.min(5, maxRetries));
    console.log(`TTS max retries set to: ${this.maxRetries}`);
  }

  /**
   * Get queue status
   */
  getQueueStatus(): { 
    length: number; 
    isProcessing: boolean; 
    highPriority: number; 
    normalPriority: number; 
    lowPriority: number; 
  } {
    const highPriority = this.audioQueue.filter(item => item.priority === 'high').length;
    const normalPriority = this.audioQueue.filter(item => item.priority === 'normal').length;
    const lowPriority = this.audioQueue.filter(item => item.priority === 'low').length;

    return {
      length: this.audioQueue.length,
      isProcessing: this.isProcessing,
      highPriority,
      normalPriority,
      lowPriority
    };
  }

  /**
   * Clear queue
   */
  clearQueue(): void {
    this.audioQueue = [];
    console.log('TTS queue cleared');
  }

  /**
   * Test TTS with sample text
   */
  async testTTS(sampleText: string = 'Тест синтеза речи'): Promise<boolean> {
    try {
      const startTime = Date.now();
      await this.ttsService.synthesizeSpeech(sampleText, {
        speed: this.settings.voiceSpeed,
        volume: this.settings.ttsVolume * 0.5 // Lower volume for test
      });
      
      const responseTime = Date.now() - startTime;
      console.log(`TTS test completed successfully in ${responseTime}ms`);
      return true;
    } catch (error) {
      console.error('TTS test failed:', error);
      return false;
    }
  }

  /**
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    this.clearQueue();
    
    if (this.audioStreamer) {
      this.audioStreamer.dispose();
      this.audioStreamer = null;
    }
    
    this.ttsService.clearCache();
    AudioMemoryManager.clearCache();
    
    console.log('TTS Integration disposed');
  }
}