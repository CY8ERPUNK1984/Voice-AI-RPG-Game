import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HybridASR } from '../HybridASR';
import { WebSpeechASR } from '../WebSpeechASR';

// Integration test for ASR services
describe('ASR Integration Tests', () => {
  let hybridASR: HybridASR;

  // Mock global APIs
  const mockSpeechRecognition = {
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
    continuous: false,
    interimResults: false,
    lang: 'ru-RU',
    maxAlternatives: 1,
    onresult: null as ((event: any) => void) | null,
    onerror: null as ((event: any) => void) | null,
    onstart: null as ((event: Event) => void) | null,
    onend: null as ((event: Event) => void) | null,
  };

  const mockMediaRecorder = {
    start: vi.fn(),
    stop: vi.fn(),
    state: 'inactive' as RecordingState,
    ondataavailable: null as ((event: BlobEvent) => void) | null,
    onstop: null as (() => void) | null,
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Web Speech API
    Object.defineProperty(window, 'SpeechRecognition', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockSpeechRecognition)
    });

    Object.defineProperty(window, 'webkitSpeechRecognition', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockSpeechRecognition)
    });

    // Mock MediaRecorder
    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      value: vi.fn().mockImplementation(() => mockMediaRecorder)
    });

    (window.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

    // Mock navigator.mediaDevices
    Object.defineProperty(navigator, 'mediaDevices', {
      writable: true,
      value: {
        getUserMedia: vi.fn().mockResolvedValue({
          getTracks: () => [{ stop: vi.fn() }]
        })
      }
    });

    // Mock fetch for Whisper API
    globalThis.fetch = vi.fn();

    hybridASR = new HybridASR();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Fallback Mechanism', () => {
    it('should use Web Speech API when available and working', async () => {
      const expectedResult = 'Web Speech API result';
      
      await hybridASR.startRecording();
      
      const resultPromise = hybridASR.stopRecording();
      
      // Simulate successful Web Speech API result
      setTimeout(() => {
        if (mockSpeechRecognition.onresult) {
          mockSpeechRecognition.onresult({
            results: [[{ transcript: expectedResult, confidence: 0.9 }]],
            resultIndex: 0
          });
        }
      }, 100);
      
      const result = await resultPromise;
      expect(result).toBe(expectedResult);
      expect(globalThis.fetch).not.toHaveBeenCalled(); // Whisper should not be called
    });

    it('should fallback to Whisper when Web Speech API fails', async () => {
      const whisperResult = 'Whisper API result';
      
      // Mock Whisper API response
      (globalThis.fetch as any).mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ transcription: whisperResult })
      });
      
      await hybridASR.startRecording();
      
      const resultPromise = hybridASR.stopRecording();
      
      // Simulate Web Speech API error
      setTimeout(() => {
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror({
            error: 'network',
            message: 'Network error'
          });
        }
      }, 100);
      
      const result = await resultPromise;
      expect(result).toBe(whisperResult);
      expect(globalThis.fetch).toHaveBeenCalledWith('/api/transcribe', {
        method: 'POST',
        body: expect.any(FormData)
      });
    });

    it('should handle both services failing gracefully', async () => {
      // Mock Whisper API failure
      (globalThis.fetch as any).mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: () => Promise.resolve({ error: 'Server error' })
      });
      
      await hybridASR.startRecording();
      
      const resultPromise = hybridASR.stopRecording();
      
      // Simulate Web Speech API error
      setTimeout(() => {
        if (mockSpeechRecognition.onerror) {
          mockSpeechRecognition.onerror({
            error: 'network',
            message: 'Network error'
          });
        }
      }, 100);
      
      await expect(resultPromise).rejects.toThrow();
    });
  });

  describe('Error Handling and User Notifications', () => {
    it('should provide meaningful error messages for different failure scenarios', async () => {
      const errorHandler = vi.fn();
      hybridASR.onError = errorHandler;
      
      await hybridASR.startRecording();
      
      // Simulate Web Speech API error
      if (mockSpeechRecognition.onerror) {
        mockSpeechRecognition.onerror({
          error: 'not-allowed',
          message: 'Microphone access denied'
        });
      }
      
      expect(errorHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining('not-allowed')
        })
      );
    });

    it('should handle network connectivity issues', async () => {
      // Mock network error
      (globalThis.fetch as any).mockRejectedValue(new Error('Failed to fetch'));
      
      const mockBlob = new Blob(['audio data'], { type: 'audio/webm' });
      
      await expect(hybridASR.transcribeAudio(mockBlob)).rejects.toThrow(
        'Whisper transcription failed: Failed to fetch'
      );
    });

    it('should handle invalid audio data', async () => {
      const emptyBlob = new Blob([], { type: 'audio/webm' });
      
      await expect(hybridASR.transcribeAudio(emptyBlob)).rejects.toThrow(
        'Audio blob is empty'
      );
    });
  });

  describe('Service Availability Detection', () => {
    it('should correctly detect Web Speech API availability', () => {
      const webSpeechASR = new WebSpeechASR();
      expect(webSpeechASR.isAvailable()).toBe(true);
    });

    it('should correctly detect MediaRecorder availability', () => {
      const methods = hybridASR.getAvailableMethods();
      expect(methods.whisper).toBe(true);
    });

    it('should handle missing Web Speech API gracefully', () => {
      // Remove Web Speech API
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      
      const webSpeechASR = new WebSpeechASR();
      expect(webSpeechASR.isAvailable()).toBe(false);
    });

    it('should handle missing MediaRecorder gracefully', () => {
      // Remove MediaRecorder
      delete (window as any).MediaRecorder;
      
      const asr = new HybridASR();
      const methods = asr.getAvailableMethods();
      expect(methods.whisper).toBe(false);
    });
  });

  describe('Performance and Reliability', () => {
    it('should handle concurrent recording attempts', async () => {
      await hybridASR.startRecording();
      
      // Try to start recording again
      await expect(hybridASR.startRecording()).rejects.toThrow(
        'Recording is already in progress'
      );
    });

    it('should clean up resources properly', async () => {
      const mockTrack = { stop: vi.fn() };
      const mockStream = { getTracks: () => [mockTrack] };
      
      (navigator.mediaDevices.getUserMedia as any).mockResolvedValue(mockStream);
      
      await hybridASR.startRecording();
      await hybridASR.stopRecording().catch(() => {}); // Ignore result
      
      // Verify cleanup
      expect(mockTrack.stop).toHaveBeenCalled();
    });

    it('should handle timeout scenarios', async () => {
      vi.useFakeTimers();
      
      await hybridASR.startRecording();
      const resultPromise = hybridASR.stopRecording();
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(15000);
      
      await expect(resultPromise).rejects.toThrow('Recording timeout');
      
      vi.useRealTimers();
    });
  });
});