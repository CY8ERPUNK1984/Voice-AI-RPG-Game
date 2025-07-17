import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GameSessionManager } from '../GameSessionManager';
import { StoryService } from '../StoryService';
import { Story, Message, GameContext, LLMService, AudioSettings } from '../../types';
import { v4 as uuidv4 } from 'uuid';

// Mock LLM Service for testing
class MockLLMService implements LLMService {
  async generateResponse(prompt: string, context: GameContext): Promise<string> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    // Simulate different responses based on input
    if (prompt.toLowerCase().includes('inventory')) {
      return 'You check your inventory and find a rusty sword, a healing potion, and 50 gold coins.';
    }
    if (prompt.toLowerCase().includes('health')) {
      return 'You examine yourself carefully. Your health is at 85/100. You have a small cut on your arm but feel strong overall.';
    }
    if (prompt.toLowerCase().includes('forest')) {
      return 'You enter the ancient forest. Tall oak trees surround you, their branches creating a canopy that filters the sunlight into dancing patterns on the forest floor.';
    }
    if (prompt.toLowerCase().includes('error')) {
      throw new Error('Simulated LLM error');
    }
    return `The game master responds to your action: "${prompt}". The adventure continues in the mystical realm of Eldoria.`;
  }
}

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

// Mock Story Service for testing
class MockStoryService extends StoryService {
  private mockStories: Story[] = [];

  constructor() {
    super();
    this.mockStories = [mockStory];
  }

  async getStoryById(id: string): Promise<Story | null> {
    return this.mockStories.find(story => story.id === id) || null;
  }

  async getAllStories(): Promise<Story[]> {
    return this.mockStories;
  }
}

