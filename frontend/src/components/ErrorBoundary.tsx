import React, { Component, ErrorInfo, ReactNode } from 'react';
import { errorHandler } from '@/services/ErrorHandler';
import { errorManager } from '@/services/ErrorManager';
import { AppError, RecoveryPlan } from '@/types';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  section?: string; // Identify which section this boundary protects
  enableReporting?: boolean; // Enable error reporting
  showDetails?: boolean; // Show error details to user
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  appError: AppError | null;
  recoveryPlan: RecoveryPlan | null;
  isRecovering: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      appError: null,
      recoveryPlan: null,
      isRecovering: false,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
      isRecovering: false,
    };
  }

  async componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({
      error,
      errorInfo,
    });

    // Create context for error reporting
    const context = {
      section: this.props.section || 'unknown',
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      timestamp: new Date().toISOString(),
    };

    // Log error to console
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    try {
      // Handle error with ErrorManager for comprehensive error handling
      const recoveryPlan = await errorManager.handleError(error, context);
      
      this.setState({
        appError: {
          id: `boundary_${Date.now()}`,
          type: 'SYSTEM_ERROR',
          severity: 'critical',
          message: error.message,
          originalError: error,
          context,
          timestamp: new Date(),
          recoverable: true,
          retryable: false,
        },
        recoveryPlan,
      });

      // Also report to legacy error handler for backward compatibility
      await errorHandler.handleError(error, context).catch(console.error);
    } catch (handlingError) {
      console.error('Error while handling boundary error:', handlingError);
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Report error if enabled
    if (this.props.enableReporting !== false) {
      this.reportError(error, errorInfo, context);
    }
  }

  private handleRetry = async () => {
    this.setState({ isRecovering: true });
    
    try {
      // Clear errors from both error systems
      errorHandler.clearAllErrors();
      errorManager.clearErrors();
      
      // Reset component state
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        appError: null,
        recoveryPlan: null,
        isRecovering: false,
      });
    } catch (error) {
      console.error('Error during retry:', error);
      this.setState({ isRecovering: false });
    }
  };

  private handleReload = () => {
    window.location.reload();
  };

  private handleRecoveryAction = async (action: () => void) => {
    this.setState({ isRecovering: true });
    
    try {
      await action();
      // If action succeeds, try to recover
      await this.handleRetry();
    } catch (error) {
      console.error('Recovery action failed:', error);
      this.setState({ isRecovering: false });
    }
  };

  private reportError = async (error: Error, errorInfo: ErrorInfo, context: Record<string, any>) => {
    // This would typically send error reports to a monitoring service
    // For now, we'll just log it
    console.log('Error report:', {
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
      errorInfo,
      context,
      userAgent: navigator.userAgent,
      url: window.location.href,
      timestamp: new Date().toISOString(),
    });
  };

  private renderRecoveryActions = () => {
    const { recoveryPlan, isRecovering } = this.state;
    
    if (!recoveryPlan || !recoveryPlan.steps.length) {
      return null;
    }

    const userActions = recoveryPlan.steps.filter(step => !step.autoExecute);
    
    if (userActions.length === 0) {
      return null;
    }

    return (
      <div className="mt-4">
        <h3 className="text-sm font-medium text-gray-300 mb-2">Варианты восстановления:</h3>
        <div className="space-y-2">
          {userActions.map((step, index) => (
            <button
              key={index}
              onClick={() => this.handleRecoveryAction(() => console.log(`Executing: ${step.action}`))}
              disabled={isRecovering}
              className="w-full text-left bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-sm py-2 px-3 rounded transition-colors"
            >
              {step.description}
            </button>
          ))}
        </div>
      </div>
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback UI if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const { error, appError, isRecovering } = this.state;
      const sectionName = this.props.section || 'приложения';

      // Default fallback UI with enhanced error handling
      return (
        <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-gray-800 rounded-lg p-6 text-center">
            <div className="mb-4">
              <svg
                className="w-16 h-16 text-red-500 mx-auto mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
              <h2 className="text-xl font-bold text-red-400 mb-2">
                Ошибка в {sectionName}
              </h2>
              <p className="text-gray-400 mb-4">
                {appError 
                  ? errorManager.getLocalizedMessage(appError)
                  : 'Произошла неожиданная ошибка. Это может быть временная проблема.'
                }
              </p>
            </div>

            {/* Error severity indicator */}
            {appError && (
              <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium mb-4 ${
                appError.severity === 'critical' ? 'bg-red-900 text-red-200' :
                appError.severity === 'high' ? 'bg-orange-900 text-orange-200' :
                appError.severity === 'medium' ? 'bg-yellow-900 text-yellow-200' :
                'bg-blue-900 text-blue-200'
              }`}>
                Серьезность: {
                  appError.severity === 'critical' ? 'Критическая' :
                  appError.severity === 'high' ? 'Высокая' :
                  appError.severity === 'medium' ? 'Средняя' : 'Низкая'
                }
              </div>
            )}

            {/* Error details (only in development or if showDetails is true) */}
            {(import.meta.env.MODE === 'development' || this.props.showDetails) && error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400">
                  Детали ошибки {import.meta.env.MODE === 'development' ? '(Разработка)' : ''}
                </summary>
                <div className="mt-2 p-3 bg-gray-900 rounded text-xs font-mono text-red-400 overflow-auto max-h-32">
                  <div className="mb-2">
                    <strong>Ошибка:</strong> {error.message}
                  </div>
                  <div className="mb-2">
                    <strong>Секция:</strong> {this.props.section || 'unknown'}
                  </div>
                  {appError && (
                    <div className="mb-2">
                      <strong>ID:</strong> {appError.id}
                    </div>
                  )}
                  {this.state.errorInfo && (
                    <div>
                      <strong>Стек компонентов:</strong>
                      <pre className="whitespace-pre-wrap">
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            )}

            {/* Recovery actions */}
            {this.renderRecoveryActions()}

            <div className="space-y-3 mt-4">
              <button
                onClick={this.handleRetry}
                disabled={isRecovering}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center"
              >
                {isRecovering ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Восстановление...
                  </>
                ) : (
                  'Попробовать снова'
                )}
              </button>
              <button
                onClick={this.handleReload}
                disabled={isRecovering}
                className="w-full bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white font-medium py-2 px-4 rounded transition-colors"
              >
                Перезагрузить страницу
              </button>
            </div>

            <div className="mt-4 text-xs text-gray-500">
              {appError?.recoverable 
                ? 'Эта ошибка может быть исправлена. Попробуйте варианты восстановления выше.'
                : 'Если проблема не исчезает, обновите страницу или попробуйте позже.'
              }
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Higher-order component for easier usage
export function withErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  options?: {
    fallback?: ReactNode;
    section?: string;
    enableReporting?: boolean;
    showDetails?: boolean;
  }
) {
  return function WithErrorBoundaryComponent(props: P) {
    return (
      <ErrorBoundary 
        fallback={options?.fallback}
        section={options?.section}
        enableReporting={options?.enableReporting}
        showDetails={options?.showDetails}
      >
        <Component {...props} />
      </ErrorBoundary>
    );
  };
}

// Specialized error boundaries for different sections
export function ChatErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      section="чата"
      enableReporting={true}
      fallback={
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="text-center">
            <div className="text-red-400 mb-2">⚠️</div>
            <p className="text-gray-400 text-sm">
              Ошибка в интерфейсе чата. Попробуйте обновить страницу.
            </p>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function VoiceErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      section="голосового ввода"
      enableReporting={true}
      fallback={
        <div className="p-2 bg-red-900/20 border border-red-500/30 rounded">
          <p className="text-red-400 text-sm">
            Ошибка голосового ввода. Используйте текстовый ввод.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function AudioErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      section="аудио плеера"
      enableReporting={true}
      fallback={
        <div className="p-2 bg-yellow-900/20 border border-yellow-500/30 rounded">
          <p className="text-yellow-400 text-sm">
            Ошибка воспроизведения аудио. Текст отображается ниже.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}

export function SettingsErrorBoundary({ children }: { children: ReactNode }) {
  return (
    <ErrorBoundary 
      section="настроек"
      enableReporting={false}
      fallback={
        <div className="p-4 bg-gray-800 rounded">
          <p className="text-gray-400 text-sm">
            Ошибка в настройках. Используются значения по умолчанию.
          </p>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}