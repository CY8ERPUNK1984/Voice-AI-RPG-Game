import { Result, AppError, ErrorType, ErrorSeverity, TypeFactory } from '../types';

/**
 * Comprehensive error handling utilities for consistent async/await patterns
 */

// Generic async wrapper that converts thrown errors to Result type
export async function safeAsync<T>(
  operation: () => Promise<T>,
  errorContext?: { component?: string; action?: string }
): Promise<Result<T, AppError>> {
  try {
    const data = await operation();
    return { success: true, data };
  } catch (error) {
    const appError = createAppErrorFromUnknown(error, errorContext);
    return { success: false, error: appError };
  }
}

// Synchronous version of safeAsync
export function safe<T>(
  operation: () => T,
  errorContext?: { component?: string; action?: string }
): Result<T, AppError> {
  try {
    const data = operation();
    return { success: true, data };
  } catch (error) {
    const appError = createAppErrorFromUnknown(error, errorContext);
    return { success: false, error: appError };
  }
}

// Retry wrapper with exponential backoff
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: {
    maxAttempts?: number;
    baseDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
    shouldRetry?: (error: AppError) => boolean;
    onRetry?: (attempt: number, error: AppError) => void;
    errorContext?: { component?: string; action?: string };
  } = {}
): Promise<Result<T, AppError>> {
  const {
    maxAttempts = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffMultiplier = 2,
    shouldRetry = (error) => error.retryable,
    onRetry,
    errorContext
  } = options;

  let lastError: AppError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await safeAsync(operation, errorContext);
    
    if (result.success) {
      return result;
    }

    lastError = result.error;
    
    // Don't retry on last attempt or if error is not retryable
    if (attempt === maxAttempts || !shouldRetry(result.error)) {
      break;
    }

    // Call retry callback if provided
    if (onRetry) {
      onRetry(attempt, result.error);
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(baseDelay * Math.pow(backoffMultiplier, attempt - 1), maxDelay);
    await sleep(delay);
  }

  // Update retry count in final error
  if (lastError) {
    lastError = {
      ...lastError,
      retryCount: maxAttempts,
      maxRetries: maxAttempts
    };
  }

  return { success: false, error: lastError! };
}

// Timeout wrapper for async operations
export async function withTimeout<T>(
  operation: () => Promise<T>,
  timeoutMs: number,
  errorContext?: { component?: string; action?: string }
): Promise<Result<T, AppError>> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  try {
    const data = await Promise.race([operation(), timeoutPromise]);
    return { success: true, data };
  } catch (error) {
    const appError = createAppErrorFromUnknown(error, {
      ...errorContext,
      timeout: timeoutMs
    });
    
    // Mark timeout errors as retryable
    if (error instanceof Error && error.message.includes('timed out')) {
      appError.retryable = true;
      appError.type = 'TIMEOUT_ERROR';
    }
    
    return { success: false, error: appError };
  }
}

// Circuit breaker pattern implementation
export class CircuitBreaker<T> {
  private failures = 0;
  private lastFailureTime = 0;
  private state: 'closed' | 'open' | 'half-open' = 'closed';

  constructor(
    private operation: () => Promise<T>,
    private options: {
      failureThreshold?: number;
      resetTimeout?: number;
      errorContext?: { component?: string; action?: string };
    } = {}
  ) {}

  async execute(): Promise<Result<T, AppError>> {
    const { failureThreshold = 5, resetTimeout = 60000, errorContext } = this.options;

    // Check if circuit should be reset
    if (this.state === 'open' && Date.now() - this.lastFailureTime > resetTimeout) {
      this.state = 'half-open';
      this.failures = 0;
    }

    // Fail fast if circuit is open
    if (this.state === 'open') {
      return {
        success: false,
        error: TypeFactory.createAppError({
          type: 'SYSTEM_ERROR',
          severity: 'high',
          message: 'Circuit breaker is open - service temporarily unavailable',
          context: { ...errorContext, circuitState: this.state, failures: this.failures },
          recoverable: true,
          retryable: false
        })
      };
    }

    const result = await safeAsync(this.operation, errorContext);

    if (result.success) {
      // Reset on success
      this.failures = 0;
      this.state = 'closed';
      return result;
    } else {
      // Increment failure count
      this.failures++;
      this.lastFailureTime = Date.now();

      // Open circuit if threshold reached
      if (this.failures >= failureThreshold) {
        this.state = 'open';
      }

      return result;
    }
  }

  getState(): { state: string; failures: number; lastFailureTime: number } {
    return {
      state: this.state,
      failures: this.failures,
      lastFailureTime: this.lastFailureTime
    };
  }

  reset(): void {
    this.failures = 0;
    this.lastFailureTime = 0;
    this.state = 'closed';
  }
}

// Promise utilities
export async function allSettledSafe<T>(
  promises: Promise<T>[],
  errorContext?: { component?: string; action?: string }
): Promise<Result<T[], AppError[]>> {
  const results = await Promise.allSettled(promises);
  const successes: T[] = [];
  const errors: AppError[] = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successes.push(result.value);
    } else {
      errors.push(createAppErrorFromUnknown(result.reason, {
        ...errorContext,
        promiseIndex: index
      }));
    }
  });

  if (errors.length === 0) {
    return { success: true, data: successes };
  } else {
    return { success: false, error: errors };
  }
}