describe('LLM Integration Tests', () => {
  let gameSessionManager: GameSessionManager;
  let storyService: MockStoryService;
  let mockLLMService: MockLLMService;

  const defaultSettings: AudioSettings = {
    ttsEnabled: true,
    ttsVolume: 0.8,
    asrSensitivity: 0.7,
    voiceSpeed: 1.0
  };

  beforeEach(() => {
    gameSessionManager = new GameSessionManager();
    storyService = new MockStoryService();
    mockLLMService = new MockLLMService();
  });

  describe('GameSessionManager and LLM Integration', () => {
    it('should create session and integrate with LLM service', async () => {
      const userId = 'test-user-1';
      const story = await storyService.getStoryById('test-story-1');
      expect(story).toBeDefined();

      // Create session
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);
      expect(session).toBeDefined();
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.storyId).toBe(story!.id);
      expect(session.status).toBe('active');
      expect(session.messages).toHaveLength(1); // Initial AI message
      expect(session.messages[0].type).toBe('ai');
      expect(session.messages[0].content).toBe(story!.initialPrompt);
    });

    it('should handle LLM response generation with context', async () => {
      const userId = 'test-user-2';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Add user message
      const userMessage: Message = {
        id: uuidv4(),
        sessionId: session.id,
        type: 'user',
        content: 'I want to check my inventory',
        metadata: {},
        timestamp: new Date()
      };

      gameSessionManager.addMessage(session.id, userMessage);

      // Generate LLM response
      const llmResponse = await mockLLMService.generateResponse(
        userMessage.content,
        session.context
      );

      expect(llmResponse).toBeDefined();
      expect(llmResponse).toContain('inventory');
      expect(llmResponse).toContain('sword');
      expect(llmResponse).toContain('healing potion');

      // Add AI response to session
      const aiMessage: Message = {
        id: uuidv4(),
        sessionId: session.id,
        type: 'ai',
        content: llmResponse,
        metadata: {},
        timestamp: new Date()
      };

      gameSessionManager.addMessage(session.id, aiMessage);

      // Verify session state
      const updatedSession = gameSessionManager.getSession(session.id);
      expect(updatedSession!.messages).toHaveLength(3); // Initial + user + AI
      expect(updatedSession!.context.conversationHistory).toContain('Player: I want to check my inventory');
      expect(updatedSession!.context.conversationHistory.some(msg => msg.includes('inventory'))).toBe(true);
    });

    it('should maintain conversation context across multiple interactions', async () => {
      const userId = 'test-user-3';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      const messages = [
        'I draw my sword',
        'I look around for enemies',
        'I search for treasure'
      ];

      // Process multiple messages
      for (const messageContent of messages) {
        const userMessage: Message = {
          id: uuidv4(),
          sessionId: session.id,
          type: 'user',
          content: messageContent,
          metadata: {},
          timestamp: new Date()
        };

        gameSessionManager.addMessage(session.id, userMessage);

        // Generate AI response
        const llmResponse = await mockLLMService.generateResponse(
          messageContent,
          session.context
        );

        const aiMessage: Message = {
          id: uuidv4(),
          sessionId: session.id,
          type: 'ai',
          content: llmResponse,
          metadata: {},
          timestamp: new Date()
        };

        gameSessionManager.addMessage(session.id, aiMessage);
      }

      // Verify conversation history
      const finalSession = gameSessionManager.getSession(session.id);
      expect(finalSession!.context.conversationHistory.length).toBeGreaterThan(messages.length);
      
      // Check that all user messages are in history
      messages.forEach(message => {
        expect(finalSession!.context.conversationHistory.some(historyMsg => 
          historyMsg.includes(message)
        )).toBe(true);
      });
    });

    it('should handle LLM errors gracefully', async () => {
      const userId = 'test-user-4';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Try to generate response that will cause error
      try {
        await mockLLMService.generateResponse('error', session.context);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Simulated LLM error');
      }
    });

    it('should limit conversation history to prevent context overflow', async () => {
      const userId = 'test-user-5';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Add many messages to test history limiting
      for (let i = 0; i < 25; i++) {
        const userMessage: Message = {
          id: uuidv4(),
          sessionId: session.id,
          type: 'user',
          content: `Message number ${i}`,
          metadata: {},
          timestamp: new Date()
        };

        gameSessionManager.addMessage(session.id, userMessage);
      }

      const finalSession = gameSessionManager.getSession(session.id);
      // Should be limited to 20 messages as per GameSessionManager implementation
      expect(finalSession!.context.conversationHistory.length).toBeLessThanOrEqual(20);
    });
  });

  describe('Context Updates and State Management', () => {
    it('should update character state based on conversation', async () => {
      const userId = 'test-user-6';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Simulate context update (this would normally happen in WebSocketServer)
      const contextUpdate: Partial<GameContext> = {
        characterState: {
          ...session.context.characterState,
          lastInventoryCheck: new Date().toISOString(),
          health: 85
        }
      };

      const success = gameSessionManager.updateSessionContext(session.id, contextUpdate);
      expect(success).toBe(true);

      const updatedSession = gameSessionManager.getSession(session.id);
      expect(updatedSession!.context.characterState.lastInventoryCheck).toBeDefined();
      expect(updatedSession!.context.characterState.health).toBe(85);
    });

    it('should update game state based on AI responses', async () => {
      const userId = 'test-user-7';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Simulate game state update
      const contextUpdate: Partial<GameContext> = {
        gameState: {
          ...session.context.gameState,
          currentLocation: 'Ancient Forest',
          lastLocationUpdate: new Date().toISOString()
        }
      };

      const success = gameSessionManager.updateSessionContext(session.id, contextUpdate);
      expect(success).toBe(true);

      const updatedSession = gameSessionManager.getSession(session.id);
      expect(updatedSession!.context.gameState.currentLocation).toBe('Ancient Forest');
      expect(updatedSession!.context.gameState.lastLocationUpdate).toBeDefined();
    });

    it('should handle session pause and resume', async () => {
      const userId = 'test-user-8';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      expect(session.status).toBe('active');

      // Pause session
      const pauseSuccess = gameSessionManager.pauseSession(session.id);
      expect(pauseSuccess).toBe(true);

      const pausedSession = gameSessionManager.getSession(session.id);
      expect(pausedSession!.status).toBe('paused');

      // Resume session
      const resumeSuccess = gameSessionManager.resumeSession(session.id);
      expect(resumeSuccess).toBe(true);

      const resumedSession = gameSessionManager.getSession(session.id);
      expect(resumedSession!.status).toBe('active');
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle invalid session operations', () => {
      // Try to get non-existent session
      const nonExistentSession = gameSessionManager.getSession('invalid-id');
      expect(nonExistentSession).toBeUndefined();

      // Try to add message to non-existent session
      const messageSuccess = gameSessionManager.addMessage('invalid-id', {
        id: uuidv4(),
        sessionId: 'invalid-id',
        type: 'user',
        content: 'test',
        metadata: {},
        timestamp: new Date()
      });
      expect(messageSuccess).toBe(false);

      // Try to update non-existent session
      const updateSuccess = gameSessionManager.updateSessionContext('invalid-id', {});
      expect(updateSuccess).toBe(false);
    });

    it('should handle story not found scenario', async () => {
      const nonExistentStory = await storyService.getStoryById('non-existent');
      expect(nonExistentStory).toBeNull();
    });

    it('should clean up old sessions', async () => {
      const userId = 'test-user-cleanup';
      const story = await storyService.getStoryById('test-story-1');
      const session = gameSessionManager.createSession(userId, story!, defaultSettings);

      // Verify session exists
      expect(gameSessionManager.getSession(session.id)).toBeDefined();

      // Manually set the session's updatedAt to an old date to simulate an old session
      const oldSession = gameSessionManager.getSession(session.id);
      if (oldSession) {
        oldSession.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }

      // Clean up sessions (with 24 hours cutoff)
      const cleanedCount = gameSessionManager.cleanupOldSessions(24);
      expect(cleanedCount).toBeGreaterThan(0);

      // Session should be removed
      expect(gameSessionManager.getSession(session.id)).toBeUndefined();
    });
  });
});