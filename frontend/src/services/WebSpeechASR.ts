import type { ASRService } from '@/types';

// Web Speech API type declarations
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onstart: ((event: Event) => void) | null;
  onend: ((event: Event) => void) | null;
  onnomatch: ((event: Event) => void) | null;
  onspeechstart: ((event: Event) => void) | null;
  onspeechend: ((event: Event) => void) | null;
  onaudiostart: ((event: Event) => void) | null;
  onaudioend: ((event: Event) => void) | null;
  onsoundstart: ((event: Event) => void) | null;
  onsoundend: ((event: Event) => void) | null;
}

interface BrowserCompatibility {
  isSupported: boolean;
  browserName: string;
  version: string;
  warnings: string[];
  recommendations: string[];
}

interface ContinuousRecognitionOptions {
  maxDuration: number; // Maximum duration in milliseconds
  restartOnEnd: boolean;
  interimResults: boolean;
  language: string;
}

interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

declare global {
  interface Window {
    SpeechRecognition: {
      new (): SpeechRecognition;
    };
    webkitSpeechRecognition: {
      new (): SpeechRecognition;
    };
  }
}

export class WebSpeechASR implements ASRService {
  private recognition: SpeechRecognition | null = null;
  private isRecording = false;
  private isContinuousMode = false;
  private continuousOptions: ContinuousRecognitionOptions | null = null;
  private continuousStartTime = 0;
  private restartTimeout: NodeJS.Timeout | null = null;
  private resolveRecording: ((result: string) => void) | null = null;
  private rejectRecording: ((error: Error) => void) | null = null;
  private browserCompatibility: BrowserCompatibility | null = null;
  private supportedLanguages: string[] = [];
  private currentLanguage = 'ru-RU';
  private errorCount = 0;
  private maxErrors = 3;

  public onResult?: (result: string) => void;
  public onError?: (error: Error) => void;
  public onInterimResult?: (result: string) => void;
  public onContinuousEnd?: () => void;

  constructor() {
    this.checkBrowserCompatibility();
    this.detectSupportedLanguages();
    this.initializeRecognition();
  }

  private checkBrowserCompatibility(): void {
    const userAgent = navigator.userAgent;
    let browserName = 'Unknown';
    let version = 'Unknown';
    const warnings: string[] = [];
    const recommendations: string[] = [];

    // Detect browser
    if (userAgent.includes('Chrome')) {
      browserName = 'Chrome';
      const match = userAgent.match(/Chrome\/(\d+)/);
      version = match ? match[1] : 'Unknown';
      
      if (parseInt(version) < 25) {
        warnings.push('Chrome version is too old for optimal speech recognition');
        recommendations.push('Update to Chrome 25 or later');
      }
    } else if (userAgent.includes('Firefox')) {
      browserName = 'Firefox';
      warnings.push('Firefox has limited Web Speech API support');
      recommendations.push('Consider using Chrome or Edge for better speech recognition');
    } else if (userAgent.includes('Safari')) {
      browserName = 'Safari';
      warnings.push('Safari has limited Web Speech API support');
      recommendations.push('Consider using Chrome or Edge for better speech recognition');
    } else if (userAgent.includes('Edge')) {
      browserName = 'Edge';
      const match = userAgent.match(/Edge\/(\d+)/);
      version = match ? match[1] : 'Unknown';
    }

    // Check HTTPS requirement
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      warnings.push('Web Speech API requires HTTPS in production');
      recommendations.push('Use HTTPS for speech recognition to work properly');
    }

