import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAILLM } from '../OpenAILLM';
import { GameContext, Story } from '../../types';

// Mock the RateLimiter
vi.mock('../RateLimiter', () => ({
  globalRateLimiter: {
    acquire: vi.fn().mockResolvedValue(undefined),
    getMetrics: vi.fn().mockReturnValue({
      totalRequests: 10,
      successfulRequests: 8,
      rateLimitedRequests: 2,
      queuedRequests: 0,
      averageWaitTime: 100,
      currentTokens: 5,
      maxTokens: 10
    })
  }
}));

// Mock OpenAI client
vi.mock('openai', () => {
  const mockCreate = vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: 'Mocked AI response for testing'
        }
      }
    ],
    usage: {
      total_tokens: 100
    }
  });

  return {
    OpenAI: vi.fn().mockImplementation(() => {
      return {
        chat: {
          completions: {
            create: mockCreate
          }
        }
      };
    })
  };
});

// Mock dotenv
vi.mock('dotenv', () => {
  return {
    config: vi.fn()
  };
});

describe('OpenAILLM', () => {
  let llmService: OpenAILLM;
  let mockContext: GameContext;
  
  beforeEach(() => {
    // Set up environment variable for testing
    process.env.OPENAI_API_KEY = 'test-api-key';
    
    // Create a new instance for each test
    llmService = new OpenAILLM();
    
    // Create mock game context
    const mockStory: Story = {
      id: 'test-story-id',
      title: 'Test Story',
      description: 'A test story for unit testing',
      genre: 'fantasy',
      initialPrompt: 'You are in a fantasy world...',
      characterContext: 'You are a brave adventurer',
      gameRules: ['Rule 1', 'Rule 2'],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    mockContext = {
      story: mockStory,
      characterState: { health: 100, mana: 50 },
      gameState: { location: 'forest', time: 'day' },
      conversationHistory: [
        'Player: Hello there',
        'AI: Greetings, adventurer!'
      ]
    };
  });
  
  it('should initialize with API key from environment', () => {
    expect(llmService).toBeDefined();
  });
  
  it('should throw error if no API key is provided', () => {
    // Remove API key from environment
    delete process.env.OPENAI_API_KEY;
    
    expect(() => new OpenAILLM()).toThrow('OpenAI API key is required');
  });
  
  it('should generate a response using the OpenAI API', async () => {
    const response = await llmService.generateResponse('What should I do next?', mockContext);
    
    expect(response).toBe('Mocked AI response for testing');
  });
  
  it('should handle API errors and retry', async () => {
    // Create a mock function that fails once then succeeds
    const mockCreateWithRetry = vi.fn()
      .mockRejectedValueOnce(new Error('API rate limit exceeded'))
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Retry succeeded' } }],
        usage: { total_tokens: 100 }
      });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateWithRetry
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    const response = await llmService.generateResponse('Test retry', mockContext);
    
    expect(mockCreateWithRetry).toHaveBeenCalledTimes(2);
    expect(response).toBe('Retry succeeded');
  });
  
  it('should format conversation history correctly', async () => {
    // Create a mock function to inspect the call arguments
    const mockCreateForHistory = vi.fn().mockResolvedValue({
      choices: [{ message: { content: 'Response' } }],
      usage: { total_tokens: 100 }
    });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateForHistory
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    await llmService.generateResponse('Test message', mockContext);
    
    // Check that the history was formatted correctly in the API call
    const callArgs = mockCreateForHistory.mock.calls[0][0];
    const messages = callArgs.messages;
    
    // Find user and assistant messages in the formatted history
    const userMessage = messages.find((m: {role: string, content: string}) => 
      m.role === 'user' && m.content === 'Hello there');
    const assistantMessage = messages.find((m: {role: string, content: string}) => 
      m.role === 'assistant' && m.content === 'Greetings, adventurer!');
    
    expect(userMessage).toBeDefined();
    expect(assistantMessage).toBeDefined();
  });
  
  it('should return fallback response after max retries', async () => {
    // Create a mock function that always fails
    const mockCreateAlwaysFail = vi.fn().mockRejectedValue(new Error('API error'));
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateAlwaysFail
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    // Configure fewer retries for faster test
    llmService.configureRetries(2, 10);
    
    const response = await llmService.generateResponse('Test max retries', mockContext);
    
    // Should return a fallback response instead of throwing
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
    expect(mockCreateAlwaysFail).toHaveBeenCalledTimes(2);
  });

  it('should handle authentication errors without retry', async () => {
    // Create a mock function that returns auth error
    const mockCreateAuthError = vi.fn().mockRejectedValue({ 
      status: 401, 
      message: 'Invalid API key' 
    });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateAuthError
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    const response = await llmService.generateResponse('Test auth error', mockContext);
    
    // Should return auth error message without retries
    expect(response).toContain('авторизации');
    expect(mockCreateAuthError).toHaveBeenCalledTimes(1);
  });

  it('should handle rate limit errors with retry', async () => {
    // Create a mock function that fails with rate limit then succeeds
    const mockCreateRateLimit = vi.fn()
      .mockRejectedValueOnce({ status: 429, message: 'Rate limit exceeded' })
      .mockResolvedValueOnce({
        choices: [{ message: { content: 'Success after rate limit' } }],
        usage: { total_tokens: 100 }
      });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateRateLimit
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    // Configure faster retries for testing
    llmService.configureRetries(3, 10, 100, 1.5);
    
    const response = await llmService.generateResponse('Test rate limit', mockContext);
    
    expect(response).toBe('Success after rate limit');
    expect(mockCreateRateLimit).toHaveBeenCalledTimes(2);
  });

  it('should provide genre-specific fallback responses', async () => {
    // Create a mock function that always fails
    const mockCreateFail = vi.fn().mockRejectedValue({ 
      status: 500, 
      message: 'Server error' 
    });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateFail
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    // Configure faster retries for testing
    llmService.configureRetries(2, 10, 100, 1.5);
    
    // Test different genres
    const genres = ['fantasy', 'sci-fi', 'mystery', 'adventure', 'horror'];
    
    for (const genre of genres) {
      mockContext.story.genre = genre as any;
      const response = await llmService.generateResponse('Test genre fallback', mockContext);
      
      expect(typeof response).toBe('string');
      expect(response.length).toBeGreaterThan(0);
    }
  });

  it('should handle timeout errors', async () => {
    // Create a mock function that hangs (never resolves)
    const mockCreateTimeout = vi.fn().mockImplementation(() => 
      new Promise(() => {}) // Never resolves
    );
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateTimeout
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    // Configure faster retries and shorter timeout for testing
    llmService.configureRetries(2, 10, 100, 1.5);
    llmService.setTimeout(50);
    
    const response = await llmService.generateResponse('Test timeout', mockContext);
    
    // Should return fallback response due to timeout
    expect(typeof response).toBe('string');
    expect(response.length).toBeGreaterThan(0);
  });

  it('should get health status', async () => {
    const health = await llmService.getHealthStatus();
    
    expect(health.status).toBe('healthy');
    expect(health.details).toBeDefined();
    expect(health.details.model).toBeDefined();
    expect(health.details.rateLimiter).toBeDefined();
  });

  it('should handle unhealthy status', async () => {
    // Create a mock function that fails
    const mockCreateFail = vi.fn().mockRejectedValue({ 
      status: 500, 
      message: 'Server error' 
    });
    
    // Replace the mocked client's create method
    const mockClient = {
      chat: {
        completions: {
          create: mockCreateFail
        }
      }
    };
    
    // @ts-ignore - Replace the client for testing
    llmService.client = mockClient;
    
    const health = await llmService.getHealthStatus();
    
    expect(health.status).toBe('unhealthy');
    expect(health.details.error).toBeDefined();
    expect(health.details.type).toBe('server');
  });

  it('should configure timeout', () => {
    llmService.setTimeout(30000);
    expect(() => llmService.setTimeout(30000)).not.toThrow();
  });

  it('should add fallback responses', () => {
    const customFallbacks = ['Custom fallback 1', 'Custom fallback 2'];
    llmService.addFallbackResponses(customFallbacks);
    expect(() => llmService.addFallbackResponses(customFallbacks)).not.toThrow();
  });
});