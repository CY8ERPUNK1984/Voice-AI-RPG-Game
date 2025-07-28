import React from 'react';
import { Story } from './types';
import SettingsPanel from './components/SettingsPanel';
import { StorySelection } from './components/StorySelection';
import { GameInterface } from './components/GameInterface';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastContainer } from './components/ToastNotification';
import { ScreenReaderAnnouncer } from './components/ScreenReaderAnnouncer';
import MonitoringDashboard from './components/MonitoringDashboard';

// Context Providers
import { AppProvider, useApp } from './contexts/AppContext';
import { ConnectionProvider, useConnection } from './contexts/ConnectionContext';
import { SettingsProvider, useSettings } from './contexts/SettingsContext';
import { GameProvider, useGame } from './contexts/GameContext';

// Custom Hooks
import { useStories } from './hooks/useStories';
import { useErrorState } from './hooks/useErrorState';
import { useOfflineMode } from './hooks/useOfflineMode';

// Main App Component (now much simpler)
function AppContent() {
  const { state, setCurrentStory } = useApp();
  const { connectionState, connectionHealth, manualReconnect } = useConnection();
  const { audioSettings, updateSettings } = useSettings();
  const { screenReaderMessage, clearMessages } = useGame();
  const { stories, storiesLoading } = useStories();
  const errorState = useErrorState();
  const offlineMode = useOfflineMode();

  // Check if monitoring dashboard should be shown
  const urlParams = new URLSearchParams(window.location.search);
  const showMonitoring = urlParams.get('monitoring') === 'true';

  if (showMonitoring) {
    return <MonitoringDashboard />;
  }

  const handleStorySelect = (story: Story) => {
    setCurrentStory(story);
    clearMessages(); // Clear previous messages
  };

  const handleStoryChange = () => {
    setCurrentStory(null);
  };

  return (
    <div 
      className="min-h-screen bg-gray-900 text-white"
      role="application"
      aria-label="Voice AI RPG Game"
    >
      {/* Skip link for keyboard navigation */}
      <a 
        href="#main-content" 
        className="skip-link"
        onFocus={(e) => e.target.scrollIntoView()}
      >
        Skip to main content
      </a>
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8 relative" role="banner">
          <h1 
            className="text-4xl font-bold text-blue-500 mb-2"
            id="main-title"
          >
            Voice AI RPG Game
          </h1>
          <p 
            className="text-gray-400"
            aria-describedby="main-title"
          >
            Interactive voice-controlled role-playing game
          </p>

          {/* Settings Panel positioned in top-right corner */}
          <div 
            className="absolute top-0 right-0"
            role="complementary"
            aria-label="Game settings"
          >
            <SettingsPanel
              settings={audioSettings}
              onSettingsChange={updateSettings}
            />
          </div>
        </header>

        <main 
          id="main-content"
          className="max-w-6xl mx-auto"
          role="main"
          aria-labelledby="main-title"
        >
          {!state.currentStory ? (
            <StorySelection
              stories={stories}
              storiesLoading={storiesLoading}
              onStorySelect={handleStorySelect}
            />
          ) : (
            <GameInterface
              currentStory={state.currentStory}
              gameSession={state.gameSession}
              errorState={errorState}
              connectionState={connectionState}
              connectionHealth={connectionHealth}
              onStoryChange={handleStoryChange}
              onManualReconnect={manualReconnect}
              isOffline={offlineMode}
            />
          )}
        </main>
      </div>

      {/* Toast notifications */}
      <ToastContainer />
      
      {/* Screen reader announcements */}
      <ScreenReaderAnnouncer 
        message={screenReaderMessage} 
        priority="polite"
        clearAfter={3000}
      />
    </div>
  );
}

// Root App component with all providers
function App() {
  return (
    <ErrorBoundary>
      <AppProvider>
        <ConnectionProvider>
          <SettingsProvider>
            <GameProvider>
              <AppContent />
            </GameProvider>
          </SettingsProvider>
        </ConnectionProvider>
      </AppProvider>
    </ErrorBoundary>
  );
}

export default App;