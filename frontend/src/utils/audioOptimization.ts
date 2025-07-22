/**
 * Audio optimization utilities for better performance and memory management
 */

export interface AudioCompressionOptions {
  quality?: number; // 0.0 to 1.0
  maxSizeKB?: number;
  format?: 'webm' | 'mp4' | 'wav';
}

export interface AudioStreamingOptions {
  chunkSize?: number;
  bufferSize?: number;
  enableStreaming?: boolean;
}

/**
 * Compress audio blob to reduce file size before transmission
 */
export async function compressAudio(
  audioBlob: Blob,
  options: AudioCompressionOptions = {}
): Promise<Blob> {
  const {
    quality = 0.7,
    maxSizeKB = 500,
    format = 'webm'
  } = options;

  // If the blob is already small enough, return as-is
  if (audioBlob.size <= maxSizeKB * 1024) {
    return audioBlob;
  }

  try {
    // Create audio context for processing
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const arrayBuffer = await audioBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Reduce sample rate and bit depth for compression
    const targetSampleRate = Math.min(audioBuffer.sampleRate, 16000); // Max 16kHz for speech
    const compressionRatio = targetSampleRate / audioBuffer.sampleRate;
    
    const compressedLength = Math.floor(audioBuffer.length * compressionRatio);
    const compressedBuffer = audioContext.createBuffer(
      audioBuffer.numberOfChannels,
      compressedLength,
      targetSampleRate
    );

    // Downsample audio data
    for (let channel = 0; channel < audioBuffer.numberOfChannels; channel++) {
      const inputData = audioBuffer.getChannelData(channel);
      const outputData = compressedBuffer.getChannelData(channel);
      
      for (let i = 0; i < compressedLength; i++) {
        const sourceIndex = Math.floor(i / compressionRatio);
        outputData[i] = inputData[sourceIndex] || 0;
      }
    }

    // Convert back to blob
    const compressedBlob = await audioBufferToBlob(compressedBuffer, format, quality);
    
    // Clean up
    audioContext.close();
    
    return compressedBlob;
  } catch (error) {
    console.warn('Audio compression failed, returning original:', error);
    return audioBlob;
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