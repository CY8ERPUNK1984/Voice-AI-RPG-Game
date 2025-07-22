import { WebSpeechTTS } from './WebSpeechTTS';
import { TTSService, TTSOptions, AudioSettings } from '@/types';
import { AudioStreamer, AudioMemoryManager } from '@/utils/audioOptimization';
import { throttle } from '@/utils/debounce';

export class TTSIntegration {
  private ttsService: TTSService;
  private settings: AudioSettings;
  private audioQueue: Array<{ text: string; options?: TTSOptions }> = [];
  private isProcessing = false;
  private audioStreamer: AudioStreamer | null = null;
  private throttledMemoryCleanup: () => void;

  constructor(settings: AudioSettings) {
    this.ttsService = new WebSpeechTTS();
    this.settings = settings;
    this.audioStreamer = new AudioStreamer({
      chunkSize: 8192,
      bufferSize: 4096,
      enableStreaming: true
    });
    
    // Throttled memory cleanup to prevent excessive cleanup calls
    this.throttledMemoryCleanup = throttle(() => {
      this.cleanupMemory();
    }, 30000); // Cleanup every 30 seconds max
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
   * Synthesize speech for AI response with automatic playback
   */
  async synthesizeAIResponse(text: string): Promise<string | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const options: TTSOptions = {
        speed: this.settings.voiceSpeed,
        volume: this.settings.ttsVolume
      };

      // Add to queue for sequential processing
      return await this.addToQueue(text, options);
    } catch (error) {
      console.error('TTS synthesis failed:', error);
      return null;
    }
  }

  /**
   * Add text to TTS queue for sequential processing
   */
  private async addToQueue(text: string, options?: TTSOptions): Promise<string | null> {
    return new Promise((resolve) => {
      this.audioQueue.push({ text, options });
      
      if (!this.isProcessing) {
        this.processQueue().then(() => resolve('queued'));
      } else {
        resolve('queued');
      }
    });
  }

  /**
   * Process TTS queue sequentially
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessing || this.audioQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    while (this.audioQueue.length > 0) {
      const item = this.audioQueue.shift();
      if (!item) continue;

      try {
        await this.ttsService.synthesizeSpeech(item.text, item.options);
      } catch (error) {
        console.error('TTS queue processing error:', error);
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
   * Get available voices for TTS
   */
  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    return await this.ttsService.getAvailableVoices();
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
   * Dispose of resources
   */
  dispose(): void {
    this.stop();
    
    if (this.audioStreamer) {
      this.audioStreamer.dispose();
      this.audioStreamer = null;
    }
    
    AudioMemoryManager.clearCache();
  }
}