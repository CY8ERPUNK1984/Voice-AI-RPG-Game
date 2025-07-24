import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { ConnectionManager, ConnectionState, ConnectionHealth } from '../services/ConnectionManager';
import { errorHandler } from '../services/ErrorHandler';
import { useApp } from './AppContext';

// Connection Context Types
interface ConnectionContextValue {
  connectionManager: ConnectionManager | null;
  connectionState: ConnectionState;
  connectionHealth: ConnectionHealth | null;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  sendMessage: (event: string, data: any) => Promise<void>;
  manualReconnect: () => Promise<void>;
}

const ConnectionContext = createContext<ConnectionContextValue | undefined>(undefined);

// Provider Component
interface ConnectionProviderProps {
  children: ReactNode;
}

export function ConnectionProvider({ children }: ConnectionProviderProps) {
  const { state: appState, setConnectionStatus, setGameSession } = useApp();
  const [connectionManager, setConnectionManager] = useState<ConnectionManager | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>({
    status: 'disconnected',
    reconnectAttempts: 0,
    quality: 'critical'
  });
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth | null>(null);

  // Initialize connection manager when story is selected
  useEffect(() => {
    if (appState.currentStory && !connectionManager && !appState.offlineMode) {
      initializeConnection();
    }
  }, [appState.currentStory, connectionManager, appState.offlineMode]);

  // Handle online/offline events
  useEffect(() => {
    const handleOnline = () => {
      errorHandler.showToast({
        type: 'success',
        title: 'Соединение восстановлено',
        message: 'Интернет-соединение восстановлено'
      });
      
      if (connectionManager && connectionState.status === 'disconnected') {
        connectionManager.connect().catch(error => {
          console.error('Failed to reconnect after coming online:', error);
          errorHandler.handleConnectionError(error);
        });
      }
    };

    const handleOffline = () => {
      errorHandler.showToast({
        type: 'warning',
        title: 'Нет соединения',
        message: 'Переход в автономный режим. Некоторые функции недоступны.'
      });
      
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (connectionManager) {
        console.log('Cleaning up connection manager');
        connectionManager.disconnect();
      }
    };
  }, [connectionManager]);

  const initializeConnection = useCallback(async () => {
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
      setConnectionHealth(manager.getConnectionHealth());
      setConnectionStatus(state.status === 'connected');

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
          if (appState.currentStory) {
            manager.sendMessage('join-game', {
              storyId: appState.currentStory.id,
              userId: 'user'
            }).catch(error => {
              console.error('Failed to join game:', error);
              errorHandler.handleConnectionError(error);
            });
          }
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
    try {
      await manager.connect();
    } catch (error) {
      console.error('Initial connection failed:', error);
      errorHandler.handleConnectionError(error as Error);
    }

    // Return cleanup function
    return () => {
      unsubscribeStateChange();
      unsubscribeMessage();
      unsubscribeError();
      unsubscribeReconnected();
      manager.disconnect();
    };
  }, [appState.currentStory, setConnectionStatus]);

  const handleSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'session-created':
        setGameSession({
          id: message.data.sessionId,
          storyId: message.data.storyId,
          userId: 'user',
          status: 'active',
          messages: [],
          context: message.data.context,
          settings: {},
          createdAt: new Date(),
          updatedAt: new Date()
        });
        break;

      case 'error':
        errorHandler.handleLLMError(new Error(message.data.message));
        break;
    }
  }, [setGameSession]);

  const connect = useCallback(async () => {
    if (connectionManager) {
      await connectionManager.connect();
    }
  }, [connectionManager]);

  const disconnect = useCallback(() => {
    if (connectionManager) {
      connectionManager.disconnect();
    }
  }, [connectionManager]);

  const sendMessage = useCallback(async (event: string, data: any) => {
    if (!connectionManager) {
      throw new Error('Connection manager not initialized');
    }
    if (connectionState.status !== 'connected') {
      throw new Error('Not connected to server');
    }
    await connectionManager.sendMessage(event, data);
  }, [connectionManager, connectionState.status]);

  const manualReconnect = useCallback(async () => {
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
  }, [connectionManager]);

  const value: ConnectionContextValue = {
    connectionManager,
    connectionState,
    connectionHealth,
    isConnected: connectionState.status === 'connected',
    connect,
    disconnect,
    sendMessage,
    manualReconnect,
  };

  return (
    <ConnectionContext.Provider value={value}>
      {children}
    </ConnectionContext.Provider>
  );
}

// Hook to use the context
export function useConnection() {
  const context = useContext(ConnectionContext);
  if (context === undefined) {
    throw new Error('useConnection must be used within a ConnectionProvider');
  }
  return context;
}