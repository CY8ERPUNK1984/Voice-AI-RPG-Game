import { ErrorResponse } from '@/types';

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

export class ErrorManager {
  private static instance: ErrorManager;
  private errorHandlers: Map<ErrorType, ErrorHandler[]> = new Map();
  private errorLog: AppError[] = [];
  private metrics: ErrorMetrics = {
    totalErrors: 0,
    errorsByType: {} as Record<ErrorType, number>,
    errorsBySeverity: {} as Record<ErrorSeverity, number>,
    recoverySuccessRate: 0,
    averageRecoveryTime: 0
  };
  private maxLogSize = 1000;

  private constructor() {
    this.initializeDefaultHandlers();
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
    
    // Find appropriate handler
    const handlers = this.errorHandlers.get(appError.type) || [];
    
    for (const handler of handlers) {
      if (handler.canHandle(appError)) {
        try {
          const recoveryPlan = await handler.handle(appError);
          console.log(`Error handled by ${handler.constructor.name}:`, {
            errorId: appError.id,
            type: appError.type,
            recoverySteps: recoveryPlan.steps.length
          });
          return recoveryPlan;
        } catch (handlerError) {
          console.error(`Error handler failed:`, handlerError);
        }
      }
    }
    
    // Fallback recovery plan
    const fallbackPlan = this.createRecoveryPlan(appError);
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
  }

  /**
   * Get error metrics
   */
  public getMetrics(): ErrorMetrics {
    return { ...this.metrics };
  }

  /**
   * Check if error is recoverable
   */
  public isRecoverable(error: AppError): boolean {
    return error.recoverable;
  }

  /**
   * Check if error is retryable
   */
  public isRetryable(error: AppError): boolean {
    return error.retryable;
  }

  /**
   * Create recovery plan for an error
   */
  public createRecoveryPlan(error: AppError): RecoveryPlan {
    switch (error.type) {
      case 'CONNECTION_ERROR':
        return this.createConnectionRecoveryPlan(error);
      case 'RATE_LIMIT_ERROR':
        return this.createRateLimitRecoveryPlan(error);
      case 'ASR_ERROR':
        return this.createASRRecoveryPlan(error);
      case 'TTS_ERROR':
        return this.createTTSRecoveryPlan(error);
      case 'LLM_ERROR':
        return this.createLLMRecoveryPlan(error);
      default:
        return this.createFallbackRecoveryPlan(error);
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
   * Create connection recovery plan
   */
  private createConnectionRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'retry_connection',
          description: 'Attempting to reconnect to server',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'check_network',
          description: 'Checking network connectivity',
          autoExecute: true,
          priority: 2
        },
        {
          action: 'fallback_mode',
          description: 'Switching to offline mode',
          autoExecute: false,
          priority: 3
        }
      ],
      autoExecute: true,
      userAction: 'Please check your internet connection',
      estimatedTime: 10000
    };
  }

  /**
   * Create rate limit recovery plan
   */
  private createRateLimitRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'wait_backoff',
          description: 'Waiting for rate limit reset',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'queue_request',
          description: 'Queuing request for later processing',
          autoExecute: true,
          priority: 2
        }
      ],
      autoExecute: true,
      userAction: 'Please wait a moment before trying again',
      estimatedTime: 30000
    };
  }

  /**
   * Create ASR recovery plan
   */
  private createASRRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'switch_asr_method',
          description: 'Switching to alternative speech recognition',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'request_permissions',
          description: 'Requesting microphone permissions',
          autoExecute: false,
          priority: 2
        },
        {
          action: 'fallback_text',
          description: 'Switching to text input',
          autoExecute: false,
          priority: 3
        }
      ],
      autoExecute: true,
      userAction: 'Please allow microphone access or use text input',
      estimatedTime: 5000
    };
  }

  /**
   * Create TTS recovery plan
   */
  private createTTSRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'switch_tts_method',
          description: 'Switching to alternative text-to-speech',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'disable_tts',
          description: 'Disabling voice output',
          autoExecute: true,
          priority: 2
        }
      ],
      autoExecute: true,
      userAction: 'Voice output disabled, text will be displayed instead',
      estimatedTime: 2000
    };
  }

  /**
   * Create LLM recovery plan
   */
  private createLLMRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'retry_llm',
          description: 'Retrying AI request',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'fallback_response',
          description: 'Using fallback response',
          autoExecute: true,
          priority: 2
        }
      ],
      autoExecute: true,
      userAction: 'AI service temporarily unavailable, please try again',
      estimatedTime: 15000
    };
  }

  /**
   * Create fallback recovery plan
   */
  private createFallbackRecoveryPlan(error: AppError): RecoveryPlan {
    return {
      steps: [
        {
          action: 'log_error',
          description: 'Logging error for investigation',
          autoExecute: true,
          priority: 1
        },
        {
          action: 'notify_user',
          description: 'Notifying user of the issue',
          autoExecute: true,
          priority: 2
        }
      ],
      autoExecute: true,
      userAction: 'An unexpected error occurred. Please try again or contact support.',
      estimatedTime: 1000
    };
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