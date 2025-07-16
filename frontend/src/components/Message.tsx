import React from 'react';
import { Message as MessageType } from '../types';

interface MessageProps {
  message: MessageType;
}

const Message: React.FC<MessageProps> = ({ message }) => {
  const isUser = message.type === 'user';
  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`flex mb-4 ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
        isUser 
          ? 'bg-blue-600 text-white' 
          : 'bg-gray-700 text-gray-100'
      }`}>
        <div className="flex items-start space-x-2">
          {!isUser && (
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-sm font-bold">
              AI
            </div>
          )}
          <div className="flex-1">
            <p className="text-sm leading-relaxed">{message.content}</p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs opacity-75">
                {formatTime(message.timestamp)}
              </span>
              {message.audioUrl && (
                <button 
                  className="text-xs opacity-75 hover:opacity-100 transition-opacity"
                  title="Play audio"
                >
                  🔊
                </button>
              )}
            </div>
            {message.metadata.confidence && (
              <div className="text-xs opacity-60 mt-1">
                Confidence: {Math.round(message.metadata.confidence * 100)}%
              </div>
            )}
          </div>
          {isUser && (
            <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
              U
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Message;