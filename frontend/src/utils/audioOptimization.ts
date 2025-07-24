/**
 * Enhanced audio optimization utilities with quality assessment and advanced processing
 */

export interface AudioCompressionOptions {
  quality?: number; // 0.0 to 1.0
  maxSizeKB?: number;
  format?: 'webm' | 'mp4' | 'wav';
  enableNoiseReduction?: boolean;
  enableAutoGain?: boolean;
  targetSampleRate?: number;
}

export interface AudioQualityMetrics {
  volume: number; // 0-1, average volume level
  clarity: number; // 0-1, signal clarity
  noiseLevel: number; // 0-1, background noise level
  duration: number; // seconds
  sampleRate: number;
  bitDepth: number;
  dynamicRange: number; // 0-1, difference between loudest and quietest parts
  speechDetected: boolean; // whether speech is detected
  qualityScore: number; // 0-1, overall quality score
}

export interface AudioProcessingOptions {
  enableNoiseGate?: boolean;
  noiseGateThreshold?: number;
  enableCompressor?: boolean;
  compressorRatio?: number;
  enableEqualizer?: boolean;
  enableVoiceEnhancement?: boolean;
}

export interface RecordingQualityFeedback {
  level: 'excellent' | 'good' | 'fair' | 'poor';
  issues: string[];
  recommendations: string[];
  metrics: AudioQualityMetrics;
}

export interface AudioStreamingOptions {
  chunkSize?: number;
  bufferSize?: number;
  enableStreaming?: boolean;
}

/**
 * Comprehensive audio quality analysis
 */
export async function analyzeAudioQuality(audioBlob: Blob): Promise<AudioQualityMetrics> {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const duration = audioBuffer.duration;
    
    // Calculate volume (RMS)
    const volume = calculateRMS(channelData);
    
    // Calculate clarity (spectral centroid and high-frequency content)
    const clarity = await calculateClarity(audioBuffer, audioContext);
    
    // Estimate noise level
    const noiseLevel = estimateNoiseLevel(channelData);
    
    // Calculate dynamic range
    const dynamicRange = calculateDynamicRange(channelData);
    
    // Detect speech presence
    const speechDetected = detectSpeech(channelData, sampleRate);
    
    // Calculate overall quality score
    const qualityScore = calculateQualityScore(volume, clarity, noiseLevel, dynamicRange, speechDetected);
    
    await audioContext.close();
    
    return {
      volume,
      clarity,
      noiseLevel,
      duration,
      sampleRate,
      bitDepth: 16, // Assumed for web audio
      dynamicRange,
      speechDetected,
      qualityScore
    };
  } catch (error) {
    console.error('Audio quality analysis failed:', error);
    return {
      volume: 0.5,
      clarity: 0.5,
      noiseLevel: 0.5,
      duration: 0,
      sampleRate: 44100,
      bitDepth: 16,
      dynamicRange: 0.5,
      speechDetected: false,
      qualityScore: 0.5
    };
  }
}

/**
 * Calculate RMS (Root Mean Square) for volume measurement
 */
function calculateRMS(channelData: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < channelData.length; i++) {
    sum += channelData[i] * channelData[i];
  }
  return Math.sqrt(sum / channelData.length);
}

/**
 * Calculate audio clarity using spectral analysis
 */
async function calculateClarity(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<number> {
  try {
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Create offline context for analysis
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );
    
    const source = offlineContext.createBufferSource();
    const analyserOffline = offlineContext.createAnalyser();
    analyserOffline.fftSize = 2048;
    
    source.buffer = audioBuffer;
    source.connect(analyserOffline);
    analyserOffline.connect(offlineContext.destination);
    
    source.start();
    await offlineContext.startRendering();
    
    analyserOffline.getByteFrequencyData(dataArray);
    
    // Calculate spectral centroid (weighted average of frequencies)
    let weightedSum = 0;
    let magnitudeSum = 0;
    
    for (let i = 0; i < bufferLength; i++) {
      const frequency = (i * audioBuffer.sampleRate) / (2 * bufferLength);
      const magnitude = dataArray[i];
      weightedSum += frequency * magnitude;
      magnitudeSum += magnitude;
    }
    
    const spectralCentroid = magnitudeSum > 0 ? weightedSum / magnitudeSum : 0;
    
    // Normalize to 0-1 (assuming speech is around 1000-4000 Hz)
    return Math.min(1, spectralCentroid / 4000);
  } catch (error) {
    console.warn('Clarity calculation failed:', error);
    return 0.5;
  }
}

