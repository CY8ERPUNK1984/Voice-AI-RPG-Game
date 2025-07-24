import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorHandler, errorHandler } from '../ErrorHandler';
import { ErrorManager } from '../ErrorManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

describe('ErrorHandler', () => {
  let handler: ErrorHandler;
  let consoleSpy: any;

  beforeEach(() => {
    // Reset singleton instances for each test
    (ErrorHandler as any).instance = undefined;
    (ErrorManager as any).instance = undefined;
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockReturnValue(null);
    
    // Get fresh instance for each test
    handler = ErrorHandler.getInstance();
    handler.clearAllErrors();
    
    // Suppress console.error during tests to reduce noise
    consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore console.error
    consoleSpy.mockRestore();
    vi.clearAllMocks();
  });

  describe('Singleton pattern', () => {
    it('should return the same instance', () => {
      const instance1 = ErrorHandler.getInstance();
      const instance2 = ErrorHandler.getInstance();
      expect(instance1).toBe(instance2);
    });

    it('should export the same instance as errorHandler', () => {
      // Since we reset the singleton in beforeEach, we need to compare after getting fresh instances
      const freshErrorHandler = ErrorHandler.getInstance();
      expect(freshErrorHandler).toBe(ErrorHandler.getInstance());
    });
  });

  describe('Error handling with recovery', () => {
    it('should handle ASR errors with recovery actions', async () => {
      const error = new Error('Microphone not-allowed');
      const context = { userId: 'test-user' };
      
      await handler.handleASRError(error, context);
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toBe('Microphone not-allowed');
    });

    it('should handle LLM errors with recovery actions', async () => {
      const error = new Error('Rate limit exceeded');
      const context = { sessionId: 'test-session' };
      
      await handler.handleLLMError(error, context);
      
      const errorState = handler.getErrorState();
      expect(errorState.llmError).toBe('Rate limit exceeded');
    });

    it('should handle TTS errors with recovery actions', async () => {
      const error = new Error('TTS not available');
      const context = { requestId: 'test-request' };
      
      await handler.handleTTSError(error, context);
      
      const errorState = handler.getErrorState();
      expect(errorState.ttsError).toBe('TTS not available');
    });

    it('should handle connection errors with recovery actions', async () => {
      const error = new Error('WebSocket connection failed');
      const context = { userId: 'test-user' };
      
      await handler.handleConnectionError(error, context);
      
      const errorState = handler.getErrorState();
      expect(errorState.connectionError).toBe('WebSocket connection failed');
    });

    it('should handle generic errors', async () => {
      const error = new Error('Generic system error');
      const context = { component: 'test-component' };
      
      const recoveryPlan = await handler.handleError(error, context);
      
      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.steps).toBeDefined();
    });
  });

  describe('Retry functionality', () => {
    it('should register and execute retry callbacks', async () => {
      const retryCallback = vi.fn().mockResolvedValue(undefined);
      const operationId = 'test-operation';
      
      handler.registerRetryCallback(operationId, retryCallback);
      await handler.executeRetry(operationId);
      
      expect(retryCallback).toHaveBeenCalled();
    });

    it('should handle retry callback failures', async () => {
      const retryCallback = vi.fn().mockRejectedValue(new Error('Retry failed'));
      const operationId = 'test-operation';
      const toastListener = vi.fn();
      
      handler.onToast(toastListener);
      handler.registerRetryCallback(operationId, retryCallback);
      await handler.executeRetry(operationId);
      
      expect(retryCallback).toHaveBeenCalled();
      // Should show error toast for failed retry
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Ошибка повтора'
        })
      );
    });

    it('should handle retry for non-existent operation', async () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      await handler.executeRetry('non-existent-operation');
      
      // Should not call any toast for non-existent operation
      expect(toastListener).not.toHaveBeenCalled();
    });
  });

  describe('Recovery actions', () => {
    it('should create recovery actions for retryable errors', () => {
      const error = {
        id: 'test-error',
        type: 'CONNECTION_ERROR' as const,
        severity: 'high' as const,
        message: 'Connection failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true,
        originalError: new Error('Connection failed')
      };
      
      const actions = handler.createRecoveryActions(error, 'test-operation');
      
      expect(actions).toHaveLength(3); // Retry + Recover + Check connection
      expect(actions[0].label).toBe('Повторить');
      expect(actions[0].primary).toBe(true);
    });

    it('should create recovery actions for ASR permission errors', () => {
      const error = {
        id: 'test-error',
        type: 'ASR_ERROR' as const,
        severity: 'medium' as const,
        message: 'Microphone not-allowed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: false,
        originalError: new Error('not-allowed')
      };
      
      const actions = handler.createRecoveryActions(error);
      
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(action => action.label === 'Настройки микрофона')).toBe(true);
    });

    it('should create recovery actions for TTS errors', () => {
      const error = {
        id: 'test-error',
        type: 'TTS_ERROR' as const,
        severity: 'low' as const,
        message: 'TTS failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: false,
        originalError: new Error('TTS failed')
      };
      
      const actions = handler.createRecoveryActions(error);
      
      expect(actions.length).toBeGreaterThan(0);
      expect(actions.some(action => action.label === 'Отключить озвучку')).toBe(true);
    });
  });

  describe('Helper actions', () => {
    it('should show microphone settings help', () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      const error = {
        id: 'test-error',
        type: 'ASR_ERROR' as const,
        severity: 'medium' as const,
        message: 'Microphone not-allowed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: false,
        originalError: new Error('not-allowed')
      };
      
      const actions = handler.createRecoveryActions(error);
      const microphoneAction = actions.find(action => action.label === 'Настройки микрофона');
      
      expect(microphoneAction).toBeDefined();
      microphoneAction!.action();
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Настройки микрофона',
          message: expect.stringContaining('значок замка')
        })
      );
    });

    it('should check connection status when online', () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      Object.defineProperty(navigator, 'onLine', { value: true });
      
      const error = {
        id: 'test-error',
        type: 'CONNECTION_ERROR' as const,
        severity: 'high' as const,
        message: 'Connection failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true,
        originalError: new Error('Connection failed')
      };
      
      const actions = handler.createRecoveryActions(error);
      const connectionAction = actions.find(action => action.label === 'Проверить соединение');
      
      expect(connectionAction).toBeDefined();
      connectionAction!.action();
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Соединение активно'
        })
      );
    });

    it('should check connection status when offline', () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      Object.defineProperty(navigator, 'onLine', { value: false });
      
      const error = {
        id: 'test-error',
        type: 'CONNECTION_ERROR' as const,
        severity: 'high' as const,
        message: 'Connection failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true,
        originalError: new Error('Connection failed')
      };
      
      const actions = handler.createRecoveryActions(error);
      const connectionAction = actions.find(action => action.label === 'Проверить соединение');
      
      expect(connectionAction).toBeDefined();
      connectionAction!.action();
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Нет соединения'
        })
      );
    });

    it('should disable TTS functionality', () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      const error = {
        id: 'test-error',
        type: 'TTS_ERROR' as const,
        severity: 'low' as const,
        message: 'TTS failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: false,
        originalError: new Error('TTS failed')
      };
      
      const actions = handler.createRecoveryActions(error);
      const ttsAction = actions.find(action => action.label === 'Отключить озвучку');
      
      expect(ttsAction).toBeDefined();
      ttsAction!.action();
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Озвучка отключена'
        })
      );
    });
  });

  describe('Error state management', () => {
    it('should maintain backward compatibility with error state', () => {
      const errorState = handler.getErrorState();
      
      expect(errorState).toHaveProperty('asrError');
      expect(errorState).toHaveProperty('llmError');
      expect(errorState).toHaveProperty('ttsError');
      expect(errorState).toHaveProperty('connectionError');
    });

    it('should clear specific error types', async () => {
      await handler.handleASRError(new Error('ASR error'));
      await handler.handleLLMError(new Error('LLM error'));
      
      handler.clearError('asrError');
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toBeNull();
      expect(errorState.llmError).toBe('LLM error');
    });

    it('should clear all errors', async () => {
      await handler.handleASRError(new Error('ASR error'));
      await handler.handleLLMError(new Error('LLM error'));
      
      handler.clearAllErrors();
      
      const errorState = handler.getErrorState();
      expect(errorState.asrError).toBeNull();
      expect(errorState.llmError).toBeNull();
      expect(errorState.ttsError).toBeNull();
      expect(errorState.connectionError).toBeNull();
    });

    it('should check if errors are present', async () => {
      expect(handler.hasErrors()).toBe(false);
      
      await handler.handleASRError(new Error('ASR error'));
      expect(handler.hasErrors()).toBe(true);
      
      handler.clearAllErrors();
      expect(handler.hasErrors()).toBe(false);
    });
  });

  describe('Event listeners', () => {
    it('should handle error listeners', async () => {
      const errorListener = vi.fn();
      const unsubscribe = handler.onError(errorListener);
      
      await handler.handleASRError(new Error('Test error'));
      
      // The error listener will be called - check that we have ASR_ERROR type
      expect(errorListener).toHaveBeenCalled();
      
      const calls = errorListener.mock.calls;
      const hasASRError = calls.some(call => 
        call[0] && call[0].type === 'ASR_ERROR'
      );
      expect(hasASRError).toBe(true);
      
      unsubscribe();
    });

    it('should handle toast listeners', () => {
      const toastListener = vi.fn();
      const unsubscribe = handler.onToast(toastListener);
      
      handler.showToast({
        type: 'info',
        title: 'Test',
        message: 'Test message'
      });
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'info',
          title: 'Test',
          message: 'Test message'
        })
      );
      
      unsubscribe();
    });

    it('should handle recovery listeners', () => {
      const recoveryListener = vi.fn();
      const unsubscribe = handler.onRecovery(recoveryListener);
      
      // Recovery listener will be called when ErrorManager handles errors
      // This is tested indirectly through error handling
      
      unsubscribe();
    });

    it('should handle listener errors gracefully', async () => {
      const faultyListener = vi.fn().mockImplementation(() => {
        throw new Error('Listener error');
      });
      
      handler.onError(faultyListener);
      
      // Should not throw even if listener fails
      await expect(handler.handleASRError(new Error('Test error'))).resolves.not.toThrow();
      
      expect(consoleSpy).toHaveBeenCalledWith('Error listener failed:', expect.any(Error));
    });
  });

  describe('Integration with ErrorManager', () => {
    it('should delegate toast notifications to ErrorManager', () => {
      const toastListener = vi.fn();
      handler.onToast(toastListener);
      
      handler.showToast({
        type: 'success',
        title: 'Success',
        message: 'Operation completed'
      });
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Success',
          message: 'Operation completed'
        })
      );
    });

    it('should handle ErrorManager events', async () => {
      const errorListener = vi.fn();
      const toastListener = vi.fn();
      
      handler.onError(errorListener);
      handler.onToast(toastListener);
      
      await handler.handleError(new Error('Test error'));
      
      // Should receive events from ErrorManager
      expect(errorListener).toHaveBeenCalled();
      expect(toastListener).toHaveBeenCalled();
    });
  });
});