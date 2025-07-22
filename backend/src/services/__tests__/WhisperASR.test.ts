import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhisperASR } from '../WhisperASR';

// Mock OpenAI
const mockCreate = vi.fn();
vi.mock('openai', () => ({
  OpenAI: vi.fn().mockImplementation(() => ({
    audio: {
      transcriptions: {
        create: mockCreate
      }
    }
  }))
}));

// Mock dotenv
vi.mock('dotenv', () => ({
  config: vi.fn()
}));

describe('WhisperASR', () => {
  let whisperASR: WhisperASR;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    // Set environment variable
    process.env.OPENAI_API_KEY = mockApiKey;
    whisperASR = new WhisperASR();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('constructor', () => {
    it('should initialize with API key from environment', () => {
      expect(() => new WhisperASR()).not.toThrow();
    });

    it('should initialize with provided API key', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new WhisperASR('custom-key')).not.toThrow();
    });

    it('should throw error if no API key is provided', () => {
      delete process.env.OPENAI_API_KEY;
      expect(() => new WhisperASR()).toThrow('OpenAI API key is required');
    });
  });

  describe('isAvailable', () => {
    it('should return true when API key is set', () => {
      expect(whisperASR.isAvailable()).toBe(true);
    });

    it('should return false when API key is not set', () => {
      delete process.env.OPENAI_API_KEY;
      const asr = new WhisperASR('test-key');
      process.env.OPENAI_API_KEY = '';
      expect(asr.isAvailable()).toBe(false);
    });
  });

  describe('transcribeAudio', () => {
    const mockAudioBuffer = Buffer.from('mock audio data');

    it('should successfully transcribe audio', async () => {
      const expectedTranscription = 'Hello, this is a test transcription';
      mockCreate.mockResolvedValueOnce(expectedTranscription);

      const result = await whisperASR.transcribeAudio(mockAudioBuffer);

      expect(result).toBe(expectedTranscription);
      expect(mockCreate).toHaveBeenCalledWith({
        file: expect.any(File),
        model: 'whisper-1',
        language: 'ru',
        response_format: 'text',
        temperature: 0.2
      });
    });

    it('should throw error for empty audio buffer', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(whisperASR.transcribeAudio(emptyBuffer)).rejects.toThrow(
        'Audio blob is empty or invalid'
      );
    });

    it('should throw error for oversized audio buffer', async () => {
      const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB

      await expect(whisperASR.transcribeAudio(largeBuffer)).rejects.toThrow(
        'Audio file too large'
      );
    });

    it('should handle OpenAI API errors', async () => {
      const apiError = new Error('API Error');
      (apiError as any).status = 400;
      mockCreate.mockRejectedValueOnce(apiError);

      await expect(whisperASR.transcribeAudio(mockAudioBuffer)).rejects.toThrow();
      
      try {
        await whisperASR.transcribeAudio(mockAudioBuffer);
      } catch (error: any) {
        const errorResponse = JSON.parse(error.message);
        expect(errorResponse.type).toBe('ASR_ERROR');
        expect(errorResponse.message).toContain('Invalid audio format');
      }
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded');
      (rateLimitError as any).status = 429;
      mockCreate.mockRejectedValueOnce(rateLimitError);

      await expect(whisperASR.transcribeAudio(mockAudioBuffer)).rejects.toThrow();
      
      try {
        await whisperASR.transcribeAudio(mockAudioBuffer);
      } catch (error: any) {
        const errorResponse = JSON.parse(error.message);
        expect(errorResponse.type).toBe('ASR_ERROR');
        expect(errorResponse.message).toContain('Rate limit exceeded');
      }
    });

    it('should handle server errors', async () => {
      const serverError = new Error('Server error');
      (serverError as any).status = 500;
      mockCreate.mockRejectedValueOnce(serverError);

      await expect(whisperASR.transcribeAudio(mockAudioBuffer)).rejects.toThrow();
      
      try {
        await whisperASR.transcribeAudio(mockAudioBuffer);
      } catch (error: any) {
        const errorResponse = JSON.parse(error.message);
        expect(errorResponse.type).toBe('ASR_ERROR');
        expect(errorResponse.message).toContain('server error');
      }
    });

    it('should retry on failure and succeed', async () => {
      const expectedTranscription = 'Retry success';
      mockCreate
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockResolvedValueOnce(expectedTranscription);

      const result = await whisperASR.transcribeAudio(mockAudioBuffer);

      expect(result).toBe(expectedTranscription);
      expect(mockCreate).toHaveBeenCalledTimes(2);
    });

    it('should fail after max retries', async () => {
      mockCreate.mockRejectedValue(new Error('Persistent failure'));

      await expect(whisperASR.transcribeAudio(mockAudioBuffer)).rejects.toThrow();
      expect(mockCreate).toHaveBeenCalledTimes(3); // Initial + 2 retries
    });

    it('should throw error for empty transcription response', async () => {
      mockCreate.mockResolvedValueOnce('   '); // Empty/whitespace response

      await expect(whisperASR.transcribeAudio(mockAudioBuffer)).rejects.toThrow();
      
      try {
        await whisperASR.transcribeAudio(mockAudioBuffer);
      } catch (error: any) {
        const errorResponse = JSON.parse(error.message);
        expect(errorResponse.type).toBe('ASR_ERROR');
        expect(errorResponse.message).toContain('Empty transcription');
      }
    });
  });

  describe('configuration methods', () => {
    it('should configure retry settings', () => {
      expect(() => whisperASR.configureRetries(5, 2000)).not.toThrow();
    });

    it('should set model', () => {
      expect(() => whisperASR.setModel('whisper-1')).not.toThrow();
    });
  });
});