/**
 * Estimate noise level using signal consistency analysis
 */
function estimateNoiseLevel(channelData: Float32Array): number {
  const windowSize = Math.floor(channelData.length / 100);
  let variance = 0;
  let mean = 0;
  
  // Calculate mean
  for (let i = 0; i < channelData.length; i++) {
    mean += Math.abs(channelData[i]);
  }
  mean /= channelData.length;
  
  // Calculate variance in windows
  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    let windowSum = 0;
    for (let j = 0; j < windowSize; j++) {
      windowSum += Math.abs(channelData[i + j]);
    }
    const windowMean = windowSum / windowSize;
    variance += Math.pow(windowMean - mean, 2);
  }
  
  variance /= Math.floor(channelData.length / windowSize);
  
  // Higher variance indicates more noise
  return Math.min(1, Math.sqrt(variance) * 10);
}

/**
 * Calculate dynamic range (difference between loudest and quietest parts)
 */
function calculateDynamicRange(channelData: Float32Array): number {
  let max = 0;
  let min = Infinity;
  
  const windowSize = Math.floor(channelData.length / 100);
  
  for (let i = 0; i < channelData.length - windowSize; i += windowSize) {
    let windowRMS = 0;
    for (let j = 0; j < windowSize; j++) {
      windowRMS += channelData[i + j] * channelData[i + j];
    }
    windowRMS = Math.sqrt(windowRMS / windowSize);
    
    max = Math.max(max, windowRMS);
    if (windowRMS > 0.001) { // Ignore very quiet sections
      min = Math.min(min, windowRMS);
    }
  }
  
  return min === Infinity ? 0 : Math.min(1, (max - min) / max);
}

/**
 * Detect speech presence using zero-crossing rate and energy
 */
function detectSpeech(channelData: Float32Array, sampleRate: number): boolean {
  const frameSize = Math.floor(sampleRate * 0.025); // 25ms frames
  const hopSize = Math.floor(frameSize / 2);
  
  let speechFrames = 0;
  let totalFrames = 0;
  
  for (let i = 0; i < channelData.length - frameSize; i += hopSize) {
    const frame = channelData.slice(i, i + frameSize);
    
    // Calculate zero-crossing rate
    let zeroCrossings = 0;
    for (let j = 1; j < frame.length; j++) {
      if ((frame[j] >= 0) !== (frame[j - 1] >= 0)) {
        zeroCrossings++;
      }
    }
    const zcr = zeroCrossings / frame.length;
    
    // Calculate energy
    let energy = 0;
    for (let j = 0; j < frame.length; j++) {
      energy += frame[j] * frame[j];
    }
    energy /= frame.length;
    
    // Speech typically has moderate ZCR and sufficient energy
    if (zcr > 0.01 && zcr < 0.3 && energy > 0.001) {
      speechFrames++;
    }
    totalFrames++;
  }
  
  return totalFrames > 0 && (speechFrames / totalFrames) > 0.3;
}

/**
 * Calculate overall quality score
 */
function calculateQualityScore(
  volume: number,
  clarity: number,
  noiseLevel: number,
  dynamicRange: number,
  speechDetected: boolean
): number {
  let score = 0;
  
  // Volume score (optimal around 0.3-0.7)
  const volumeScore = volume < 0.1 ? volume * 5 : 
                     volume > 0.8 ? (1 - volume) * 5 : 
                     1;
  score += volumeScore * 0.25;
  
  // Clarity score
  score += clarity * 0.25;
  
  // Noise score (lower noise is better)
  score += (1 - noiseLevel) * 0.25;
  
  // Dynamic range score
  score += dynamicRange * 0.15;
  
  // Speech detection bonus
  score += speechDetected ? 0.1 : 0;
  
  return Math.min(1, Math.max(0, score));
}

