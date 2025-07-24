import React, { ComponentType, ErrorInfo, ReactNode } from 'react';
import { AppError, Result } from '../types';
import { createErrorBoundaryHandler } from '../utils/errorHandling';
import { errorHandler } from '../services/ErrorHandler';

/**
 * Higher-order component that adds consistent error handling to any component
 */

interface ErrorHandlingState {
  hasError: boolean;
  error?: AppError;
}

interface ErrorHandlingProps {
  fallback?: (error: AppError) => ReactNode;
  onError?: (error: AppError) => void;
  resetOnPropsChange?: boolean;
}

export function withErrorHandling<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: {
    componentName?: string;
    fallback?: (error: AppError) => ReactNode;
    onError?: (error: AppError) => void;
    resetOnPropsChange?: boolean;
  } = {}
) {
  const {
    componentName = WrappedComponent.displayName || WrappedComponent.name || 'Component',
    fallback,
    onError,
    resetOnPropsChange = true
  } = options;

  return class ErrorHandledComponent extends React.Component<
    P & ErrorHandlingProps,
    ErrorHandlingState
  > {
    private errorBoundaryHandler = createErrorBoundaryHandler({ component: componentName });

    constructor(props: P & ErrorHandlingProps) {
      super(props);
      this.state = { hasError: false };
    }

    static getDerivedStateFromError(error: Error): ErrorHandlingState {
      return { hasError: true };
    }

    componentDidCatch(error: Error, errorInfo: ErrorInfo) {
      const appError = this.errorBoundaryHandler(error, errorInfo);
      
      this.setState({ error: appError });
      
      // Call component-specific error handler
      if (this.props.onError) {
        this.props.onError(appError);
      } else if (onError) {
        onError(appError);
      }
      
      // Report to global error handler
      errorHandler.handleError(error, {
        component: componentName,
        action: 'componentDidCatch',
        componentStack: errorInfo.componentStack
      });
    }

    componentDidUpdate(prevProps: P & ErrorHandlingProps) {
      // Reset error state when props change (if enabled)
      if (resetOnPropsChange && this.state.hasError && prevProps !== this.props) {
        this.setState({ hasError: false, error: undefined });
      }
    }

    render() {
      if (this.state.hasError && this.state.error) {
        // Use component-specific fallback or default fallback
        const fallbackComponent = this.props.fallback || fallback;
        
        if (fallbackComponent) {
          return fallbackComponent(this.state.error);
        }
        
        // Default error UI
        return (
          <div className="error-boundary-fallback bg-red-50 border border-red-200 rounded-lg p-4 m-4">
            <h3 className="text-red-800 font-semibold mb-2">
              Произошла ошибка в компоненте {componentName}
            </h3>
            <p className="text-red-600 text-sm mb-3">
              {this.state.error.message}
            </p>
            <button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="bg-red-600 text-white px-3 py-1 rounded text-sm hover:bg-red-700 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        );
      }

      return <WrappedComponent {...this.props} />;
    }
  };
}

/**
 * Hook for consistent async error handling in functional components
 */
export function useAsyncErrorHandler(componentName: string) {
  const handleAsync = React.useCallback(
    async <T>(
      operation: () => Promise<T>,
      options?: {
        onError?: (error: AppError) => void;
        showToast?: boolean;
        retryOptions?: { maxAttempts?: number; baseDelay?: number };
      }
    ): Promise<Result<T, AppError>> => {
      const { onError, showToast = true, retryOptions } = options || {};

      const result = retryOptions
        ? await errorHandler.asyncUtils.withRetry(
            operation,
            retryOptions,
            { component: componentName, action: 'asyncOperation' }
          )
        : await errorHandler.asyncUtils.safe(
            operation,
            { component: componentName, action: 'asyncOperation' }
          );

      if (!result.success) {
        if (onError) {
          onError(result.error);
        }

        if (showToast) {
          errorHandler.showToast({
            type: 'error',
            title: 'Ошибка',
            message: result.error.message,
            actions: errorHandler.createRecoveryActions(result.error)
          });
        }
      }

      return result;
    },
    [componentName]
  );

  const handleAsyncWithTimeout = React.useCallback(
    async <T>(
      operation: () => Promise<T>,
      timeoutMs: number,
      options?: {
        onError?: (error: AppError) => void;
        showToast?: boolean;
      }
    ): Promise<Result<T, AppError>> => {
      const { onError, showToast = true } = options || {};

      const result = await errorHandler.asyncUtils.withTimeout(
        operation,
        timeoutMs,
        { component: componentName, action: 'asyncOperationWithTimeout' }
      );

      if (!result.success) {
        if (onError) {
          onError(result.error);
        }

        if (showToast) {
          errorHandler.showToast({
            type: 'error',
            title: 'Ошибка',
            message: result.error.message,
            actions: errorHandler.createRecoveryActions(result.error)
          });
        }
      }

      return result;
    },
    [componentName]
  );

  return {
    handleAsync,
    handleAsyncWithTimeout,
    createRecoveryActions: errorHandler.createRecoveryActions.bind(errorHandler),
    showToast: errorHandler.showToast.bind(errorHandler)
  };
}

/**
 * Hook for error state management in functional components
 */
export function useErrorState(initialError?: AppError) {
  const [error, setError] = React.useState<AppError | null>(initialError || null);

  const clearError = React.useCallback(() => {
    setError(null);
  }, []);

  const handleError = React.useCallback((newError: AppError) => {
    setError(newError);
  }, []);

  return {
    error,
    hasError: error !== null,
    setError: handleError,
    clearError
  };
}

/**
 * Default error fallback component
 */
export const DefaultErrorFallback: React.FC<{
  error: AppError;
  onRetry?: () => void;
  componentName?: string;
}> = ({ error, onRetry, componentName = 'Component' }) => {
  return (
    <div className="error-fallback bg-red-50 border border-red-200 rounded-lg p-6 m-4 max-w-md mx-auto">
      <div className="flex items-center mb-4">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">
            Ошибка в {componentName}
          </h3>
        </div>
      </div>
      
      <div className="mb-4">
        <p className="text-sm text-red-700">{error.message}</p>
        {error.context && Object.keys(error.context).length > 0 && (
          <details className="mt-2">
            <summary className="text-xs text-red-600 cursor-pointer">
              Подробности
            </summary>
            <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap">
              {JSON.stringify(error.context, null, 2)}
            </pre>
          </details>
        )}
      </div>
      
      <div className="flex space-x-2">
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
          >
            Попробовать снова
          </button>
        )}
        <button
          onClick={() => window.location.reload()}
          className="bg-gray-600 text-white px-3 py-2 rounded text-sm hover:bg-gray-700 transition-colors"
        >
          Перезагрузить страницу
        </button>
      </div>
    </div>
  );
};