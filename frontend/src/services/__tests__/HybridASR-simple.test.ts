import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HybridASR } from '../HybridASR';

// Simple test to verify basic functionality
describe('HybridASR - Basic Functionality', () => {
  let hybridASR: HybridASR;

  beforeEach(() => {
    // Mock basic browser APIs
    Object.defineProperty(window, 'SpeechRecognition', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        abort: vi.fn(),
        continuous: false,
        interimResults: false,
        lang: 'ru-RU',
        maxAlternatives: 1,
        onresult: null,
        onerror: null,
        onstart: null,
        onend: null,
      }))
    });

    Object.defineProperty(window, 'MediaRecorder', {
      writable: true,
      value: vi.fn().mockImplementation(() => ({
        start: vi.fn(),
        stop: vi.fn(),
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
      }))
    });

    (window.MediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

    hybridASR = new HybridASR();
  });

  it('should initialize correctly', () => {
    expect(hybridASR).toBeDefined();
  });

  it('should detect available methods', () => {
    const methods = hybridASR.getAvailableMethods();
    expect(methods).toHaveProperty('webSpeech');
    expect(methods).toHaveProperty('whisper');
  });

  it('should return recording state', () => {
    expect(hybridASR.getRecordingState()).toBe(false);
  });

  it('should handle empty audio blob', async () => {
    const emptyBlob = new Blob([], { type: 'audio/webm' });
    
    await expect(hybridASR.transcribeAudio(emptyBlob)).rejects.toThrow(
      'Audio blob is empty'
    );
  });
});