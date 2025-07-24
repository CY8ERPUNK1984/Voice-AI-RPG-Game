import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ErrorManager, ErrorType, ErrorSeverity, AppError, ErrorHandler, ToastNotification } from '../ErrorManager';

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock });

describe('ErrorManager', () => {
  let errorManager: ErrorManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ErrorManager as any).instance = undefined;
    localStorageMock.getItem.mockClear();
    localStorageMock.setItem.mockClear();
    localStorageMock.getItem.mockReturnValue(null); // Return null by default
    errorManager = ErrorManager.getInstance();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const instance1 = ErrorManager.getInstance();
      const instance2 = ErrorManager.getInstance();
      expect(instance1).toBe(instance2);
    });
  });

  describe('handleError', () => {
    it('should handle basic Error object', async () => {
      const error = new Error('Test error');
      const recoveryPlan = await errorManager.handleError(error);
      
      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.steps).toHaveLength(2);
      expect(recoveryPlan.userAction).toContain('неожиданная ошибка');
    });

    it('should handle AppError object', async () => {
      const appError: AppError = {
        id: 'test-error',
        type: 'CONNECTION_ERROR',
        severity: 'high',
        message: 'WebSocket connection failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const recoveryPlan = await errorManager.handleError(appError);
      
      expect(recoveryPlan).toBeDefined();
      expect(recoveryPlan.steps.length).toBeGreaterThan(0);
    });

    it('should notify error listeners', async () => {
      const errorListener = vi.fn();
      const unsubscribe = errorManager.onError(errorListener);
      
      const error = new Error('Test error');
      await errorManager.handleError(error);
      
      expect(errorListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SYSTEM_ERROR',
          message: 'Test error'
        })
      );
      
      unsubscribe();
    });

    it('should notify toast listeners', async () => {
      const toastListener = vi.fn();
      const unsubscribe = errorManager.onToast(toastListener);
      
      const error = new Error('Test error');
      await errorManager.handleError(error);
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'error',
          title: 'Системная ошибка'
        })
      );
      
      unsubscribe();
    });
  });

  describe('error classification', () => {
    it('should classify connection errors', async () => {
      const error = new Error('WebSocket connection lost');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('CONNECTION_ERROR');
      expect(errors[0].severity).toBe('high');
    });

    it('should classify ASR errors', async () => {
      const error = new Error('Speech recognition failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('ASR_ERROR');
      expect(errors[0].severity).toBe('medium');
    });

    it('should classify TTS errors', async () => {
      const error = new Error('TTS synthesis failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('TTS_ERROR');
      expect(errors[0].severity).toBe('low');
    });

    it('should classify LLM errors', async () => {
      const error = new Error('OpenAI request failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('LLM_ERROR');
      expect(errors[0].severity).toBe('high');
    });

    it('should classify rate limit errors', async () => {
      const error = new Error('Rate limit exceeded');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('RATE_LIMIT_ERROR');
      expect(errors[0].severity).toBe('medium');
    });
  });

  describe('localized messages', () => {
    it('should provide Russian error messages for ASR errors', () => {
      const error: AppError = {
        id: 'test',
        type: 'ASR_ERROR',
        severity: 'medium',
        message: 'not-allowed',
        originalError: new Error('not-allowed'),
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const message = errorManager.getLocalizedMessage(error);
      expect(message).toContain('микрофону запрещен');
    });

    it('should provide Russian error messages for LLM errors', () => {
      const error: AppError = {
        id: 'test',
        type: 'LLM_ERROR',
        severity: 'high',
        message: 'rate limit',
        originalError: new Error('rate limit'),
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const message = errorManager.getLocalizedMessage(error);
      expect(message).toContain('Слишком много запросов');
    });

    it('should provide Russian error messages for TTS errors', () => {
      const error: AppError = {
        id: 'test',
        type: 'TTS_ERROR',
        severity: 'low',
        message: 'not available',
        originalError: new Error('not available'),
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const message = errorManager.getLocalizedMessage(error);
      expect(message).toContain('Синтез речи недоступен');
    });

    it('should provide Russian error messages for connection errors', () => {
      const error: AppError = {
        id: 'test',
        type: 'CONNECTION_ERROR',
        severity: 'high',
        message: 'WebSocket connection failed',
        originalError: new Error('WebSocket connection failed'),
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const message = errorManager.getLocalizedMessage(error);
      expect(message).toContain('игровым сервером');
    });

    it('should provide default message for unknown error patterns', () => {
      const error: AppError = {
        id: 'test',
        type: 'SYSTEM_ERROR',
        severity: 'critical',
        message: 'unknown error pattern',
        originalError: new Error('unknown error pattern'),
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: true
      };

      const message = errorManager.getLocalizedMessage(error);
      expect(message).toContain('системная ошибка');
    });
  });

  describe('toast notifications', () => {
    it('should show toast with retry action for retryable errors', async () => {
      const toastListener = vi.fn();
      errorManager.onToast(toastListener);
      
      const error = new Error('Connection timeout');
      await errorManager.handleError(error);
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              label: 'Повторить',
              primary: true
            })
          ])
        })
      );
    });

    it('should show toast with recovery action for recoverable non-retryable errors', async () => {
      const toastListener = vi.fn();
      errorManager.onToast(toastListener);
      
      // Create a recoverable but non-retryable error
      const appError: AppError = {
        id: 'test',
        type: 'TTS_ERROR',
        severity: 'low',
        message: 'TTS failed',
        context: {},
        timestamp: new Date(),
        recoverable: true,
        retryable: false
      };
      
      await errorManager.handleError(appError);
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          actions: expect.arrayContaining([
            expect.objectContaining({
              label: 'Восстановить'
            })
          ])
        })
      );
    });

    it('should show manual toast notifications', () => {
      const toastListener = vi.fn();
      errorManager.onToast(toastListener);
      
      errorManager.showToast({
        type: 'success',
        title: 'Успех',
        message: 'Операция выполнена успешно'
      });
      
      expect(toastListener).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'success',
          title: 'Успех',
          message: 'Операция выполнена успешно',
          duration: 3000
        })
      );
    });
  });

  describe('error handlers', () => {
    it('should register and use custom error handlers', async () => {
      const mockHandler: ErrorHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue({
          steps: [{ action: 'custom_action', description: 'Custom recovery', autoExecute: true, priority: 1 }],
          autoExecute: true
        }),
        priority: 10
      };

      errorManager.registerErrorHandler('SYSTEM_ERROR', mockHandler);
      
      const error = new Error('System failure');
      const plan = await errorManager.handleError(error);
      
      expect(mockHandler.canHandle).toHaveBeenCalled();
      expect(mockHandler.handle).toHaveBeenCalled();
      expect(plan.steps[0].action).toBe('custom_action');
    });

    it('should prioritize handlers correctly', async () => {
      const lowPriorityHandler: ErrorHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue({
          steps: [{ action: 'low_priority', description: 'Low priority', autoExecute: true, priority: 1 }],
          autoExecute: true
        }),
        priority: 1
      };

      const highPriorityHandler: ErrorHandler = {
        canHandle: vi.fn().mockReturnValue(true),
        handle: vi.fn().mockResolvedValue({
          steps: [{ action: 'high_priority', description: 'High priority', autoExecute: true, priority: 1 }],
          autoExecute: true
        }),
        priority: 10
      };

      errorManager.registerErrorHandler('SYSTEM_ERROR', lowPriorityHandler);
      errorManager.registerErrorHandler('SYSTEM_ERROR', highPriorityHandler);
      
      const error = new Error('System failure');
      const plan = await errorManager.handleError(error);
      
      expect(highPriorityHandler.handle).toHaveBeenCalled();
      expect(lowPriorityHandler.handle).not.toHaveBeenCalled();
      expect(plan.steps[0].action).toBe('high_priority');
    });
  });

  describe('persistence', () => {
    it('should persist errors to localStorage', async () => {
      const error = new Error('Test error');
      await errorManager.handleError(error);
      
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'voice-ai-rpg-errors',
        expect.stringContaining('Test error')
      );
    });

    it('should load persisted errors on initialization', () => {
      const mockErrors = JSON.stringify([
        {
          id: 'test-error',
          type: 'SYSTEM_ERROR',
          severity: 'medium',
          message: 'Persisted error',
          context: {},
          timestamp: new Date().toISOString(),
          recoverable: true,
          retryable: false
        }
      ]);
      
      localStorageMock.getItem.mockReturnValue(mockErrors);
      
      // Create new instance to trigger loading
      (ErrorManager as any).instance = undefined;
      const newErrorManager = ErrorManager.getInstance();
      
      const errors = newErrorManager.getErrorState();
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toBe('Persisted error');
    });

    it('should handle localStorage errors gracefully', async () => {
      localStorageMock.setItem.mockImplementation(() => {
        throw new Error('Storage quota exceeded');
      });
      
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      const error = new Error('Test error');
      await errorManager.handleError(error);
      
      expect(consoleSpy).toHaveBeenCalledWith('Failed to persist errors:', expect.any(Error));
      
      consoleSpy.mockRestore();
    });
  });

  describe('metrics', () => {
    it('should track error metrics', async () => {
      await errorManager.handleError(new Error('Connection error'));
      await errorManager.handleError(new Error('LLM error'));
      await errorManager.handleError(new Error('TTS error'));
      
      const metrics = errorManager.getMetrics();
      expect(metrics.totalErrors).toBe(3);
      expect(metrics.errorsByType['CONNECTION_ERROR']).toBe(1);
      expect(metrics.errorsByType['LLM_ERROR']).toBe(1);
      expect(metrics.errorsByType['TTS_ERROR']).toBe(1);
    });

    it('should track severity metrics', async () => {
      await errorManager.handleError(new Error('Authentication failed')); // critical
      await errorManager.handleError(new Error('Connection lost')); // high
      await errorManager.handleError(new Error('TTS failed')); // low
      
      const metrics = errorManager.getMetrics();
      expect(metrics.errorsBySeverity['critical']).toBe(1);
      expect(metrics.errorsBySeverity['high']).toBe(1);
      expect(metrics.errorsBySeverity['low']).toBe(1);
    });
  });

  describe('error state management', () => {
    it('should maintain error log', async () => {
      // Clear any existing errors first
      errorManager.clearErrors();
      
      await errorManager.handleError(new Error('Test error 1'));
      await errorManager.handleError(new Error('Test error 2'));
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Test error 1');
      expect(errors[1].message).toBe('Test error 2');
    });

    it('should clear errors by type', async () => {
      // Clear any existing errors first
      errorManager.clearErrors();
      
      await errorManager.handleError(new Error('Connection error'));
      await errorManager.handleError(new Error('LLM error'));
      
      errorManager.clearErrors('CONNECTION_ERROR');
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('LLM_ERROR');
    });

    it('should clear all errors', async () => {
      // Clear any existing errors first
      errorManager.clearErrors();
      
      await errorManager.handleError(new Error('Error 1'));
      await errorManager.handleError(new Error('Error 2'));
      
      errorManager.clearErrors();
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(0);
    });
  });

  describe('recovery plan execution', () => {
    it('should notify recovery listeners', async () => {
      const recoveryListener = vi.fn();
      errorManager.onRecovery(recoveryListener);
      
      const error = new Error('Connection error');
      await errorManager.handleError(error);
      
      expect(recoveryListener).toHaveBeenCalledWith(
        expect.objectContaining({
          steps: expect.any(Array),
          autoExecute: expect.any(Boolean)
        })
      );
    });
  });
});