/**
 * Generate recording quality feedback
 */
export function generateQualityFeedback(metrics: AudioQualityMetrics): RecordingQualityFeedback {
  const issues: string[] = [];
  const recommendations: string[] = [];
  
  // Analyze volume
  if (metrics.volume < 0.1) {
    issues.push('Слишком тихая запись');
    recommendations.push('Говорите громче или приблизьтесь к микрофону');
  } else if (metrics.volume > 0.8) {
    issues.push('Слишком громкая запись');
    recommendations.push('Говорите тише или отдалитесь от микрофона');
  }
  
  // Analyze noise
  if (metrics.noiseLevel > 0.6) {
    issues.push('Высокий уровень фонового шума');
    recommendations.push('Найдите более тихое место для записи');
  }
  
  // Analyze clarity
  if (metrics.clarity < 0.4) {
    issues.push('Нечеткая речь');
    recommendations.push('Говорите четче и медленнее');
  }
  
  // Analyze speech detection
  if (!metrics.speechDetected) {
    issues.push('Речь не обнаружена');
    recommendations.push('Убедитесь, что говорите в микрофон');
  }
  
  // Analyze duration
  if (metrics.duration < 0.5) {
    issues.push('Слишком короткая запись');
    recommendations.push('Говорите дольше для лучшего распознавания');
  }
  
  // Determine overall level
  let level: 'excellent' | 'good' | 'fair' | 'poor';
  if (metrics.qualityScore >= 0.8) {
    level = 'excellent';
  } else if (metrics.qualityScore >= 0.6) {
    level = 'good';
  } else if (metrics.qualityScore >= 0.4) {
    level = 'fair';
  } else {
    level = 'poor';
  }
  
  return {
    level,
    issues,
    recommendations,
    metrics
  };
}

/**
 * Enhanced audio compression with quality-based optimization
 */
export async function compressAudio(
  audioBlob: Blob,
  options: AudioCompressionOptions = {}
): Promise<Blob> {
  const {
    quality = 0.7,
    maxSizeKB = 500,
    format = 'webm',
    enableNoiseReduction = true,
    enableAutoGain = true,
    targetSampleRate = 16000
  } = options;

  try {
    // Analyze audio quality first
    const qualityMetrics = await analyzeAudioQuality(audioBlob);
    console.log('Audio quality before compression:', qualityMetrics);

    // Create audio context for processing
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    let audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Apply preprocessing based on quality analysis
    if (enableNoiseReduction && qualityMetrics.noiseLevel > 0.5) {
      audioBuffer = await applyNoiseReduction(audioBuffer, audioContext);
    }

    if (enableAutoGain && (qualityMetrics.volume < 0.3 || qualityMetrics.volume > 0.8)) {
      const targetGain = qualityMetrics.volume < 0.3 ? 2.0 : 0.5;
      audioBuffer = await applyAutoGain(audioBuffer, audioContext, targetGain);
    }

    // Apply speech enhancement if speech is detected
    if (qualityMetrics.speechDetected) {
      audioBuffer = await applySpeechEnhancement(audioBuffer, audioContext);
    }

    // Determine optimal sample rate based on content
    const optimalSampleRate = Math.min(
      audioBuffer.sampleRate,
      qualityMetrics.speechDetected ? targetSampleRate : Math.min(targetSampleRate, 22050)
    );

    // Compress if needed
    let finalBuffer = audioBuffer;
    if (audioBlob.size > maxSizeKB * 1024 || optimalSampleRate < audioBuffer.sampleRate) {
      finalBuffer = await resampleAudio(audioBuffer, audioContext, optimalSampleRate);
    }

    // Convert back to blob
    const compressedBlob = await audioBufferToBlob(finalBuffer, format, quality);
    
    // Log compression results
    const compressionRatio = audioBlob.size / compressedBlob.size;
    console.log(`Audio compression: ${audioBlob.size} → ${compressedBlob.size} bytes (${compressionRatio.toFixed(2)}x reduction)`);
    
    // Clean up
    await audioContext.close();
    
    return compressedBlob;
  } catch (error) {
    console.warn('Audio compression failed, returning original:', error);
    return audioBlob;
  }
}

