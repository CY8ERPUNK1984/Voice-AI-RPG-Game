import React from 'react';
import { LoadingSpinner } from './LoadingSpinner';
import { ProgressBar } from './ProgressBar';

interface VoiceProcessingIndicatorProps {
  stage: 'idle' | 'recording' | 'processing' | 'transcribing' | 'complete' | 'error';
  progress?: number;
  audioLevel?: number;
  error?: string;
  className?: string;
}

export const VoiceProcessingIndicator: React.FC<VoiceProcessingIndicatorProps> = ({
  stage,
  progress = 0,
  audioLevel = 0,
  error,
  className = ''
}) => {
  const getStageInfo = () => {
    switch (stage) {
      case 'recording':
        return {
          icon: '🎤',
          text: 'Запись...',
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          borderColor: 'border-red-600/30'
        };
      case 'processing':
        return {
          icon: '⚡',
          text: 'Обработка аудио...',
          color: 'text-blue-400',
          bgColor: 'bg-blue-900/30',
          borderColor: 'border-blue-600/30'
        };
      case 'transcribing':
        return {
          icon: '📝',
          text: 'Распознавание речи...',
          color: 'text-purple-400',
          bgColor: 'bg-purple-900/30',
          borderColor: 'border-purple-600/30'
        };
      case 'complete':
        return {
          icon: '✅',
          text: 'Готово!',
          color: 'text-green-400',
          bgColor: 'bg-green-900/30',
          borderColor: 'border-green-600/30'
        };
      case 'error':
        return {
          icon: '❌',
          text: 'Ошибка',
          color: 'text-red-400',
          bgColor: 'bg-red-900/30',
          borderColor: 'border-red-600/30'
        };
      default:
        return null;
    }
  };

  const stageInfo = getStageInfo();

  if (stage === 'idle' || !stageInfo) {
    return null;
  }

  return (
    <div className={`p-3 rounded-lg border ${stageInfo.bgColor} ${stageInfo.borderColor} ${className}`}>
      <div className="flex items-center space-x-3">
        {/* Stage Icon */}
        <div className="flex-shrink-0">
          {stage === 'processing' || stage === 'transcribing' ? (
            <LoadingSpinner size="sm" color="blue" />
          ) : (
            <span className="text-lg">{stageInfo.icon}</span>
          )}
        </div>

        {/* Stage Text and Progress */}
        <div className="flex-1">
          <div className={`text-sm font-medium ${stageInfo.color}`}>
            {stageInfo.text}
          </div>

          {/* Progress Bar for processing stages */}
          {(stage === 'processing' || stage === 'transcribing') && progress > 0 && (
            <div className="mt-2">
              <ProgressBar
                progress={progress}
                size="sm"
                color={stage === 'processing' ? 'blue' : 'purple'}
                showPercentage={true}
                animated={true}
              />
            </div>
          )}

          {/* Audio Level Indicator for recording */}
          {stage === 'recording' && (
            <div className="mt-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-400">Уровень:</span>
                <div className="flex-1">
                  <ProgressBar
                    progress={audioLevel * 100}
                    size="sm"
                    color="red"
                    animated={false}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Error Message */}
          {stage === 'error' && error && (
            <div className="mt-2 text-xs text-red-300">
              {error}
            </div>
          )}
        </div>

        {/* Recording Animation */}
        {stage === 'recording' && (
          <div className="flex-shrink-0">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </div>
        )}
      </div>

      {/* Waveform Animation for Recording */}
      {stage === 'recording' && (
        <div className="mt-3 flex items-center justify-center space-x-1">
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className="w-1 bg-red-400 rounded-full animate-pulse"
              style={{
                height: `${Math.max(4, audioLevel * 20 + Math.random() * 10)}px`,
                animationDelay: `${index * 0.1}s`,
                animationDuration: '0.8s'
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default VoiceProcessingIndicator;