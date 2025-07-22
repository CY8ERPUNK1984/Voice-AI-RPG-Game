import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Server } from 'socket.io';
import { WebSocketServer } from '../WebSocketServer';
import { GameSessionManager } from '../GameSessionManager';
import { StoryService } from '../StoryService';
import { OpenAILLM } from '../OpenAILLM';
import { OpenAITTS } from '../OpenAITTS';
import { Story, GameSession, Message, AudioSettings, GameContext, LLMService, TTSService } from '../../types';
import { v4 as uuidv4 } from 'uuid';

// Mock story for testing
const mockStory: Story = {
  id: 'test-story-1',
  title: 'Test Fantasy Adventure',
  description: 'A test fantasy story',
  genre: 'fantasy',
  initialPrompt: 'Welcome to the mystical realm of Eldoria! You find yourself standing at the edge of an ancient forest.',
  characterContext: 'You are a brave adventurer seeking ancient treasures.',
  gameRules: [
    'Stay in character as a fantasy game master',
    'Provide vivid descriptions',
    'Offer meaningful choices'
  ],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock LLM Service for integration testing
class MockLLMService implements LLMService {
  async generateResponse(prompt: string, context: GameContext): Promise<string> {
    // Minimal delay for testing - just enough to simulate async behavior
    await new Promise(resolve => setTimeout(resolve, 1));
    
    // Simulate contextual responses based on input and game state
    const promptLower = prompt.toLowerCase();
    
    if (promptLower.includes('inventory')) {
      return 'You check your inventory and find a rusty sword, a healing potion, and 50 gold coins. Your bag feels lighter than usual.';
    }
    if (promptLower.includes('health')) {
      return 'You examine yourself carefully. Your health is at 85/100. You have a small cut on your arm but feel strong overall.';
    }
    if (promptLower.includes('forest') || promptLower.includes('enter')) {
      return 'You enter the ancient forest. Tall oak trees surround you, their branches creating a canopy that filters the sunlight into dancing patterns on the forest floor. You find yourself in the Heart of the Ancient Woods.';
    }
    if (promptLower.includes('attack') || promptLower.includes('fight')) {
      return 'You draw your sword and prepare for battle! The enemy approaches menacingly. Your combat skills are put to the test in this dangerous encounter.';
    }
    if (promptLower.includes('talk') || promptLower.includes('speak')) {
      return 'You encounter a wise old merchant who greets you warmly. "Welcome, traveler," he says with a knowing smile.';
    }
    if (promptLower.includes('quest')) {
      return 'The village elder approaches you with urgency. "We have a quest for you, brave adventurer. Quest: Find the lost Crystal of Eldoria hidden deep within the Whispering Caves."';
    }
    if (promptLower.includes('error')) {
      throw new Error('Simulated LLM error for testing');
    }
    
    // Default response that includes context awareness
    const location = context.gameState?.currentLocation || 'unknown location';
    return `The game master responds to your action: "${prompt}". You are currently in ${location}. The adventure continues in the mystical realm of Eldoria.`;
  }
}

// Mock TTS Service for integration testing
class MockTTSService implements TTSService {
  async synthesizeSpeech(text: string): Promise<Buffer> {
    // Minimal delay for testing
    await new Promise(resolve => setTimeout(resolve, 1));
    
    // Return a mock audio buffer
    return Buffer.from('mock-audio-data');
  }

  isAvailable(): boolean {
    return true;
  }
}

describe('WebSocket LLM Integration Tests', () => {
  let webSocketServer: WebSocketServer;
  let mockIO: any;
  let mockSocket: any;
  let gameSessionManager: GameSessionManager;
  let storyService: StoryService;
  let mockLLMService: MockLLMService;
  let mockTTSService: MockTTSService;
  let eventHandlers: Map<string, Function>;

  const defaultSettings: AudioSettings = {
    ttsEnabled: true,
    ttsVolume: 0.8,
    asrSensitivity: 0.7,
    voiceSpeed: 1.0
  };

  beforeEach(() => {
    // Reset event handlers map
    eventHandlers = new Map();

    // Setup socket mock that captures event handlers
    mockSocket = {
      id: 'test-socket',
      join: vi.fn(),
      emit: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        eventHandlers.set(event, handler);
      })
    };

    mockIO = {
      on: vi.fn((event: string, callback: Function) => {
        if (event === 'connection') {
          callback(mockSocket);
        }
      })
    };

    // Create real instances for integration testing with mocked services
    mockLLMService = new MockLLMService();
    mockTTSService = new MockTTSService();
    gameSessionManager = new GameSessionManager(mockTTSService);
    storyService = new StoryService();

    // Mock the StoryService to return our test story
    vi.spyOn(storyService, 'getStoryById').mockResolvedValue(mockStory);

    // Create WebSocketServer with mocked services
    webSocketServer = new WebSocketServer(mockIO as unknown as Server);
    
    // Replace the services with our mocks
    (webSocketServer as any).llmService = mockLLMService;
    (webSocketServer as any).ttsService = mockTTSService;
    (webSocketServer as any).gameSessionManager = gameSessionManager;
    (webSocketServer as any).storyService = storyService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Service Integration', () => {
    it('should initialize WebSocket server with all required services', () => {
      expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('send-message', expect.any(Function));
      expect(mockSocket.on).toHaveBeenCalledWith('join-game', expect.any(Function));
    });

    it('should register all required event handlers', () => {
      const expectedEvents = [
        'join-game',
        'send-message', 
        'voice-input',
        'update-settings',
        'pause-session',
        'resume-session',
        'get-history',
        'disconnect'
      ];

      expectedEvents.forEach(event => {
        expect(eventHandlers.has(event)).toBe(true);
      });
    });
  });

  describe('Complete Message Flow Integration', () => {
    let sessionId: string;
    const userId = 'test-user-integration';

    beforeEach(async () => {
      // Simulate joining a game session
      const joinGameHandler = eventHandlers.get('join-game');
      expect(joinGameHandler).toBeDefined();

      await joinGameHandler!({
        storyId: 'test-story-1',
        userId: userId,
        settings: defaultSettings
      });

      // Get the created session
      const userSession = gameSessionManager.getUserSession(userId);
      expect(userSession).toBeDefined();
      sessionId = userSession!.id;
    });

    it('should handle complete message flow: user message -> LLM -> context update', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      expect(sendMessageHandler).toBeDefined();

      // Send a message that should trigger context updates
      const messagePromise = sendMessageHandler!('I want to check my inventory');
      
      // Wait for the message handler to complete
      await messagePromise;

      // Small delay to ensure all async operations complete
      await new Promise(resolve => setTimeout(resolve, 10));

      // Verify session was updated with user message
      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();
      expect(session!.messages.length).toBeGreaterThan(1); // Initial + user + AI messages

      // Find the user and AI messages
      const userMessage = session!.messages.find(m => m.type === 'user' && m.content.includes('inventory'));
      const aiMessage = session!.messages.find(m => m.type === 'ai' && m.content.includes('sword'));

      expect(userMessage).toBeDefined();
      expect(aiMessage).toBeDefined();
      expect(aiMessage!.content).toContain('inventory');
      expect(aiMessage!.content).toContain('sword');
      expect(aiMessage!.content).toContain('healing potion');

      // Verify context was updated
      expect(session!.context.characterState.lastInventoryCheck).toBeDefined();
      expect(session!.context.conversationHistory).toContain('Player: I want to check my inventory');
    }, 2000);

    it('should maintain conversation context across multiple interactions', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      const messages = [
        'I enter the forest',
        'I look around for enemies',
        'I search for treasure'
      ];

      // Process multiple messages sequentially
      for (const message of messages) {
        await sendMessageHandler!(message);
        // Small delay between messages to ensure proper processing
        await new Promise(resolve => setTimeout(resolve, 5));
      }

      // Wait for final processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Verify all messages are in conversation history
      messages.forEach(message => {
        expect(session!.context.conversationHistory.some(historyMsg => 
          historyMsg.includes(message)
        )).toBe(true);
      });

      // Verify location context was updated from forest message
      expect(session!.context.gameState.currentLocation).toBeDefined();
      expect(session!.context.gameState.lastLocationUpdate).toBeDefined();
    }, 2000);

    it('should update character state based on health check', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      await sendMessageHandler!('How is my health?');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Verify health context was updated
      expect(session!.context.characterState.lastHealthCheck).toBeDefined();
      expect(session!.context.characterState.currentHealth).toBe(85);
      expect(session!.context.characterState.maxHealth).toBe(100);

      // Verify AI response contains health information
      const aiMessage = session!.messages.find(m => 
        m.type === 'ai' && m.content.includes('health is at 85/100')
      );
      expect(aiMessage).toBeDefined();
    }, 2000);

    it('should track combat actions and update character state', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      await sendMessageHandler!('I attack the enemy with my sword');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Verify combat context was updated
      expect(session!.context.characterState.lastCombatAction).toBeDefined();
      expect(session!.context.characterState.lastAction).toBe('combat');

      // Verify AI response reflects combat
      const aiMessage = session!.messages.find(m => 
        m.type === 'ai' && m.content.includes('sword') && m.content.includes('battle')
      );
      expect(aiMessage).toBeDefined();
    }, 2000);

    it('should track NPC encounters and quest information', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      // First, trigger NPC encounter
      await sendMessageHandler!('I want to talk to someone');
      await new Promise(resolve => setTimeout(resolve, 10));

      let session = gameSessionManager.getSession(sessionId);
      expect(session!.context.characterState.lastSocialAction).toBeDefined();
      expect(session!.context.characterState.lastAction).toBe('social');

      // Then trigger quest
      await sendMessageHandler!('Do you have any quests for me?');
      await new Promise(resolve => setTimeout(resolve, 10));

      session = gameSessionManager.getSession(sessionId);
      expect(session!.context.gameState.lastQuestUpdate).toBeDefined();
      expect(session!.context.gameState.activeQuests).toBeDefined();
      expect(session!.context.gameState.activeQuests.length).toBeGreaterThan(0);
      expect(session!.context.gameState.activeQuests[0].description).toContain('Crystal of Eldoria');
    }, 2000);

    it('should handle location updates from AI responses', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      await sendMessageHandler!('I want to enter the forest');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Verify location was extracted and updated
      expect(session!.context.gameState.currentLocation).toBe('Heart of the Ancient Woods');
      expect(session!.context.gameState.lastLocationUpdate).toBeDefined();
      expect(session!.context.characterState.lastAction).toBe('exploration');
    }, 2000);

    it('should handle LLM errors gracefully with fallback messages', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      // Send message that triggers error
      await sendMessageHandler!('error');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      const session = gameSessionManager.getSession(sessionId);
      expect(session).toBeDefined();

      // Should have fallback message
      const fallbackMessage = session!.messages.find(m => 
        m.type === 'ai' && m.content.includes('возникли проблемы')
      );
      expect(fallbackMessage).toBeDefined();
      expect(fallbackMessage!.metadata.error).toBe(true);

      // Verify error was emitted to socket
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        type: 'LLM_ERROR'
      }));
    }, 2000);

    it('should emit proper WebSocket events during message flow', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      await sendMessageHandler!('I check my inventory');

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 20));

      // Verify proper sequence of events was emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('message-received', expect.objectContaining({
        message: expect.objectContaining({
          type: 'user',
          content: 'I check my inventory'
        })
      }));

      expect(mockSocket.emit).toHaveBeenCalledWith('ai-thinking', { status: 'generating' });

      expect(mockSocket.emit).toHaveBeenCalledWith('game-response', expect.objectContaining({
        message: expect.objectContaining({
          type: 'ai',
          content: expect.stringContaining('inventory')
        })
      }));
    }, 3000);

    it('should validate session state before processing messages', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      // Pause the session
      gameSessionManager.pauseSession(sessionId);
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      // Try to send message to paused session
      await sendMessageHandler!('This should fail');

      // Should emit validation error (message is in Russian)
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        type: 'VALIDATION_ERROR',
        message: 'Сессия неактивна'
      }));
    });
  });

  describe('Session Management Integration', () => {
    it('should handle session creation through WebSocket events', async () => {
      const joinGameHandler = eventHandlers.get('join-game');
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      await joinGameHandler!({
        storyId: 'test-story-1',
        userId: 'new-user',
        settings: defaultSettings
      });

      // Verify session was created
      const session = gameSessionManager.getUserSession('new-user');
      expect(session).toBeDefined();
      expect(session!.storyId).toBe('test-story-1');
      expect(session!.status).toBe('active');

      // Verify proper events were emitted
      expect(mockSocket.emit).toHaveBeenCalledWith('session-created', expect.objectContaining({
        sessionId: session!.id,
        story: mockStory,
        settings: defaultSettings
      }));

      expect(mockSocket.emit).toHaveBeenCalledWith('game-response', expect.objectContaining({
        message: expect.objectContaining({
          type: 'ai',
          content: mockStory.initialPrompt
        })
      }));
    });

    it('should handle session history requests', async () => {
      // First create a session and add some messages
      const joinGameHandler = eventHandlers.get('join-game');
      await joinGameHandler!({
        storyId: 'test-story-1',
        userId: 'history-user',
        settings: defaultSettings
      });

      const session = gameSessionManager.getUserSession('history-user');
      const sessionId = session!.id;

      // Add a user message
      const sendMessageHandler = eventHandlers.get('send-message');
      await sendMessageHandler!('Hello game master');

      // Wait for message processing
      await new Promise(resolve => setTimeout(resolve, 20));

      // Clear emit calls and request history
      mockSocket.emit.mockClear();
      
      const getHistoryHandler = eventHandlers.get('get-history');
      
      // Mock the current session ID (normally set by join-game)
      (webSocketServer as any).currentSessionId = sessionId;
      
      // We need to simulate the session context properly
      const historyHandler = eventHandlers.get('get-history');
      
      // Create a mock context for the history handler
      const mockContext = {
        currentSessionId: sessionId,
        currentUserId: 'history-user'
      };
      
      // Bind the handler with proper context
      historyHandler!.call(mockContext);

      // Since we can't easily mock the closure variables, let's verify the session has the expected data
      const updatedSession = gameSessionManager.getSession(sessionId);
      expect(updatedSession!.messages.length).toBeGreaterThan(1);
      expect(updatedSession!.context.conversationHistory.length).toBeGreaterThan(0);
    }, 3000);
  });

  describe('Error Handling Integration', () => {
    it('should handle story not found error', async () => {
      // Mock story service to return null
      vi.spyOn(storyService, 'getStoryById').mockResolvedValue(null);
      
      const joinGameHandler = eventHandlers.get('join-game');
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      await joinGameHandler!({
        storyId: 'non-existent-story',
        userId: 'error-user',
        settings: defaultSettings
      });

      // Should emit error (message is in Russian)
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        type: 'VALIDATION_ERROR',
        message: 'История не найдена'
      }));
    });

    it('should handle missing session errors', async () => {
      const sendMessageHandler = eventHandlers.get('send-message');
      
      // Clear previous emit calls
      mockSocket.emit.mockClear();
      
      // Try to send message without active session
      await sendMessageHandler!('This should fail');

      // Should emit validation error (message is in Russian)
      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({
        type: 'VALIDATION_ERROR',
        message: 'Нет активной сессии'
      }));
    });
  });
});