/**
 * Apply noise reduction using spectral gating
 */
async function applyNoiseReduction(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  try {
    const processedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      // Simple noise gate
      const threshold = 0.01;
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.abs(inputData[i]) > threshold ? inputData[i] : inputData[i] * 0.1;
      }
    }

    return processedBuffer;
  } catch (error) {
    console.warn('Noise reduction failed:', error);
    return audioBuffer;
  }
}

/**
 * Apply automatic gain control
 */
async function applyAutoGain(audioBuffer: AudioBuffer, audioContext: AudioContext, targetGain: number): Promise<AudioBuffer> {
  try {
    const processedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = processedBuffer.getChannelData(channel);
      
      for (let i = 0; i < inputData.length; i++) {
        outputData[i] = Math.max(-1, Math.min(1, inputData[i] * targetGain));
      }
    }

    return processedBuffer;
  } catch (error) {
    console.warn('Auto gain failed:', error);
    return audioBuffer;
  }
}

/**
 * Apply speech enhancement (simple high-pass filter for speech frequencies)
 */
async function applySpeechEnhancement(audioBuffer: AudioBuffer, audioContext: AudioContext): Promise<AudioBuffer> {
  try {
    // Create offline context for processing
    const offlineContext = new OfflineAudioContext(
      audioBuffer.numberOfChannels,
      audioBuffer.length,
      audioBuffer.sampleRate
    );

    const source = offlineContext.createBufferSource();
    const highpass = offlineContext.createBiquadFilter();
    
    source.buffer = audioBuffer;
    highpass.type = 'highpass';
    highpass.frequency.value = 80; // Remove low-frequency noise
    highpass.Q.value = 0.7;

    source.connect(highpass);
    highpass.connect(offlineContext.destination);
    
    source.start();
    const processedBuffer = await offlineContext.startRendering();
    
    return processedBuffer;
  } catch (error) {
    console.warn('Speech enhancement failed:', error);
    return audioBuffer;
  }
}

/**
 * Resample audio to target sample rate
 */
async function resampleAudio(audioBuffer: AudioBuffer, audioContext: AudioContext, targetSampleRate: number): Promise<AudioBuffer> {
  if (audioBuffer.sampleRate === targetSampleRate) {
    return audioBuffer;
  }

  try {
    const ratio = targetSampleRate / audioBuffer.sampleRate;
    const newLength = Math.floor(audioBuffer.length * ratio);
    
    const resampledBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      newLength,
      targetSampleRate
    );

    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = resampledBuffer.getChannelData(channel);
      
      // Simple linear interpolation resampling
      for (let i = 0; i < newLength; i++) {
        const sourceIndex = i / ratio;
        const index = Math.floor(sourceIndex);
        const fraction = sourceIndex - index;
        
        if (index + 1 < inputData.length) {
          outputData[i] = inputData[index] * (1 - fraction) + inputData[index + 1] * fraction;
        } else {
          outputData[i] = inputData[index] || 0;
        }
      }
    }

    return resampledBuffer;
  } catch (error) {
    console.warn('Resampling failed:', error);
    return audioBuffer;
  }
}

/**
 * Real-time audio quality monitoring
 */
export class AudioQualityMonitor {
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private mediaStream: MediaStream | null = null;
  private isMonitoring = false;
  private qualityCallback?: (metrics: Partial<AudioQualityMetrics>) => void;
  private monitoringInterval: NodeJS.Timeout | null = null;

