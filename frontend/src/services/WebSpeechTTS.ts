import { TTSService, TTSOptions } from '@/types';

interface VoiceProfile {
  voice: SpeechSynthesisVoice;
  quality: number; // 0-1 quality rating
  suitability: number; // 0-1 suitability for current language
  isPreferred: boolean;
}

interface TTSQualityMetrics {
  voiceQuality: number;
  speechRate: number;
  naturalness: number;
  clarity: number;
  overallScore: number;
}

interface TTSCache {
  [key: string]: {
    audioUrl: string;
    timestamp: number;
    options: TTSOptions;
  };
}

export class WebSpeechTTS implements TTSService {
  private synthesis: SpeechSynthesis;
  private currentUtterance: SpeechSynthesisUtterance | null = null;
  private availableVoices: SpeechSynthesisVoice[] = [];
  private voiceProfiles: VoiceProfile[] = [];
  private preferredVoice: SpeechSynthesisVoice | null = null;
  private ttsCache: TTSCache = {};
  private maxCacheSize = 50;
  private cacheExpiryTime = 300000; // 5 minutes
  private defaultOptions: TTSOptions = {
    speed: 1.0,
    pitch: 1.0,
    volume: 1.0
  };

  constructor() {
    this.synthesis = window.speechSynthesis;
    this.initializeVoices();
    this.setupVoiceChangeListener();
  }

  private async initializeVoices(): Promise<void> {
    if (!this.synthesis || !this.synthesis.getVoices) {
      console.warn('Speech synthesis not available for voice initialization');
      return;
    }

    // Wait for voices to be loaded
    try {
      if (this.synthesis.getVoices().length === 0) {
        await new Promise<void>((resolve) => {
          const checkVoices = () => {
            if (this.synthesis && this.synthesis.getVoices && this.synthesis.getVoices().length > 0) {
              resolve();
            } else {
              setTimeout(checkVoices, 100);
            }
          };
          checkVoices();
        });
      }

      this.availableVoices = this.synthesis.getVoices();
      this.analyzeVoices();
      this.selectOptimalVoice();
    } catch (error) {
      console.warn('Failed to initialize voices:', error);
      this.availableVoices = [];
    }
  }

  private setupVoiceChangeListener(): void {
    if (!this.synthesis) return;
    
    this.synthesis.onvoiceschanged = () => {
      if (this.synthesis) {
        this.availableVoices = this.synthesis.getVoices();
        this.analyzeVoices();
        if (!this.preferredVoice) {
          this.selectOptimalVoice();
        }
      }
    };
  }

  private analyzeVoices(): void {
    this.voiceProfiles = this.availableVoices.map(voice => {
      const quality = this.assessVoiceQuality(voice);
      const suitability = this.assessVoiceSuitability(voice);
      const isPreferred = this.isPreferredVoice(voice);

      return {
        voice,
        quality,
        suitability,
        isPreferred
      };
    });

    // Sort by overall score
    this.voiceProfiles.sort((a, b) => {
      const scoreA = (a.quality + a.suitability) * (a.isPreferred ? 1.2 : 1);
      const scoreB = (b.quality + b.suitability) * (b.isPreferred ? 1.2 : 1);
      return scoreB - scoreA;
    });
  }

