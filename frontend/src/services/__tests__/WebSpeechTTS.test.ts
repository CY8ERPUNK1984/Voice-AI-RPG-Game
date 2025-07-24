import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
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

// Store original values for cleanup
let originalSpeechSynthesis: any;
let originalSpeechSynthesisUtterance: any;

// Helper function to setup Web Speech API mocks
function setupWebSpeechAPIMocks() {
  Object.defineProperty(window, 'speechSynthesis', {
    value: mockSpeechSynthesis,
    writable: true,
    configurable: true
  });

  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: mockSpeechSynthesisUtterance,
    writable: true,
    configurable: true
  });
}

// Helper function to remove Web Speech API mocks
function removeWebSpeechAPIMocks() {
  Object.defineProperty(window, 'speechSynthesis', {
    value: undefined,
    writable: true,
    configurable: true
  });

  Object.defineProperty(window, 'SpeechSynthesisUtterance', {
    value: undefined,
    writable: true,
    configurable: true
  });
}

describe('WebSpeechTTS', () => {
  let ttsService: WebSpeechTTS;

  beforeEach(() => {
    // Store original values
    originalSpeechSynthesis = (window as any).speechSynthesis;
    originalSpeechSynthesisUtterance = (window as any).SpeechSynthesisUtterance;
    
    // Setup mocks
    setupWebSpeechAPIMocks();
    
    vi.clearAllMocks();
    mockSpeechSynthesis.speaking = false;
    mockSpeechSynthesis.paused = false;
    ttsService = new WebSpeechTTS();
  });

  afterEach(() => {
    // Restore original values
    if (originalSpeechSynthesis !== undefined) {
      Object.defineProperty(window, 'speechSynthesis', {
        value: originalSpeechSynthesis,
        writable: true,
        configurable: true
      });
    }
    
    if (originalSpeechSynthesisUtterance !== undefined) {
      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: originalSpeechSynthesisUtterance,
        writable: true,
        configurable: true
      });
    }
  });

  describe('isAvailable', () => {
    it('should return true when speechSynthesis is available', () => {
      expect(ttsService.isAvailable()).toBe(true);
    });

    it('should return false when speechSynthesis is not available', () => {
      // Remove speechSynthesis using proper mock cleanup
      removeWebSpeechAPIMocks();
      
      const newTtsService = new WebSpeechTTS();
      expect(newTtsService.isAvailable()).toBe(false);
      
      // Restore mocks for other tests
      setupWebSpeechAPIMocks();
    });

    it('should return false when speechSynthesis is null', () => {
      Object.defineProperty(window, 'speechSynthesis', {
        value: null,
        writable: true,
        configurable: true
      });
      
      const newTtsService = new WebSpeechTTS();
      expect(newTtsService.isAvailable()).toBe(false);
      
      // Restore mocks
      setupWebSpeechAPIMocks();
    });

    it('should handle feature detection in different browser environments', () => {
      // Test Chrome-like environment
      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeechSynthesis,
        writable: true,
        configurable: true
      });
      expect(new WebSpeechTTS().isAvailable()).toBe(true);

      // Test environment without Web Speech API
      Object.defineProperty(window, 'speechSynthesis', {
        value: undefined,
        writable: true,
        configurable: true
      });
      expect(new WebSpeechTTS().isAvailable()).toBe(false);

      // Restore mocks
      setupWebSpeechAPIMocks();
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

  describe('fallback mechanism testing', () => {
    it('should handle graceful degradation when synthesis fails', async () => {
      const text = 'Test fallback';
      
      // Mock synthesis failure
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onerror) {
            utterance.onerror({ error: 'synthesis-unavailable' });
          }
        }, 10);
      });

      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow(
        'Speech synthesis error: synthesis-unavailable'
      );
    });

    it('should handle network-related synthesis failures', async () => {
      const text = 'Network test';
      
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onerror) {
            utterance.onerror({ error: 'network' });
          }
        }, 10);
      });

      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow(
        'Speech synthesis error: network'
      );
    });

    it('should handle voice loading failures gracefully', async () => {
      const text = 'Voice loading test';
      
      // Mock getVoices to return empty array (voices not loaded)
      mockSpeechSynthesis.getVoices.mockReturnValue([]);
      
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      // Should still work even without voices loaded
      const result = await ttsService.synthesizeSpeech(text, { voice: 'NonExistentVoice' });
      expect(result).toBe('Speech synthesis completed');
    });

    it('should handle browser compatibility issues', async () => {
      // Test with minimal speechSynthesis implementation
      const minimalSynthesis = {
        speak: vi.fn(),
        cancel: vi.fn(),
        getVoices: vi.fn().mockReturnValue([]),
        speaking: false,
        paused: false
      };

      Object.defineProperty(window, 'speechSynthesis', {
        value: minimalSynthesis,
        writable: true,
        configurable: true
      });

      const compatTtsService = new WebSpeechTTS();
      expect(compatTtsService.isAvailable()).toBe(true);

      // Restore mocks
      setupWebSpeechAPIMocks();
    });
  });

  describe('service availability detection', () => {
    it('should detect service availability in different environments', () => {
      // Test modern browser environment
      const modernSynthesis = {
        ...mockSpeechSynthesis,
        getVoices: vi.fn().mockReturnValue([
          { name: 'Voice 1', lang: 'en-US' },
          { name: 'Voice 2', lang: 'en-GB' }
        ])
      };

      Object.defineProperty(window, 'speechSynthesis', {
        value: modernSynthesis,
        writable: true,
        configurable: true
      });

      const modernTts = new WebSpeechTTS();
      expect(modernTts.isAvailable()).toBe(true);

      // Test legacy browser environment (no speechSynthesis)
      removeWebSpeechAPIMocks();
      const legacyTts = new WebSpeechTTS();
      expect(legacyTts.isAvailable()).toBe(false);

      // Restore mocks
      setupWebSpeechAPIMocks();
    });

    it('should handle partial Web Speech API implementations', () => {
      // Test environment with speechSynthesis but no SpeechSynthesisUtterance
      Object.defineProperty(window, 'speechSynthesis', {
        value: mockSpeechSynthesis,
        writable: true,
        configurable: true
      });

      Object.defineProperty(window, 'SpeechSynthesisUtterance', {
        value: undefined,
        writable: true,
        configurable: true
      });

      // Service should still be considered available if speechSynthesis exists
      const partialTts = new WebSpeechTTS();
      expect(partialTts.isAvailable()).toBe(true);

      // Restore mocks
      setupWebSpeechAPIMocks();
    });

    it('should validate service health before synthesis', async () => {
      const text = 'Health check test';
      
      // Mock healthy service
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      expect(ttsService.isAvailable()).toBe(true);
      const result = await ttsService.synthesizeSpeech(text);
      expect(result).toBe('Speech synthesis completed');
    });

    it('should handle service unavailability during runtime', async () => {
      const text = 'Runtime unavailability test';
      
      // Initially available
      expect(ttsService.isAvailable()).toBe(true);
      
      // Simulate service becoming unavailable
      Object.defineProperty(window, 'speechSynthesis', {
        value: null,
        writable: true,
        configurable: true
      });

      // Create new instance to test runtime availability
      const runtimeTts = new WebSpeechTTS();
      expect(runtimeTts.isAvailable()).toBe(false);
      
      await expect(runtimeTts.synthesizeSpeech(text)).rejects.toThrow(
        'Speech synthesis not available'
      );

      // Restore mocks
      setupWebSpeechAPIMocks();
    });

    it('should provide detailed availability information', () => {
      // Test with full feature support
      expect(ttsService.isAvailable()).toBe(true);
      expect(typeof ttsService.getAvailableVoices).toBe('function');
      expect(typeof ttsService.synthesizeSpeech).toBe('function');
      expect(typeof ttsService.stop).toBe('function');
      expect(typeof ttsService.pause).toBe('function');
      expect(typeof ttsService.resume).toBe('function');
      expect(typeof ttsService.isSpeaking).toBe('function');
      expect(typeof ttsService.isPaused).toBe('function');
    });
  });

  describe('error recovery and resilience', () => {
    it('should recover from temporary synthesis failures', async () => {
      const text = 'Recovery test';
      let callCount = 0;
      
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        callCount++;
        setTimeout(() => {
          if (callCount === 1) {
            // First call fails
            if (utterance.onerror) {
              utterance.onerror({ error: 'temporary-failure' });
            }
          } else {
            // Second call succeeds
            if (utterance.onend) {
              utterance.onend();
            }
          }
        }, 10);
      });

      // First attempt should fail
      await expect(ttsService.synthesizeSpeech(text)).rejects.toThrow(
        'Speech synthesis error: temporary-failure'
      );

      // Second attempt should succeed
      const result = await ttsService.synthesizeSpeech(text);
      expect(result).toBe('Speech synthesis completed');
    });

    it('should handle concurrent synthesis requests gracefully', async () => {
      const text1 = 'First request';
      const text2 = 'Second request';
      
      mockSpeechSynthesis.speaking = true; // Simulate ongoing speech
      
      mockSpeechSynthesis.speak.mockImplementation((utterance: any) => {
        setTimeout(() => {
          if (utterance.onend) {
            utterance.onend();
          }
        }, 10);
      });

      // Start first request
      const promise1 = ttsService.synthesizeSpeech(text1);
      
      // Start second request while first is still processing
      const promise2 = ttsService.synthesizeSpeech(text2);

      const results = await Promise.all([promise1, promise2]);
      
      expect(results[0]).toBe('Speech synthesis completed');
      expect(results[1]).toBe('Speech synthesis completed');
      expect(mockSpeechSynthesis.cancel).toHaveBeenCalled(); // Should cancel previous speech
    });
  });
});