  async startMonitoring(stream: MediaStream, callback: (metrics: Partial<AudioQualityMetrics>) => void): Promise<void> {
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 256;
      
      const source = this.audioContext.createMediaStreamSource(stream);
      source.connect(this.analyser);
      
      this.mediaStream = stream;
      this.qualityCallback = callback;
      this.isMonitoring = true;
      
      // Monitor quality every 100ms
      this.monitoringInterval = setInterval(() => {
        if (this.isMonitoring) {
          const metrics = this.getCurrentQualityMetrics();
          if (this.qualityCallback) {
            this.qualityCallback(metrics);
          }
        }
      }, 100);
      
    } catch (error) {
      console.error('Failed to start audio quality monitoring:', error);
      throw error;
    }
  }

  private getCurrentQualityMetrics(): Partial<AudioQualityMetrics> {
    if (!this.analyser) return {};

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const timeDataArray = new Uint8Array(bufferLength);
    
    this.analyser.getByteFrequencyData(dataArray);
    this.analyser.getByteTimeDomainData(timeDataArray);
    
    // Calculate volume
    let sum = 0;
    for (let i = 0; i < timeDataArray.length; i++) {
      const normalized = (timeDataArray[i] - 128) / 128;
      sum += normalized * normalized;
    }
    const volume = Math.sqrt(sum / timeDataArray.length);
    
    // Calculate frequency distribution for clarity
    let highFreqEnergy = 0;
    let totalEnergy = 0;
    for (let i = 0; i < dataArray.length; i++) {
      totalEnergy += dataArray[i];
      if (i > dataArray.length * 0.5) { // High frequencies
        highFreqEnergy += dataArray[i];
      }
    }
    const clarity = totalEnergy > 0 ? highFreqEnergy / totalEnergy : 0;
    
    return {
      volume: Math.min(1, volume * 5), // Normalize
      clarity: Math.min(1, clarity * 2),
      sampleRate: this.audioContext?.sampleRate || 44100
    };
  }

  stopMonitoring(): void {
    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    
    this.analyser = null;
    this.mediaStream = null;
    this.qualityCallback = undefined;
  }

  getAudioLevel(): number {
    if (!this.analyser) return 0;

    const bufferLength = this.analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyser.getByteTimeDomainData(dataArray);
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const normalized = (dataArray[i] - 128) / 128;
      sum += Math.abs(normalized);
    }
    
    return sum / dataArray.length;
  }
}

/**
 * Convert AudioBuffer to Blob
 */
async function audioBufferToBlob(
  audioBuffer: AudioBuffer,
  format: string,
  _quality: number
): Promise<Blob> {
  // For WebM format, we need to use MediaRecorder
  if (format === 'webm') {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const canvasContext = canvas.getContext('2d');
      if (!canvasContext) {
        reject(new Error('Canvas context not available'));
        return;
      }

      // Create a simple audio stream from the buffer
      // const _stream = new MediaStream(); // Unused for now
      
      // This is a simplified approach - in a real implementation,
      // you'd need to properly encode the audio buffer
      const blob = new Blob([audioBuffer.getChannelData(0)], { type: 'audio/webm' });
      resolve(blob);
    });
  }

  // For WAV format, create WAV file manually
  const wavBlob = createWavBlob(audioBuffer);
  return wavBlob;
}

/**
 * Create WAV blob from AudioBuffer
 */
