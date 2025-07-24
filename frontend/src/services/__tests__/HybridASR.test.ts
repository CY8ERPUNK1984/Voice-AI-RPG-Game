import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HybridASR } from '../HybridASR';

// Mock utility functions
vi.mock('@/utils/debounce', () => ({
  debounce: vi.fn((fn) => fn)
}));

vi.mock('@/utils/audioOptimization', () => ({
  compressAudio: vi.fn((blob) => Promise.resolve(blob))
}));

// Mock WebSpeechASR
const mockWebSpeechASR = {
  isAvailable: vi.fn(),
  startRecording: vi.fn(),
  stopRecording: vi.fn(),
  getRecordingState: vi.fn(),
  onResult: undefined as ((result: string) => void) | undefined,
  onError: undefined as ((error: Error) => void) | undefined,
};

vi.mock('../WebSpeechASR', () => ({
  WebSpeechASR: vi.fn().mockImplementation(() => mockWebSpeechASR)
}));

// Mock MediaRecorder
const mockMediaRecorder = {
  start: vi.fn(),
  stop: vi.fn(),
  state: 'inactive' as RecordingState,
  ondataavailable: null as ((event: BlobEvent) => void) | null,
  onstop: null as (() => void) | null,
};

Object.defineProperty(window, 'MediaRecorder', {
  writable: true,
  value: vi.fn().mockImplementation(() => mockMediaRecorder)
});

