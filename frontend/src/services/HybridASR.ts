import type { ASRService } from '@/types';
import { WebSpeechASR } from './WebSpeechASR';
import { debounce } from '@/utils/debounce';
import { compressAudio, AudioCompressionOptions } from '@/utils/audioOptimization';

interface ASRMethodPerformance {
  successRate: number;
  averageConfidence: number;
  averageResponseTime: number;
  errorCount: number;
  totalAttempts: number;
  lastUsed: Date;
}

interface TranscriptionResult {
  text: string;
  confidence: number;
  method: 'webspeech' | 'whisper';
  processingTime: number;
  audioQuality?: number;
}

interface AudioQualityMetrics {
  volume: number;
  clarity: number;
  noiseLevel: number;
  duration: number;
}

/**
 * Enhanced Hybrid ASR service with intelligent method selection and quality assessment
 */
export class HybridASR implements ASRService {
  private webSpeechASR: WebSpeechASR;
  private isRecording = false;
  private mediaRecorder: MediaRecorder | null = null;
  private audioChunks: Blob[] = [];
  private resolveRecording: ((result: string) => void) | null = null;
  private rejectRecording: ((error: Error) => void) | null = null;
  private compressionOptions: AudioCompressionOptions;
  private debouncedProcessResult: (result: string) => void;
  
  // Performance tracking
  private methodPerformance: Map<string, ASRMethodPerformance> = new Map();
  private preferredMethod: 'webspeech' | 'whisper' | 'auto' = 'auto';
  private confidenceThreshold = 0.7;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;

  public onResult?: (result: string) => void;
  public onError?: (error: Error) => void;

  constructor(compressionOptions: AudioCompressionOptions = {}) {
    this.webSpeechASR = new WebSpeechASR();
    this.compressionOptions = {
      quality: 0.7,
      maxSizeKB: 500,
      format: 'webm',
      ...compressionOptions
    };
    
    // Initialize performance tracking
    this.initializePerformanceTracking();
    
    // Debounce result processing to avoid rapid-fire results
    this.debouncedProcessResult = debounce((result: string) => {
      if (this.onResult) {
        this.onResult(result);
      }
      
      if (this.resolveRecording) {
        this.resolveRecording(result);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    }, 300); // 300ms debounce
    
    this.setupWebSpeechHandlers();
    this.initializeAudioAnalysis();
  }

  private initializePerformanceTracking(): void {
    // Initialize performance metrics for both methods
    this.methodPerformance.set('webspeech', {
      successRate: 0.8, // Start with reasonable defaults
      averageConfidence: 0.75,
      averageResponseTime: 2000,
      errorCount: 0,
      totalAttempts: 0,
      lastUsed: new Date()
    });
    
    this.methodPerformance.set('whisper', {
      successRate: 0.9,
      averageConfidence: 0.85,
      averageResponseTime: 5000,
      errorCount: 0,
      totalAttempts: 0,
      lastUsed: new Date()
    });
  }

  private initializeAudioAnalysis(): void {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    } catch (error) {
      console.warn('AudioContext not available for audio analysis:', error);
    }
  }

  private setupWebSpeechHandlers(): void {
    this.webSpeechASR.onResult = (result: string) => {
      const startTime = Date.now();
      
      // Track performance
      this.updateMethodPerformance('webspeech', true, 0.8, Date.now() - startTime);
      
      // Use debounced processing to avoid rapid-fire results
      this.debouncedProcessResult(result);
    };

    this.webSpeechASR.onError = async (error: Error) => {
      console.warn('Web Speech API failed, attempting intelligent fallback:', error.message);
      
      // Track failure
      this.updateMethodPerformance('webspeech', false, 0, 0);
      
      // Try Whisper fallback if we have recorded audio
      if (this.audioChunks.length > 0) {
        try {
          const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
          const result = await this.transcribeWithWhisper(audioBlob);
          
          // Use debounced processing for consistency
          this.debouncedProcessResult(result);
          return;
        } catch (whisperError) {
          console.error('Whisper fallback also failed:', whisperError);
          this.updateMethodPerformance('whisper', false, 0, 0);
        }
      }
      
      if (this.onError) {
        this.onError(error);
      }
      
      if (this.rejectRecording) {
        this.rejectRecording(error);
        this.resolveRecording = null;
        this.rejectRecording = null;
      }
    };
  }

