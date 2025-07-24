import React from 'react';
import { Story, GameSession, ErrorState } from '../types';
import { ConnectionState, ConnectionHealth } from '../services/ConnectionManager';
import ChatInterface from './ChatInterface';
import { ConnectionStatus } from './ConnectionStatus';
import { useGame } from '../contexts/GameContext';
import { useSettings } from '../contexts/SettingsContext';

interface GameInterfaceProps {
  currentStory: Story;
  gameSession: GameSession | null;
  errorState: ErrorState;
  connectionState: ConnectionState;
  connectionHealth: ConnectionHealth | null;
  onStoryChange: () => void;
  onManualReconnect: () => Promise<void>;
  isOffline: boolean;
}

export function GameInterface({
  currentStory,
  gameSession,
  errorState,
  connectionState,
  connectionHealth,
  onStoryChange,
  onManualReconnect,
  isOffline
}: GameInterfaceProps) {
  const { 
    messages, 
    isLoading, 
    isRecording, 
    sendMessage, 
    handleVoiceInput, 
    setRecordingState 
  } = useGame();
  const { audioSettings } = useSettings();

  return (
    <div 
      className="grid grid-cols-1 lg:grid-cols-4 gap-6"
      role="region"
      aria-label="Game interface"
    >
      {/* Status Panel */}
      <aside 
        className="lg:col-span-1"
        role="complementary"
        aria-label="Game status and controls"
      >
        {/* Current Story Section */}
        <section 
          className="bg-gray-800 rounded-lg p-4 mb-4"
          role="region"
          aria-labelledby="current-story-title"
        >
          <h3 
            id="current-story-title"
            className="text-lg font-semibold mb-3"
          >
            Current Story
          </h3>
          <div className="space-y-2 text-sm">
            <p 
              className="font-medium text-blue-400"
              aria-label={`Story title: ${currentStory.title}`}
            >
              {currentStory.title}
            </p>
            <p 
              className="text-gray-400"
              aria-label={`Story description: ${currentStory.description}`}
            >
              {currentStory.description}
            </p>
            <span 
              className="inline-block px-2 py-1 bg-purple-600 text-xs rounded"
              role="badge"
              aria-label={`Genre: ${currentStory.genre}`}
            >
              {currentStory.genre}
            </span>
          </div>

          <button
            onClick={onStoryChange}
            className="mt-3 text-xs text-gray-400 hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 rounded px-2 py-1"
            aria-label="Change story selection"
          >
            ← Change Story
          </button>
        </section>

        {/* Connection Status Component */}
        <ConnectionStatus
          connectionState={connectionState}
          connectionHealth={connectionHealth}
          onManualReconnect={onManualReconnect}
          isOffline={isOffline}
        />

        {/* Game Session Status */}
        <section 
          className="bg-gray-800 rounded-lg p-4 mt-4"
          role="region"
          aria-labelledby="game-session-title"
          aria-live="polite"
        >
          <h3 
            id="game-session-title"
            className="text-lg font-semibold mb-3"
          >
            Игровая сессия
          </h3>
          <div className="space-y-2 text-sm text-gray-400">
            <div className="flex items-center justify-between">
              <span>Статус:</span>
              <span 
                className="text-blue-400"
                aria-label={`Session status: ${gameSession?.status || 'Initializing'}`}
              >
                {gameSession?.status || 'Инициализация...'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Сообщений:</span>
              <span 
                className="text-gray-300"
                aria-label={`Message count: ${messages.length}`}
              >
                {messages.length}
              </span>
            </div>
          </div>

          {/* Service Status Indicators */}
          {(errorState.asrError || errorState.llmError || errorState.ttsError || errorState.connectionError) && (
            <div 
              className="mt-4 pt-3 border-t border-gray-700"
              role="status"
              aria-live="polite"
              aria-label="Service status indicators"
            >
              <h4 
                className="text-sm font-medium text-yellow-400 mb-2"
                id="service-status-title"
              >
                Статус сервисов
              </h4>
              <div 
                className="space-y-1 text-xs"
                role="list"
                aria-labelledby="service-status-title"
              >
                <ServiceStatusIndicator
                  label="Голосовой ввод"
                  hasError={!!errorState.asrError}
                  ariaLabel="Voice input"
                />
                <ServiceStatusIndicator
                  label="ИИ ответы"
                  hasError={!!errorState.llmError}
                  ariaLabel="AI responses"
                />
                <ServiceStatusIndicator
                  label="Голосовой вывод"
                  hasError={!!errorState.ttsError}
                  ariaLabel="Voice output"
                  isWarning={true}
                />
                <ServiceStatusIndicator
                  label="Соединение"
                  hasError={!!errorState.connectionError}
                  ariaLabel="Connection"
                />
              </div>
            </div>
          )}
        </section>
      </aside>

      {/* Chat Interface */}
      <section 
        className="lg:col-span-3"
        role="main"
        aria-label="Game chat interface"
      >
        <div 
          style={{ height: '70vh' }} 
          data-testid="chat-interface"
          role="region"
          aria-label="Chat messages and input"
          aria-live="polite"
        >
          <ChatInterface
            messages={messages}
            onSendMessage={sendMessage}
            isLoading={isLoading}
            onVoiceInput={handleVoiceInput}
            isRecording={isRecording}
            onRecordingStateChange={setRecordingState}
            audioSettings={audioSettings}
          />
        </div>
      </section>
    </div>
  );
}

// Helper component for service status indicators
interface ServiceStatusIndicatorProps {
  label: string;
  hasError: boolean;
  ariaLabel: string;
  isWarning?: boolean;
}

function ServiceStatusIndicator({ label, hasError, ariaLabel, isWarning = false }: ServiceStatusIndicatorProps) {
  const getStatusColor = () => {
    if (hasError) return isWarning ? 'text-yellow-400' : 'text-red-400';
    return 'text-green-400';
  };

  const getIndicatorColor = () => {
    if (hasError) return isWarning ? 'bg-yellow-400' : 'bg-red-400';
    return 'bg-green-400';
  };

  const getStatusText = () => {
    if (hasError) return isWarning ? 'Warning' : 'Error';
    return 'Working';
  };

  return (
    <div 
      className={`flex items-center ${getStatusColor()}`}
      role="listitem"
      aria-label={`${ariaLabel}: ${getStatusText()}`}
    >
      <div 
        className={`w-2 h-2 rounded-full mr-2 ${getIndicatorColor()}`}
        role="img"
        aria-label={`${getStatusText()} indicator`}
      />
      {label}
    </div>
  );
}