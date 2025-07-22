import { ErrorState, ErrorResponse } from '@/types';

export type ErrorType = 'ASR_ERROR' | 'LLM_ERROR' | 'TTS_ERROR' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR';

export interface ToastNotification {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  timestamp: Date;
  duration?: number;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorListeners: ((error: ErrorResponse) => void)[] = [];
  private toastListeners: ((toast: ToastNotification) => void)[] = [];
  private currentErrors: ErrorState = {
    asrError: null,
    llmError: null,
    ttsError: null,
    connectionError: null,
  };

  private constructor() {}

  public static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle ASR (Speech Recognition) errors
   */
  public handleASRError(error: Error): void {
    const errorResponse: ErrorResponse = {
      type: 'ASR_ERROR',
      message: this.getASRErrorMessage(error.message),
      details: error,
      timestamp: new Date(),
    };

    this.currentErrors.asrError = errorResponse.message;
    this.notifyError(errorResponse);
    this.showToastInternal({
      type: 'error',
      title: 'Voice Recognition Error',
      message: errorResponse.message,
    });

    console.error('ASR Error:', error);
  }

  /**
   * Handle LLM (Language Model) errors
   */
  public handleLLMError(error: Error): void {
    const errorResponse: ErrorResponse = {
      type: 'LLM_ERROR',
      message: this.getLLMErrorMessage(error.message),
      details: error,
      timestamp: new Date(),
    };

    this.currentErrors.llmError = errorResponse.message;
    this.notifyError(errorResponse);
    this.showToastInternal({
      type: 'error',
      title: 'AI Response Error',
      message: errorResponse.message,
    });

    console.error('LLM Error:', error);
  }

  /**
   * Handle TTS (Text-to-Speech) errors
   */
  public handleTTSError(error: Error): void {
    const errorResponse: ErrorResponse = {
      type: 'TTS_ERROR',
      message: this.getTTSErrorMessage(error.message),
      details: error,
      timestamp: new Date(),
    };

    this.currentErrors.ttsError = errorResponse.message;
    this.notifyError(errorResponse);
    this.showToastInternal({
      type: 'warning',
      title: 'Voice Synthesis Error',
      message: errorResponse.message,
    });

    console.error('TTS Error:', error);
  }

  /**
   * Handle connection errors
   */
  public handleConnectionError(error: Error): void {
    const errorResponse: ErrorResponse = {
      type: 'CONNECTION_ERROR',
      message: this.getConnectionErrorMessage(error.message),
      details: error,
      timestamp: new Date(),
    };

    this.currentErrors.connectionError = errorResponse.message;
    this.notifyError(errorResponse);
    this.showToastInternal({
      type: 'error',
      title: 'Connection Error',
      message: errorResponse.message,
    });

    console.error('Connection Error:', error);
  }

  /**
   * Clear specific error type
   */
  public clearError(errorType: keyof ErrorState): void {
    this.currentErrors[errorType] = null;
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
   * Show toast notification (public method)
   */
  public showToast(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    const notification: ToastNotification = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
      timestamp: new Date(),
      duration: toast.type === 'error' ? 5000 : 3000,
      ...toast,
    };

    this.toastListeners.forEach(listener => listener(notification));
  }

  /**
   * Show toast notification (private method for internal use)
   */
  private showToastInternal(toast: Omit<ToastNotification, 'id' | 'timestamp'>): void {
    this.showToast(toast);
  }

  /**
   * Notify error listeners
   */
  private notifyError(error: ErrorResponse): void {
    this.errorListeners.forEach(listener => listener(error));
  }

  /**
   * Get user-friendly ASR error message
   */
  private getASRErrorMessage(originalMessage: string): string {
    if (originalMessage.includes('not-allowed')) {
      return 'Microphone access denied. Please allow microphone permissions and try again.';
    }
    if (originalMessage.includes('no-speech')) {
      return 'No speech detected. Please speak clearly and try again.';
    }
    if (originalMessage.includes('network')) {
      return 'Network error during voice recognition. Please check your connection.';
    }
    if (originalMessage.includes('not available')) {
      return 'Voice recognition is not available in your browser. Please try typing instead.';
    }
    if (originalMessage.includes('timeout')) {
      return 'Voice recognition timed out. Please try speaking again.';
    }
    return 'Voice recognition failed. Please try again or use text input.';
  }

  /**
   * Get user-friendly LLM error message
   */
  private getLLMErrorMessage(originalMessage: string): string {
    if (originalMessage.includes('rate limit')) {
      return 'Too many requests. Please wait a moment before trying again.';
    }
    if (originalMessage.includes('network') || originalMessage.includes('fetch')) {
      return 'Network error connecting to AI service. Please check your connection.';
    }
    if (originalMessage.includes('timeout')) {
      return 'AI response timed out. Please try again.';
    }
    if (originalMessage.includes('quota') || originalMessage.includes('billing')) {
      return 'AI service temporarily unavailable. Please try again later.';
    }
    return 'Failed to get AI response. Please try again.';
  }

  /**
   * Get user-friendly TTS error message
   */
  private getTTSErrorMessage(originalMessage: string): string {
    if (originalMessage.includes('not available')) {
      return 'Voice synthesis not available. Text will be displayed instead.';
    }
    if (originalMessage.includes('network')) {
      return 'Network error during voice synthesis. Text will be displayed instead.';
    }
    if (originalMessage.includes('interrupted')) {
      return 'Voice synthesis was interrupted.';
    }
    return 'Voice synthesis failed. Text will be displayed instead.';
  }

  /**
   * Get user-friendly connection error message
   */
  private getConnectionErrorMessage(originalMessage: string): string {
    if (originalMessage.includes('WebSocket')) {
      return 'Lost connection to game server. Attempting to reconnect...';
    }
    if (originalMessage.includes('timeout')) {
      return 'Connection timed out. Please check your internet connection.';
    }
    if (originalMessage.includes('refused')) {
      return 'Cannot connect to game server. Please try again later.';
    }
    return 'Connection error. Please check your internet connection and try again.';
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();