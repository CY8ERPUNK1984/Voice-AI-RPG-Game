// import { ErrorResponse } from '@/types'; // Unused import removed

export type ErrorType = 
  | 'ASR_ERROR' 
  | 'LLM_ERROR' 
  | 'TTS_ERROR' 
  | 'CONNECTION_ERROR' 
  | 'VALIDATION_ERROR'
  | 'RATE_LIMIT_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'SYSTEM_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface AppError {
  id: string;
  type: ErrorType;
  severity: ErrorSeverity;
  message: string;
  originalError?: Error;
  context: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface RecoveryStep {
  action: string;
  description: string;
  autoExecute: boolean;
  priority: number;
}

export interface RecoveryPlan {
  steps: RecoveryStep[];
  autoExecute: boolean;
  userAction?: string;
  estimatedTime?: number;
}

export interface ErrorMetrics {
  totalErrors: number;
  errorsByType: Record<ErrorType, number>;
  errorsBySeverity: Record<ErrorSeverity, number>;
  recoverySuccessRate: number;
  averageRecoveryTime: number;
}

export interface ErrorHandler {
  canHandle(error: AppError): boolean;
  handle(error: AppError): Promise<RecoveryPlan>;
  priority: number;
}

export interface ToastNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  action: () => void;
  primary?: boolean;
}

