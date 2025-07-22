import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorHandler, errorHandler } from '../ErrorHandler';

describe('ErrorHandler', () => {
  let handler: ErrorHandler;

  beforeEach(() => {
    // Get fresh instance for each test
    handler = ErrorHandler.getInstance();
    handler.clearAllErrors();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export the same instance as errorHandler', () => {
      expect(errorHandler).toBe(ErrorHandler.getInstance());
    });
  });

  describe('ASR Error Handling', () => {
    it('should handle microphone permission error', () => {
      const error = new Error('not-allowed');
      handler.handleASRError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toContain('Microphone access denied');
    });

    it('should handle no speech detected error', () => {
      const error = new Error('no-speech detected');
      handler.handleASRError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toContain('No speech detected');
    });

    it('should handle network error', () => {
      const error = new Error('network connection failed');
      handler.handleASRError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toContain('Network error during voice recognition');
    });

    it('should handle timeout error', () => {
      const error = new Error('timeout occurred');
      handler.handleASRError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toContain('Voice recognition timed out');
    });

    it('should handle generic ASR error', () => {
      const error = new Error('unknown error');
      handler.handleASRError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toContain('Voice recognition failed');
    });
  });

  describe('LLM Error Handling', () => {
    it('should handle rate limit error', () => {
      const error = new Error('rate limit exceeded');
      handler.handleLLMError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toContain('Too many requests');
    });

    it('should handle network error', () => {
      const error = new Error('fetch failed');
      handler.handleLLMError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toContain('Network error connecting to AI service');
    });

    it('should handle timeout error', () => {
      const error = new Error('timeout');
      handler.handleLLMError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toContain('AI response timed out');
    });

    it('should handle quota error', () => {
      const error = new Error('quota exceeded');
      handler.handleLLMError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toContain('AI service temporarily unavailable');
    });

    it('should handle generic LLM error', () => {
      const error = new Error('unknown error');
      handler.handleLLMError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toContain('Failed to get AI response');
    });
  });

  describe('TTS Error Handling', () => {
    it('should handle unavailable TTS', () => {
      const error = new Error('not available');
      handler.handleTTSError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.ttsError).toContain('Voice synthesis not available');
    });

    it('should handle network error', () => {
      const error = new Error('network failed');
      handler.handleTTSError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.ttsError).toContain('Network error during voice synthesis');
    });

    it('should handle interrupted error', () => {
      const error = new Error('interrupted');
      handler.handleTTSError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.ttsError).toContain('Voice synthesis was interrupted');
    });

    it('should handle generic TTS error', () => {
      const error = new Error('unknown error');
      handler.handleTTSError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.ttsError).toContain('Voice synthesis failed');
    });
  });

  describe('Connection Error Handling', () => {
    it('should handle WebSocket error', () => {
      const error = new Error('WebSocket connection failed');
      handler.handleConnectionError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.connectionError).toContain('Lost connection to game server');
    });

    it('should handle timeout error', () => {
      const error = new Error('timeout');
      handler.handleConnectionError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.connectionError).toContain('Connection timed out');
    });

    it('should handle refused connection', () => {
      const error = new Error('connection refused');
      handler.handleConnectionError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.connectionError).toContain('Cannot connect to game server');
    });

    it('should handle generic connection error', () => {
      const error = new Error('unknown error');
      handler.handleConnectionError(error);
      
      const errorState = handler.getErrorState();
      expect(errorState.connectionError).toContain('Connection error');
    });
  });

  describe('Error State Management', () => {
    it('should clear specific error type', () => {
      const error = new Error('test error');
      handler.handleASRError(error);
      handler.handleLLMError(error);
      
      expect(handler.getErrorState().asrError).not.toBeNull();
      expect(handler.getErrorState().llmError).not.toBeNull();
      
      handler.clearError('asrError');
      
      expect(handler.getErrorState().asrError).toBeNull();
      expect(handler.getErrorState().llmError).not.toBeNull();
    });

    it('should clear all errors', () => {
      const error = new Error('test error');
      handler.handleASRError(error);
      handler.handleLLMError(error);
      handler.handleTTSError(error);
      handler.handleConnectionError(error);
      
      expect(handler.hasErrors()).toBe(true);
      
      handler.clearAllErrors();
      
      expect(handler.hasErrors()).toBe(false);
      expect(handler.getErrorState()).toEqual({
        asrError: null,
        llmError: null,
        ttsError: null,
        connectionError: null,
      });
    });

    it('should detect when errors are present', () => {
      expect(handler.hasErrors()).toBe(false);
      
      handler.handleASRError(new Error('test'));
      expect(handler.hasErrors()).toBe(true);
      
      handler.clearAllErrors();
      expect(handler.hasErrors()).toBe(false);
    });
  });

  describe('Event Listeners', () => {
    it('should notify error listeners', () => {
      const mockCallback = vi.fn();
      const unsubscribe = handler.onError(mockCallback);
      
      const error = new Error('test error');
      handler.handleASRError(error);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ASR_ERROR',
          message: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
      
      unsubscribe();
    });

    it('should notify toast listeners', () => {
      const mockCallback = vi.fn();
      const unsubscribe = handler.onToast(mockCallback);
      
      const error = new Error('test error');
      handler.handleASRError(error);
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: 'error',
          title: 'Voice Recognition Error',
          message: expect.any(String),
          timestamp: expect.any(Date),
        })
      );
      
      unsubscribe();
    });

    it('should unsubscribe listeners correctly', () => {
      const mockCallback = vi.fn();
      const unsubscribe = handler.onError(mockCallback);
      
      unsubscribe();
      
      handler.handleASRError(new Error('test'));
      expect(mockCallback).not.toHaveBeenCalled();
    });
  });

  describe('Toast Notifications', () => {
    it('should create error toast for ASR errors', () => {
      const mockCallback = vi.fn();
      handler.onToast(mockCallback);
      
      handler.handleASRError(new Error('test'));
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Voice Recognition Error',
        })
      );
    });

    it('should create error toast for LLM errors', () => {
      const mockCallback = vi.fn();
      handler.onToast(mockCallback);
      
      handler.handleLLMError(new Error('test'));
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'AI Response Error',
        })
      );
    });

    it('should create warning toast for TTS errors', () => {
      const mockCallback = vi.fn();
      handler.onToast(mockCallback);
      
      handler.handleTTSError(new Error('test'));
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'warning',
          title: 'Voice Synthesis Error',
        })
      );
    });

    it('should create error toast for connection errors', () => {
      const mockCallback = vi.fn();
      handler.onToast(mockCallback);
      
      handler.handleConnectionError(new Error('test'));
      
      expect(mockCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Connection Error',
        })
      );
    });
  });
});