// Error boundary integration
export function createErrorBoundaryHandler(
  errorContext: { component: string }
) {
  return (error: Error, errorInfo: { componentStack: string }) => {
    const appError = TypeFactory.createAppError({
      type: 'SYSTEM_ERROR',
      severity: 'critical',
      message: `React Error Boundary caught error in ${errorContext.component}`,
      context: {
        ...errorContext,
        componentStack: errorInfo.componentStack,
        errorMessage: error.message,
        errorStack: error.stack
      },
      originalError: error,
      recoverable: false,
      retryable: false
    });

    // Log error for monitoring
    console.error('Error Boundary caught error:', appError);
    
    // Could integrate with error reporting service here
    // errorReportingService.report(appError);

    return appError;
  };
}

// Utility functions
function createAppErrorFromUnknown(
  error: unknown,
  context?: Record<string, any>
): AppError {
  if (error instanceof Error) {
    return TypeFactory.createAppError({
      type: determineErrorType(error),
      severity: determineErrorSeverity(error),
      message: error.message || 'Unknown error occurred',
      context: { ...context, originalName: error.name },
      originalError: error,
      recoverable: isRecoverableError(error),
      retryable: isRetryableError(error)
    });
  }

  // Handle non-Error objects
  const message = typeof error === 'string' ? error : 
                  typeof error === 'object' && error !== null ? JSON.stringify(error) :
                  'Unknown error occurred';

  return TypeFactory.createAppError({
    type: 'SYSTEM_ERROR',
    severity: 'medium',
    message,
    context: { ...context, originalType: typeof error },
    recoverable: true,
    retryable: false
  });
}

function determineErrorType(error: Error): ErrorType {
  const message = error.message.toLowerCase();
  const name = error.name.toLowerCase();

  if (message.includes('network') || message.includes('fetch')) return 'NETWORK_ERROR';
  if (message.includes('timeout') || message.includes('timed out')) return 'TIMEOUT_ERROR';
  if (message.includes('permission') || message.includes('denied')) return 'PERMISSION_ERROR';
  if (message.includes('rate limit') || message.includes('too many requests')) return 'RATE_LIMIT_ERROR';
  if (message.includes('unauthorized') || message.includes('authentication')) return 'AUTHENTICATION_ERROR';
  if (message.includes('validation') || message.includes('invalid')) return 'VALIDATION_ERROR';
  if (name.includes('typeerror') || name.includes('referenceerror')) return 'SYSTEM_ERROR';

  return 'SYSTEM_ERROR';
}

function determineErrorSeverity(error: Error): ErrorSeverity {
  const message = error.message.toLowerCase();
  
  if (message.includes('critical') || message.includes('fatal')) return 'critical';
  if (message.includes('network') || message.includes('connection')) return 'high';
  if (message.includes('validation') || message.includes('invalid')) return 'medium';
  
  return 'low';
}

function isRecoverableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Non-recoverable errors
  if (message.includes('permission denied')) return false;
  if (message.includes('unauthorized')) return false;
  if (error.name === 'TypeError' || error.name === 'ReferenceError') return false;
  
  return true;
}

function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase();
  
  // Retryable errors
  if (message.includes('network')) return true;
  if (message.includes('timeout')) return true;
  if (message.includes('rate limit')) return true;
  if (message.includes('server error') || message.includes('5')) return true;
  
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Export commonly used patterns
export const ErrorHandlingPatterns = {
  // Standard async operation with error handling
  async handleAsync<T>(
    operation: () => Promise<T>,
    context: { component: string; action: string }
  ): Promise<Result<T, AppError>> {
    return safeAsync(operation, context);
  },

  // Async operation with retry
  async handleAsyncWithRetry<T>(
    operation: () => Promise<T>,
    context: { component: string; action: string },
    retryOptions?: { maxAttempts?: number; baseDelay?: number }
  ): Promise<Result<T, AppError>> {
    return withRetry(operation, {
      ...retryOptions,
      errorContext: context
    });
  },

  // Async operation with timeout
  async handleAsyncWithTimeout<T>(
    operation: () => Promise<T>,
    timeoutMs: number,
    context: { component: string; action: string }
  ): Promise<Result<T, AppError>> {
    return withTimeout(operation, timeoutMs, context);
  },

  // Complete async operation with retry, timeout, and circuit breaker
  async handleAsyncComplete<T>(
    operation: () => Promise<T>,
    options: {
      context: { component: string; action: string };
      timeout?: number;
      retry?: { maxAttempts?: number; baseDelay?: number };
      circuitBreaker?: { failureThreshold?: number; resetTimeout?: number };
    }
  ): Promise<Result<T, AppError>> {
    const { context, timeout = 10000, retry, circuitBreaker } = options;

    let wrappedOperation = operation;

    // Add timeout if specified
    if (timeout > 0) {
      wrappedOperation = async () => {
        const result = await withTimeout(operation, timeout, context);
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      };
    }

    // Add circuit breaker if specified
    if (circuitBreaker) {
      const cb = new CircuitBreaker(wrappedOperation, {
        ...circuitBreaker,
        errorContext: context
      });
      wrappedOperation = () => cb.execute().then(result => {
        if (!result.success) throw new Error(result.error.message);
        return result.data;
      });
    }

    // Add retry if specified
    if (retry) {
      return withRetry(wrappedOperation, {
        ...retry,
        errorContext: context
      });
    }

    return safeAsync(wrappedOperation, context);
  }
} as const;