export class ErrorManager {
  private static instance: ErrorManager;
  private errorHandlers: Map<ErrorType, ErrorHandler[]> = new Map();
  private errorLog: AppError[] = [];
  private errorListeners: ((error: AppError) => void)[] = [];
  private toastListeners: ((toast: ToastNotification) => void)[] = [];
  private recoveryListeners: ((plan: RecoveryPlan) => void)[] = [];
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<ErrorType, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recoverySuccessRate: 0,
    averageRecoveryTime: 0
  };
  private maxLogSize = 1000;
  private persistenceKey = 'voice-ai-rpg-errors';

  private constructor() {
    this.initializeDefaultHandlers();
    this.loadPersistedErrors();
  }

  public static getInstance(): ErrorManager {
    if (!ErrorManager.instance) {
      ErrorManager.instance = new ErrorManager();
    }
    return ErrorManager.instance;
  }

  /**
   * Register an error handler for a specific error type
   */
  public registerErrorHandler(type: ErrorType, handler: ErrorHandler): void {
    if (!this.errorHandlers.has(type)) {
      this.errorHandlers.set(type, []);
    }
    
    const handlers = this.errorHandlers.get(type)!;
    handlers.push(handler);
    handlers.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Handle an error and create recovery plan
   */
  public async handleError(error: Error | AppError, context: Record<string, any> = {}): Promise<RecoveryPlan> {
    const appError = this.normalizeError(error, context);
    
    // Log the error
    this.logError(appError);
    
    // Update metrics
    this.updateMetrics(appError);
    
    // Notify error listeners
    this.notifyErrorListeners(appError);
    
    // Show toast notification
    this.showErrorToast(appError);
    
    // Find appropriate handler
    const handlers = this.errorHandlers.get(appError.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(appError)) {
        try {
          const recoveryPlan = await handler.handle(appError);
          this.notifyRecoveryListeners(recoveryPlan);
          
          // Execute auto-recovery if enabled
          if (recoveryPlan.autoExecute) {
            this.executeRecoveryPlan(recoveryPlan, appError);
          }
          
          return recoveryPlan;
        } catch (handlerError) {
          console.error(`Error handler failed:`, handlerError);
        }
      }
    }
    
    // Fallback recovery plan
    const fallbackPlan = this.createFallbackRecoveryPlan(appError);
    this.notifyRecoveryListeners(fallbackPlan);
    return fallbackPlan;
  }

  /**
   * Get current error state
   */
  public getErrorState(): AppError[] {
    return this.errorLog.slice(-10); // Return last 10 errors
  }

  /**
   * Clear errors by type or all errors
   */
  public clearErrors(type?: ErrorType): void {
    if (type) {
      this.errorLog = this.errorLog.filter(error => error.type !== type);
    } else {
      this.errorLog = [];
    }
    this.persistErrors();
  }

  /**
   * Get error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Subscribe to error notifications
   */
  public onError(callback: (error: AppError) => void): () => void {
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
   * Show toast notification
   */
  public showToast(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    const notification: ToastNotification = {
      id: this.generateErrorId(),
      timestamp: new Date(),
      duration: toast.type === 'error' ? 5000 : 3000,
      ...toast,
    };

    this.toastListeners.forEach(listener => listener(notification));
  }

  /**
   * Get user-friendly error message in Russian
   */
  public getLocalizedMessage(error: AppError): string {
    const russianMessages: Record<ErrorType, Record<string, string>> = {
      ASR_ERROR: {
        'not-allowed': 'Доступ к микрофону запрещен. Пожалуйста, разрешите доступ к микрофону и попробуйте снова.',
        'no-speech': 'Речь не обнаружена. Пожалуйста, говорите четко и попробуйте снова.',
        'network': 'Ошибка сети при распознавании речи. Проверьте подключение к интернету.',
        'not available': 'Распознавание речи недоступно в вашем браузере. Попробуйте использовать текстовый ввод.',
        'timeout': 'Время распознавания речи истекло. Попробуйте говорить снова.',
        'default': 'Ошибка распознавания речи. Попробуйте снова или используйте текстовый ввод.'
      },
      LLM_ERROR: {
        'rate limit': 'Слишком много запросов. Пожалуйста, подождите немного перед повторной попыткой.',
        'network': 'Ошибка сети при подключении к ИИ сервису. Проверьте подключение к интернету.',
        'timeout': 'Время ожидания ответа ИИ истекло. Попробуйте снова.',
        'quota': 'ИИ сервис временно недоступен. Попробуйте позже.',
        'default': 'Не удалось получить ответ от ИИ. Попробуйте снова.'
      },
      TTS_ERROR: {
        'not available': 'Синтез речи недоступен. Текст будет отображен вместо озвучивания.',
        'network': 'Ошибка сети при синтезе речи. Текст будет отображен вместо озвучивания.',
        'interrupted': 'Синтез речи был прерван.',
        'default': 'Ошибка синтеза речи. Текст будет отображен вместо озвучивания.'
      },
      CONNECTION_ERROR: {
        'WebSocket': 'Потеряно соединение с игровым сервером. Попытка переподключения...',
        'timeout': 'Время подключения истекло. Проверьте подключение к интернету.',
        'refused': 'Не удается подключиться к игровому серверу. Попробуйте позже.',
        'default': 'Ошибка подключения. Проверьте подключение к интернету и попробуйте снова.'
      },
      RATE_LIMIT_ERROR: {
        'default': 'Превышен лимит запросов. Пожалуйста, подождите перед повторной попыткой.'
      },
      AUTHENTICATION_ERROR: {
        'default': 'Ошибка авторизации. Обновите страницу или войдите заново.'
      },
      VALIDATION_ERROR: {
        'default': 'Ошибка валидации данных. Проверьте введенную информацию.'
      },
      SYSTEM_ERROR: {
        'default': 'Произошла системная ошибка. Попробуйте обновить страницу.'
      }
    };

    const typeMessages = russianMessages[error.type];
    if (!typeMessages) {
      return 'Произошла неизвестная ошибка. Попробуйте снова.';
    }

    const originalMessage = error.originalError?.message || error.message;
    
    // Find matching message pattern
    for (const [pattern, message] of Object.entries(typeMessages)) {
      if (pattern !== 'default' && originalMessage.toLowerCase().includes(pattern.toLowerCase())) {
        return message;
      }
    }
    
    return typeMessages.default;
  }

  /**
   * Execute recovery plan
   */
  private async executeRecoveryPlan(plan: RecoveryPlan, error: AppError): Promise<void> {
    const autoSteps = plan.steps.filter(step => step.autoExecute);
    
    for (const step of autoSteps) {
      try {
        await this.executeRecoveryStep(step, error);
      } catch (stepError) {
        console.error(`Recovery step failed:`, stepError);
      }
    }
  }

  /**
   * Execute individual recovery step
   */
  private async executeRecoveryStep(step: RecoveryStep, error: AppError): Promise<void> {
    console.log(`Executing recovery step: ${step.action}`);
    
    switch (step.action) {
      case 'retry_connection':
        // This would be handled by ConnectionManager
        break;
      case 'switch_asr_method':
        // This would be handled by ASR service
        break;
      case 'switch_tts_method':
        // This would be handled by TTS service
        break;
      case 'wait_backoff':
        await new Promise(resolve => setTimeout(resolve, 1000));
        break;
      case 'log_error':
        console.error('Recovery logging:', error);
        break;
      case 'notify_user':
        this.showToast({
          type: 'info',
          title: 'Восстановление',
          message: step.description
        });
        break;
    }
  }

  /**
   * Normalize error to AppError format
   */
  private normalizeError(error: Error | AppError, context: Record<string, any>): AppError {
    if (this.isAppError(error)) {
      return error;
    }

    const errorType = this.classifyError(error);
    const severity = this.determineSeverity(errorType, error);

    return {
      id: this.generateErrorId(),
      type: errorType,
      severity,
      message: error.message,
      originalError: error,
      context,
      timestamp: new Date(),
      recoverable: this.isErrorRecoverable(errorType),
      retryable: this.isErrorRetryable(errorType),
      userId: context.userId,
      sessionId: context.sessionId,
      requestId: context.requestId
    };
  }

  /**
   * Check if error is already an AppError
   */
  private isAppError(error: any): error is AppError {
    return error && typeof error === 'object' && 'type' in error && 'severity' in error;
  }

  /**
   * Classify error type based on error message and context
   */
  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('websocket') || message.includes('connection')) {
      return 'CONNECTION_ERROR';
    }
    if (message.includes('rate limit') || message.includes('429')) {
      return 'RATE_LIMIT_ERROR';
    }
    if (message.includes('speech') || message.includes('microphone') || message.includes('asr')) {
      return 'ASR_ERROR';
    }
    if (message.includes('tts') || message.includes('synthesis')) {
      return 'TTS_ERROR';
    }
    if (message.includes('llm') || message.includes('openai') || message.includes('claude')) {
      return 'LLM_ERROR';
    }
    if (message.includes('auth') || message.includes('unauthorized')) {
      return 'AUTHENTICATION_ERROR';
    }
    if (message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }
    
    return 'SYSTEM_ERROR';
  }

  /**
   * Determine error severity
   */
  private determineSeverity(type: ErrorType, error: Error): ErrorSeverity {
    switch (type) {
      case 'SYSTEM_ERROR':
      case 'AUTHENTICATION_ERROR':
        return 'critical';
      case 'CONNECTION_ERROR':
      case 'LLM_ERROR':
        return 'high';
      case 'RATE_LIMIT_ERROR':
      case 'ASR_ERROR':
        return 'medium';
      case 'TTS_ERROR':
      case 'VALIDATION_ERROR':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Check if error type is recoverable
   */
  private isErrorRecoverable(type: ErrorType): boolean {
    return ![
      'AUTHENTICATION_ERROR',
      'VALIDATION_ERROR'
    ].includes(type);
  }

  /**
   * Check if error type is retryable
   */
  private isErrorRetryable(type: ErrorType): boolean {
    return [
      'CONNECTION_ERROR',
      'RATE_LIMIT_ERROR',
      'ASR_ERROR',
      'TTS_ERROR',
      'LLM_ERROR'
    ].includes(type);
  }

  /**
   * Generate unique error ID
   */
  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  }

  /**
   * Log error to internal storage
   */
  private logError(error: AppError): void {
    this.errorLog.push(error);
    
    // Maintain log size limit
    if (this.errorLog.length > this.maxLogSize) {
      this.errorLog = this.errorLog.slice(-this.maxLogSize);
    }
    
    // Persist to localStorage
    this.persistErrors();
    
    // Console logging with structured format
    console.error('ErrorManager:', {
      id: error.id,
      type: error.type,
      severity: error.severity,
      message: error.message,
      context: error.context,
      timestamp: error.timestamp.toISOString()
    });
  }

  /**
   * Update error metrics
   */
  private updateMetrics(error: AppError): void {
    this.metrics.totalErrors++;
    
    if (!this.metrics.errorsByType[error.type]) {
      this.metrics.errorsByType[error.type] = 0;
    }
    this.metrics.errorsByType[error.type]++;
    
    if (!this.metrics.errorsBySeverity[error.severity]) {
      this.metrics.errorsBySeverity[error.severity] = 0;
    }
    this.metrics.errorsBySeverity[error.severity]++;
  }

  /**
   * Notify error listeners
   */
  private notifyErrorListeners(error: AppError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (listenerError) {
        console.error('Error listener failed:', listenerError);
      }
    });
  }

  /**
   * Notify recovery listeners
   */
  private notifyRecoveryListeners(plan: RecoveryPlan): void {
    this.recoveryListeners.forEach(listener => {
      try {
        listener(plan);
      } catch (listenerError) {
        console.error('Recovery listener failed:', listenerError);
      }
    });
  }

  /**
   * Show error toast notification
   */
  private showErrorToast(error: AppError): void {
    const localizedMessage = this.getLocalizedMessage(error);
    const actions: ToastAction[] = [];

    // Add retry action for retryable errors
    if (error.retryable) {
      actions.push({
        label: 'Повторить',
        action: () => {
          // This would trigger a retry mechanism
          console.log('Retrying after error:', error.id);
        },
        primary: true
      });
    }

    // Add recovery action for recoverable errors
    if (error.recoverable && !error.retryable) {
      actions.push({
        label: 'Восстановить',
        action: () => {
          this.handleError(error);
        }
      });
    }

    this.showToast({
      type: error.severity === 'critical' ? 'error' : 'warning',
      title: this.getErrorTitle(error.type),
      message: localizedMessage,
      actions: actions.length > 0 ? actions : undefined,
      duration: error.severity === 'critical' ? 10000 : 5000
    });
  }

  /**
   * Get error title in Russian
   */
  private getErrorTitle(type: ErrorType): string {
    const titles: Record<ErrorType, string> = {
      ASR_ERROR: 'Ошибка распознавания речи',
      LLM_ERROR: 'Ошибка ИИ сервиса',
      TTS_ERROR: 'Ошибка синтеза речи',
      CONNECTION_ERROR: 'Ошибка подключения',
      RATE_LIMIT_ERROR: 'Превышен лимит запросов',
      AUTHENTICATION_ERROR: 'Ошибка авторизации',
      VALIDATION_ERROR: 'Ошибка валидации',
      SYSTEM_ERROR: 'Системная ошибка'
    };
    
    return titles[type] || 'Ошибка';
  }

  /**
   * Create fallback recovery plan
   */
  private createFallbackRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'log_error',
          description: 'Логирование ошибки для расследования',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'notify_user',
          description: 'Уведомление пользователя о проблеме',
          autoExecute: true,
          priority: 2
        }
      ],
      autoExecute: true,
      userAction: 'Произошла неожиданная ошибка. Попробуйте снова или обратитесь в поддержку.',
      estimatedTime: 1000
    };
  }

  /**
   * Persist errors to localStorage
   */
  private persistErrors(): void {
    try {
      const recentErrors = this.errorLog.slice(-50); // Keep only recent errors
      localStorage.setItem(this.persistenceKey, JSON.stringify(recentErrors));
    } catch (error) {
      console.warn('Failed to persist errors:', error);
    }
  }

  /**
   * Load persisted errors from localStorage
   */
  private loadPersistedErrors(): void {
    try {
      const stored = localStorage.getItem(this.persistenceKey);
      if (stored) {
        const errors = JSON.parse(stored) as AppError[];
        this.errorLog = errors.map(error => ({
          ...error,
          timestamp: new Date(error.timestamp)
        }));
      }
    } catch (error) {
      console.warn('Failed to load persisted errors:', error);
    }
  }

  /**
   * Initialize default error handlers
   */
  private initializeDefaultHandlers(): void {
    // Default handlers will be registered here
    // This is a placeholder for future handler implementations
  }
}

// Export singleton instance
export const errorManager = ErrorManager.getInstance();