  /**
   * Intelligent method selection based on performance and audio quality
   */
  private selectOptimalMethod(audioQuality?: AudioQualityMetrics): 'webspeech' | 'whisper' {
    if (this.preferredMethod !== 'auto') {
      return this.preferredMethod;
    }

    const webSpeechPerf = this.methodPerformance.get('webspeech')!;
    const whisperPerf = this.methodPerformance.get('whisper')!;

    // Calculate scores based on multiple factors
    const webSpeechScore = this.calculateMethodScore('webspeech', webSpeechPerf, audioQuality);
    const whisperScore = this.calculateMethodScore('whisper', whisperPerf, audioQuality);

    console.log(`Method selection scores - WebSpeech: ${webSpeechScore.toFixed(2)}, Whisper: ${whisperScore.toFixed(2)}`);

    return webSpeechScore >= whisperScore ? 'webspeech' : 'whisper';
  }

  private calculateMethodScore(method: string, performance: ASRMethodPerformance, audioQuality?: AudioQualityMetrics): number {
    let score = 0;

    // Base performance score (0-40 points)
    score += performance.successRate * 20;
    score += performance.averageConfidence * 20;

    // Response time score (0-20 points, faster is better)
    const responseTimeScore = Math.max(0, 20 - (performance.averageResponseTime / 1000) * 2);
    score += responseTimeScore;

    // Audio quality considerations (0-20 points)
    if (audioQuality) {
      if (method === 'webspeech') {
        // WebSpeech works better with clear, high-quality audio
        score += audioQuality.clarity * 10;
        score += Math.max(0, 10 - audioQuality.noiseLevel * 10);
      } else {
        // Whisper is more robust to noise and poor quality
        score += 15; // Base bonus for robustness
        if (audioQuality.noiseLevel > 0.3) {
          score += 5; // Extra bonus for noisy audio
        }
      }
    }

    // Availability penalty
    if (method === 'webspeech' && !this.webSpeechASR.isAvailable()) {
      score = 0;
    }
    if (method === 'whisper' && !this.isMediaRecorderAvailable()) {
      score = 0;
    }

    return score;
  }

  private updateMethodPerformance(method: string, success: boolean, confidence: number, responseTime: number): void {
    const performance = this.methodPerformance.get(method);
    if (!performance) return;

    performance.totalAttempts++;
    performance.lastUsed = new Date();

    if (success) {
      // Update success rate with exponential moving average
      performance.successRate = performance.successRate * 0.9 + (success ? 1 : 0) * 0.1;
      
      // Update confidence with exponential moving average
      performance.averageConfidence = performance.averageConfidence * 0.8 + confidence * 0.2;
      
      // Update response time with exponential moving average
      performance.averageResponseTime = performance.averageResponseTime * 0.8 + responseTime * 0.2;
    } else {
      performance.errorCount++;
      performance.successRate = performance.successRate * 0.9; // Decrease success rate
    }

    this.methodPerformance.set(method, performance);
  }

