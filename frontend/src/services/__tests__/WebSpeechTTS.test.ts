import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { WebSpeechTTS } from '../WebSpeechTTS';

// Mock the Web Speech API
const mockSpeechSynthesis = {
  speak: vi.fn(),
  cancel: vi.fn(),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn(),
  speaking: false,
  paused: false,
  onvoiceschanged: null as any
};

const mockSpeechSynthesisUtterance = vi.fn().mockImplementation((text: string) => ({
  text,
  voice: null,
  rate: 1,
  pitch: 1,
  volume: 1,
  onend: null as any,
  onerror: null as any
}));

// Setup global mocks
Object.defineProperty(window, 'speechSynthesis', {
  value: mockSpeechSynthesis,
  writable: true
});

Object.defineProperty(window, 'SpeechSynthesisUtterance', {
  value: mockSpeechSynthesisUtterance,
  writable: true
});

describe('WebSpeechTTS', () => {
  let ttsService: WebSpeechTTS;

  beforeEach(() => {
    vi.clearAllMocks();
    mockSpeechSynthesis.speaking = false;
    mockSpeechSynthesis.paused = false;
    ttsService = new WebSpeechTTS();
  });

  describe('isAvailable', () => {
    it('should return true when speechSynthesis is available', () => {
      expect(ttsService.isAvailable()).toBe(true);
    });

    it('should return false when speechSynthesis is not available', () => {
      // Temporarily remove speechSynthesis
      const originalSpeechSynthesis = (window as any).speechSynthesis;
      delete (window as any).speechSynthesis;
      
      const newTtsService = new WebSpeechTTS();
      expect(newTtsService.isAvailable()).toBe(false);
      
      // Restore speechSynthesis
      (window as any).speechSynthesis = originalSpeechSynthesis;
    });
  });

  describe('synthesizeSpeech', () => {
    it('should successfully synthesize speech with default options', async () => {
      const text = 'Hello, world!';
      
      // Mock successful speech synthesis
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      const result = await ttsService.synthesizeSpeech(text);
      
      expect(result).toBe('Speech synthesis completed');
      expect(mockSpeechSynthesisUtterance).toHaveBeenCalledWith(text);
      expect(mockSpeechSynthesis.speak).toHaveBeenCalled();
    });

    it('should apply custom options to utterance', async () => {
      const text = 'Hello, world!';
      const options = {
        speed: 1.5,
        pitch: 0.8,
        volume: 0.7
      };

      let capturedUtterance: any;
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        capturedUtterance = utterance;
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      await ttsService.synthesizeSpeech(text, options);
      
      expect(capturedUtterance.rate).toBe(options.speed);
      expect(capturedUtterance.pitch).toBe(options.pitch);
      expect(capturedUtterance.volume).toBe(options.volume);
    });

    it('should select voice when specified in options', async () => {
      const text = 'Hello, world!';
      const mockVoices = [
        { name: 'Voice 1', lang: 'en-US' },
        { name: 'Voice 2', lang: 'en-GB' }
      ] as SpeechSynthesisVoice[];
      
      mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);

      let capturedUtterance: any;
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        capturedUtterance = utterance;
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      await ttsService.synthesizeSpeech(text, { voice: 'Voice 2' });
      
      expect(capturedUtterance.voice).toBe(mockVoices[1]);
    });

    it('should handle speech synthesis errors', async () => {
      const text = 'Hello, world!';
      const errorMessage = 'synthesis-failed';

      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onerror) {
            utterance.onerror({ error: errorMessage });
          }
        }, 10);
      });

      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow(
        `Speech synthesis error: ${errorMessage}`
      );
    });

    it('should throw error when speech synthesis is not available', async () => {
      const unavailableTts = new WebSpeechTTS();
      vi.spyOn(unavailableTts, 'isAvailable').mockReturnValue(false);

      await expect(unavailableTts.synthesizeSpeech('test')).rejects.toThrow(
        'Speech synthesis not available'
      );
    });

    it('should stop current speech before starting new synthesis', async () => {
      const text = 'Hello, world!';
      mockSpeechSynthesis.speaking = true;

      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      await ttsService.synthesizeSpeech(text);
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });
  });

  describe('getAvailableVoices', () => {
    it('should return voices when immediately available', async () => {
      const mockVoices = [
        { name: 'Voice 1', lang: 'en-US' },
        { name: 'Voice 2', lang: 'en-GB' }
      ] as SpeechSynthesisVoice[];
      
      mockSpeechSynthesis.getVoices.mockReturnValue(mockVoices);

      const voices = await ttsService.getAvailableVoices();
      
      expect(voices).toEqual(mockVoices);
    });

    it('should wait for voices to load when not immediately available', async () => {
      const mockVoices = [
        { name: 'Voice 1', lang: 'en-US' }
      ] as SpeechSynthesisVoice[];
      
      // First call returns empty array, second call returns voices
      mockSpeechSynthesis.getVoices
        .mockReturnValueOnce([])
        .mockReturnValueOnce(mockVoices);

      const voicesPromise = ttsService.getAvailableVoices();
      
      // Simulate voices loading
      setTimeout(() => {
        if (mockSpeechSynthesis.onvoiceschanged) {
          mockSpeechSynthesis.onvoiceschanged();
        }
      }, 10);

      const voices = await voicesPromise;
      
      expect(voices).toEqual(mockVoices);
    });
  });

  describe('stop', () => {
    it('should cancel speech synthesis when speaking', () => {
      mockSpeechSynthesis.speaking = true;
      
      ttsService.stop();
      
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled();
    });

    it('should not cancel when not speaking', () => {
      mockSpeechSynthesis.speaking = false;
      
      ttsService.stop();
      
      expect(mockSpeechSynthesis.cancel).not.toHaveBeenCalled();
    });
  });

  describe('isSpeaking', () => {
    it('should return true when synthesis is speaking', () => {
      mockSpeechSynthesis.speaking = true;
      
      expect(ttsService.isSpeaking()).toBe(true);
    });

    it('should return false when synthesis is not speaking', () => {
      mockSpeechSynthesis.speaking = false;
      
      expect(ttsService.isSpeaking()).toBe(false);
    });
  });

  describe('isPaused', () => {
    it('should return true when synthesis is paused', () => {
      mockSpeechSynthesis.paused = true;
      
      expect(ttsService.isPaused()).toBe(true);
    });

    it('should return false when synthesis is not paused', () => {
      mockSpeechSynthesis.paused = false;
      
      expect(ttsService.isPaused()).toBe(false);
    });
  });

  describe('pause', () => {
    it('should pause when speaking and not already paused', () => {
      mockSpeechSynthesis.speaking = true;
      mockSpeechSynthesis.paused = false;
      
      ttsService.pause();
      
      expect(mockSpeechSynthesis.pause).toHaveBeenCalled();
    });

    it('should not pause when not speaking', () => {
      mockSpeechSynthesis.speaking = false;
      mockSpeechSynthesis.paused = false;
      
      ttsService.pause();
      
      expect(mockSpeechSynthesis.pause).not.toHaveBeenCalled();
    });

    it('should not pause when already paused', () => {
      mockSpeechSynthesis.speaking = true;
      mockSpeechSynthesis.paused = true;
      
      ttsService.pause();
      
      expect(mockSpeechSynthesis.pause).not.toHaveBeenCalled();
    });
  });

  describe('resume', () => {
    it('should resume when paused', () => {
      mockSpeechSynthesis.paused = true;
      
      ttsService.resume();
      
      expect(mockSpeechSynthesis.resume).toHaveBeenCalled();
    });

    it('should not resume when not paused', () => {
      mockSpeechSynthesis.paused = false;
      
      ttsService.resume();
      
      expect(mockSpeechSynthesis.resume).not.toHaveBeenCalled();
    });
  });
});