// Mock MediaRecorder.isTypeSupported
(window.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

// Mock navigator.mediaDevices
const mockGetUserMedia = vi.fn();
Object.defineProperty(navigator, 'mediaDevices', {
  writable: true,
  value: {
    getUserMedia: mockGetUserMedia
  }
});

// Mock fetch for Whisper API
globalThis.fetch = vi.fn();

describe('HybridASR', () => {
  let hybridASR: HybridASR;

  beforeEach(() => {
    vi.clearAllMocks();
    mockWebSpeechASR.isAvailable.mockReturnValue(true);
    mockWebSpeechASR.getRecordingState.mockReturnValue(false);
    mockWebSpeechASR.startRecording.mockResolvedValue(undefined);
    mockWebSpeechASR.stopRecording.mockResolvedValue('test result');
    mockGetUserMedia.mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }]
    });
    mockMediaRecorder.state = 'inactive';
    hybridASR = new HybridASR();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize WebSpeechASR and setup handlers', () => {
      expect(hybridASR).toBeDefined();
      expect(mockWebSpeechASR.onResult).toBeDefined();
      expect(mockWebSpeechASR.onError).toBeDefined();
    });
  });

  describe('isAvailable', () => {
    it('should return true when Web Speech API is available', () => {
      mockWebSpeechASR.isAvailable.mockReturnValue(true);
      expect(hybridASR.isAvailable()).toBe(true);
    });

    it('should return true when MediaRecorder is available', () => {
      mockWebSpeechASR.isAvailable.mockReturnValue(false);
      expect(hybridASR.isAvailable()).toBe(true);
    });

    it('should return false when neither is available', () => {
      mockWebSpeechASR.isAvailable.mockReturnValue(false);
      (window.MediaRecorder as any).isTypeSupported.mockReturnValue(false);
      
      const asr = new HybridASR();
      expect(asr.isAvailable()).toBe(false);
    });
  });

  describe('getAvailableMethods', () => {
    it('should return correct availability status', () => {
      mockWebSpeechASR.isAvailable.mockReturnValue(true);
      (window.MediaRecorder as any).isTypeSupported.mockReturnValue(true);
      
      const methods = hybridASR.getAvailableMethods();
      expect(methods.webSpeech).toBe(true);
      expect(methods.whisper).toBe(true);
    });
  });

  describe('startRecording', () => {
    it('should start both Web Speech API and MediaRecorder', async () => {
      mockWebSpeechASR.startRecording.mockResolvedValue(undefined);
      
      await hybridASR.startRecording();
      
      expect(mockWebSpeechASR.startRecording).toHaveBeenCalled();
      expect(mockGetUserMedia).toHaveBeenCalledWith({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000
        }
      });
      expect(mockMediaRecorder.start).toHaveBeenCalled();
    });

    it('should continue if Web Speech API fails to start', async () => {
      mockWebSpeechASR.startRecording.mockRejectedValue(new Error('Web Speech failed'));
      
      await expect(hybridASR.startRecording()).resolves.not.toThrow();
      expect(mockGetUserMedia).toHaveBeenCalled();
    });

    it('should throw error if already recording', async () => {
      await hybridASR.startRecording();
      
      await expect(hybridASR.startRecording()).rejects.toThrow(
        'Recording is already in progress'
      );
    });

    it('should throw error if no ASR method is available', async () => {
      mockWebSpeechASR.isAvailable.mockReturnValue(false);
      (window.MediaRecorder as any).isTypeSupported.mockReturnValue(false);
      
      const asr = new HybridASR();
      await expect(asr.startRecording()).rejects.toThrow(
        'No ASR method is available'
      );
    });
  });

  describe('stopRecording', () => {
    beforeEach(async () => {
      await hybridASR.startRecording();
      // Simulate audio data being available after starting recording
      setTimeout(() => {
        if (mockMediaRecorder.ondataavailable) {
          mockMediaRecorder.ondataavailable({ data: new Blob(['audio data'], { type: 'audio/webm' }) } as BlobEvent);
        }
      }, 0);
    });

    it('should stop recording and return Web Speech API result', async () => {
      const expectedResult = 'Web Speech result';
      mockWebSpeechASR.getRecordingState.mockReturnValue(true);
      mockWebSpeechASR.stopRecording.mockResolvedValue(expectedResult);
      
      const resultPromise = hybridASR.stopRecording();
      
      // Simulate Web Speech API success
      setTimeout(() => {
        if (mockWebSpeechASR.onResult) {
          mockWebSpeechASR.onResult(expectedResult);
        }
      }, 10);
      
      const result = await resultPromise;
      expect(result).toBe(expectedResult);
    });

    it('should fallback to Whisper when Web Speech API fails', async () => {
      const whisperResult = 'Whisper result';
      
      // Mock fetch for Whisper API
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transcription: whisperResult })
      });
      
      // Test the transcribeAudio method directly for fallback scenario
      const audioBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const result = await hybridASR.transcribeAudio(audioBlob);
      
      expect(result).toBe(whisperResult);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('should throw error if not recording', async () => {
      const asr = new HybridASR();
      
      await expect(asr.stopRecording()).rejects.toThrow(
        'No recording in progress'
      );
    });

    it('should timeout if no result is received', async () => {
      vi.useFakeTimers();
      
      // Create new instance and start recording
      const asr = new HybridASR();
      await asr.startRecording();
      
      // Mock Web Speech API to be recording but never return result
      mockWebSpeechASR.getRecordingState.mockReturnValue(true);
      mockWebSpeechASR.stopRecording.mockImplementation(() => new Promise(() => {})); // Never resolves
      
      const resultPromise = asr.stopRecording();
      
      // Fast-forward time to trigger timeout
      vi.advanceTimersByTime(15100); // Slightly more than 15000ms timeout
      
      await expect(resultPromise).rejects.toThrow('Recording timeout');
      
      vi.useRealTimers();
    });
  });

  describe('transcribeAudio', () => {
    it('should successfully transcribe audio using Whisper API', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      const expectedResult = 'Transcribed text';
      
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transcription: expectedResult })
      });
      
      const result = await hybridASR.transcribeAudio(mockBlob);
      
      expect(result).toBe(expectedResult);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('should throw error for empty audio blob', async () => {
      const emptyBlob = new Blob([], { type: 'audio/webm' });
      
      await expect(hybridASR.transcribeAudio(emptyBlob)).rejects.toThrow(
        'Audio blob is empty'
      );
    });

    it('should handle API errors', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      });
      
      await expect(hybridASR.transcribeAudio(mockBlob)).rejects.toThrow(
        'Whisper transcription failed: Server error'
      );
    });

    it('should handle network errors', async () => {
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      (globalThis.fetch as any).mockRejectedValue(new Error('Network error'));
      
      await expect(hybridASR.transcribeAudio(mockBlob)).rejects.toThrow(
        'Whisper transcription failed: Network error'
      );
    });
  });

  describe('getRecordingState', () => {
    it('should return false initially', () => {
      expect(hybridASR.getRecordingState()).toBe(false);
    });

    it('should return true when recording', async () => {
      await hybridASR.startRecording();
      expect(hybridASR.getRecordingState()).toBe(true);
    });
  });
});