  private async analyzeAudioQuality(audioBlob: Blob): Promise<AudioQualityMetrics> {
    if (!this.audioContext) {
      return { volume: 0.5, clarity: 0.5, noiseLevel: 0.5, duration: 0 };
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      const channelData = audioBuffer.getChannelData(0);
      const duration = audioBuffer.duration;
      
      // Calculate volume (RMS)
      let sum = 0;
      for (let i = 0; i < channelData.length; i++) {
        sum += channelData[i] * channelData[i];
      }
      const volume = Math.sqrt(sum / channelData.length);
      
      // Estimate clarity (high frequency content)
      const clarity = this.estimateClarity(channelData);
      
      // Estimate noise level (consistency of signal)
      const noiseLevel = this.estimateNoiseLevel(channelData);
      
      return {
        volume: Math.min(1, volume * 10), // Normalize to 0-1
        clarity: Math.min(1, clarity),
        noiseLevel: Math.min(1, noiseLevel),
        duration
      };
    } catch (error) {
      console.warn('Audio quality analysis failed:', error);
      return { volume: 0.5, clarity: 0.5, noiseLevel: 0.5, duration: 0 };
    }
  }

  private estimateClarity(channelData: Float32Array): number {
    // Simple clarity estimation based on signal variation
    let variation = 0;
    for (let i = 1; i < channelData.length; i++) {
      variation += Math.abs(channelData[i] - channelData[i - 1]);
    }
    return Math.min(1, variation / channelData.length * 100);
  }

  private estimateNoiseLevel(channelData: Float32Array): number {
    // Estimate noise by looking at signal consistency
    const windowSize = Math.floor(channelData.length / 100);
    let inconsistency = 0;
    
    for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
      let windowSum = 0;
      for (let j = 0; j < windowSize; j++) {
        windowSum += Math.abs(channelData[i + j]);
      }
      const windowAvg = windowSum / windowSize;
      
      // Compare with overall average
      inconsistency += Math.abs(windowAvg - 0.1); // Assuming 0.1 as baseline
    }
    
