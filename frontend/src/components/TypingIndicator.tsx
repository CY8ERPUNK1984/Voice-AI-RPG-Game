import React, { useState, useEffect } from 'react';

interface TypingIndicatorProps {
  className?: string;
  text?: string;
  variant?: 'dots' | 'wave' | 'pulse' | 'typing' | 'brain' | 'sparkle';
  showProgress?: boolean;
  estimatedTime?: number; // in seconds
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className = '',
  text = 'ИИ печатает',
  variant = 'dots',
  showProgress = false,
  estimatedTime = 0,
  size = 'md',
  animated = true
}) => {
  const [progress, setProgress] = useState(0);
  const [elapsedTime, setElapsedTime] = useState(0);

  useEffect(() => {
    if (!showProgress || estimatedTime <= 0) return;

    const interval = setInterval(() => {
      setElapsedTime(prev => {
        const newTime = prev + 0.1;
        setProgress(Math.min((newTime / estimatedTime) * 100, 95)); // Cap at 95% until complete
        return newTime;
      });
    }, 100);

    return () => clearInterval(interval);
  }, [showProgress, estimatedTime]);

  const getSizeClasses = () => {
    switch (size) {
      case 'sm':
        return { dot: 'w-1.5 h-1.5', bar: 'w-0.5 h-3', spacing: 'space-x-0.5' };
      case 'lg':
        return { dot: 'w-3 h-3', bar: 'w-1.5 h-6', spacing: 'space-x-1.5' };
      case 'md':
      default:
        return { dot: 'w-2 h-2', bar: 'w-1 h-4', spacing: 'space-x-1' };
    }
  };

  const sizeClasses = getSizeClasses();

  const renderIndicator = () => {
    if (!animated) {
      return <div className="w-4 h-4 bg-gray-400 rounded-full" />;
    }

    switch (variant) {
      case 'wave':
        return (
          <div className={`flex ${sizeClasses.spacing}`}>
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="bg-gradient-to-t from-purple-400 to-blue-400 rounded-full animate-pulse"
                style={{
                  width: size === 'sm' ? '3px' : size === 'lg' ? '5px' : '4px',
                  height: `${(size === 'sm' ? 6 : size === 'lg' ? 12 : 8) + Math.sin(Date.now() / 200 + index) * (size === 'sm' ? 2 : size === 'lg' ? 6 : 4)}px`,
                  animationDelay: `${index * 0.1}s`,
                  animationDuration: '1s'
                }}
              />
            ))}
          </div>
        );

      case 'pulse':
        return (
          <div className={`flex ${sizeClasses.spacing}`}>
            <div className={`${sizeClasses.dot} bg-purple-400 rounded-full animate-ping`} />
            <div className={`${sizeClasses.dot} bg-blue-400 rounded-full animate-ping`} style={{ animationDelay: '0.2s' }} />
            <div className={`${sizeClasses.dot} bg-green-400 rounded-full animate-ping`} style={{ animationDelay: '0.4s' }} />
          </div>
        );

      case 'brain':
        return (
          <div className="flex items-center space-x-2">
            <div className="relative">
              <div className={`${sizeClasses.dot} bg-purple-500 rounded-full animate-pulse`} />
              <div className={`absolute inset-0 ${sizeClasses.dot} bg-purple-300 rounded-full animate-ping`} />
            </div>
            <div className="flex space-x-0.5">
              {Array.from({ length: 3 }).map((_, index) => (
                <div
                  key={index}
                  className="w-0.5 bg-purple-400 rounded-full animate-pulse"
                  style={{
                    height: `${4 + Math.random() * 4}px`,
                    animationDelay: `${index * 0.15}s`,
                    animationDuration: '0.8s'
                  }}
                />
              ))}
            </div>
          </div>
        );

      case 'sparkle':
        return (
          <div className="flex items-center space-x-1">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="relative"
              >
                <div 
                  className={`${sizeClasses.dot} bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full animate-pulse`}
                  style={{ animationDelay: `${index * 0.2}s` }}
                />
                {index % 2 === 0 && (
                  <div className="absolute inset-0 animate-spin">
                    <div className="w-full h-0.5 bg-yellow-300 absolute top-1/2 left-0 transform -translate-y-1/2" />
                    <div className="h-full w-0.5 bg-yellow-300 absolute left-1/2 top-0 transform -translate-x-1/2" />
                  </div>
                )}
              </div>
            ))}
          </div>
        );

      case 'typing':
        return (
          <div className="flex items-center space-x-1">
            <div className={`flex ${sizeClasses.spacing}`}>
              <div className={`${sizeClasses.bar} bg-gray-400 rounded animate-pulse`} />
              <div className={`w-1 h-3 bg-gray-400 rounded animate-pulse`} style={{ animationDelay: '0.1s' }} />
              <div className={`${sizeClasses.bar} bg-gray-400 rounded animate-pulse`} style={{ animationDelay: '0.2s' }} />
              <div className={`w-1 h-2 bg-gray-400 rounded animate-pulse`} style={{ animationDelay: '0.3s' }} />
            </div>
            <div className="w-0.5 h-4 bg-blue-400 animate-pulse" />
          </div>
        );

      case 'dots':
      default:
        return (
          <div className={`flex ${sizeClasses.spacing}`}>
            <div className={`${sizeClasses.dot} bg-gray-400 rounded-full animate-bounce`} />
            <div 
              className={`${sizeClasses.dot} bg-gray-400 rounded-full animate-bounce`}
              style={{ animationDelay: '0.1s' }}
            />
            <div 
              className={`${sizeClasses.dot} bg-gray-400 rounded-full animate-bounce`}
              style={{ animationDelay: '0.2s' }}
            />
          </div>
        );
    }
  };

  return (
    <div className={`flex flex-col space-y-2 ${className}`}>
      <div className="flex items-center space-x-3">
        {renderIndicator()}
        <span className="text-sm text-gray-500">{text}</span>
      </div>
      
      {showProgress && estimatedTime > 0 && (
        <div className="flex items-center space-x-2 text-xs text-gray-400">
          <div className="flex-1 bg-gray-700 rounded-full h-1">
            <div
              className="bg-blue-400 h-1 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span>{Math.round(elapsedTime)}с</span>
        </div>
      )}
    </div>
  );
};