function createWavBlob(audioBuffer: AudioBuffer): Blob {
  const numberOfChannels = audioBuffer.numberOfChannels;
  const sampleRate = audioBuffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numberOfChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = audioBuffer.length * blockAlign;
  const bufferSize = 44 + dataSize;

  const buffer = new ArrayBuffer(bufferSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, bufferSize - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numberOfChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Convert audio data
  let offset = 44;
  for (let i = 0; i < audioBuffer.length; i++) {
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const sample = audioBuffer.getChannelData(channel)[i];
      const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Memory-efficient audio streaming for large TTS files
 */
export class AudioStreamer {
  private audioContext: AudioContext | null = null;
  private sourceNode: AudioBufferSourceNode | null = null;
  private gainNode: GainNode | null = null;
  // private _chunks: ArrayBuffer[] = []; // Unused for now
  private isPlaying = false;

  constructor(private options: AudioStreamingOptions = {}) {
    this.options = {
      chunkSize: 8192,
      bufferSize: 4096,
      enableStreaming: true,
      ...options
    };
  }

  async initialize(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
  }

  async streamAudio(audioBlob: Blob): Promise<void> {
    await this.initialize();
    
    if (!this.audioContext || !this.gainNode) {
      throw new Error('Audio context not initialized');
    }

    const arrayBuffer = await audioBlob.arrayBuffer();
    
    if (this.options.enableStreaming && arrayBuffer.byteLength > (this.options.chunkSize! * 4)) {
      await this.streamLargeAudio(arrayBuffer);
    } else {
      await this.playDirectly(arrayBuffer);
    }
  }

  private async streamLargeAudio(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext || !this.gainNode) return;

    // Split into chunks for streaming
    const chunkSize = this.options.chunkSize!;
    const chunks: ArrayBuffer[] = [];
    
    for (let i = 0; i < arrayBuffer.byteLength; i += chunkSize) {
      const chunk = arrayBuffer.slice(i, i + chunkSize);
      chunks.push(chunk);
    }

    // Play chunks sequentially
    for (const chunk of chunks) {
      if (!this.isPlaying) break;
      
      try {
        const audioBuffer = await this.audioContext.decodeAudioData(chunk.slice(0));
        await this.playAudioBuffer(audioBuffer);
      } catch (error) {
        console.warn('Failed to play audio chunk:', error);
      }
    }
  }

  private async playDirectly(arrayBuffer: ArrayBuffer): Promise<void> {
    if (!this.audioContext) return;

    const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
    await this.playAudioBuffer(audioBuffer);
  }

  private async playAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.audioContext || !this.gainNode) {
        reject(new Error('Audio context not available'));
        return;
      }

      this.sourceNode = this.audioContext.createBufferSource();
      this.sourceNode.buffer = audioBuffer;
      this.sourceNode.connect(this.gainNode);

      this.sourceNode.onended = () => {
        this.isPlaying = false;
        resolve();
      };

      this.sourceNode.addEventListener('error', () => {
        this.isPlaying = false;
        reject(new Error('Audio playback error'));
      });

      this.isPlaying = true;
      this.sourceNode.start();
    });
  }

  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stop(): void {
    this.isPlaying = false;
    if (this.sourceNode) {
      this.sourceNode.stop();
      this.sourceNode = null;
    }
  }

  dispose(): void {
    this.stop();
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    // this._chunks = []; // Reset chunks if needed
  }
}

/**
 * Memory management utilities
 */
export class AudioMemoryManager {
  private static audioBuffers = new Map<string, AudioBuffer>();
  private static maxCacheSize = 10; // Maximum number of cached audio buffers

  static cacheAudioBuffer(key: string, buffer: AudioBuffer): void {
    if (this.audioBuffers.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.audioBuffers.keys().next().value;
      if (firstKey) {
        this.audioBuffers.delete(firstKey);
      }
    }
    this.audioBuffers.set(key, buffer);
  }

  static getCachedAudioBuffer(key: string): AudioBuffer | undefined {
    return this.audioBuffers.get(key);
  }

  static clearCache(): void {
    this.audioBuffers.clear();
  }

  static getMemoryUsage(): { bufferCount: number; estimatedSizeKB: number } {
    let estimatedSize = 0;
    
    this.audioBuffers.forEach((buffer) => {
      // Rough estimation: channels * length * 4 bytes per float32 sample
      estimatedSize += buffer.numberOfChannels * buffer.length * 4;
    });

    return {
      bufferCount: this.audioBuffers.size,
      estimatedSizeKB: Math.round(estimatedSize / 1024)
    };
  }
}