    // Check microphone permissions
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      warnings.push('Microphone access not available');
      recommendations.push('Enable microphone permissions for speech recognition');
    }

    this.browserCompatibility = {
      isSupported: this.isAvailable(),
      browserName,
      version,
      warnings,
      recommendations
    };

    if (warnings.length > 0) {
      console.warn('WebSpeechASR compatibility warnings:', warnings);
    }
  }

  private detectSupportedLanguages(): void {
    // Common languages supported by most browsers
    this.supportedLanguages = [
      'ru-RU', 'en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 
      'it-IT', 'pt-BR', 'zh-CN', 'ja-JP', 'ko-KR'
    ];
  }

  private initializeRecognition(): void {
    if (!this.isAvailable()) {
      console.warn('Web Speech API not available');
      return;
    }

    try {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = this.currentLanguage;
      this.recognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy

      this.setupEventHandlers();
      console.log('WebSpeechASR initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Web Speech API:', error);
      this.recognition = null;
    }
  }

  private setupEventHandlers(): void {
    if (!this.recognition) return;

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      try {
        let finalTranscript = '';
        let interimTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const result = event.results[i];
          const transcript = result[0].transcript;

          if (result.isFinal) {
            finalTranscript += transcript;
          } else {
            interimTranscript += transcript;
          }
        }

        // Handle interim results
        if (interimTranscript && this.onInterimResult) {
          this.onInterimResult(interimTranscript);
        }

        // Handle final results
        if (finalTranscript) {
          this.errorCount = 0; // Reset error count on successful recognition
          
          if (this.onResult) {
            this.onResult(finalTranscript);
          }
          
          if (this.resolveRecording && !this.isContinuousMode) {
            this.resolveRecording(finalTranscript);
            this.resolveRecording = null;
            this.rejectRecording = null;
          }
        }
      } catch (error) {
        console.error('Error processing speech recognition result:', error);
        this.handleError(new Error('Failed to process recognition result'));
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = this.getDetailedErrorMessage(event.error, event.message);
      const error = new Error(errorMessage);
      
      this.errorCount++;
      console.error(`Speech recognition error (${this.errorCount}/${this.maxErrors}):`, errorMessage);
      
      this.handleError(error);
    };

    this.recognition.onstart = () => {
      this.isRecording = true;
      console.log('Speech recognition started');
    };

    this.recognition.onend = () => {
      this.isRecording = false;
      console.log('Speech recognition ended');
      
      // Handle continuous recognition restart
      if (this.isContinuousMode && this.continuousOptions) {
        const elapsed = Date.now() - this.continuousStartTime;
        
        if (elapsed < this.continuousOptions.maxDuration && this.continuousOptions.restartOnEnd) {
          // Restart recognition after a short delay
          this.restartTimeout = setTimeout(() => {
            if (this.isContinuousMode) {
              this.startContinuousRecognition();
            }
          }, 100);
        } else {
          this.stopContinuousRecognition();
        }
      }
    };

    // Additional event handlers for better monitoring
    this.recognition.onnomatch = () => {
      console.warn('Speech recognition: no match found');
    };

    this.recognition.onspeechstart = () => {
      console.log('Speech detected');
    };

    this.recognition.onspeechend = () => {
      console.log('Speech ended');
    };

    this.recognition.onaudiostart = () => {
      console.log('Audio capture started');
    };

    this.recognition.onaudioend = () => {
      console.log('Audio capture ended');
    };
  }

  private getDetailedErrorMessage(error: string, message?: string): string {
    const errorMessages: Record<string, string> = {
      'no-speech': 'Речь не обнаружена. Попробуйте говорить громче или ближе к микрофону.',
      'aborted': 'Распознавание речи было прервано.',
      'audio-capture': 'Не удалось получить доступ к микрофону. Проверьте разрешения.',
      'network': 'Ошибка сети. Проверьте подключение к интернету.',
      'not-allowed': 'Доступ к микрофону запрещен. Разрешите использование микрофона.',
      'service-not-allowed': 'Сервис распознавания речи недоступен.',
      'bad-grammar': 'Ошибка в грамматике распознавания.',
      'language-not-supported': `Язык ${this.currentLanguage} не поддерживается.`
    };

    const detailedMessage = errorMessages[error] || `Неизвестная ошибка: ${error}`;
    return message ? `${detailedMessage} (${message})` : detailedMessage;
  }

  private handleError(error: Error): void {
    if (this.onError) {
      this.onError(error);
    }
    
    if (this.rejectRecording && !this.isContinuousMode) {
      this.rejectRecording(error);
      this.resolveRecording = null;
      this.rejectRecording = null;
    }

    // Stop continuous recognition if too many errors
    if (this.isContinuousMode && this.errorCount >= this.maxErrors) {
      console.error('Too many errors in continuous recognition, stopping');
      this.stopContinuousRecognition();
    }
  }

  public isAvailable(): boolean {
    try {
      return !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    } catch (error) {
      console.warn('Error checking Web Speech API availability:', error);
      return false;
    }
  }

  /**
   * Get browser compatibility information
   */
  public getBrowserCompatibility(): BrowserCompatibility | null {
    return this.browserCompatibility;
  }

  /**
   * Get supported languages
   */
  public getSupportedLanguages(): string[] {
    return [...this.supportedLanguages];
  }

  /**
   * Set recognition language with validation
   */
  public setLanguage(language: string): boolean {
    if (!this.supportedLanguages.includes(language)) {
      console.warn(`Language ${language} may not be supported`);
    }

    this.currentLanguage = language;
    
    if (this.recognition) {
      this.recognition.lang = language;
    }

    console.log(`Recognition language set to: ${language}`);
    return true;
  }

  /**
   * Auto-detect language based on user's browser settings
   */
  public autoDetectLanguage(): string {
    const browserLang = navigator.language || navigator.languages?.[0] || 'en-US';
    
    // Find best match in supported languages
    const exactMatch = this.supportedLanguages.find(lang => lang === browserLang);
    if (exactMatch) {
      this.setLanguage(exactMatch);
      return exactMatch;
    }

    // Find language family match (e.g., 'en' matches 'en-US')
    const langCode = browserLang.split('-')[0];
    const familyMatch = this.supportedLanguages.find(lang => lang.startsWith(langCode));
    if (familyMatch) {
      this.setLanguage(familyMatch);
      return familyMatch;
    }

    // Default to current language
    return this.currentLanguage;
  }

  public async startRecording(): Promise<void> {
    if (!this.recognition || !this.isAvailable()) {
      const compatibility = this.getBrowserCompatibility();
      const errorMsg = compatibility?.warnings.join(', ') || 'Speech recognition is not available';
      throw new Error(errorMsg);
    }

    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    try {
      // Reset error count
      this.errorCount = 0;
      
      // Configure for single recording
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start speech recognition:', error);
      throw new Error(`Failed to start speech recognition: ${error}`);
    }
  }

  /**
   * Start continuous speech recognition
   */
  public async startContinuousRecognition(options: Partial<ContinuousRecognitionOptions> = {}): Promise<void> {
    if (!this.recognition || !this.isAvailable()) {
      throw new Error('Speech recognition is not available');
    }

    if (this.isRecording || this.isContinuousMode) {
      throw new Error('Recognition is already in progress');
    }

    this.continuousOptions = {
      maxDuration: 300000, // 5 minutes default
      restartOnEnd: true,
      interimResults: true,
      language: this.currentLanguage,
      ...options
    };

    try {
      this.isContinuousMode = true;
      this.continuousStartTime = Date.now();
      this.errorCount = 0;

      // Configure for continuous recognition
      this.recognition.continuous = true;
      this.recognition.interimResults = this.continuousOptions.interimResults;
      this.recognition.lang = this.continuousOptions.language;

      this.recognition.start();
      console.log('Continuous speech recognition started');
    } catch (error) {
      this.isContinuousMode = false;
      this.continuousOptions = null;
      console.error('Failed to start continuous speech recognition:', error);
      throw new Error(`Failed to start continuous recognition: ${error}`);
    }
  }

  /**
   * Stop continuous speech recognition
   */
  public stopContinuousRecognition(): void {
    if (!this.isContinuousMode) {
      return;
    }

    this.isContinuousMode = false;
    this.continuousOptions = null;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }

    if (this.recognition && this.isRecording) {
      this.recognition.stop();
    }

    if (this.onContinuousEnd) {
      this.onContinuousEnd();
    }

    console.log('Continuous speech recognition stopped');
  }

  /**
   * Check if in continuous recognition mode
   */
  public isContinuous(): boolean {
    return this.isContinuousMode;
  }

  public async stopRecording(): Promise<string> {
    if (!this.recognition || !this.isRecording) {
      throw new Error('No recording in progress');
    }

    // If in continuous mode, stop continuous recognition
    if (this.isContinuousMode) {
      this.stopContinuousRecognition();
      throw new Error('Cannot get single result from continuous recognition');
    }

    return new Promise((resolve, reject) => {
      this.resolveRecording = resolve;
      this.rejectRecording = reject;
      
      const timeout = setTimeout(() => {
        if (this.rejectRecording) {
          this.rejectRecording(new Error('Recording timeout - no speech detected'));
          this.resolveRecording = null;
          this.rejectRecording = null;
        }
      }, 10000);

      // Clear timeout when recognition completes
      const originalResolve = this.resolveRecording;
      const originalReject = this.rejectRecording;

      this.resolveRecording = (result: string) => {
        clearTimeout(timeout);
        if (originalResolve) originalResolve(result);
      };

      this.rejectRecording = (error: Error) => {
        clearTimeout(timeout);
        if (originalReject) originalReject(error);
      };

      try {
        this.recognition!.stop();
      } catch (error) {
        clearTimeout(timeout);
        this.resolveRecording = null;
        this.rejectRecording = null;
        reject(new Error(`Failed to stop recognition: ${error}`));
      }
    });
  }

  /**
   * Abort current recognition
   */
  public abort(): void {
    if (this.recognition) {
      try {
        this.recognition.abort();
      } catch (error) {
        console.warn('Error aborting speech recognition:', error);
      }
    }

    this.cleanup();
  }

  /**
   * Clean up resources and reset state
   */
  private cleanup(): void {
    this.isRecording = false;
    this.isContinuousMode = false;
    this.continuousOptions = null;
    this.resolveRecording = null;
    this.rejectRecording = null;
    this.errorCount = 0;

    if (this.restartTimeout) {
      clearTimeout(this.restartTimeout);
      this.restartTimeout = null;
    }
  }

  /**
   * Get current recognition state
   */
  public getRecognitionState(): {
    isRecording: boolean;
    isContinuous: boolean;
    language: string;
    errorCount: number;
    compatibility: BrowserCompatibility | null;
  } {
    return {
      isRecording: this.isRecording,
      isContinuous: this.isContinuousMode,
      language: this.currentLanguage,
      errorCount: this.errorCount,
      compatibility: this.browserCompatibility
    };
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    this.stopContinuousRecognition();
    this.abort();
    this.cleanup();
    
    // Remove event listeners
    if (this.recognition) {
      this.recognition.onresult = null;
      this.recognition.onerror = null;
      this.recognition.onstart = null;
      this.recognition.onend = null;
      this.recognition.onnomatch = null;
      this.recognition.onspeechstart = null;
      this.recognition.onspeechend = null;
      this.recognition.onaudiostart = null;
      this.recognition.onaudioend = null;
    }
  }

  public async transcribeAudio(_audioBlob: Blob): Promise<string> {
    throw new Error('Web Speech API does not support blob transcription. Use startRecording/stopRecording instead.');
  }

  public getRecordingState(): boolean {
    return this.isRecording;
  }
}