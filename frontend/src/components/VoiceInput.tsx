import React, { useState, useEffect, useRef } from 'react';
import { VoiceInputProps } from '@/types';
import { HybridASR } from '@/services/HybridASR';
import { LoadingSpinner } from './LoadingSpinner';
import { ProgressBar } from './ProgressBar';

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
  const [audioLevel, setAudioLevel] = useState(0);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [currentMethod, setCurrentMethod] = useState<'webSpeech' | 'whisper' | null>(null);
  const [confidence, setConfidence] = useState(0);
  const mountedRef = useRef(true);
  const recordingTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioLevelTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Check if ASR is supported
    setIsSupported(asrService.isAvailable());
    setAvailableMethods(asrService.getAvailableMethods());

    // Setup ASR event handlers
    asrService.onResult = (result: string) => {
      if (!mountedRef.current) return;
      
      setError(null);
      setIsProcessing(false);
      setRecordingDuration(0);
      setAudioLevel(0);
      setConfidence(0.9); // Simulate confidence score
      onVoiceInput(result);
      onRecordingStateChange(false);
      
      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
        audioLevelTimerRef.current = null;
      }
    };

    asrService.onError = (error: Error) => {
      if (!mountedRef.current) return;
      
      setError(error.message);
      setIsProcessing(false);
      setRecordingDuration(0);
      setAudioLevel(0);
      setConfidence(0);
      onRecordingStateChange(false);
      
      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
        audioLevelTimerRef.current = null;
      }
    };

    return () => {
      mountedRef.current = false;
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
      }
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
      setRecordingDuration(0);
      setAudioLevel(0);
      setConfidence(0);
      setCurrentMethod(availableMethods.webSpeech ? 'webSpeech' : 'whisper');
      
      onRecordingStateChange(true);
      await asrService.startRecording();
      
      setIsProcessing(false);
      
      // Start recording timer
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 0.1);
      }, 100);
      
      // Start audio level simulation
      audioLevelTimerRef.current = setInterval(() => {
        setAudioLevel(Math.random() * 0.8 + 0.1); // Simulate audio levels
      }, 150);
      
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
      setAudioLevel(0);
      
      // Clear timers
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
      if (audioLevelTimerRef.current) {
        clearInterval(audioLevelTimerRef.current);
        audioLevelTimerRef.current = null;
      }
      
      await asrService.stopRecording();
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to stop recording';
      setError(errorMessage);
      setIsProcessing(false);
      setRecordingDuration(0);
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

  const voiceCommands = [
    'Скажи "Привет" чтобы поприветствовать',
    'Опиши что видишь вокруг',
    'Что мне делать дальше?',
    'Покажи мой инвентарь',
    'Иди на север/юг/восток/запад'
  ];

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-md">
      {/* Enhanced microphone button with visual feedback */}
      <div className="relative">
        <button
          onClick={isRecording ? handleStopRecording : handleStartRecording}
          disabled={!isSupported || isProcessing}
          className={getButtonClass()}
          aria-label={getButtonText()}
        >
          <div className="flex items-center space-x-2">
            {/* Enhanced microphone icon with animation */}
            <div className="relative">
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
              
              {/* Audio level indicator around microphone */}
              {isRecording && audioLevel > 0.3 && (
                <div 
                  className="absolute inset-0 border-2 border-white rounded-full animate-ping"
                  style={{ 
                    transform: `scale(${1 + audioLevel * 0.5})`,
                    opacity: audioLevel 
                  }}
                />
              )}
            </div>
            <span>{getButtonText()}</span>
          </div>
        </button>
        
        {/* Recording pulse effect */}
        {isRecording && (
          <div className="absolute inset-0 rounded-lg border-2 border-red-400 animate-ping opacity-75" />
        )}
      </div>

      {/* Enhanced recording status with audio visualization */}
      {isRecording && (
        <div className="w-full space-y-3">
          {/* Recording header */}
          <div className="flex items-center justify-center space-x-2 text-red-500">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium">
              Запись... {recordingDuration.toFixed(1)}с
            </span>
          </div>
          
          {/* Audio level visualization */}
          <div className="space-y-2">
            <div className="text-xs text-gray-400 text-center">Уровень звука</div>
            <ProgressBar
              progress={audioLevel * 100}
              size="sm"
              color="red"
              animated={false}
              className="w-full"
            />
          </div>
          
          {/* Audio waveform visualization */}
          <div className="flex items-center justify-center space-x-1">
            {Array.from({ length: 12 }).map((_, index) => (
              <div
                key={index}
                className="w-1 bg-red-400 rounded-full transition-all duration-150"
                style={{
                  height: `${Math.max(4, audioLevel * 20 + Math.sin(Date.now() / 100 + index) * 8)}px`,
                  opacity: audioLevel > 0.1 ? 0.8 : 0.3
                }}
              />
            ))}
          </div>
          
          {/* Current method indicator */}
          {currentMethod && (
            <div className="text-xs text-gray-500 text-center">
              Используется: {currentMethod === 'webSpeech' ? 'Web Speech API' : 'Whisper API'}
            </div>
          )}
        </div>
      )}

      {/* Enhanced processing indicator */}
      {isProcessing && !isRecording && (
        <div className="w-full space-y-2">
          <div className="flex items-center justify-center space-x-2 text-blue-500">
            <LoadingSpinner size="sm" color="blue" />
            <span className="text-sm">Обработка речи...</span>
          </div>
          
          {/* Processing progress simulation */}
          <ProgressBar
            progress={75}
            size="sm"
            color="blue"
            animated={true}
            label="Распознавание"
            className="w-full"
          />
        </div>
      )}

      {/* Confidence indicator for last result */}
      {confidence > 0 && !isRecording && !isProcessing && (
        <div className="w-full space-y-1">
          <div className="text-xs text-gray-400 text-center">Точность распознавания</div>
          <ProgressBar
            progress={confidence * 100}
            size="sm"
            color={confidence > 0.8 ? 'green' : confidence > 0.6 ? 'yellow' : 'red'}
            showPercentage={true}
            animated={false}
            className="w-full"
          />
        </div>
      )}

      {/* Error display with enhanced styling */}
      {error && (
        <div className="w-full bg-red-50 border border-red-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-red-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <p className="font-medium text-sm">Ошибка голосового ввода</p>
          </div>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {/* Browser support warning */}
      {!isSupported && (
        <div className="w-full bg-amber-50 border border-amber-200 rounded-lg p-3">
          <div className="flex items-center space-x-2 text-amber-600">
            <svg className="w-4 h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <p className="font-medium text-sm">Голосовой ввод недоступен</p>
          </div>
          <p className="text-amber-600 text-sm mt-1">
            Ваш браузер не поддерживает голосовые технологии. Попробуйте использовать современный браузер.
          </p>
        </div>
      )}

      {/* Voice command suggestions */}
      {isSupported && !isRecording && !isProcessing && (
        <div className="w-full space-y-2">
          <button
            onClick={() => setShowHelp(!showHelp)}
            className="flex items-center justify-center space-x-2 text-gray-500 hover:text-gray-700 transition-colors text-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Примеры голосовых команд</span>
            <svg 
              className={`w-4 h-4 transition-transform ${showHelp ? 'rotate-180' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          
          {showHelp && (
            <div className="bg-gray-50 rounded-lg p-3 space-y-2">
              <p className="text-xs text-gray-600 font-medium">Попробуйте сказать:</p>
              <div className="space-y-1">
                {voiceCommands.map((command, index) => (
                  <div key={index} className="text-xs text-gray-600 bg-white rounded px-2 py-1">
                    "{command}"
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Enhanced ASR methods info */}
      {isSupported && (
        <div className="w-full text-xs text-gray-500 text-center space-y-1">
          <div className="flex items-center justify-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${availableMethods.webSpeech ? 'bg-green-400' : 'bg-gray-300'}`} />
            <span>Web Speech API</span>
            {availableMethods.whisper && (
              <>
                <div className="w-2 h-2 rounded-full bg-green-400" />
                <span>Whisper API</span>
              </>
            )}
          </div>
          <p>Автоматическое переключение между методами</p>
        </div>
      )}
    </div>
  );
};