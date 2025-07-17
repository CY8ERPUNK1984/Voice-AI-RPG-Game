import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Server } from 'socket.io';
import { WebSocketServer } from '../WebSocketServer';
import { GameSessionManager } from '../GameSessionManager';
import { StoryService } from '../StoryService';
import { OpenAILLM } from '../OpenAILLM';
import { Story, GameSession } from '../../types';

// Mock dependencies
vi.mock('../GameSessionManager');
vi.mock('../StoryService');
vi.mock('../OpenAILLM');

// Mock story for testing
const mockStory: Story = {
  id: 'story-1',
  title: 'Test Story',
  description: 'A test story',
  genre: 'fantasy',
  initialPrompt: 'Welcome to the test story',
  characterContext: 'You are a test character',
  gameRules: ['Rule 1', 'Rule 2'],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Mock session
const mockSession: GameSession = {
  id: 'session-1',
  storyId: 'story-1',
  userId: 'user-1',
  status: 'active',
  messages: [{
    id: 'msg-1',
    sessionId: 'session-1',
    type: 'ai',
    content: 'Welcome to the test story',
    metadata: {},
    timestamp: new Date()
  }],
  context: {
    story: mockStory,
    characterState: {},
    gameState: {},
    conversationHistory: ['AI: Welcome to the test story']
  },
  settings: {
    ttsEnabled: true,
    ttsVolume: 0.8,
    asrSensitivity: 0.7,
    voiceSpeed: 1.0
  },
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('WebSocketServer LLM Integration', () => {
  let mockGameSessionManager: any;
  let mockStoryService: any;
  let mockLLMService: any;
  let socketEventHandlers: Record<string, Function>;
  
  // Enhanced mock socket that records emitted events
  const mockSocket = {
    id: 'mock-socket-id',
    rooms: new Set(),
    join: vi.fn(),
    emit: vi.fn(),
    on: vi.fn(),
    recordedEmits: [] as Array<{ event: string; data: any }>
  };
  
  const mockIO = {
    on: vi.fn(),
  };
  
  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockSocket.recordedEmits = [];
    socketEventHandlers = {};
    
    // Setup enhanced socket mock that captures event handlers
    mockSocket.on.mockImplementation((event: string, handler: Function) => {
      socketEventHandlers[event] = handler;
      return mockSocket;
    });
    
    // Setup enhanced socket emit mock that records events
    mockSocket.emit.mockImplementation((event: string, data?: any) => {
      mockSocket.recordedEmits.push({ event, data });
      return mockSocket;
    });
    
    // Setup GameSessionManager mock
    mockGameSessionManager = {
      createSession: vi.fn().mockReturnValue(mockSession),
      getSession: vi.fn().mockReturnValue(mockSession),
      getUserSession: vi.fn().mockReturnValue(mockSession),
      addMessage: vi.fn().mockReturnValue(true),
      updateSessionSettings: vi.fn().mockReturnValue(true),
      updateSessionContext: vi.fn().mockReturnValue(true),
      pauseSession: vi.fn().mockReturnValue(true),
      resumeSession: vi.fn().mockReturnValue(true),
      cleanupOldSessions: vi.fn().mockReturnValue(0)
    };
    
    vi.mocked(GameSessionManager).mockImplementation(() => mockGameSessionManager);
    
    // Setup StoryService mock
    mockStoryService = {
      getStoryById: vi.fn().mockResolvedValue(mockStory),
      getAllStories: vi.fn().mockResolvedValue([mockStory])
    };
    
    vi.mocked(StoryService).mockImplementation(() => mockStoryService);
    
    // Setup OpenAILLM mock
    mockLLMService = {
      generateResponse: vi.fn().mockResolvedValue('AI response to test message')
    };
    
    vi.mocked(OpenAILLM).mockImplementation(() => mockLLMService);
    
    // Setup IO mock to return our socket mock when connection event is triggered
    mockIO.on.mockImplementation((event, callback) => {
      if (event === 'connection') {
        callback(mockSocket);
      }
      return mockIO;
    });
  });

  it('should initialize WebSocket server with LLM integration', () => {
    // Create WebSocketServer with mocked IO
    new WebSocketServer(mockIO as unknown as Server);
    
    // Verify connection handler was registered
    expect(mockIO.on).toHaveBeenCalledWith('connection', expect.any(Function));
    
    // Verify socket event handlers were registered
    expect(mockSocket.on).toHaveBeenCalledWith('join-game', expect.any(Function));
    expect(mockSocket.on).toHaveBeenCalledWith('send-message', expect.any(Function));
  });

  it('should integrate LLM service with game sessions for message processing', async () => {
    // Create WebSocketServer
    new WebSocketServer(mockIO as unknown as Server);
    
    // First join a game to establish session
    await socketEventHandlers['join-game']({
      storyId: 'story-1',
      userId: 'user-1'
    });
    
    // Clear previous emits and reset mocks
    mockSocket.recordedEmits = [];
    mockGameSessionManager.addMessage.mockClear();
    mockLLMService.generateResponse.mockClear();
    
    // Simulate send-message event
    await socketEventHandlers['send-message']('Hello, game master!');
    
    // Verify user message was added to session
    expect(mockGameSessionManager.addMessage).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        type: 'user',
        content: 'Hello, game master!'
      })
    );
    
    // Verify LLM service was called with correct context
    expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
      'Hello, game master!',
      mockSession.context
    );
    
    // Verify AI response was added to session
    expect(mockGameSessionManager.addMessage).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        type: 'ai',
        content: 'AI response to test message'
      })
    );
    
    // Verify game-response event was emitted
    const gameResponseEvent = mockSocket.recordedEmits.find(e => e.event === 'game-response');
    expect(gameResponseEvent).toBeDefined();
    expect(gameResponseEvent?.data.message.type).toBe('ai');
    expect(gameResponseEvent?.data.message.content).toBe('AI response to test message');
  });

  it('should handle LLM errors gracefully with fallback messages', async () => {
    // Mock LLM service to throw error
    mockLLMService.generateResponse.mockRejectedValueOnce(new Error('LLM service error'));
    
    // Create WebSocketServer
    new WebSocketServer(mockIO as unknown as Server);
    
    // First join a game
    await socketEventHandlers['join-game']({
      storyId: 'story-1',
      userId: 'user-1'
    });
    
    // Clear previous emits
    mockSocket.recordedEmits = [];
    
    // Simulate send-message event
    await socketEventHandlers['send-message']('Test message');
    
    // Verify fallback message was sent
    const gameResponseEvent = mockSocket.recordedEmits.find(e => e.event === 'game-response');
    expect(gameResponseEvent).toBeDefined();
    expect(gameResponseEvent?.data.message.type).toBe('ai');
    expect(gameResponseEvent?.data.message.content).toContain('проблемы с генерацией ответа');
    expect(gameResponseEvent?.data.message.metadata.error).toBe(true);
    
    // Verify error event was also emitted
    const errorEvent = mockSocket.recordedEmits.find(e => e.event === 'error');
    expect(errorEvent).toBeDefined();
    expect(errorEvent?.data.type).toBe('LLM_ERROR');
  });

  it('should pass complete game context to LLM service', async () => {
    // Create WebSocketServer
    new WebSocketServer(mockIO as unknown as Server);
    
    // First join a game
    await socketEventHandlers['join-game']({
      storyId: 'story-1',
      userId: 'user-1'
    });
    
    // Clear mocks
    mockLLMService.generateResponse.mockClear();
    
    // Simulate send-message event
    await socketEventHandlers['send-message']('Tell me about this world');
    
    // Verify LLM service was called with the correct context
    expect(mockLLMService.generateResponse).toHaveBeenCalledWith(
      'Tell me about this world',
      expect.objectContaining({
        story: mockStory,
        characterState: expect.any(Object),
        gameState: expect.any(Object),
        conversationHistory: expect.arrayContaining(['AI: Welcome to the test story'])
      })
    );
  });

  it('should maintain conversation context across multiple messages', async () => {
    // Update mock session to track conversation history changes
    const updatedSession = { ...mockSession };
    mockGameSessionManager.getSession.mockReturnValue(updatedSession);
    
    // Create WebSocketServer
    new WebSocketServer(mockIO as unknown as Server);
    
    // First join a game
    await socketEventHandlers['join-game']({
      storyId: 'story-1',
      userId: 'user-1'
    });
    
    // Send first message
    await socketEventHandlers['send-message']('First message');
    
    // Update conversation history to simulate what GameSessionManager would do
    updatedSession.context.conversationHistory.push('Player: First message');
    updatedSession.context.conversationHistory.push('AI: AI response to test message');
    
    // Send second message
    await socketEventHandlers['send-message']('Second message');
    
    // Verify LLM service was called with updated context
    const secondCallContext = mockLLMService.generateResponse.mock.calls[1][1];
    expect(secondCallContext.conversationHistory).toContain('Player: First message');
    expect(secondCallContext.conversationHistory).toContain('AI: AI response to test message');
  });

  it('should update game context based on AI responses', async () => {
    // Create WebSocketServer
    new WebSocketServer(mockIO as unknown as Server);
    
    // First join a game
    await socketEventHandlers['join-game']({
      storyId: 'story-1',
      userId: 'user-1'
    });
    
    // Clear mocks
    mockGameSessionManager.updateSessionContext.mockClear();
    
    // Send a message that should trigger context updates
    await socketEventHandlers['send-message']('check my inventory');
    
    // Verify that context update was attempted
    expect(mockGameSessionManager.updateSessionContext).toHaveBeenCalled();
  });
});