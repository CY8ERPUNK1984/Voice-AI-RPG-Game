import React from 'react';
import { AppState } from './types';

function App() {
  // Basic app structure - will be expanded in later tasks
  const [appState] = React.useState<AppState>({
    currentStory: null,
    gameSession: null,
    isConnected: false,
  });

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-500 mb-2">
            Voice AI RPG Game
          </h1>
          <p className="text-gray-400">
            Interactive voice-controlled role-playing game
          </p>
        </header>
        
        <main className="max-w-4xl mx-auto">
          <div className="bg-gray-800 rounded-lg p-6">
            <p className="text-center text-gray-300">
              Game interface will be implemented in upcoming tasks
            </p>
            <div className="mt-4 text-sm text-gray-500">
              <p>Connection Status: {appState.isConnected ? 'Connected' : 'Disconnected'}</p>
              <p>Current Story: {appState.currentStory?.title || 'None selected'}</p>
              <p>Game Session: {appState.gameSession?.status || 'Not started'}</p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;