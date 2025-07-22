import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSessionManager } from '../GameSessionManager';
import { TTSService, Story, AudioSettings } from '../../types';

// Mock TTS Service
const mockTTSService: TTSService = {
  synthesizeSpeech: vi.fn().mockResolvedValue('/api/audio/test-audio.mp3'),
  isAvailable: vi.fn().mockReturnValue(true)
};

describe('GameSessionManager TTS Integration', () => {
  let gameSessionManager: GameSessionManager;
  let mockStory: Story;
  let mockSettings: AudioSettings;

  beforeEach(() => {
    vi.clearAllMocks();
    gameSessionManager = new GameSessionManager(mockTTSService);
    
    mockStory = {
      id: 'test-story',
      title: 'Test Story',
      description: 'A test story',
      genre: 'fantasy',
      initialPrompt: 'Welcome to the test adventure!',
      characterContext: 'You are a brave adventurer',
      gameRules: ['Be creative', 'Have fun'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockSettings = {
      ttsEnabled: true,
      ttsVolume: 1.0,
      asrSensitivity: 0.5,
      voiceSpeed: 1.0
    };
  });

  describe('addAIMessageWithTTS', () => {
    it('should create AI message with TTS when enabled', async () => {
      const session = gameSessionManager.createSession('user1', mockStory, mockSettings);
      
      const message = await gameSessionManager.addAIMessageWithTTS(
        session.id,
        'Hello, adventurer!',
        { testMetadata: true }
      );

      expect(message).toBeTruthy();
      expect(message?.type).toBe('ai');
      expect(message?.content).toBe('Hello, adventurer!');
      expect(message?.audioUrl).toBe('/api/audio/test-audio.mp3');
      expect(message?.metadata.testMetadata).toBe(true);
      
      expect(mockTTSService.synthesizeSpeech).toHaveBeenCalledWith(
        'Hello, adventurer!',
        {
          voice: 'alloy',
          speed: 1.0,
          pitch: 1.0
        }
      );
    });

    it('should create AI message without TTS when disabled', async () => {
      const disabledSettings = { ...mockSettings, ttsEnabled: false };
      const session = gameSessionManager.createSession('user1', mockStory, disabledSettings);
      
      const message = await gameSessionManager.addAIMessageWithTTS(
        session.id,
        'Hello, adventurer!'
      );

      expect(message).toBeTruthy();
      expect(message?.audioUrl).toBeUndefined();
      expect(mockTTSService.synthesizeSpeech).not.toHaveBeenCalled();
    });

    it('should handle TTS synthesis errors gracefully', async () => {
      vi.mocked(mockTTSService.synthesizeSpeech).mockRejectedValueOnce(new Error('TTS failed'));
      
      const session = gameSessionManager.createSession('user1', mockStory, mockSettings);
      
      const message = await gameSessionManager.addAIMessageWithTTS(
        session.id,
        'Hello, adventurer!'
      );

      expect(message).toBeTruthy();
      expect(message?.audioUrl).toBeUndefined();
      expect(message?.metadata.ttsError).toBe(true);
    });

    it('should return null for invalid session', async () => {
      const message = await gameSessionManager.addAIMessageWithTTS(
        'invalid-session',
        'Hello, adventurer!'
      );

      expect(message).toBeNull();
    });

    it('should use voice speed from session settings', async () => {
      const fastSettings = { ...mockSettings, voiceSpeed: 1.5 };
      const session = gameSessionManager.createSession('user1', mockStory, fastSettings);
      
      await gameSessionManager.addAIMessageWithTTS(session.id, 'Hello, adventurer!');

      expect(mockTTSService.synthesizeSpeech).toHaveBeenCalledWith(
        'Hello, adventurer!',
        {
          voice: 'alloy',
          speed: 1.5,
          pitch: 1.0
        }
      );
    });
  });

  describe('TTS service availability', () => {
    it('should check TTS availability', () => {
      expect(gameSessionManager.isTTSAvailable()).toBe(true);
    });

    it('should handle unavailable TTS service', () => {
      vi.mocked(mockTTSService.isAvailable).mockReturnValue(false);
      
      expect(gameSessionManager.isTTSAvailable()).toBe(false);
    });
  });

  describe('testTTS', () => {
    it('should test TTS synthesis', async () => {
      const result = await gameSessionManager.testTTS('Test message');
      
      expect(result).toBe('/api/audio/test-audio.mp3');
      expect(mockTTSService.synthesizeSpeech).toHaveBeenCalledWith(
        'Test message',
        {
          voice: 'alloy',
          speed: 1.0,
          pitch: 1.0
        }
      );
    });

    it('should use default test message', async () => {
      await gameSessionManager.testTTS();
      
      expect(mockTTSService.synthesizeSpeech).toHaveBeenCalledWith(
        'Hello, this is a test.',
        expect.any(Object)
      );
    });

    it('should return null when TTS is unavailable', async () => {
      vi.mocked(mockTTSService.isAvailable).mockReturnValue(false);
      
      const result = await gameSessionManager.testTTS();
      
      expect(result).toBeNull();
    });

    it('should handle TTS test errors', async () => {
      vi.mocked(mockTTSService.synthesizeSpeech).mockRejectedValueOnce(new Error('TTS test failed'));
      
      const result = await gameSessionManager.testTTS();
      
      expect(result).toBeNull();
    });
  });
});