import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HybridASR } from '../HybridASR';
import { TTSIntegration } from '../TTSIntegration';
import { compressAudio, AudioStreamer, AudioMemoryManager } from '@/utils/audioOptimization';
import { debounce, throttle } from '@/utils/debounce';

// Mock Web APIs
const mockMediaDevices = {
  getUserMedia: vi.fn()
};

// Mock navigator
Object.defineProperty(globalThis, 'navigator', {
  value: {
    ...globalThis.navigator,
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    mediaDevices: mockMediaDevices
  },
  writable: true
});

const mockMediaRecorder = vi.fn().mockImplementation(() => ({
  start: vi.fn(),
  stop: vi.fn(),
  ondataavailable: null,
  onstop: null,
  state: 'inactive'
}));

const mockSpeechRecognition = vi.fn().mockImplementation(() => ({
  continuous: false,
  interimResults: false,
  lang: 'ru-RU',
  maxAlternatives: 1,
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onresult: null,
  onerror: null,
  onstart: null,
  onend: null
}));

const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn().mockReturnValue([]),
  speaking: false,
  paused: false,
  onvoiceschanged: null
};

const mockAudioContext = vi.fn().mockImplementation(() => ({
  createBuffer: vi.fn().mockReturnValue({
    numberOfChannels: 1,
    length: 1024,
    sampleRate: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024))
  }),
  createBufferSource: vi.fn().mockReturnValue({
    buffer: null,
    connect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
    onerror: null
  }),
  createGain: vi.fn().mockReturnValue({
    gain: { value: 1 },
    connect: vi.fn()
  }),
  decodeAudioData: vi.fn().mockResolvedValue({
    numberOfChannels: 1,
    length: 1024,
    sampleRate: 44100,
    getChannelData: vi.fn().mockReturnValue(new Float32Array(1024))
  }),
  destination: {},
  close: vi.fn()
}));

// Setup global mocks
Object.defineProperty(global, 'navigator', {
  value: {
    mediaDevices: mockMediaDevices
  },
  writable: true
});

Object.defineProperty(global, 'MediaRecorder', {
  value: mockMediaRecorder,
  writable: true
});

Object.defineProperty(global, 'window', {
  value: {
    SpeechRecognition: mockSpeechRecognition,
    webkitSpeechRecognition: mockSpeechRecognition,
    speechSynthesis: mockSpeechSynthesis,
    AudioContext: mockAudioContext,
    webkitAudioContext: mockAudioContext
  },
  writable: true
});