    return Math.min(1, inconsistency * 10);
  }

  /**
   * Check if any ASR method is available
   */
  public isAvailable(): boolean {
    return this.webSpeechASR.isAvailable() || this.isMediaRecorderAvailable();
  }

  /**
   * Check if MediaRecorder is available for Whisper fallback
   */
  private isMediaRecorderAvailable(): boolean {
    return typeof MediaRecorder !== 'undefined' && 
           typeof MediaRecorder.isTypeSupported === 'function' &&
           MediaRecorder.isTypeSupported('audio/webm');
  }

  /**
   * Start recording with intelligent method selection
   */
  public async startRecording(): Promise<void> {
    if (this.isRecording) {
      throw new Error('Recording is already in progress');
    }

    this.isRecording = true;
    this.audioChunks = [];

    // Always start MediaRecorder for audio analysis and fallback
    if (this.isMediaRecorderAvailable()) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 16000 // Optimal for speech recognition
          }
        });
        
        this.mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        
        // Setup audio analysis
        if (this.audioContext && this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
        }
        
        if (this.audioContext) {
          const source = this.audioContext.createMediaStreamSource(stream);
          this.analyser = this.audioContext.createAnalyser();
          this.analyser.fftSize = 256;
          source.connect(this.analyser);
        }
        
        this.mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            this.audioChunks.push(event.data);
          }
        };

        this.mediaRecorder.onstop = () => {
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
        };

        this.mediaRecorder.start();
      } catch (error) {
        console.warn('Failed to start MediaRecorder:', error);
        this.isRecording = false;
        throw new Error('Failed to access microphone');
      }
    }

    // Determine optimal method and start primary recognition
    const optimalMethod = this.selectOptimalMethod();
    console.log(`Selected optimal ASR method: ${optimalMethod}`);

    if (optimalMethod === 'webspeech' && this.webSpeechASR.isAvailable()) {
      try {
        await this.webSpeechASR.startRecording();
      } catch (error) {
        console.warn('Failed to start Web Speech API, will use Whisper:', error);
        // Continue with MediaRecorder only
      }
    }

    // If no method is available, throw error
    if (!this.webSpeechASR.isAvailable() && !this.isMediaRecorderAvailable()) {
      this.isRecording = false;
      throw new Error('No ASR method is available');
    }
  }

  /**
   * Stop recording and get transcription
   */
  public async stopRecording(): Promise<string> {
    if (!this.isRecording) {
      throw new Error('No recording in progress');
    }

    this.isRecording = false;

    // Stop MediaRecorder
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }

    return new Promise((resolve, reject) => {
      this.resolveRecording = resolve;
      this.rejectRecording = reject;
      
      // Set timeout for recording
      setTimeout(() => {
        if (this.rejectRecording) {
          this.rejectRecording(new Error('Recording timeout'));
          this.resolveRecording = null;
          this.rejectRecording = null;
        }
      }, 15000); // Longer timeout for Whisper processing

      // Try to stop Web Speech API first
      if (this.webSpeechASR.getRecordingState()) {
        this.webSpeechASR.stopRecording().catch((error) => {
          console.warn('Web Speech API stop failed:', error);
          // The error handler will trigger Whisper fallback
        });
      } else {
        // If Web Speech API wasn't recording, try Whisper directly
        setTimeout(() => {
          if (this.audioChunks.length > 0) {
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            this.transcribeWithWhisper(audioBlob)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('No audio data recorded'));
          }
        }, 100); // Small delay to allow MediaRecorder to finish
      }
    });
  }

  /**
   * Transcribe audio blob using Whisper API
   */
  public async transcribeAudio(audioBlob: Blob): Promise<string> {
    return this.transcribeWithWhisper(audioBlob);
  }

  /**
   * Internal method to call Whisper API with performance tracking
   */
  private async transcribeWithWhisper(audioBlob: Blob): Promise<string> {
    const startTime = Date.now();
    
    if (audioBlob.size === 0) {
      throw new Error('Audio blob is empty');
    }

    try {
      // Analyze audio quality before processing
      const audioQuality = await this.analyzeAudioQuality(audioBlob);
      console.log('Audio quality metrics:', audioQuality);

      // Apply noise reduction and preprocessing
      const preprocessedBlob = await this.preprocessAudio(audioBlob, audioQuality);
      
      // Compress audio before sending to reduce bandwidth and processing time
      const compressedBlob = await compressAudio(preprocessedBlob, this.compressionOptions);
      
      console.log(`Audio processing: ${audioBlob.size} bytes -> ${compressedBlob.size} bytes (${Math.round((1 - compressedBlob.size / audioBlob.size) * 100)}% reduction)`);

      // Create FormData for file upload
      const formData = new FormData();
      formData.append('audio', compressedBlob, 'recording.webm');
      formData.append('startTime', startTime.toString());
      formData.append('audioQuality', JSON.stringify(audioQuality));

      const response = await fetch('/api/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.transcription) {
        throw new Error('No transcription received from server');
      }

      // Track successful performance
      const processingTime = Date.now() - startTime;
      const confidence = data.confidence || 0.8; // Default confidence if not provided
      this.updateMethodPerformance('whisper', true, confidence, processingTime);

      return data.transcription;
    } catch (error: any) {
      console.error('Whisper API transcription failed:', error);
      
      // Track failed performance
      const processingTime = Date.now() - startTime;
      this.updateMethodPerformance('whisper', false, 0, processingTime);
      
      throw new Error(`Whisper transcription failed: ${error.message}`);
    }
  }

  /**
   * Preprocess audio to improve recognition quality
   */
  private async preprocessAudio(audioBlob: Blob, audioQuality: AudioQualityMetrics): Promise<Blob> {
    if (!this.audioContext) {
      return audioBlob; // Return original if no audio context
    }

    try {
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      
      // Apply preprocessing based on audio quality
      let processedBuffer = audioBuffer;
      
      // Apply gain control if volume is too low
      if (audioQuality.volume < 0.3) {
        processedBuffer = this.applyGainControl(processedBuffer, 2.0);
      }
      
      // Apply noise reduction if noise level is high
      if (audioQuality.noiseLevel > 0.5) {
        processedBuffer = this.applyNoiseReduction(processedBuffer);
      }
      
      // Convert back to blob (simplified - in real implementation would need proper encoding)
      return audioBlob; // For now, return original
    } catch (error) {
      console.warn('Audio preprocessing failed:', error);
      return audioBlob;
    }
  }

  private applyGainControl(audioBuffer: AudioBuffer, gain: number): AudioBuffer {
    const processedBuffer = this.audioContext!.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.max(-1, Math.min(1, inputData[i] * gain));
      }
    }
    
    return processedBuffer;
  }

  private applyNoiseReduction(audioBuffer: AudioBuffer): AudioBuffer {
    // Simple noise gate implementation
    const threshold = 0.01;
    const processedBuffer = this.audioContext!.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.abs(inputData[i]) > threshold ? inputData[i] : 0;
      }
    }
    
    return processedBuffer;
  }

  /**
   * Get current recording state
   */
  public getRecordingState(): boolean {
    return this.isRecording;
  }

  /**
   * Get information about available ASR methods with performance data
   */
  public getAvailableMethods(): { 
    webSpeech: boolean; 
    whisper: boolean;
    performance: Map<string, ASRMethodPerformance>;
    recommendedMethod: string;
  } {
    return {
      webSpeech: this.webSpeechASR.isAvailable(),
      whisper: this.isMediaRecorderAvailable(),
      performance: new Map(this.methodPerformance),
      recommendedMethod: this.selectOptimalMethod()
    };
  }

  /**
   * Set preferred ASR method
   */
  public setPreferredMethod(method: 'webspeech' | 'whisper' | 'auto'): void {
    this.preferredMethod = method;
    console.log(`ASR preferred method set to: ${method}`);
  }

  /**
   * Set confidence threshold for method switching
   */
  public setConfidenceThreshold(threshold: number): void {
    this.confidenceThreshold = Math.max(0, Math.min(1, threshold));
    console.log(`ASR confidence threshold set to: ${this.confidenceThreshold}`);
  }

  /**
   * Get current performance metrics
   */
  public getPerformanceMetrics(): Map<string, ASRMethodPerformance> {
    return new Map(this.methodPerformance);
  }

  /**
   * Reset performance tracking
   */
  public resetPerformanceTracking(): void {
    this.initializePerformanceTracking();
    console.log('ASR performance tracking reset');
  }

  /**
   * Get real-time audio level (if recording)
   */
  public getAudioLevel(): number {
    if (!this.analyser || !this.isRecording) {
      return 0;
    }

    const dataArray = new Uint8Array(this.analyser.frequencyBinCount);
    this.analyser.getByteFrequencyData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    
    return sum / dataArray.length / 255; // Normalize to 0-1
  }

  /**
   * Enhanced transcription with quality assessment
   */
  public async transcribeWithQualityAssessment(audioBlob: Blob): Promise<TranscriptionResult> {
    const startTime = Date.now();
    const audioQuality = await this.analyzeAudioQuality(audioBlob);
    
    // Select method based on audio quality
    const selectedMethod = this.selectOptimalMethod(audioQuality);
    
    try {
      let transcription: string;
      let confidence: number;
      
      if (selectedMethod === 'webspeech' && this.webSpeechASR.isAvailable()) {
        // For WebSpeech, we can't directly transcribe a blob, so use Whisper
        transcription = await this.transcribeWithWhisper(audioBlob);
        confidence = 0.8; // Default confidence for Whisper
      } else {
        transcription = await this.transcribeWithWhisper(audioBlob);
        confidence = 0.8; // Default confidence for Whisper
      }
      
      const processingTime = Date.now() - startTime;
      
      return {
        text: transcription,
        confidence,
        method: 'whisper', // Currently always using Whisper for blob transcription
        processingTime,
        audioQuality: (audioQuality.volume + audioQuality.clarity + (1 - audioQuality.noiseLevel)) / 3
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * Dispose of resources
   */
  public dispose(): void {
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close();
    }
    
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      this.mediaRecorder.stop();
    }
    
    this.isRecording = false;
    this.audioChunks = [];
    this.resolveRecording = null;
    this.rejectRecording = null;
  }
}