import React from 'react';
import { AppState, Message, AudioSettings, ErrorState, Story } from './types';
import ChatInterface from './components/ChatInterface';
import SettingsPanel from './components/SettingsPanel';
import StorySelector from './components/StorySelector';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastNotification';
import { errorHandler } from './services/ErrorHandler';
import { StoryService } from './services/StoryService';
import { ConnectionManager, ConnectionState } from './services/ConnectionManager';

function App() {
  // Application state
  const [appState, setAppState] = React.useState<AppState>({
    currentStory: null,
    gameSession: null,
    isConnected: false,
  });

  // Stories state
  const [stories, setStories] = React.useState<Story[]>([]);
  const [storiesLoading, setStoriesLoading] = React.useState(true);

  // Audio settings state with localStorage persistence
  const [audioSettings, setAudioSettings] = React.useState<AudioSettings>(() => {
    const saved = localStorage.getItem('audioSettings');
    return saved ? JSON.parse(saved) : {
      ttsEnabled: true,
      ttsVolume: 0.8,
      asrSensitivity: 0.7,
      voiceSpeed: 1.0,
    };
  });

  // Error state
  const [errorState, setErrorState] = React.useState<ErrorState>({
    asrError: null,
    llmError: null,
    ttsError: null,
    connectionError: null,
  });

  // Connection manager state
  const [connectionManager, setConnectionManager] = React.useState<ConnectionManager | null>(null);
  const [connectionState, setConnectionState] = React.useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    quality: 'critical'
  });

  // Offline mode detection
  const [offlineMode, setOfflineMode] = React.useState(!navigator.onLine);

  // Load stories on mount
  React.useEffect(() => {
    const loadStories = async () => {
      try {
        setStoriesLoading(true);
        const storyService = new StoryService();
        const loadedStories = await storyService.getAllStories();
        setStories(loadedStories);
      } catch (error) {
        console.error('Failed to load stories:', error);
        errorHandler.handleConnectionError(new Error('Failed to load stories'));
        
        // In offline mode, show a more helpful message
        if (!navigator.onLine) {
          errorHandler.showToast({
            type: 'warning',
            title: 'Автономный режим',
            message: 'Истории недоступны без интернет-соединения'
          });
        }
      } finally {
        setStoriesLoading(false);
      }
    };

    loadStories();
  }, []);

  // Subscribe to error updates
  React.useEffect(() => {
    const unsubscribe = errorHandler.onError(() => {
      setErrorState(errorHandler.getErrorState());
    });

    return unsubscribe;
  }, []);

  // Persist audio settings
  React.useEffect(() => {
    localStorage.setItem('audioSettings', JSON.stringify(audioSettings));
  }, [audioSettings]);

  // Enhanced offline mode detection with graceful degradation
  React.useEffect(() => {
    const handleOnline = () => {
      setOfflineMode(false);
      errorHandler.showToast({
        type: 'success',
        title: 'Соединение восстановлено',
        message: 'Интернет-соединение восстановлено'
      });
      
      // Attempt to reconnect if we have a connection manager
      if (connectionManager && connectionState.status === 'disconnected') {
        connectionManager.connect().catch(error => {
          console.error('Failed to reconnect after coming online:', error);
          errorHandler.handleConnectionError(error);
        });
      }
    };

    const handleOffline = () => {
      setOfflineMode(true);
      errorHandler.showToast({
        type: 'warning',
        title: 'Нет соединения',
        message: 'Переход в автономный режим. Некоторые функции недоступны.'
      });
      
      // Disconnect connection manager when going offline
      if (connectionManager) {
        connectionManager.disconnect();
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [connectionManager, connectionState.status]);

  // Connection management with enhanced ConnectionManager
  React.useEffect(() => {
    if (appState.currentStory && !connectionManager && !offlineMode) {
      const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';
      const manager = new ConnectionManager(socketUrl, {
        maxAttempts: 10,
        baseDelay: 1000,
        maxDelay: 30000,
        backoffMultiplier: 2,
        heartbeatInterval: 30000
      });

      // Set up event listeners
      const unsubscribeStateChange = manager.onStateChange((state) => {
        setConnectionState(state);
        setAppState(prev => ({ 
          ...prev, 
          isConnected: state.status === 'connected' 
        }));

        // Show user feedback for connection state changes
        switch (state.status) {
          case 'connecting':
            errorHandler.showToast({
              type: 'info',
              title: 'Подключение',
              message: 'Подключение к серверу...'
            });
            break;
          case 'connected':
            errorHandler.showToast({
              type: 'success',
              title: 'Подключение',
              message: 'Подключение установлено'
            });
            // Join game session after connection
            manager.sendMessage('join-game', {
              storyId: appState.currentStory!.id,
              userId: 'user'
            }).catch(error => {
              console.error('Failed to join game:', error);
              errorHandler.handleConnectionError(error);
            });
            break;
          case 'reconnecting':
            errorHandler.showToast({
              type: 'warning',
              title: 'Переподключение',
              message: `Переподключение... (попытка ${state.reconnectAttempts})`
            });
            break;
          case 'disconnected':
            errorHandler.showToast({
              type: 'error',
              title: 'Соединение',
              message: 'Соединение потеряно'
            });
            break;
          case 'failed':
            errorHandler.showToast({
              type: 'error',
              title: 'Ошибка подключения',
              message: 'Не удалось подключиться к серверу'
            });
            errorHandler.handleConnectionError(new Error('Connection failed after maximum retry attempts'));
            break;
        }
      });

      const unsubscribeMessage = manager.onMessage((event, data) => {
        handleSocketMessage({ type: event, data });
      });

      const unsubscribeError = manager.onError((error) => {
        console.error('Connection error:', error);
        errorHandler.handleConnectionError(error);
      });

      const unsubscribeReconnected = manager.onReconnected(() => {
        errorHandler.showToast({
          type: 'success',
          title: 'Соединение восстановлено',
          message: 'Соединение с сервером восстановлено'
        });
        // Rejoin game session after reconnection
        if (appState.currentStory) {
          manager.sendMessage('join-game', {
            storyId: appState.currentStory.id,
            userId: 'user'
          }).catch(error => {
            console.error('Failed to rejoin game after reconnection:', error);
          });
        }
      });

      setConnectionManager(manager);

      // Start connection
      manager.connect().catch(error => {
        console.error('Initial connection failed:', error);
        errorHandler.handleConnectionError(error);
      });

      return () => {
        unsubscribeStateChange();
        unsubscribeMessage();
        unsubscribeError();
        unsubscribeReconnected();
        manager.disconnect();
      };
    }
  }, [appState.currentStory, connectionManager, offlineMode]);

  const handleSocketMessage = (message: any) => {
    switch (message.type) {
      case 'game-response':
        const aiMessage: Message = {
          id: message.data.message.id,
          sessionId: message.data.sessionId,
          type: 'ai',
          content: message.data.message.content,
          audioUrl: message.data.message.audioUrl,
          timestamp: new Date(message.data.message.timestamp),
          metadata: message.data.message.metadata || {}
        };
        setMessages(prev => [...prev, aiMessage]);
        break;

      case 'session-created':
        setAppState(prev => ({
          ...prev,
          gameSession: {
            id: message.data.sessionId,
            storyId: message.data.storyId,
            userId: 'user',
            status: 'active',
            messages: [],
            context: message.data.context,
            settings: audioSettings,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        }));
        break;

      case 'error':
        errorHandler.handleLLMError(new Error(message.data.message));
        break;
    }
  };

  const handleStorySelect = (story: Story) => {
    setAppState(prev => ({ ...prev, currentStory: story }));
    setMessages([]); // Clear previous messages
  };

  // Mock messages for demonstration
  const [messages, setMessages] = React.useState<Message[]>([
    {
      id: '1',
      sessionId: 'demo',
      type: 'ai',
      content: 'Welcome to the Voice AI RPG Game! I am your game master. What would you like to do?',
      timestamp: new Date(Date.now() - 60000),
      metadata: {}
    },
    {
      id: '2',
      sessionId: 'demo',
      type: 'user',
      content: 'I want to explore the mysterious forest.',
      timestamp: new Date(Date.now() - 30000),
      metadata: { confidence: 0.95 }
    }
  ]);

  const [isLoading, setIsLoading] = React.useState(false);

  const handleSendMessage = async (messageText: string) => {
    if (!connectionManager || connectionState.status !== 'connected' || !appState.gameSession) {
      const errorMsg = !connectionManager ? 'Соединение не инициализировано' :
                      connectionState.status !== 'connected' ? 'Нет соединения с сервером' :
                      'Нет активной игровой сессии';
      errorHandler.handleConnectionError(new Error(errorMsg));
      errorHandler.showToast({
        type: 'error',
        title: 'Ошибка отправки',
        message: errorMsg
      });
      return;
    }

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sessionId: appState.gameSession.id,
      type: 'user',
      content: messageText,
      timestamp: new Date(),
      metadata: {}
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      // Send message via ConnectionManager
      await connectionManager.sendMessage('send-message', messageText);
    } catch (error) {
      console.error('Failed to send message:', error);
      errorHandler.handleConnectionError(error as Error);
      errorHandler.showToast({
        type: 'error',
        title: 'Ошибка отправки',
        message: 'Не удалось отправить сообщение'
      });
      setIsLoading(false);
    }

    // Set timeout to handle potential response delays
    setTimeout(() => {
      setIsLoading(false);
    }, 30000); // 30 second timeout
  };

  const handleSettingsChange = async (newSettings: AudioSettings) => {
    setAudioSettings(newSettings);

    // Update session settings if connected
    if (connectionManager && connectionState.status === 'connected' && appState.gameSession) {
      try {
        await connectionManager.sendMessage('update-settings', newSettings);
      } catch (error) {
        console.error('Failed to update settings:', error);
        errorHandler.showToast({
          type: 'warning',
          title: 'Настройки',
          message: 'Не удалось обновить настройки'
        });
      }
    }
  };

  const handleVoiceInput = (transcript: string) => {
    if (transcript.trim()) {
      handleSendMessage(transcript);
    }
  };

  const [isRecording, setIsRecording] = React.useState(false);

  const handleRecordingStateChange = (recording: boolean) => {
    setIsRecording(recording);
  };
  
  // Handle manual reconnection attempts
  const handleManualReconnect = async () => {
    if (!connectionManager) {
      errorHandler.showToast({
        type: 'error',
        title: 'Ошибка подключения',
        message: 'Менеджер подключений не инициализирован'
      });
      return;
    }
    
    try {
      errorHandler.showToast({
        type: 'info',
        title: 'Переподключение',
        message: 'Попытка переподключения к серверу...'
      });
      
      await connectionManager.connect();
    } catch (error) {
      console.error('Manual reconnection failed:', error);
      errorHandler.handleConnectionError(error as Error);
      errorHandler.showToast({
        type: 'error',
        title: 'Ошибка подключения',
        message: 'Не удалось переподключиться к серверу'
      });
    }
  };

  // Enhanced cleanup for connection manager on unmount
  React.useEffect(() => {
    return () => {
      if (connectionManager) {
        console.log('Cleaning up connection manager on component unmount');
        // Ensure all event listeners are removed
        connectionManager.disconnect();
      }
    };
  }, [connectionManager]);

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-900 text-white">
        <div className="container mx-auto px-4 py-8">
          <header className="text-center mb-8 relative">
            <h1 className="text-4xl font-bold text-blue-500 mb-2">
              Voice AI RPG Game
            </h1>
            <p className="text-gray-400">
              Interactive voice-controlled role-playing game
            </p>

            {/* Settings Panel positioned in top-right corner */}
            <div className="absolute top-0 right-0">
              <SettingsPanel
                settings={audioSettings}
                onSettingsChange={handleSettingsChange}
              />
            </div>
          </header>

          <main className="max-w-6xl mx-auto">
            {!appState.currentStory ? (
              // Story Selection Screen
              <div className="space-y-6">
                <div className="text-center">
                  <h2 className="text-2xl font-bold mb-4">Choose Your Adventure</h2>
                  <p className="text-gray-400">Select a story to begin your voice-controlled RPG experience</p>
                </div>

                <StorySelector
                  stories={stories}
                  onStorySelect={handleStorySelect}
                  isLoading={storiesLoading}
                />
              </div>
            ) : (
              // Game Interface
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Status Panel */}
                <div className="lg:col-span-1">
                  <div className="bg-gray-800 rounded-lg p-4 mb-4">
                    <h3 className="text-lg font-semibold mb-3">Current Story</h3>
                    <div className="space-y-2 text-sm">
                      <p className="font-medium text-blue-400">{appState.currentStory.title}</p>
                      <p className="text-gray-400">{appState.currentStory.description}</p>
                      <span className="inline-block px-2 py-1 bg-purple-600 text-xs rounded">
                        {appState.currentStory.genre}
                      </span>
                    </div>

                    <button
                      onClick={() => setAppState(prev => ({ ...prev, currentStory: null }))}
                      className="mt-3 text-xs text-gray-400 hover:text-white transition-colors"
                    >
                      ← Change Story
                    </button>
                  </div>

                  <div className="bg-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-semibold mb-3">Status</h3>
                    <div className="space-y-2 text-sm text-gray-400">
                      {/* Enhanced Connection Status Indicator */}
                      <div className="flex items-center justify-between">
                        <span>Connection:</span>
                        <div className="flex items-center space-x-2">
                          <div className={`w-2 h-2 rounded-full ${
                            connectionState.status === 'connected' ? 'bg-green-400' :
                            connectionState.status === 'connecting' ? 'bg-blue-400 animate-pulse' :
                            connectionState.status === 'reconnecting' ? 'bg-yellow-400 animate-pulse' :
                            'bg-red-400'
                          }`}></div>
                          <span className={
                            connectionState.status === 'connected' ? 'text-green-400' :
                            connectionState.status === 'connecting' ? 'text-blue-400' :
                            connectionState.status === 'reconnecting' ? 'text-yellow-400' :
                            'text-red-400'
                          }>
                            {connectionState.status === 'connected' ? 'Подключено' :
                             connectionState.status === 'connecting' ? 'Подключение...' :
                             connectionState.status === 'reconnecting' ? `Переподключение (${connectionState.reconnectAttempts})` :
                             connectionState.status === 'failed' ? 'Ошибка подключения' :
                             'Отключено'}
                          </span>
                        </div>
                      </div>
                      
                      {connectionState.latency !== undefined && connectionState.status === 'connected' && (
                        <div className="flex items-center justify-between">
                          <span>Latency:</span>
                          <span className={
                            connectionState.latency < 100 ? 'text-green-400' :
                            connectionState.latency < 300 ? 'text-yellow-400' :
                            'text-red-400'
                          }>
                            {connectionState.latency}ms
                          </span>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span>Quality:</span>
                        <span className={
                          connectionState.quality === 'excellent' ? 'text-green-400' :
                          connectionState.quality === 'good' ? 'text-blue-400' :
                          connectionState.quality === 'poor' ? 'text-yellow-400' :
                          'text-red-400'
                        }>
                          {connectionState.quality === 'excellent' ? 'Отлично' :
                           connectionState.quality === 'good' ? 'Хорошо' :
                           connectionState.quality === 'poor' ? 'Плохо' :
                           'Критично'}
                        </span>
                      </div>
                      
                      <p>Session: {appState.gameSession?.status || 'Initializing...'}</p>
                      <p>Messages: {messages.length}</p>
                    </div>

                    {/* Enhanced Connection Status and Retry Button */}
                    <div className="mt-4 pt-3 border-t border-gray-700">
                      {/* Network Status Indicator */}
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm">Network:</span>
                        <span className={`text-sm ${navigator.onLine ? 'text-green-400' : 'text-red-400'}`}>
                          {navigator.onLine ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      
                      {/* Connection Uptime (if connected) */}
                      {connectionState.status === 'connected' && (
                        <div className="text-xs text-gray-400 mb-2">
                          Connected since: {connectionState.lastConnected ? 
                            new Date(connectionState.lastConnected).toLocaleTimeString() : 'Unknown'}
                        </div>
                      )}
                      
                      {/* Reconnection Button */}
                      {(connectionState.status === 'failed' || connectionState.status === 'disconnected') && !offlineMode && (
                        <button
                          onClick={handleManualReconnect}
                          className="w-full px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
                        >
                          Переподключиться
                        </button>
                      )}
                      
                      {/* Connection Status Message */}
                      {connectionState.status === 'reconnecting' && (
                        <div className="flex items-center justify-center space-x-2 text-yellow-400 text-sm py-2">
                          <div className="w-2 h-2 bg-yellow-400 rounded-full animate-ping"></div>
                          <span>Переподключение... (попытка {connectionState.reconnectAttempts})</span>
                        </div>
                      )}
                      
                      {connectionState.status === 'connecting' && (
                        <div className="flex items-center justify-center space-x-2 text-blue-400 text-sm py-2">
                          <div className="w-2 h-2 bg-blue-400 rounded-full animate-ping"></div>
                          <span>Подключение...</span>
                        </div>
                      )}
                      
                      {connectionState.status === 'failed' && (
                        <div className="text-xs text-red-400 mt-2">
                          Не удалось подключиться после {connectionState.reconnectAttempts} попыток. Проверьте соединение или попробуйте позже.
                        </div>
                      )}
                    </div>

                    {/* Service Status Indicators */}
                    {(errorState.asrError || errorState.llmError || errorState.ttsError || errorState.connectionError) && (
                      <div className="mt-4 pt-3 border-t border-gray-700">
                        <h4 className="text-sm font-medium text-yellow-400 mb-2">Service Status</h4>
                        <div className="space-y-1 text-xs">
                          <div className={`flex items-center ${errorState.asrError ? 'text-red-400' : 'text-green-400'}`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${errorState.asrError ? 'bg-red-400' : 'bg-green-400'}`}></div>
                            Voice Input
                          </div>
                          <div className={`flex items-center ${errorState.llmError ? 'text-red-400' : 'text-green-400'}`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${errorState.llmError ? 'bg-red-400' : 'bg-green-400'}`}></div>
                            AI Response
                          </div>
                          <div className={`flex items-center ${errorState.ttsError ? 'text-yellow-400' : 'text-green-400'}`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${errorState.ttsError ? 'bg-yellow-400' : 'bg-green-400'}`}></div>
                            Voice Output
                          </div>
                          <div className={`flex items-center ${errorState.connectionError ? 'text-red-400' : 'text-green-400'}`}>
                            <div className={`w-2 h-2 rounded-full mr-2 ${errorState.connectionError ? 'bg-red-400' : 'bg-green-400'}`}></div>
                            Connection
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Chat Interface */}
                <div className="lg:col-span-3">
                  <div style={{ height: '70vh' }} data-testid="chat-interface">
                    <ChatInterface
                      messages={messages}
                      onSendMessage={handleSendMessage}
                      isLoading={isLoading}
                      onVoiceInput={handleVoiceInput}
                      isRecording={isRecording}
                      onRecordingStateChange={handleRecordingStateChange}
                      audioSettings={audioSettings}
                    />
                  </div>
                </div>
              </div>
            )}
          </main>
        </div>

        {/* Toast notifications */}
        <ToastContainer />
      </div>
    </ErrorBoundary>
  );
}

export default App;