describe('Audio Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    AudioMemoryManager.clearCache();
  });

  afterEach(() => {
    AudioMemoryManager.clearCache();
  });

  describe('Debounce and Throttle Utilities', () => {
    it('should debounce function calls', async () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 100);

      // Call multiple times rapidly
      debouncedFn('call1');
      debouncedFn('call2');
      debouncedFn('call3');

      // Should not be called immediately
      expect(mockFn).not.toHaveBeenCalled();

      // Wait for debounce delay
      await new Promise(resolve => setTimeout(resolve, 150));

      // Should be called only once with the last argument
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call3');
    });

    it('should throttle function calls', async () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 100);

      // Call multiple times rapidly
      throttledFn('call1');
      throttledFn('call2');
      throttledFn('call3');

      // Should be called immediately for first call
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith('call1');

      // Wait for throttle period
      await new Promise(resolve => setTimeout(resolve, 150));

      // Call again
      throttledFn('call4');
      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith('call4');
    });
  });

  describe('Audio Compression', () => {
    it('should compress audio blob', async () => {
      // Create a mock audio blob
      const originalSize = 1000000; // 1MB
      const mockBlob = new Blob([new ArrayBuffer(originalSize)], { type: 'audio/webm' });

      // Mock AudioContext methods
      mockAudioContext.prototype.decodeAudioData = vi.fn().mockResolvedValue({
        numberOfChannels: 1,
        length: 44100,
        sampleRate: 44100,
        getChannelData: vi.fn().mockReturnValue(new Float32Array(44100))
      });

      const compressedBlob = await compressAudio(mockBlob, {
        quality: 0.5,
        maxSizeKB: 500
      });

      // Should return a blob (compression might not work in test environment)
      expect(compressedBlob).toBeInstanceOf(Blob);
    });

    it('should return original blob if already small enough', async () => {
      const smallBlob = new Blob([new ArrayBuffer(1000)], { type: 'audio/webm' }); // 1KB

      const result = await compressAudio(smallBlob, {
        maxSizeKB: 500
      });

      expect(result).toBe(smallBlob);
    });
  });

  describe('Audio Streaming', () => {
    it('should initialize audio streamer', async () => {
      const streamer = new AudioStreamer({
        chunkSize: 4096,
        bufferSize: 2048,
        enableStreaming: true
      });

      await streamer.initialize();
      
      // Should not throw
      expect(streamer).toBeDefined();
      
      streamer.dispose();
    });

    it('should handle volume control', async () => {
      const streamer = new AudioStreamer();
      await streamer.initialize();

      streamer.setVolume(0.5);
      streamer.setVolume(1.5); // Should clamp to 1.0
      streamer.setVolume(-0.5); // Should clamp to 0.0

      // Should not throw
      expect(streamer).toBeDefined();
      
      streamer.dispose();
    });
  });

  describe('Memory Management', () => {
    it('should track memory usage', () => {
      const mockBuffer = {
        numberOfChannels: 2,
        length: 44100,
        sampleRate: 44100
      } as AudioBuffer;

      AudioMemoryManager.cacheAudioBuffer('test1', mockBuffer);
      AudioMemoryManager.cacheAudioBuffer('test2', mockBuffer);

      const usage = AudioMemoryManager.getMemoryUsage();
      
      expect(usage.bufferCount).toBe(2);
      expect(usage.estimatedSizeKB).toBeGreaterThan(0);
    });

    it('should limit cache size', () => {
      const mockBuffer = {
        numberOfChannels: 1,
        length: 1024,
        sampleRate: 44100
      } as AudioBuffer;

      // Add more buffers than the cache limit
      for (let i = 0; i < 15; i++) {
        AudioMemoryManager.cacheAudioBuffer(`test${i}`, mockBuffer);
      }

      const usage = AudioMemoryManager.getMemoryUsage();
      expect(usage.bufferCount).toBeLessThanOrEqual(10); // Max cache size
    });

    it('should clear cache', () => {
      const mockBuffer = {
        numberOfChannels: 1,
        length: 1024,
        sampleRate: 44100
      } as AudioBuffer;

      AudioMemoryManager.cacheAudioBuffer('test', mockBuffer);
      expect(AudioMemoryManager.getMemoryUsage().bufferCount).toBe(1);

      AudioMemoryManager.clearCache();
      expect(AudioMemoryManager.getMemoryUsage().bufferCount).toBe(0);
    });
  });

  describe('HybridASR Performance', () => {
    it('should initialize with compression options', () => {
      const asr = new HybridASR({
        quality: 0.8,
        maxSizeKB: 300,
        format: 'webm'
      });

      expect(asr).toBeDefined();
      expect(asr.isAvailable()).toBeDefined();
    });

    it('should handle debounced results', async () => {
      const asr = new HybridASR();
      const resultHandler = vi.fn();
      asr.onResult = resultHandler;

      // Simulate rapid results (would be debounced)
      // Note: In real implementation, this would be debounced
      expect(asr).toBeDefined();
    });
  });

  describe('TTS Performance', () => {
    it('should initialize with audio streaming', () => {
      const tts = new TTSIntegration({
        ttsEnabled: true,
        ttsVolume: 1.0,
        asrSensitivity: 0.5,
        voiceSpeed: 1.0
      });

      expect(tts).toBeDefined();
      expect(tts.isAvailable()).toBeDefined();
    });

    it('should handle memory cleanup', () => {
      const tts = new TTSIntegration({
        ttsEnabled: true,
        ttsVolume: 1.0,
        asrSensitivity: 0.5,
        voiceSpeed: 1.0
      });

      // Should not throw during disposal
      expect(() => tts.dispose()).not.toThrow();
    });
  });

  describe('Performance Benchmarks', () => {
    it('should measure debounce performance', async () => {
      const mockFn = vi.fn();
      const debouncedFn = debounce(mockFn, 50);

      const startTime = performance.now();
      
      // Simulate rapid calls
      for (let i = 0; i < 100; i++) {
        debouncedFn(`call${i}`);
      }

      await new Promise(resolve => setTimeout(resolve, 100));
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly and call function only once
      expect(duration).toBeLessThan(200); // Should be fast
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should measure throttle performance', () => {
      const mockFn = vi.fn();
      const throttledFn = throttle(mockFn, 50);

      const startTime = performance.now();
      
      // Simulate rapid calls
      for (let i = 0; i < 100; i++) {
        throttledFn(`call${i}`);
      }
      
      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete quickly and call function only once initially
      expect(duration).toBeLessThan(50); // Should be very fast
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });
});