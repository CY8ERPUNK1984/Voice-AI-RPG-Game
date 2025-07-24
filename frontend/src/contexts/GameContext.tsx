import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Message } from '../types';
import { useConnection } from './ConnectionContext';
import { useApp } from './AppContext';
import { errorHandler } from '../services/ErrorHandler';

// Game Context Types
interface GameContextValue {
  messages: Message[];
  isLoading: boolean;
  isRecording: boolean;
  screenReaderMessage: string;
  sendMessage: (messageText: string) => Promise<void>;
  handleVoiceInput: (transcript: string) => void;
  setRecordingState: (recording: boolean) => void;
  clearMessages: () => void;
  setScreenReaderMessage: (message: string) => void;
}

const GameContext = createContext<GameContextValue | undefined>(undefined);

// Provider Component
interface GameProviderProps {
  children: ReactNode;
}

export function GameProvider({ children }: GameProviderProps) {
  const { sendMessage: connectionSendMessage, isConnected, connectionManager } = useConnection();
  const { state: appState } = useApp();
  
  const [messages, setMessages] = useState<Message[]>([
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
  
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [screenReaderMessage, setScreenReaderMessage] = useState('');

  // Listen for game messages from connection
  useEffect(() => {
    if (!connectionManager) return;

    const unsubscribe = connectionManager.onMessage((event, data) => {
      if (event === 'game-response') {
        const aiMessage: Message = {
          id: data.message.id,
          sessionId: data.sessionId,
          type: 'ai',
          content: data.message.content,
          audioUrl: data.message.audioUrl,
          timestamp: new Date(data.message.timestamp),
          metadata: data.message.metadata || {}
        };
        
        setMessages(prev => [...prev, aiMessage]);
        setScreenReaderMessage(`AI response received: ${aiMessage.content.substring(0, 100)}${aiMessage.content.length > 100 ? '...' : ''}`);
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [connectionManager]);

  const sendMessage = useCallback(async (messageText: string) => {
    if (!isConnected || !appState.gameSession) {
      const errorMsg = !isConnected ? 'Нет соединения с сервером' : 'Нет активной игровой сессии';
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
      await connectionSendMessage('send-message', messageText);
      
      // Set timeout to handle potential response delays
      setTimeout(() => {
        setIsLoading(false);
      }, 30000); // 30 second timeout
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
  }, [isConnected, appState.gameSession, connectionSendMessage]);

  const handleVoiceInput = useCallback((transcript: string) => {
    if (transcript.trim()) {
      sendMessage(transcript);
    }
  }, [sendMessage]);

  const setRecordingState = useCallback((recording: boolean) => {
    setIsRecording(recording);
    
    // Announce recording state changes to screen readers
    if (recording) {
      setScreenReaderMessage('Voice recording started');
    } else {
      setScreenReaderMessage('Voice recording stopped');
    }
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);

  const value: GameContextValue = {
    messages,
    isLoading,
    isRecording,
    screenReaderMessage,
    sendMessage,
    handleVoiceInput,
    setRecordingState,
    clearMessages,
    setScreenReaderMessage,
  };

  return (
    <GameContext.Provider value={value}>
      {children}
    </GameContext.Provider>
  );
}

// Hook to use the context
export function useGame() {
  const context = useContext(GameContext);
  if (context === undefined) {
    throw new Error('useGame must be used within a GameProvider');
  }
  return context;
}