import React from 'react';
import { AppState, Message } from './types';
import ChatInterface from './components/ChatInterface';

function App() {
  // Basic app structure - will be expanded in later tasks
  const [appState] = React.useState<AppState>({
    currentStory: null,
    gameSession: null,
    isConnected: false,
  });

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

  const handleSendMessage = (messageText: string) => {
    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      sessionId: 'demo',
      type: 'user',
      content: messageText,
      timestamp: new Date(),
      metadata: {}
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Simulate AI response after delay
    setTimeout(() => {
      const aiMessage: Message = {
        id: (Date.now() + 1).toString(),
        sessionId: 'demo',
        type: 'ai',
        content: `You said: "${messageText}". This is a demo response from the AI game master. The actual LLM integration will be implemented in later tasks.`,
        timestamp: new Date(),
        metadata: { processingTime: 1500 }
      };

      setMessages(prev => [...prev, aiMessage]);
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-blue-500 mb-2">
            Voice AI RPG Game
          </h1>
          <p className="text-gray-400">
            Interactive voice-controlled role-playing game
          </p>
        </header>
        
        <main className="max-w-4xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Status Panel */}
            <div className="lg:col-span-1">
              <div className="bg-gray-800 rounded-lg p-4">
                <h3 className="text-lg font-semibold mb-3">Status</h3>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>Connection: {appState.isConnected ? 'Connected' : 'Disconnected'}</p>
                  <p>Story: {appState.currentStory?.title || 'None selected'}</p>
                  <p>Session: {appState.gameSession?.status || 'Demo mode'}</p>
                </div>
              </div>
            </div>

            {/* Chat Interface */}
            <div className="lg:col-span-3">
              <div style={{ height: '70vh' }}>
                <ChatInterface
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                />
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;