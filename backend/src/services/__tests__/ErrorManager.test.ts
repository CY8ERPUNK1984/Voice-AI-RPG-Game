import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ErrorManager, ErrorType, ErrorSeverity, AppError, ErrorHandler } from '../ErrorManager';

describe('ErrorManager', () => {
  let errorManager: ErrorManager;

  beforeEach(() => {
    // Reset singleton instance for each test
    (ErrorManager as any).instance = undefined;
    errorManager = ErrorManager.getInstance();
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
      expect(recoveryPlan.userAction).toContain('unexpected error');
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
      expect(recoveryPlan.steps).toHaveLength(3);
      expect(recoveryPlan.autoExecute).toBe(true);
    });

    it('should classify errors correctly', async () => {
      const connectionError = new Error('WebSocket connection failed');
      await errorManager.handleError(connectionError);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('CONNECTION_ERROR');
    });

    it('should handle rate limit errors', async () => {
      const rateLimitError = new Error('Rate limit exceeded (429)');
      const recoveryPlan = await errorManager.handleError(rateLimitError);
      
      expect(recoveryPlan.steps).toHaveLength(2);
      expect(recoveryPlan.estimatedTime).toBe(30000);
    });

    it('should handle ASR errors', async () => {
      const asrError = new Error('Microphone not available');
      const recoveryPlan = await errorManager.handleError(asrError);
      
      expect(recoveryPlan.steps).toHaveLength(3);
      expect(recoveryPlan.userAction).toContain('microphone');
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

    it('should classify LLM errors', async () => {
      const error = new Error('OpenAI API request failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('LLM_ERROR');
      expect(errors[0].severity).toBe('high');
    });

    it('should classify TTS errors', async () => {
      const error = new Error('TTS synthesis failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('TTS_ERROR');
      expect(errors[0].severity).toBe('low');
    });

    it('should classify authentication errors', async () => {
      const error = new Error('Unauthorized access');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].type).toBe('AUTHENTICATION_ERROR');
      expect(errors[0].severity).toBe('critical');
    });
  });

  describe('error recovery', () => {
    it('should mark connection errors as recoverable and retryable', async () => {
      const error = new Error('Connection timeout');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].recoverable).toBe(true);
      expect(errors[0].retryable).toBe(true);
    });

    it('should mark authentication errors as non-recoverable', async () => {
      const error = new Error('Authentication failed');
      await errorManager.handleError(error);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].recoverable).toBe(false);
      expect(errors[0].retryable).toBe(false);
    });

    it('should create appropriate recovery plans', async () => {
      const connectionError = new Error('WebSocket disconnected');
      const plan = await errorManager.handleError(connectionError);
      
      expect(plan.steps.some(step => step.action === 'retry_connection')).toBe(true);
      expect(plan.steps.some(step => step.action === 'check_network')).toBe(true);
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
      await errorManager.handleError(new Error('Test error 1'));
      await errorManager.handleError(new Error('Test error 2'));
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(2);
      expect(errors[0].message).toBe('Test error 1');
      expect(errors[1].message).toBe('Test error 2');
    });

    it('should clear errors by type', async () => {
      await errorManager.handleError(new Error('Connection error'));
      await errorManager.handleError(new Error('LLM error'));
      
      errorManager.clearErrors('CONNECTION_ERROR');
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(1);
      expect(errors[0].type).toBe('LLM_ERROR');
    });

    it('should clear all errors', async () => {
      await errorManager.handleError(new Error('Error 1'));
      await errorManager.handleError(new Error('Error 2'));
      
      errorManager.clearErrors();
      
      const errors = errorManager.getErrorState();
      expect(errors).toHaveLength(0);
    });
  });

  describe('context handling', () => {
    it('should include context in error objects', async () => {
      const context = {
        userId: 'user123',
        sessionId: 'session456',
        requestId: 'req789'
      };
      
      await errorManager.handleError(new Error('Test error'), context);
      
      const errors = errorManager.getErrorState();
      expect(errors[0].userId).toBe('user123');
      expect(errors[0].sessionId).toBe('session456');
      expect(errors[0].requestId).toBe('req789');
      expect(errors[0].context).toEqual(context);
    });
  });
});