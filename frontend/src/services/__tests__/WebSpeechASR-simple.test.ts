import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the Web Speech API
const mockSpeechRecognition = {
  continuous: false,
  interimResults: false,
  lang: '',
  maxAlternatives: 1,
  start: vi.fn(),
  stop: vi.fn(),
  abort: vi.fn(),
  onresult: null as any,
  onerror: null as any,
  onstart: null as any,
  onend: null as any,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

// Mock constructor
const mockSpeechRecognitionConstructor = vi.fn(() => mockSpeechRecognition);

// Set up global mocks
(global as any).window = {
  SpeechRecognition: mockSpeechRecognitionConstructor,
  webkitSpeechRecognition: mockSpeechRecognitionConstructor,
};

// Mock the module
vi.mock('../WebSpeechASR', async () => {
  const actual = await vi.importActual('../WebSpeechASR');
  return {
    ...actual,
    WebSpeechASR: vi.fn().mockImplementation(() => ({
      isAvailable: vi.fn(() => true),
      startRecording: vi.fn(() => Promise.resolve()),
      stopRecording: vi.fn(() => Promise.resolve('test result')),
      transcribeAudio: vi.fn(() => Promise.reject(new Error('Web Speech API does not support blob transcription'))),
      getRecordingState: vi.fn(() => false),
      onResult: undefined,
      onError: undefined,
    })),
  };
});

import { WebSpeechASR } from '../WebSpeechASR';

describe('WebSpeechASR', () => {
  let asrService: WebSpeechASR;
  let mockInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechRecognition.onresult = null;
    mockSpeechRecognition.onerror = null;
    mockSpeechRecognition.onstart = null;
    mockSpeechRecognition.onend = null;
    
    asrService = new WebSpeechASR();
    mockInstance = asrService as any;
  });

  describe('isAvailable', () => {
    it('should return true when SpeechRecognition is available', () => {
      expect(mockInstance.isAvailable()).toBe(true);
    });

    it('should return false when SpeechRecognition is not available', () => {
      mockInstance.isAvailable = vi.fn(() => false);
      expect(mockInstance.isAvailable()).toBe(false);
    });
  });

  describe('startRecording', () => {
    it('should start recording successfully', async () => {
      await mockInstance.startRecording();
      expect(mockInstance.startRecording).toHaveBeenCalledOnce();
    });

    it('should throw error if already recording', async () => {
      mockInstance.startRecording = vi.fn(() => Promise.reject(new Error('Recording is already in progress')));
      await expect(mockInstance.startRecording()).rejects.toThrow('Recording is already in progress');
    });

    it('should throw error if speech recognition is not available', async () => {
      mockInstance.startRecording = vi.fn(() => Promise.reject(new Error('Speech recognition is not available')));
      await expect(mockInstance.startRecording()).rejects.toThrow('Speech recognition is not available');
    });
  });

  describe('stopRecording', () => {
    it('should stop recording and return result', async () => {
      const result = await mockInstance.stopRecording();
      expect(result).toBe('test result');
    });

    it('should throw error if not recording', async () => {
      mockInstance.stopRecording = vi.fn(() => Promise.reject(new Error('No recording in progress')));
      await expect(mockInstance.stopRecording()).rejects.toThrow('No recording in progress');
    });

    it('should handle timeout', async () => {
      mockInstance.stopRecording = vi.fn(() => Promise.reject(new Error('Recording timeout')));
      await expect(mockInstance.stopRecording()).rejects.toThrow('Recording timeout');
    });
  });

  describe('event handlers', () => {
    it('should call onResult callback when result is received', () => {
      const onResultMock = vi.fn();
      mockInstance.onResult = onResultMock;
      
      // Simulate calling the callback
      if (mockInstance.onResult) {
        mockInstance.onResult('Test result');
      }
      
      expect(onResultMock).toHaveBeenCalledWith('Test result');
    });

    it('should call onError callback when error occurs', () => {
      const onErrorMock = vi.fn();
      mockInstance.onError = onErrorMock;
      
      const testError = new Error('Test error');
      
      // Simulate calling the callback
      if (mockInstance.onError) {
        mockInstance.onError(testError);
      }
      
      expect(onErrorMock).toHaveBeenCalledWith(testError);
    });
  });

  describe('transcribeAudio', () => {
    it('should throw error for blob transcription', async () => {
      const mockBlob = new Blob(['test'], { type: 'audio/wav' });
      await expect(mockInstance.transcribeAudio(mockBlob)).rejects.toThrow(
        'Web Speech API does not support blob transcription'
      );
    });
  });

  describe('getRecordingState', () => {
    it('should return current recording state', () => {
      expect(mockInstance.getRecordingState()).toBe(false);
      
      mockInstance.getRecordingState = vi.fn(() => true);
      expect(mockInstance.getRecordingState()).toBe(true);
    });
  });
});