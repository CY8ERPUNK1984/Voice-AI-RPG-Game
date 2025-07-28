import { ErrorState, ErrorResponse, ToastNotification, ToastAction, AppError, RecoveryPlan, Result, ErrorType } from '@/types';
import { errorManager } from './ErrorManager';
import { ErrorHandlingPatterns, safeAsync, withRetry } from '../utils/errorHandling';

// ErrorType is now imported from types

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: ((error: ErrorResponse) => void)[] = [];
  private toastListeners: ((toast: ToastNotification) => void)[] = [];
  private recoveryListeners: ((plan: RecoveryPlan) => void)[] = [];
  private currentErrors: ErrorState = {
    asrError: null,
    llmError: null,
    ttsError: null,
    connectionError: null,
  };
  private retryCallbacks: Map<string, () => Promise<void>> = new Map();

  private constructor() {
    // Subscribe to ErrorManager events
    errorManager.onError(this.handleErrorManagerError.bind(this));
    errorManager.onToast(this.handleErrorManagerToast.bind(this));
    errorManager.onRecovery(this.handleRecoveryPlan.bind(this));
  }

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle ASR (Speech Recognition) errors with consistent patterns
   */
  public async handleASRError(error: Error, context: Record<string, any> = {}): Promise<Result<void, AppError>> {
    return ErrorHandlingPatterns.handleAsync(
      () => this.handleErrorWithRecovery(error, 'ASR_ERROR', context),
      { component: 'ErrorHandler', action: 'handleASRError' }
    );
  }

  /**
   * Handle LLM (Language Model) errors with consistent patterns
   */
  public async handleLLMError(error: Error, context: Record<string, any> = {}): Promise<Result<void, AppError>> {
    return ErrorHandlingPatterns.handleAsync(
      () => this.handleErrorWithRecovery(error, 'LLM_ERROR', context),
      { component: 'ErrorHandler', action: 'handleLLMError' }
    );
  }

  /**
   * Handle TTS (Text-to-Speech) errors with consistent patterns
   */
  public async handleTTSError(error: Error, context: Record<string, any> = {}): Promise<Result<void, AppError>> {
    return ErrorHandlingPatterns.handleAsync(
      () => this.handleErrorWithRecovery(error, 'TTS_ERROR', context),
      { component: 'ErrorHandler', action: 'handleTTSError' }
    );
  }

  /**
   * Handle connection errors with consistent patterns
   */
  public async handleConnectionError(error: Error, context: Record<string, any> = {}): Promise<Result<void, AppError>> {
    return ErrorHandlingPatterns.handleAsync(
      () => this.handleErrorWithRecovery(error, 'CONNECTION_ERROR', context),
      { component: 'ErrorHandler', action: 'handleConnectionError' }
    );
  }

  /**
   * Handle any error with recovery actions
   */
  public async handleError(error: Error, context: Record<string, any> = {}): Promise<RecoveryPlan> {
    return await errorManager.handleError(error, context);
  }

  /**
   * Register retry callback for specific operation
   */
  public registerRetryCallback(operationId: string, callback: () => Promise<void>): void {
    this.retryCallbacks.set(operationId, callback);
  }

  /**
   * Execute retry for specific operation with consistent error handling
   */
  public async executeRetry(operationId: string): Promise<Result<void, AppError>> {
    const callback = this.retryCallbacks.get(operationId);
    if (!callback) {
      return {
        success: false,
        error: {
          id: crypto.randomUUID(),
          type: 'VALIDATION_ERROR',
          severity: 'medium',
          message: `No retry callback found for operation: ${operationId}`,
          context: { operationId },
          timestamp: new Date(),
          recoverable: false,
          retryable: false
        } as AppError
      };
    }

    const result = await withRetry(
      callback,
      {
        maxAttempts: 3,
        baseDelay: 1000,
        errorContext: { component: 'ErrorHandler', action: 'executeRetry', operationId }
      }
    );

    if (result.success) {
      this.showToast({
        type: 'success',
        title: 'Успешно',
        message: 'Операция выполнена успешно после повторной попытки'
      });
    } else {
      this.showToast({
        type: 'error',
        title: 'Ошибка повтора',
        message: 'Не удалось выполнить операцию после повторной попытки'
      });
    }

    return result;
  }

  /**
   * Handle error with recovery actions using consistent patterns
   */
  private async handleErrorWithRecovery(error: Error, type: ErrorType, context: Record<string, any>): Promise<void> {
    const result = await safeAsync(
      async () => {
        // Update legacy error state for backward compatibility
        this.updateLegacyErrorState(type, error.message);
        
        // Use ErrorManager for comprehensive error handling
        const recoveryPlan = await errorManager.handleError(error, context);
        
        // Create legacy ErrorResponse for backward compatibility
        const errorResponse: ErrorResponse = {
          type,
          message: errorManager.getLocalizedMessage(recoveryPlan as any) || error.message,
          details: error,
          timestamp: new Date(),
        };
        
        this.notifyError(errorResponse);
      },
      { component: 'ErrorHandler', action: 'handleErrorWithRecovery', errorType: type }
    );

    if (!result.success) {
      console.error('Failed to handle error with recovery:', result.error);
      // Fallback: still notify about the original error
      this.notifyError({
        type,
        message: error.message,
        details: error,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Update legacy error state for backward compatibility
   */
  private updateLegacyErrorState(type: ErrorType, message: string): void {
    switch (type) {
      case 'ASR_ERROR':
        this.currentErrors.asrError = message;
        break;
      case 'LLM_ERROR':
        this.currentErrors.llmError = message;
        break;
      case 'TTS_ERROR':
        this.currentErrors.ttsError = message;
        break;
      case 'CONNECTION_ERROR':
        this.currentErrors.connectionError = message;
        break;
    }
  }

  /**
   * Clear specific error type
   */
  public clearError(errorType: keyof ErrorState): void {
    this.currentErrors[errorType] = null;
    
    // Also clear from ErrorManager
    const errorTypeMap: Record<keyof ErrorState, ErrorType> = {
      asrError: 'ASR_ERROR',
      llmError: 'LLM_ERROR',
      ttsError: 'TTS_ERROR',
      connectionError: 'CONNECTION_ERROR'
    };
    
    const mappedType = errorTypeMap[errorType];
    if (mappedType) {
      errorManager.clearErrors(mappedType);
    }
  }

  /**
   * Clear all errors
   */
  public clearAllErrors(): void {
    this.currentErrors = {
      asrError: null,
      llmError: null,
      ttsError: null,
      connectionError: null,
    };
    
    // Also clear from ErrorManager
    errorManager.clearErrors();
  }

  /**
   * Get current error state
   */
  public getErrorState(): ErrorState {
    return { ...this.currentErrors };
  }

  /**
   * Check if any errors are present
   */
  public hasErrors(): boolean {
    return Object.values(this.currentErrors).some(error => error !== null);
  }

  /**
   * Subscribe to error notifications
   */
  public onError(callback: (error: ErrorResponse) => void): () => void {
    this.errorListeners.push(callback);
    return () => {
      this.errorListeners = this.errorListeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Subscribe to toast notifications
   */
  public onToast(callback: (toast: ToastNotification) => void): () => void {
    this.toastListeners.push(callback);
    return () => {
      this.toastListeners = this.toastListeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Subscribe to recovery plan notifications
   */
  public onRecovery(callback: (plan: RecoveryPlan) => void): () => void {
    this.recoveryListeners.push(callback);
    return () => {
      this.recoveryListeners = this.recoveryListeners.filter(listener => listener !== callback);
    };
  }

  /**
   * Show toast notification (public method)
   */
  public showToast(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    // Delegate to ErrorManager for consistent toast handling
    errorManager.showToast(toast);
  }

  /**
   * Create recovery actions for toast notifications
   */
  public createRecoveryActions(error: AppError, operationId?: string): ToastAction[] {
    const actions: ToastAction[] = [];

    if (error.retryable && operationId) {
      actions.push({
        label: 'Повторить',
        action: () => this.executeRetry(operationId),
        primary: true
      });
    }

    if (error.recoverable) {
      actions.push({
        label: 'Восстановить',
        action: async () => {
          await this.handleError(error.originalError || new Error(error.message));
        }
      });
    }

    // Add specific recovery actions based on error type
    switch (error.type) {
      case 'ASR_ERROR':
        if (error.message.includes('not-allowed')) {
          actions.push({
            label: 'Настройки микрофона',
            action: () => this.showMicrophoneSettings()
          });
        }
        break;
      case 'CONNECTION_ERROR':
        actions.push({
          label: 'Проверить соединение',
          action: () => this.checkConnection()
        });
        break;
      case 'TTS_ERROR':
        actions.push({
          label: 'Отключить озвучку',
          action: () => this.disableTTS()
        });
        break;
    }

    return actions;
  }

  /**
   * Show microphone settings help
   */
  private showMicrophoneSettings(): void {
    this.showToast({
      type: 'info',
      title: 'Настройки микрофона',
      message: 'Нажмите на значок замка в адресной строке и разрешите доступ к микрофону',
      duration: 8000
    });
  }

  /**
   * Check connection status
   */
  private checkConnection(): void {
    if (navigator.onLine) {
      this.showToast({
        type: 'success',
        title: 'Соединение активно',
        message: 'Интернет-соединение работает нормально'
      });
    } else {
      this.showToast({
        type: 'error',
        title: 'Нет соединения',
        message: 'Проверьте подключение к интернету'
      });
    }
  }

  /**
   * Disable TTS functionality
   */
  private disableTTS(): void {
    // This would typically interact with app settings
    this.showToast({
      type: 'info',
      title: 'Озвучка отключена',
      message: 'Текст будет отображаться без озвучивания'
    });
  }

  /**
   * Notify error listeners
   */
  private notifyError(error: ErrorResponse): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });
  }

  /**
   * Handle ErrorManager error events
   */
  private handleErrorManagerError(error: AppError): void {
    // Convert AppError to legacy ErrorResponse for backward compatibility
    const errorResponse: ErrorResponse = {
      type: error.type,
      message: error.message,
      details: error.originalError,
      timestamp: error.timestamp,
    };
    
    this.notifyError(errorResponse);
  }

  /**
   * Handle ErrorManager toast events
   */
  private handleErrorManagerToast(toast: ToastNotification): void {
    this.toastListeners.forEach(listener => {
      try {
        listener(toast);
      } catch (listenerError) {
        console.error('Toast listener failed:', listenerError);
      }
    });
  }

  /**
   * Handle recovery plan events
   */
  private handleRecoveryPlan(plan: RecoveryPlan): void {
    this.recoveryListeners.forEach(listener => {
      try {
        listener(plan);
      } catch (listenerError) {
        console.error('Recovery listener failed:', listenerError);
      }
    });
  }


  /**
   * Utility methods for common async operations with consistent error handling
   */
  public readonly asyncUtils = {
    /**
     * Safe async operation wrapper
     */
    safe: <T>(operation: () => Promise<T>, context?: { component?: string; action?: string }) =>
      ErrorHandlingPatterns.handleAsync(operation, {
        component: context?.component || 'ErrorHandler',
        action: context?.action || 'asyncOperation'
      }),

    /**
     * Async operation with retry
     */
    withRetry: <T>(
      operation: () => Promise<T>,
      options?: { maxAttempts?: number; baseDelay?: number },
      context?: { component?: string; action?: string }
    ) =>
      ErrorHandlingPatterns.handleAsyncWithRetry(operation, {
        component: context?.component || 'ErrorHandler',
        action: context?.action || 'asyncOperationWithRetry'
      }, options),

    /**
     * Async operation with timeout
     */
    withTimeout: <T>(
      operation: () => Promise<T>,
      timeoutMs: number,
      context?: { component?: string; action?: string }
    ) =>
      ErrorHandlingPatterns.handleAsyncWithTimeout(operation, timeoutMs, {
        component: context?.component || 'ErrorHandler',
        action: context?.action || 'asyncOperationWithTimeout'
      }),

    /**
     * Complete async operation with all error handling features
     */
    complete: <T>(
      operation: () => Promise<T>,
      options?: {
        timeout?: number;
        retry?: { maxAttempts?: number; baseDelay?: number };
        circuitBreaker?: { failureThreshold?: number; resetTimeout?: number };
      },
      context?: { component?: string; action?: string }
    ) =>
      ErrorHandlingPatterns.handleAsyncComplete(operation, {
        context: {
          component: context?.component || 'ErrorHandler',
          action: context?.action || 'asyncOperationComplete'
        },
        ...options
      })
  } as const;

  /**
   * Promise rejection handler for unhandled promise rejections
   */
  public handleUnhandledRejection = (event: PromiseRejectionEvent): void => {
    console.error('Unhandled promise rejection:', event.reason);
    
    const error = event.reason instanceof Error ? event.reason : new Error(String(event.reason));
    
    this.handleError(error, {
      component: 'Global',
      action: 'unhandledRejection',
      type: 'unhandled_promise_rejection'
    });

    // Prevent the default browser behavior
    event.preventDefault();
  };

  /**
   * Global error handler for uncaught errors
   */
  public handleUncaughtError = (event: ErrorEvent): void => {
    console.error('Uncaught error:', event.error);
    
    const error = event.error instanceof Error ? event.error : new Error(event.message);
    
    this.handleError(error, {
      component: 'Global',
      action: 'uncaughtError',
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno
    });
  };

  /**
   * Initialize global error handlers
   */
  public initializeGlobalHandlers(): void {
    // Handle unhandled promise rejections
    window.addEventListener('unhandledrejection', this.handleUnhandledRejection);
    
    // Handle uncaught errors
    window.addEventListener('error', this.handleUncaughtError);
  }

  /**
   * Cleanup global error handlers
   */
  public cleanupGlobalHandlers(): void {
    window.removeEventListener('unhandledrejection', this.handleUnhandledRejection);
    window.removeEventListener('error', this.handleUncaughtError);
  }}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();