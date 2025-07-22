import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAITTS } from '../OpenAITTS';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Mock axios
vi.mock('axios');
const mockedAxios = vi.mocked(axios);

// Mock fs
vi.mock('fs');
const mockedFs = vi.mocked(fs);

// Mock path
vi.mock('path');
const mockedPath = vi.mocked(path);

describe('OpenAITTS', () => {
  let ttsService: OpenAITTS;
  const mockApiKey = 'test-api-key';

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock environment variable
    process.env.OPENAI_API_KEY = mockApiKey;
    
    // Mock path methods
    mockedPath.join.mockImplementation((...args) => args.join('/'));
    
    // Mock fs methods
    mockedFs.existsSync.mockReturnValue(true);
    mockedFs.mkdirSync.mockImplementation(() => undefined);
    mockedFs.writeFileSync.mockImplementation(() => undefined);
    mockedFs.readdirSync.mockReturnValue([]);
    mockedFs.statSync.mockReturnValue({ mtime: new Date() } as any);
    mockedFs.unlinkSync.mockImplementation(() => undefined);
    
    ttsService = new OpenAITTS();
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe('isAvailable', () => {
    it('should return true when API key is provided', () => {
      expect(ttsService.isAvailable()).toBe(true);
    });

    it('should return false when no API key is provided', () => {
      const ttsWithoutKey = new OpenAITTS('');
      expect(ttsWithoutKey.isAvailable()).toBe(false);
    });
  });

  describe('synthesizeSpeech', () => {
    it('should successfully synthesize speech', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      const result = await ttsService.synthesizeSpeech('Hello world');
      
      expect(result).toMatch(/^\/api\/audio\/[a-f0-9-]+\.mp3$/);
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: 'Hello world',
          voice: 'alloy',
          speed: 1.0
        },
        {
          headers: {
            'Authorization': `Bearer ${mockApiKey}`,
            'Content-Type': 'application/json'
          },
          responseType: 'arraybuffer'
        }
      );
      expect(mockedFs.writeFileSync).toHaveBeenCalled();
    });

    it('should apply custom options', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      await ttsService.synthesizeSpeech('Hello world', {
        voice: 'nova',
        speed: 1.5,
        pitch: 1.0
      });
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        {
          model: 'tts-1',
          input: 'Hello world',
          voice: 'nova',
          speed: 1.5
        },
        expect.any(Object)
      );
    });

    it('should clamp speed to valid range', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      await ttsService.synthesizeSpeech('Hello world', {
        voice: 'alloy',
        speed: 10.0, // Should be clamped to 4.0
        pitch: 1.0
      });
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        'https://api.openai.com/v1/audio/speech',
        expect.objectContaining({
          speed: 4.0
        }),
        expect.any(Object)
      );
    });

    it('should throw error when service is not available', async () => {
      const ttsWithoutKey = new OpenAITTS('');
      
      await expect(ttsWithoutKey.synthesizeSpeech('Hello world')).rejects.toThrow(
        'OpenAI TTS service not available - missing API key'
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.post.mockRejectedValue(new Error('API Error'));
      
      await expect(ttsService.synthesizeSpeech('Hello world')).rejects.toThrow(
        'TTS synthesis failed: API Error'
      );
    });
  });

  describe('voice mapping', () => {
    it('should map generic voice names to OpenAI voices', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      // Test male voice mapping
      await ttsService.synthesizeSpeech('Hello', { voice: 'male', speed: 1.0, pitch: 1.0 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ voice: 'onyx' }),
        expect.any(Object)
      );

      // Test female voice mapping
      await ttsService.synthesizeSpeech('Hello', { voice: 'female', speed: 1.0, pitch: 1.0 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ voice: 'nova' }),
        expect.any(Object)
      );

      // Test default voice mapping
      await ttsService.synthesizeSpeech('Hello', { voice: 'unknown', speed: 1.0, pitch: 1.0 });
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ voice: 'alloy' }),
        expect.any(Object)
      );
    });
  });

  describe('cleanupOldFiles', () => {
    it('should clean up old files', () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      const newDate = new Date();

      mockedFs.readdirSync.mockReturnValue(['old-file.mp3', 'new-file.mp3'] as any);
      mockedFs.statSync
        .mockReturnValueOnce({ mtime: oldDate } as any)
        .mockReturnValueOnce({ mtime: newDate } as any);

      const cleanedCount = ttsService.cleanupOldFiles(60); // 1 hour max age
      
      expect(cleanedCount).toBe(1);
      expect(mockedFs.unlinkSync).toHaveBeenCalledTimes(1);
    });

    it('should handle cleanup errors gracefully', () => {
      mockedFs.readdirSync.mockImplementation(() => {
        throw new Error('Directory read error');
      });

      const cleanedCount = ttsService.cleanupOldFiles(60);
      
      expect(cleanedCount).toBe(0);
    });
  });

  describe('getAudioFilePath', () => {
    it('should return correct audio file path', () => {
      const audioId = 'test-audio-id';
      const expectedPath = `process.cwd()/temp/audio/${audioId}.mp3`;
      
      mockedPath.join.mockReturnValue(expectedPath);
      
      const result = ttsService.getAudioFilePath(`${audioId}.mp3`);
      
      expect(result).toBe(expectedPath);
      expect(mockedPath.join).toHaveBeenCalledWith(
        expect.any(String),
        'temp',
        'audio',
        `${audioId}.mp3`
      );
    });
  });
});