import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OpenAILLM } from '../OpenAILLM';
import { GameContext, Story } from '../../types';

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
  
  it('should throw error after max retries', async () => {
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
    
    await expect(llmService.generateResponse('Test max retries', mockContext))
      .rejects.toThrow('API error');
    
    expect(mockCreateAlwaysFail).toHaveBeenCalledTimes(2);
  });
});