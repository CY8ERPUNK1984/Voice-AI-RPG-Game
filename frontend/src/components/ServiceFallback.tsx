import React from 'react';
import { errorManager } from '@/services/ErrorManager';
import { AppError, ToastAction } from '@/types';

interface ServiceFallbackProps {
  serviceName: string;
  error?: string | AppError;
  onRetry?: () => void;
  children?: React.ReactNode;
  showRecoveryActions?: boolean;
}

export const ServiceFallback: React.FC<ServiceFallbackProps> = ({
  serviceName,
  error,
  onRetry,
  children,
  showRecoveryActions = true
}) => {
  const [isRetrying, setIsRetrying] = React.useState(false);
  
  const appError = typeof error === 'object' ? error : null;
  const errorMessage = typeof error === 'string' ? error : 
    appError ? errorManager.getLocalizedMessage(appError) : 
    `${serviceName} временно недоступен`;

  const handleRetry = async () => {
    if (!onRetry) return;
    
    setIsRetrying(true);
    try {
      await onRetry();
    } finally {
      setIsRetrying(false);
    }
  };

  const renderRecoveryActions = () => {
    if (!showRecoveryActions || !appError) return null;

    const actions: ToastAction[] = [];
    
    if (appError.retryable && onRetry) {
      actions.push({
        label: 'Повторить',
        action: handleRetry,
        primary: true
      });
    }

    // Add service-specific recovery actions
    if (serviceName.toLowerCase().includes('микрофон') || serviceName.toLowerCase().includes('voice')) {
      actions.push({
        label: 'Проверить разрешения',
        action: () => {
          errorManager.showToast({
            type: 'info',
            title: 'Разрешения микрофона',
            message: 'Проверьте, что доступ к микрофону разрешен в настройках браузера'
          });
        }
      });
    }

    if (actions.length === 0) return null;

    return (
      <div className="mt-3 space-y-2">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.action}
            disabled={isRetrying}
            className={`w-full px-3 py-2 rounded text-sm font-medium transition-colors ${
              action.primary 
                ? 'bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white'
                : 'bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-white'
            }`}
          >
            {isRetrying && action.primary ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Повторяем...
              </>
            ) : (
              action.label
            )}
          </button>
        ))}
      </div>
    );
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center">
      <div className="mb-3">
        <svg
          className={`w-8 h-8 mx-auto mb-2 ${
            appError?.severity === 'critical' ? 'text-red-500' :
            appError?.severity === 'high' ? 'text-orange-500' :
            'text-yellow-500'
          }`}
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
        <h3 className={`text-lg font-medium ${
          appError?.severity === 'critical' ? 'text-red-400' :
          appError?.severity === 'high' ? 'text-orange-400' :
          'text-yellow-400'
        }`}>
          {serviceName} недоступен
        </h3>
      </div>
      
      <p className="text-sm text-gray-400 mb-3">
        {errorMessage}
      </p>
      
      {children && (
        <div className="mb-3">
          {children}
        </div>
      )}
      
      {renderRecoveryActions()}
      
      {!showRecoveryActions && onRetry && (
        <button
          onClick={handleRetry}
          disabled={isRetrying}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-800 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
        >
          {isRetrying ? 'Повторяем...' : 'Попробовать снова'}
        </button>
      )}
    </div>
  );
};

interface VoiceInputFallbackProps {
  onTextInput: (text: string) => void;
  error?: string;
  onRetryVoice?: () => void;
}

export const VoiceInputFallback: React.FC<VoiceInputFallbackProps> = ({
  onTextInput,
  error,
  onRetryVoice
}) => {
  const [inputText, setInputText] = React.useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim()) {
      onTextInput(inputText.trim());
      setInputText('');
    }
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center mb-3">
        <svg
          className="w-5 h-5 text-yellow-500 mr-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          />
        </svg>
        <span className="text-sm font-medium text-yellow-400">
          Голосовой ввод недоступен
        </span>
      </div>
      
      {error && (
        <p className="text-xs text-gray-400 mb-3">
          {error}
        </p>
      )}
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="flex space-x-2">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            placeholder="Введите ваше сообщение здесь..."
            className="flex-1 bg-gray-700 border border-gray-600 rounded px-3 py-2 text-sm text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors"
          >
            Отправить
          </button>
        </div>
        
        {onRetryVoice && (
          <button
            type="button"
            onClick={onRetryVoice}
            className="w-full bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded text-sm font-medium transition-colors"
          >
            Попробовать голосовой ввод снова
          </button>
        )}
      </form>
    </div>
  );
};

interface TTSFallbackProps {
  text: string;
  onRetryTTS?: () => void;
}

export const TTSFallback: React.FC<TTSFallbackProps> = ({
  text,
  onRetryTTS
}) => {
  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-3">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <svg
              className="w-4 h-4 text-yellow-500 mr-2"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
              />
            </svg>
            <span className="text-xs font-medium text-yellow-400">
              Аудио недоступно - только текст
            </span>
          </div>
          <p className="text-sm text-gray-300">
            {text}
          </p>
        </div>
        
        {onRetryTTS && (
          <button
            onClick={onRetryTTS}
            className="ml-3 bg-gray-600 hover:bg-gray-700 text-white px-2 py-1 rounded text-xs font-medium transition-colors"
          >
            Повторить аудио
          </button>
        )}
      </div>
    </div>
  );
};

interface ConnectionFallbackProps {
  onRetry?: () => void;
  isRetrying?: boolean;
}

export const ConnectionFallback: React.FC<ConnectionFallbackProps> = ({
  onRetry,
  isRetrying = false
}) => {
  return (
    <div className="bg-red-900 border border-red-700 rounded-lg p-4 text-center">
      <div className="mb-3">
        <svg
          className="w-8 h-8 text-red-400 mx-auto mb-2"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192L5.636 18.364M12 2.25a9.75 9.75 0 100 19.5 9.75 9.75 0 000-19.5z"
          />
        </svg>
        <h3 className="text-lg font-medium text-red-400">
          Соединение потеряно
        </h3>
      </div>
      
      <p className="text-sm text-red-200 mb-4">
        Не удается подключиться к игровому серверу. Проверьте подключение к интернету.
      </p>
      
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="bg-red-600 hover:bg-red-700 disabled:bg-red-800 disabled:cursor-not-allowed text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center mx-auto"
        >
          {isRetrying ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Переподключение...
            </>
          ) : (
            'Переподключиться'
          )}
        </button>
      )}
    </div>
  );
};