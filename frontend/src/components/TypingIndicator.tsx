import React from 'react';

interface TypingIndicatorProps {
  className?: string;
  text?: string;
}

export const TypingIndicator: React.FC<TypingIndicatorProps> = ({
  className = '',
  text = 'ИИ печатает'
}) => {
  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      <div className="flex space-x-1">
        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
        <div 
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
          style={{ animationDelay: '0.1s' }}
        ></div>
        <div 
          className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" 
          style={{ animationDelay: '0.2s' }}
        ></div>
      </div>
      <span className="text-sm text-gray-500">{text}</span>
    </div>
  );
};