  private assessVoiceQuality(voice: SpeechSynthesisVoice): number {
    let score = 0.5; // Base score

    // Prefer neural/premium voices
    if (voice.name.toLowerCase().includes('neural') || 
        voice.name.toLowerCase().includes('premium') ||
        voice.name.toLowerCase().includes('enhanced')) {
      score += 0.3;
    }

    // Prefer local voices (usually higher quality)
    if (voice.localService) {
      score += 0.2;
    }

    // Voice name quality indicators
    const qualityIndicators = ['high', 'quality', 'natural', 'clear'];
    if (qualityIndicators.some(indicator => voice.name.toLowerCase().includes(indicator))) {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  private assessVoiceSuitability(voice: SpeechSynthesisVoice): number {
    let score = 0.5; // Base score

    // Language matching
    const currentLang = navigator.language || 'en-US';
    if (voice.lang === currentLang) {
      score += 0.4;
    } else if (voice.lang.startsWith(currentLang.split('-')[0])) {
      score += 0.2;
    }

    // Russian language preference for our app
    if (voice.lang.startsWith('ru')) {
      score += 0.3;
    }

    return Math.min(1, score);
  }

  private isPreferredVoice(voice: SpeechSynthesisVoice): boolean {
    // Common high-quality voice names
    const preferredNames = [
      'Google русский',
      'Microsoft Irina',
      'Microsoft Pavel',
      'Yandex',
      'Alice',
      'Milena',
      'Google US English',
      'Microsoft David',
      'Microsoft Zira'
    ];

    return preferredNames.some(name => 
      voice.name.toLowerCase().includes(name.toLowerCase())
    );
  }

  private selectOptimalVoice(): void {
    if (this.voiceProfiles.length > 0) {
      this.preferredVoice = this.voiceProfiles[0].voice;
      console.log(`Selected optimal TTS voice: ${this.preferredVoice.name} (${this.preferredVoice.lang})`);
    }
  }

  async synthesizeSpeech(text: string, options: TTSOptions = {}): Promise<string> {
    if (!this.isAvailable()) {
      throw new Error('Speech synthesis not available');
    }

    // Merge with default options
    const finalOptions = { ...this.defaultOptions, ...options };

    // Check cache first
    const cacheKey = this.generateCacheKey(text, finalOptions);
    const cachedResult = this.getCachedSynthesis(cacheKey);
    if (cachedResult) {
      console.log('Using cached TTS result');
      return this.playCachedAudio(cachedResult.audioUrl);
    }

    return new Promise((resolve, reject) => {
      try {
        // Stop any current speech
        this.stop();

        // Validate and preprocess text
        const processedText = this.preprocessText(text);
        if (!processedText) {
          reject(new Error('Invalid text input for speech synthesis'));
          return;
        }

        const utterance = new SpeechSynthesisUtterance(processedText);
        this.currentUtterance = utterance;

        // Apply voice selection
        this.applyVoiceSelection(utterance, finalOptions);

        // Apply speech parameters with optimization
        this.applySpeechParameters(utterance, finalOptions);

        // Set up enhanced event handlers
        this.setupUtteranceHandlers(utterance, resolve, reject, cacheKey, finalOptions);

        // Start synthesis with quality monitoring
        this.startSynthesisWithMonitoring(utterance);
      } catch (error) {
        this.currentUtterance = null;
        reject(error);
      }
    });
  }

  private preprocessText(text: string): string | null {
    if (!text || typeof text !== 'string') {
      return null;
    }

    let processed = text.trim();
    
    // Remove excessive whitespace
    processed = processed.replace(/\s+/g, ' ');
    
    // Add pauses for better speech flow (only if SSML is supported)
    // For now, keep it simple for Web Speech API compatibility
    // processed = processed.replace(/[.!?]/g, '$&<break time="300ms"/>');
    // processed = processed.replace(/[,;]/g, '$&<break time="200ms"/>');
    
    // Limit length to prevent timeout
    if (processed.length > 1000) {
      processed = processed.substring(0, 997) + '...';
    }

    return processed.length > 0 ? processed : null;
  }

  private applyVoiceSelection(utterance: SpeechSynthesisUtterance, options: TTSOptions): void {
    let selectedVoice: SpeechSynthesisVoice | null = null;

    // Use specified voice if provided
    if (options.voice) {
      selectedVoice = this.availableVoices.find(voice => voice.name === options.voice) || null;
    }

    // Fall back to preferred voice
    if (!selectedVoice) {
      selectedVoice = this.preferredVoice;
    }

    // Fall back to best available voice
    if (!selectedVoice && this.voiceProfiles.length > 0) {
      selectedVoice = this.voiceProfiles[0].voice;
    }

    if (selectedVoice) {
      utterance.voice = selectedVoice;
      console.log(`Using TTS voice: ${selectedVoice.name}`);
    }
  }

  private applySpeechParameters(utterance: SpeechSynthesisUtterance, options: TTSOptions): void {
    // Apply rate with intelligent adjustment
    let rate = options.speed ?? 1.0;
    
    // Adjust rate based on text length (slower for longer text)
    if (utterance.text.length > 200) {
      rate *= 0.9;
    }
    
    utterance.rate = Math.max(0.1, Math.min(3.0, rate));

    // Apply pitch with voice-specific optimization
    let pitch = options.pitch ?? 1.0;
    
    // Adjust pitch based on voice characteristics
    if (utterance.voice && utterance.voice.name.toLowerCase().includes('male')) {
      pitch *= 0.9; // Slightly lower for male voices
    }
    
    utterance.pitch = Math.max(0, Math.min(2, pitch));

    // Apply volume with normalization
    const volume = options.volume ?? 1.0;
    utterance.volume = Math.max(0, Math.min(1, volume));
  }

  private setupUtteranceHandlers(
    utterance: SpeechSynthesisUtterance,
    resolve: (value: string) => void,
    reject: (reason: Error) => void,
    cacheKey: string,
    options: TTSOptions
  ): void {
    const startTime = Date.now();
    
    // Add timeout to prevent hanging
    const timeout = setTimeout(() => {
      this.currentUtterance = null;
      this.synthesis.cancel();
      reject(new Error('Speech synthesis timeout'));
    }, Math.max(30000, utterance.text.length * 100)); // Dynamic timeout based on text length

    const cleanup = () => {
      clearTimeout(timeout);
      this.currentUtterance = null;
    };

    utterance.onstart = () => {
      console.log('TTS synthesis started');
    };

    utterance.onend = () => {
      cleanup();
      const duration = Date.now() - startTime;
      console.log(`TTS synthesis completed in ${duration}ms`);
      
      // Cache the result (simplified - in real implementation would cache actual audio)
      this.cacheSynthesisResult(cacheKey, 'completed', options);
      
      resolve('Speech synthesis completed');
    };

    utterance.onerror = (event) => {
      cleanup();
      const errorMessage = this.getDetailedTTSError(event.error);
      console.error('TTS synthesis error:', errorMessage);
      reject(new Error(errorMessage));
    };

    utterance.onpause = () => {
      console.log('TTS synthesis paused');
    };

    utterance.onresume = () => {
      console.log('TTS synthesis resumed');
    };
  }

  private startSynthesisWithMonitoring(utterance: SpeechSynthesisUtterance): void {
    // Check if synthesis queue is too long
    if (this.synthesis.pending) {
      console.warn('TTS synthesis queue is busy, clearing...');
      this.synthesis.cancel();
    }

    // Start synthesis
    this.synthesis.speak(utterance);
    
    // Monitor synthesis progress
    this.monitorSynthesisProgress(utterance);
  }

  private monitorSynthesisProgress(utterance: SpeechSynthesisUtterance): void {
    const checkProgress = () => {
      if (this.synthesis.speaking && utterance === this.currentUtterance) {
        // Synthesis is progressing normally
        setTimeout(checkProgress, 1000);
      } else if (!this.synthesis.speaking && utterance === this.currentUtterance) {
        // Synthesis might be stuck
        console.warn('TTS synthesis appears stuck, attempting restart');
        this.synthesis.cancel();
        setTimeout(() => {
          if (utterance === this.currentUtterance) {
            this.synthesis.speak(utterance);
          }
        }, 100);
      }
    };
    
    setTimeout(checkProgress, 2000); // Start monitoring after 2 seconds
  }

  private getDetailedTTSError(error: string): string {
    const errorMessages: Record<string, string> = {
      'canceled': 'Синтез речи был отменен',
      'interrupted': 'Синтез речи был прерван',
      'audio-busy': 'Аудиосистема занята',
      'audio-hardware': 'Проблема с аудиооборудованием',
      'network': 'Ошибка сети при синтезе речи',
      'synthesis-unavailable': 'Сервис синтеза речи недоступен',
      'synthesis-failed': 'Не удалось синтезировать речь',
      'language-unavailable': 'Выбранный язык недоступен',
      'voice-unavailable': 'Выбранный голос недоступен',
      'text-too-long': 'Текст слишком длинный для синтеза',
      'invalid-argument': 'Неверные параметры синтеза'
    };

    return errorMessages[error] || `Ошибка синтеза речи: ${error}`;
  }

  isAvailable(): boolean {
    try {
      // Check if speechSynthesis exists and is not null/undefined
      if (!('speechSynthesis' in window) || !window.speechSynthesis) {
        return false;
      }

      // Additional check to ensure the API is functional
      const synthesis = window.speechSynthesis;
      
      // Verify essential methods exist
      if (typeof synthesis.speak !== 'function' || 
          typeof synthesis.cancel !== 'function' || 
          typeof synthesis.getVoices !== 'function') {
        return false;
      }

      return true;
    } catch (error) {
      // If any error occurs during availability check, consider it unavailable
      console.warn('Speech synthesis availability check failed:', error);
      return false;
    }
  }

  private generateCacheKey(text: string, options: TTSOptions): string {
    const optionsStr = JSON.stringify({
      voice: options.voice || this.preferredVoice?.name,
      speed: options.speed || 1.0,
      pitch: options.pitch || 1.0,
      volume: options.volume || 1.0
    });
    
    // Create hash-like key
    return btoa(text + optionsStr).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  private getCachedSynthesis(cacheKey: string): TTSCache[string] | null {
    const cached = this.ttsCache[cacheKey];
    if (!cached) return null;

    // Check if cache entry is expired
    if (Date.now() - cached.timestamp > this.cacheExpiryTime) {
      delete this.ttsCache[cacheKey];
      return null;
    }

    return cached;
  }

  private cacheSynthesisResult(cacheKey: string, audioUrl: string, options: TTSOptions): void {
    // Clean up old cache entries if needed
    if (Object.keys(this.ttsCache).length >= this.maxCacheSize) {
      this.cleanupCache();
    }

    this.ttsCache[cacheKey] = {
      audioUrl,
      timestamp: Date.now(),
      options
    };
  }

  private cleanupCache(): void {
    const entries = Object.entries(this.ttsCache);
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    // Remove oldest 25% of entries
    const toRemove = Math.floor(entries.length * 0.25);
    for (let i = 0; i < toRemove; i++) {
      delete this.ttsCache[entries[i][0]];
    }
  }

  private async playCachedAudio(audioUrl: string): Promise<string> {
    // For Web Speech API, we can't actually cache audio data
    // This is a placeholder for the caching mechanism
    return Promise.resolve('Cached synthesis completed');
  }

  /**
   * Get available voices with quality ratings
   */
  async getAvailableVoices(): Promise<SpeechSynthesisVoice[]> {
    if (!this.isAvailable()) {
      return [];
    }

    // Ensure voices are loaded
    if (this.availableVoices.length === 0) {
      await this.initializeVoices();
    }

    return this.availableVoices;
  }

  /**
   * Get voice profiles with quality and suitability ratings
   */
  getVoiceProfiles(): VoiceProfile[] {
    return [...this.voiceProfiles];
  }

  /**
   * Set preferred voice by name
   */
  setPreferredVoice(voiceName: string): boolean {
    const voice = this.availableVoices.find(v => v.name === voiceName);
    if (voice) {
      this.preferredVoice = voice;
      console.log(`Preferred TTS voice set to: ${voiceName}`);
      return true;
    }
    return false;
  }

  /**
   * Get current preferred voice
   */
  getPreferredVoice(): SpeechSynthesisVoice | null {
    return this.preferredVoice;
  }

  /**
   * Auto-select best voice for given language
   */
  autoSelectVoiceForLanguage(language: string): SpeechSynthesisVoice | null {
    const languageVoices = this.voiceProfiles.filter(profile => 
      profile.voice.lang.startsWith(language.split('-')[0])
    );

    if (languageVoices.length > 0) {
      const bestVoice = languageVoices[0].voice;
      this.preferredVoice = bestVoice;
      console.log(`Auto-selected voice for ${language}: ${bestVoice.name}`);
      return bestVoice;
    }

    return null;
  }

  /**
   * Assess TTS quality for current configuration
   */
  assessTTSQuality(options: TTSOptions = {}): TTSQualityMetrics {
    const voice = this.preferredVoice;
    if (!voice) {
      return {
        voiceQuality: 0.3,
        speechRate: 0.5,
        naturalness: 0.3,
        clarity: 0.3,
        overallScore: 0.3
      };
    }

    const profile = this.voiceProfiles.find(p => p.voice === voice);
    const voiceQuality = profile ? profile.quality : 0.5;
    
    // Assess speech rate (optimal around 1.0)
    const rate = options.speed || 1.0;
    const speechRate = 1 - Math.abs(rate - 1.0) * 0.5;
    
    // Assess naturalness based on voice characteristics
    const naturalness = voice.localService ? 0.8 : 0.6;
    
    // Assess clarity based on voice name and type
    const clarity = this.assessVoiceClarity(voice);
    
    const overallScore = (voiceQuality + speechRate + naturalness + clarity) / 4;
    
    return {
      voiceQuality,
      speechRate,
      naturalness,
      clarity,
      overallScore
    };
  }

  private assessVoiceClarity(voice: SpeechSynthesisVoice): number {
    let score = 0.5;
    
    const clarityIndicators = ['clear', 'hd', 'enhanced', 'premium', 'neural'];
    if (clarityIndicators.some(indicator => 
      voice.name.toLowerCase().includes(indicator))) {
      score += 0.3;
    }
    
    if (voice.localService) {
      score += 0.2;
    }
    
    return Math.min(1, score);
  }

  /**
   * Get TTS cache statistics
   */
  getCacheStats(): { size: number; maxSize: number; hitRate: number } {
    return {
      size: Object.keys(this.ttsCache).length,
      maxSize: this.maxCacheSize,
      hitRate: 0 // Would need to track hits/misses for real implementation
    };
  }

  /**
   * Clear TTS cache
   */
  clearCache(): void {
    this.ttsCache = {};
    console.log('TTS cache cleared');
  }

  /**
   * Preload common phrases for better performance
   */
  async preloadCommonPhrases(phrases: string[], options: TTSOptions = {}): Promise<void> {
    console.log(`Preloading ${phrases.length} TTS phrases...`);
    
    for (const phrase of phrases) {
      try {
        // Generate cache key without actually synthesizing
        const cacheKey = this.generateCacheKey(phrase, options);
        
        // In a real implementation, you might pre-synthesize and cache the audio
        this.cacheSynthesisResult(cacheKey, 'preloaded', options);
      } catch (error) {
        console.warn(`Failed to preload phrase: ${phrase}`, error);
      }
    }
  }

  stop(): void {
    try {
      if (this.synthesis && this.synthesis.speaking) {
        this.synthesis.cancel();
      }
    } catch (error) {
      console.warn('Error stopping speech synthesis:', error);
    }
    this.currentUtterance = null;
  }

  getCurrentUtterance(): SpeechSynthesisUtterance | null {
    return this.currentUtterance;
  }

  isSpeaking(): boolean {
    try {
      return this.synthesis ? this.synthesis.speaking : false;
    } catch (error) {
      console.warn('Error checking speaking state:', error);
      return false;
    }
  }

  isPaused(): boolean {
    try {
      return this.synthesis ? this.synthesis.paused : false;
    } catch (error) {
      console.warn('Error checking paused state:', error);
      return false;
    }
  }

  pause(): void {
    try {
      if (this.synthesis && this.synthesis.speaking && !this.synthesis.paused) {
        this.synthesis.pause();
      }
    } catch (error) {
      console.warn('Error pausing speech synthesis:', error);
    }
  }

  resume(): void {
    try {
      if (this.synthesis && this.synthesis.paused) {
        this.synthesis.resume();
      }
    } catch (error) {
      console.warn('Error resuming speech synthesis:', error);
    }
  }
}