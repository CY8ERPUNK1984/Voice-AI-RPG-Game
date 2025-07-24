import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { AppState, Story, GameSession } from '../types';

// App State Types
interface AppContextState {
  currentStory: Story | null;
  gameSession: GameSession | null;
  isConnected: boolean;
  stories: Story[];
  storiesLoading: boolean;
  offlineMode: boolean;
}

// App Actions
type AppAction =
  | { type: 'SET_CURRENT_STORY'; payload: Story | null }
  | { type: 'SET_GAME_SESSION'; payload: GameSession | null }
  | { type: 'SET_CONNECTION_STATUS'; payload: boolean }
  | { type: 'SET_STORIES'; payload: Story[] }
  | { type: 'SET_STORIES_LOADING'; payload: boolean }
  | { type: 'SET_OFFLINE_MODE'; payload: boolean };

// Initial State
const initialState: AppContextState = {
  currentStory: null,
  gameSession: null,
  isConnected: false,
  stories: [],
  storiesLoading: true,
  offlineMode: !navigator.onLine,
};

// Reducer
function appReducer(state: AppContextState, action: AppAction): AppContextState {
  switch (action.type) {
    case 'SET_CURRENT_STORY':
      return { ...state, currentStory: action.payload };
    case 'SET_GAME_SESSION':
      return { ...state, gameSession: action.payload };
    case 'SET_CONNECTION_STATUS':
      return { ...state, isConnected: action.payload };
    case 'SET_STORIES':
      return { ...state, stories: action.payload };
    case 'SET_STORIES_LOADING':
      return { ...state, storiesLoading: action.payload };
    case 'SET_OFFLINE_MODE':
      return { ...state, offlineMode: action.payload };
    default:
      return state;
  }
}

// Context
interface AppContextValue {
  state: AppContextState;
  dispatch: React.Dispatch<AppAction>;
  // Convenience methods
  setCurrentStory: (story: Story | null) => void;
  setGameSession: (session: GameSession | null) => void;
  setConnectionStatus: (connected: boolean) => void;
  setStories: (stories: Story[]) => void;
  setStoriesLoading: (loading: boolean) => void;
  setOfflineMode: (offline: boolean) => void;
}

const AppContext = createContext<AppContextValue | undefined>(undefined);

// Provider Component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Convenience methods to avoid direct dispatch usage
  const setCurrentStory = (story: Story | null) => {
    dispatch({ type: 'SET_CURRENT_STORY', payload: story });
  };

  const setGameSession = (session: GameSession | null) => {
    dispatch({ type: 'SET_GAME_SESSION', payload: session });
  };

  const setConnectionStatus = (connected: boolean) => {
    dispatch({ type: 'SET_CONNECTION_STATUS', payload: connected });
  };

  const setStories = (stories: Story[]) => {
    dispatch({ type: 'SET_STORIES', payload: stories });
  };

  const setStoriesLoading = (loading: boolean) => {
    dispatch({ type: 'SET_STORIES_LOADING', payload: loading });
  };

  const setOfflineMode = (offline: boolean) => {
    dispatch({ type: 'SET_OFFLINE_MODE', payload: offline });
  };

  const value: AppContextValue = {
    state,
    dispatch,
    setCurrentStory,
    setGameSession,
    setConnectionStatus,
    setStories,
    setStoriesLoading,
    setOfflineMode,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

// Hook to use the context
export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}