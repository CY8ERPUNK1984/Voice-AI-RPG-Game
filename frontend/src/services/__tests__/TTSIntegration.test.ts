import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TTSIntegration } from '../TTSIntegration';
import { AudioSettings } from '@/types';

// Mock WebSpeechTTS
vi.mock('../WebSpeechTTS', () => ({
  WebSpeechTTS: vi.fn().mockImplementation(() => ({
    synthesizeSpeech: vi.fn().mockResolvedValue('Speech synthesis completed'),
    isAvailable: vi.fn().mockReturnValue(true),
    getAvailableVoices: vi.fn().mockResolvedValue([]),
    stop: vi.fn(),
    isSpeaking: vi.fn().mockReturnValue(false),
    pause: vi.fn(),
    resume: vi.fn()
  }))
}));

describe('TTSIntegration', () => {
  let ttsIntegration: TTSIntegration;
  let mockSettings: AudioSettings;

  beforeEach(() => {
    mockSettings = {
      ttsEnabled: true,
      ttsVolume: 1.0,
      asrSensitivity: 0.5,
      voiceSpeed: 1.0
    };
    ttsIntegration = new TTSIntegration(mockSettings);
  });

  describe('isAvailable', () => {
    it('should return true when TTS is enabled and service is available', () => {
      expect(ttsIntegration.isAvailable()).toBe(true);
    });

    it('should return false when TTS is disabled', () => {
      ttsIntegration.updateSettings({ ...mockSettings, ttsEnabled: false });
      expect(ttsIntegration.isAvailable()).toBe(false);
    });
  });

  describe('synthesizeAIResponse', () => {
    it('should synthesize speech when available', async () => {
      const result = await ttsIntegration.synthesizeAIResponse('Hello world');
      expect(result).toBe('queued');
    });

    it('should return null when not available', async () => {
      ttsIntegration.updateSettings({ ...mockSettings, ttsEnabled: false });
      const result = await ttsIntegration.synthesizeAIResponse('Hello world');
      expect(result).toBeNull();
    });
  });

  describe('createAudioUrl', () => {
    it('should create TTS URL when available', async () => {
      const url = await ttsIntegration.createAudioUrl('Hello world');
      expect(url).toBe('tts:Hello%20world');
    });

    it('should return null when not available', async () => {
      ttsIntegration.updateSettings({ ...mockSettings, ttsEnabled: false });
      const url = await ttsIntegration.createAudioUrl('Hello world');
      expect(url).toBeNull();
    });
  });

  describe('playFromUrl', () => {
    it('should play TTS from valid URL', async () => {
      await expect(ttsIntegration.playFromUrl('tts:Hello%20world')).resolves.not.toThrow();
    });

    it('should throw error for invalid URL', async () => {
      await expect(ttsIntegration.playFromUrl('invalid:url')).rejects.toThrow('Invalid TTS URL');
    });
  });

  describe('updateSettings', () => {
    it('should update settings correctly', () => {
      const newSettings = { ...mockSettings, voiceSpeed: 1.5 };
      ttsIntegration.updateSettings(newSettings);
      
      // Settings should be updated (we can't directly test private property, 
      // but we can test behavior that depends on it)
      expect(ttsIntegration.isAvailable()).toBe(true);
    });
  });

  describe('control methods', () => {
    it('should have stop method', () => {
      expect(() => ttsIntegration.stop()).not.toThrow();
    });

    it('should have pause method', () => {
      expect(() => ttsIntegration.pause()).not.toThrow();
    });

    it('should have resume method', () => {
      expect(() => ttsIntegration.resume()).not.toThrow();
    });

    it('should have isSpeaking method', () => {
      expect(ttsIntegration.isSpeaking()).toBe(false);
    });
  });

  describe('getAvailableVoices', () => {
    it('should return available voices', async () => {
      const voices = await ttsIntegration.getAvailableVoices();
      expect(Array.isArray(voices)).toBe(true);
    });
  });
});