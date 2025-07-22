import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhisperASR } from '../WhisperASR';

// Simple test to verify basic functionality
describe('WhisperASR - Basic Functionality', () => {
  let whisperASR: WhisperASR;

  beforeEach(() => {
    // Set a mock API key for testing
    process.env.OPENAI_API_KEY = 'test-api-key';
    whisperASR = new WhisperASR();
  });

  it('should initialize correctly with API key', () => {
    expect(whisperASR).toBeDefined();
    expect(whisperASR.isAvailable()).toBe(true);
  });

  it('should throw error for empty audio buffer', async () => {
    const emptyBuffer = Buffer.alloc(0);
    
    await expect(whisperASR.transcribeAudio(emptyBuffer)).rejects.toThrow();
  });

  it('should throw error for oversized audio buffer', async () => {
    const largeBuffer = Buffer.alloc(26 * 1024 * 1024); // 26MB
    
    await expect(whisperASR.transcribeAudio(largeBuffer)).rejects.toThrow();
  });

  it('should have configuration methods', () => {
    expect(() => whisperASR.configureRetries(5, 2000)).not.toThrow();
    expect(() => whisperASR.setModel('whisper-1')).not.toThrow();
  });
});