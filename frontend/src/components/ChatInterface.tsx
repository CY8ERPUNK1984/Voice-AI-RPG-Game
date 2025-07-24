import React, { useEffect, useRef, useState } from 'react';
import { ChatInterfaceProps } from '../types';
import Message from './Message';
import { VoiceInput } from './VoiceInput';
import { TypingIndicator } from './TypingIndicator';
import { LoadingSpinner } from './LoadingSpinner';
import { SkeletonLoader } from './SkeletonLoader';
import { VoiceProcessingIndicator } from './VoiceProcessingIndicator';
import { ProgressBar } from './ProgressBar';

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onVoiceInput,
  isRecording = false,
  onRecordingStateChange,
  audioSettings
}) => {
  // TODO: Implement audioSettings integration for voice input customization
  // Currently audioSettings is passed but not used - will be implemented in future tasks
  // Suppress TypeScript warning for now
  void audioSettings;
  const [inputText, setInputText] = useState('');
  const [voiceProcessingStage, setVoiceProcessingStage] = useState<'idle' | 'recording' | 'processing' | 'transcribing' | 'complete' | 'error'>('idle');
  const [voiceProgress, setVoiceProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState<'thinking' | 'generating' | 'finalizing'>('thinking');
  const [estimatedTime, setEstimatedTime] = useState(8);
  const [showDetailedProgress, setShowDetailedProgress] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    if (messagesEndRef.current && typeof messagesEndRef.current.scrollIntoView === 'function') {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputText.trim() && !isLoading) {
      onSendMessage(inputText.trim());
      setInputText('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const handleVoiceInput = (text: string) => {
    if (onVoiceInput) {
      onVoiceInput(text);
    } else {
      setInputText(text);
    }
  };

  const handleRecordingStateChange = (recording: boolean) => {
    if (recording) {
      setVoiceProcessingStage('recording');
      setVoiceProgress(0);
      // Simulate audio level changes during recording
      const audioLevelInterval = setInterval(() => {
        setAudioLevel(Math.random() * 0.8 + 0.2);
      }, 100);
      
      // Clean up interval when recording stops
      setTimeout(() => {
        clearInterval(audioLevelInterval);
      }, 5000);
    } else {
      setVoiceProcessingStage('processing');
      setVoiceProgress(0);
      setAudioLevel(0);
      
      // Simulate processing progress
      const progressInterval = setInterval(() => {
        setVoiceProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            setVoiceProcessingStage('complete');
            setTimeout(() => setVoiceProcessingStage('idle'), 2000);
            return 100;
          }
          return prev + 10;
        });
      }, 200);
    }
    
    if (onRecordingStateChange) {
      onRecordingStateChange(recording);
    }
  };

  // Enhanced loading progress simulation for AI responses
  useEffect(() => {
    if (isLoading) {
      setLoadingProgress(0);
      setLoadingStage('thinking');
      setEstimatedTime(8 + Math.random() * 4); // 8-12 seconds estimate
      
      const progressInterval = setInterval(() => {
        setLoadingProgress(prev => {
          // Stage transitions based on progress
          if (prev >= 30 && prev < 70) {
            setLoadingStage('generating');
          } else if (prev >= 70) {
            setLoadingStage('finalizing');
          }
          
          // Slower progress at the end to avoid reaching 100% too early
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90; // Cap at 90% until actual response arrives
          }
          
          // Variable speed based on stage
          const increment = prev < 30 ? Math.random() * 8 + 2 : 
                           prev < 70 ? Math.random() * 6 + 1 : 
                           Math.random() * 3 + 0.5;
          
          return Math.min(prev + increment, 90);
        });
      }, 400);

      return () => clearInterval(progressInterval);
    } else {
      setLoadingProgress(100);
      setLoadingStage('thinking');
      setTimeout(() => {
        setLoadingProgress(0);
        setShowDetailedProgress(false);
      }, 800);
    }
  }, [isLoading]);

  return (
    <div 
      className="flex flex-col h-full bg-gray-800 rounded-lg"
      role="region"
      aria-label="Game chat interface"
    >
      {/* Chat Header */}
      <header 
        className="flex-shrink-0 px-6 py-4 border-b border-gray-700"
        role="banner"
      >
        <h2 
          className="text-xl font-semibold text-white"
          id="chat-title"
        >
          Game Chat
        </h2>
        <p 
          className="text-sm text-gray-400"
          aria-live="polite"
          aria-label={`Chat contains ${messages.length} message${messages.length !== 1 ? 's' : ''}`}
        >
          {messages.length} message{messages.length !== 1 ? 's' : ''}
        </p>
      </header>

      {/* Messages Container */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-2"
        style={{ maxHeight: '60vh' }}
        data-testid="chat-messages"
        role="log"
        aria-live="polite"
        aria-labelledby="chat-title"
        aria-describedby="chat-description"
        tabIndex={0}
      >
        <div id="chat-description" className="sr-only">
          Chat messages between you and the AI game master. Use arrow keys to navigate through messages.
        </div>
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center text-gray-500">
              <div className="text-4xl mb-2">💬</div>
              <p>No messages yet</p>
              <p className="text-sm">Start the conversation!</p>
            </div>
          </div>
        ) : (
          messages.map((message) => (
            <Message key={message.id} message={message} />
          ))
        )}

        {/* Enhanced Loading indicator with detailed progress and animations */}
        {isLoading && (
          <div className="flex justify-start mb-4">
            <div className="max-w-xs lg:max-w-md px-4 py-3 rounded-lg bg-gray-700 border border-gray-600 relative overflow-hidden">
              {/* Animated background gradient */}
              <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-blue-900/20 to-purple-900/20 animate-pulse" />
              
              <div className="relative">
                <div className="flex items-center space-x-3 mb-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center text-sm font-bold animate-pulse">
                    AI
                  </div>
                  <div className="flex-1">
                    <TypingIndicator 
                      className="text-gray-300" 
                      variant="wave"
                      showProgress={true}
                      estimatedTime={estimatedTime}
                    />
                    
                    {/* Stage indicator */}
                    <div className="mt-1 text-xs text-gray-400">
                      {loadingStage === 'thinking' && '🤔 Обдумывание ответа...'}
                      {loadingStage === 'generating' && '✍️ Создание текста...'}
                      {loadingStage === 'finalizing' && '🎯 Финализация...'}
                    </div>
                  </div>
                  
                  {/* Toggle detailed progress */}
                  <button
                    onClick={() => setShowDetailedProgress(!showDetailedProgress)}
                    className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    aria-label="Toggle detailed progress"
                  >
                    {showDetailedProgress ? '▼' : '▶'}
                  </button>
                </div>
                
                {/* Skeleton preview with enhanced animation */}
                <div className="ml-11 space-y-2 mb-3">
                  <SkeletonLoader 
                    variant="response" 
                    lines={loadingStage === 'thinking' ? 1 : loadingStage === 'generating' ? 2 : 3} 
                    animated={true}
                    shimmer={true}
                  />
                </div>
                
                {/* Enhanced progress indicator */}
                <div className="ml-11">
                  <ProgressBar
                    progress={loadingProgress}
                    size="sm"
                    color="purple"
                    showPercentage={showDetailedProgress}
                    label={showDetailedProgress ? `${loadingStage === 'thinking' ? 'Анализ' : loadingStage === 'generating' ? 'Генерация' : 'Завершение'}` : undefined}
                    animated={true}
                    className="mb-2"
                  />
                  
                  {/* Detailed progress information */}
                  {showDetailedProgress && (
                    <div className="space-y-1 text-xs text-gray-400">
                      <div className="flex justify-between">
                        <span>Прогресс:</span>
                        <span>{Math.round(loadingProgress)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Этап:</span>
                        <span className="capitalize">
                          {loadingStage === 'thinking' && 'Анализ запроса'}
                          {loadingStage === 'generating' && 'Генерация ответа'}
                          {loadingStage === 'finalizing' && 'Подготовка к отправке'}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span>Осталось:</span>
                        <span>~{Math.max(1, Math.round((100 - loadingProgress) / 100 * estimatedTime))}с</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Scroll anchor */}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Form */}
      <footer 
        className="flex-shrink-0 px-6 py-4 border-t border-gray-700"
        role="contentinfo"
      >
        <form 
          onSubmit={handleSubmit} 
          className="flex space-x-3"
          role="form"
          aria-label="Send message form"
        >
          <div className="flex-1">
            <label htmlFor="message-input" className="sr-only">
              Type your message to the AI game master
            </label>
            <textarea
              id="message-input"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your message here..."
              className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={2}
              disabled={isLoading}
              aria-describedby="input-help"
              aria-invalid={false}
            />
          </div>
          <button
            type="submit"
            disabled={!inputText.trim() || isLoading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label={isLoading ? 'Sending message...' : 'Send message'}
            aria-describedby="send-button-help"
          >
            {isLoading ? (
              <>
                <LoadingSpinner size="sm" color="white" />
                <span className="sr-only">Sending message...</span>
              </>
            ) : (
              'Send'
            )}
          </button>
        </form>
        <div 
          id="input-help" 
          className="mt-2 text-xs text-gray-500"
          role="note"
        >
          Press Enter to send, Shift+Enter for new line
        </div>
        <div id="send-button-help" className="sr-only">
          Click to send your message to the AI game master
        </div>

        {/* Voice Input Section */}
        <section 
          className="mt-4 pt-4 border-t border-gray-700"
          role="region"
          aria-labelledby="voice-input-title"
        >
          <div className="flex flex-col items-center space-y-3">
            <h3 
              id="voice-input-title"
              className="text-sm text-gray-400 mb-2"
            >
              Голосовой ввод
            </h3>
            
            {/* Voice Processing Indicator */}
            {voiceProcessingStage !== 'idle' && (
              <div 
                role="status" 
                aria-live="polite"
                aria-label="Voice processing status"
              >
                <VoiceProcessingIndicator
                  stage={voiceProcessingStage}
                  progress={voiceProgress}
                  audioLevel={audioLevel}
                  className="w-full max-w-md"
                />
              </div>
            )}
            
            <VoiceInput
              onVoiceInput={handleVoiceInput}
              isRecording={isRecording}
              onRecordingStateChange={handleRecordingStateChange}
            />
          </div>
        </section>
      </footer>
    </div>
  );
};

export default ChatInterface;