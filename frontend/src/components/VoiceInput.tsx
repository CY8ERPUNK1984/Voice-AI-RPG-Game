import React, { useState, useEffect, useRef } from 'react';
import { VoiceInputProps } from '@/types';
import { HybridASR } from '@/services/HybridASR';
import { LoadingSpinner } from './LoadingSpinner';

export const VoiceInput: React.FC<VoiceInputProps> = ({
  onVoiceInput,
  isRecording,
  onRecordingStateChange,
}) => {
  const [asrService] = useState(() => new HybridASR());
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [availableMethods, setAvailableMethods] = useState({ webSpeech: false, whisper: false });
  const mountedRef = useRef(true);

  useEffect(() => {
    // Check if ASR is supported
    setIsSupported(asrService.isAvailable());
    setAvailableMethods(asrService.getAvailableMethods());

    // Setup ASR event handlers
    asrService.onResult = (result: string) => {
      if (!mountedRef.current) return;
      
      setError(null);
      setIsProcessing(false);
      onVoiceInput(result);
      onRecordingStateChange(false);
    };

    asrService.onError = (error: Error) => {
      if (!mountedRef.current) return;
      
      setError(error.message);
      setIsProcessing(false);
      onRecordingStateChange(false);
    };

    return () => {
      mountedRef.current = false;
    };
  }, [asrService, onVoiceInput, onRecordingStateChange]);

  const handleStartRecording = async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported in this browser');
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      onRecordingStateChange(true);
      await asrService.startRecording();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to start recording';
      setError(errorMessage);
      setIsProcessing(false);
      onRecordingStateChange(false);
    }
  };

  const handleStopRecording = async () => {
    try {
      setIsProcessing(true);
      await asrService.stopRecording();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      setIsProcessing(false);
      onRecordingStateChange(false);
    }
  };

  const getButtonText = () => {
    if (isProcessing) return 'Обработка...';
    if (isRecording) return 'Остановить запись';
    return 'Начать запись';
  };

  const getButtonClass = () => {
    const baseClass = 'px-6 py-3 rounded-lg font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2';
    
    if (!isSupported) {
      return `${baseClass} bg-gray-300 text-gray-500 cursor-not-allowed`;
    }
    
    if (isRecording) {
      return `${baseClass} bg-red-500 hover:bg-red-600 text-white focus:ring-red-500 animate-pulse`;
    }
    
    if (isProcessing) {
      return `${baseClass} bg-blue-400 text-white cursor-not-allowed`;
    }
    
    return `${baseClass} bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-500`;
  };

  return (
    <div className="flex flex-col items-center space-y-4">
      <button
        onClick={isRecording ? handleStopRecording : handleStartRecording}
        disabled={!isSupported || isProcessing}
        className={getButtonClass()}
        aria-label={getButtonText()}
      >
        <div className="flex items-center space-x-2">
          {/* Microphone icon */}
          <svg
            className={`w-5 h-5 ${isRecording ? 'animate-pulse' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
            />
          </svg>
          <span>{getButtonText()}</span>
        </div>
      </button>

      {/* Visual recording indicator */}
      {isRecording && (
        <div className="flex items-center space-x-2 text-red-500">
          <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-medium">Запись...</span>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessing && !isRecording && (
        <div className="flex items-center space-x-2 text-blue-500">
          <LoadingSpinner size="sm" color="blue" />
          <span className="text-sm">Обработка речи...</span>
        </div>
      )}

      {/* Error display */}
      {error && (
        <div className="text-red-500 text-sm text-center max-w-md">
          <p className="font-medium">Ошибка:</p>
          <p>{error}</p>
        </div>
      )}

      {/* Browser support warning */}
      {!isSupported && (
        <div className="text-amber-600 text-sm text-center max-w-md bg-amber-50 p-3 rounded-lg">
          <p className="font-medium">Голосовой ввод недоступен</p>
          <p>Ваш браузер не поддерживает голосовые технологии. Попробуйте использовать современный браузер.</p>
        </div>
      )}

      {/* ASR methods info */}
      {isSupported && (
        <div className="text-xs text-gray-500 text-center max-w-md">
          <p>
            Доступно: {availableMethods.webSpeech && 'Web Speech API'} 
            {availableMethods.webSpeech && availableMethods.whisper && ' + '}
            {availableMethods.whisper && 'Whisper API (резерв)'}
          </p>
        </div>
      )}
    </div>
  );
};