import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { OpenAITTS } from '../OpenAITTS';
import axios from 'axios';
import fs from 'fs';
import path from 'path';

// Mock the RateLimiter
vi.mock('../RateLimiter', () => ({
  globalRateLimiter: {
    acquire: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({
      totalRequests: 10,
      successfulRequests: 8,
      rateLimitedRequests: 2,
      queuedRequests: 0,
      averageWaitTime: 100,
      currentTokens: 5,
      maxTokens: 10
    })
  }
}));

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
          responseType: 'arraybuffer',
          timeout: 30000
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

    it('should fallback to text mode when service is not available', async () => {
      const ttsWithoutKey = new OpenAITTS('');
      
      const result = await ttsWithoutKey.synthesizeSpeech('Hello world');
      
      expect(result).toBe('TEXT_ONLY:Hello world');
    });

    it('should throw error when service is not available and fallback is disabled', async () => {
      const ttsWithoutKey = new OpenAITTS('');
      ttsWithoutKey.setFallbackMode(false);
      
      await expect(ttsWithoutKey.synthesizeSpeech('Hello world')).rejects.toThrow(
        'OpenAI TTS service not available - missing API key'
      );
    });

    it('should retry on rate limit error', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      
      // Mock rate limit error then success
      mockedAxios.post
        .mockRejectedValueOnce({ 
          response: { status: 429 }, 
          message: 'Rate limit exceeded' 
        })
        .mockResolvedValueOnce({
          data: mockAudioData
        });

      // Configure faster retries for testing
      ttsService.configureRetries(3, 10, 100, 1.5);

      const result = await ttsService.synthesizeSpeech('Hello world');
      
      expect(result).toMatch(/^\/api\/audio\/[a-f0-9-]+\.mp3$/);
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should return fallback after max retries', async () => {
      // Mock persistent failures
      mockedAxios.post.mockRejectedValue({
        response: { status: 500 },
        message: 'Server error'
      });

      // Configure faster retries for testing
      ttsService.configureRetries(2, 10, 100, 1.5);

      const result = await ttsService.synthesizeSpeech('Hello world');
      
      // Should return text fallback
      expect(result).toBe('TEXT_ONLY:Hello world');
      expect(mockedAxios.post).toHaveBeenCalledTimes(2);
    });

    it('should handle authentication errors without retry', async () => {
      // Mock auth error
      mockedAxios.post.mockRejectedValue({
        response: { status: 401 },
        message: 'Invalid API key'
      });

      const result = await ttsService.synthesizeSpeech('Hello world');
      
      // Should return text fallback without retries
      expect(result).toBe('TEXT_ONLY:Hello world');
      expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    });

    it('should handle timeout errors', async () => {
      // Mock timeout by making the API call hang
      mockedAxios.post.mockImplementation(() => 
        new Promise(() => {}) // Never resolves
      );

      // Set a very short timeout for testing
      ttsService.setTimeout(50);
      ttsService.configureRetries(2, 10, 100, 1.5);

      const result = await ttsService.synthesizeSpeech('Hello world');
      
      // Should return text fallback due to timeout
      expect(result).toBe('TEXT_ONLY:Hello world');
    });

    it('should truncate long text', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      const longText = 'a'.repeat(5000); // Longer than 4096 limit
      await ttsService.synthesizeSpeech(longText);
      
      expect(mockedAxios.post).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          input: 'a'.repeat(4096) // Should be truncated
        }),
        expect.any(Object)
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
      const audioId = 'test-audio-id.mp3';
      const expectedPath = `process.cwd()/temp/audio/${audioId}`;
      
      mockedPath.join.mockReturnValue(expectedPath);
      
      const result = ttsService.getAudioFilePath(audioId);
      
      expect(result).toBe(expectedPath);
      // The path.join is called internally, so we just verify the result
      expect(result).toContain(audioId);
    });
  });

  describe('configuration', () => {
    it('should configure retry settings', () => {
      ttsService.configureRetries(5, 2000, 60000, 3);
      expect(() => ttsService.configureRetries(5, 2000)).not.toThrow();
    });

    it('should set timeout', () => {
      ttsService.setTimeout(30000);
      expect(() => ttsService.setTimeout(30000)).not.toThrow();
    });

    it('should set fallback mode', () => {
      ttsService.setFallbackMode(false);
      expect(() => ttsService.setFallbackMode(true)).not.toThrow();
    });
  });

  describe('health check', () => {
    it('should return healthy status when API is working', async () => {
      const mockAudioData = Buffer.from('mock audio data');
      mockedAxios.post.mockResolvedValue({
        data: mockAudioData
      });

      const health = await ttsService.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.details).toBeDefined();
      expect(health.details.rateLimiter).toBeDefined();
      expect(health.details.fallbackMode).toBeDefined();
    });

    it('should return unhealthy status when API fails', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 500 },
        message: 'Server error'
      });

      const health = await ttsService.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.details.error).toBeDefined();
      expect(health.details.type).toBe('server');
    });

    it('should return degraded status for rate limiting', async () => {
      mockedAxios.post.mockRejectedValue({
        response: { status: 429 },
        message: 'Rate limit exceeded'
      });

      const health = await ttsService.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.details.type).toBe('rate_limit');
    });
  });

  describe('maintenance', () => {
    it('should perform maintenance and cleanup', async () => {
      const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2 hours ago
      
      mockedFs.readdirSync.mockReturnValue(['old-file.mp3'] as any);
      mockedFs.statSync.mockReturnValue({ mtime: oldDate } as any);
      mockedFs.writeFileSync.mockImplementation(() => undefined);
      mockedFs.unlinkSync.mockImplementation(() => undefined);

      const result = await ttsService.performMaintenance();
      
      expect(result.cleaned).toBe(1);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle maintenance errors', async () => {
      // Mock file system write error to trigger maintenance error
      mockedFs.writeFileSync.mockImplementation(() => {
        throw new Error('Write error');
      });

      const result = await ttsService.performMaintenance();
      
      expect(result.cleaned).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('not writable');
    });
  });
});