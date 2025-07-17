import { describe, it, expect, vi } from 'vitest';

// Mock Web Speech API
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

Object.defineProperty(window, 'SpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition),
});

Object.defineProperty(window, 'webkitSpeechRecognition', {
  writable: true,
  value: vi.fn(() => mockSpeechRecognition),
});

describe('ASR Integration', () => {
  it('should have Web Speech API available in test environment', () => {
    expect(window.SpeechRecognition || window.webkitSpeechRecognition).toBeDefined();
  });

  it('should be able to create speech recognition instance', () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    expect(recognition).toBeDefined();
    expect(typeof recognition.start).toBe('function');
    expect(typeof recognition.stop).toBe('function');
  });
});