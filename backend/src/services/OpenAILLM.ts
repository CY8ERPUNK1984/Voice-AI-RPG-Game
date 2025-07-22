import { OpenAI } from 'openai';
import { LLMService, GameContext, ErrorResponse } from '../types';
import { globalRateLimiter } from './RateLimiter';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * OpenAI LLM service implementation with rate limiting and retry logic
 * Handles communication with OpenAI API for generating game responses
 */
export class OpenAILLM implements LLMService {
  private client: OpenAI;
  private maxRetries: number = 3;
  private baseRetryDelay: number = 1000; // ms
  private maxRetryDelay: number = 30000; // ms
  private backoffMultiplier: number = 2;
  private model: string = 'gpt-4o';
  private requestTimeout: number = 60000; // 60 seconds
  private fallbackResponses: string[] = [
    'Извините, у меня временные проблемы с подключением. Попробуйте повторить ваш запрос.',
    'Сейчас я испытываю технические трудности. Пожалуйста, попробуйте еще раз через несколько секунд.',
    'Произошла временная ошибка. Повторите ваше действие, пожалуйста.'
  ];

  constructor(apiKey?: string) {
    // Use provided API key or get from environment variables
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
      throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable or pass it to the constructor.');
    }
    
    this.client = new OpenAI({
      apiKey: key
    });
  }

  /**
   * Generate a response based on user prompt and game context
   * @param prompt User's message
   * @param context Game context including story, character state, and conversation history
   * @returns AI-generated response
   */
  async generateResponse(prompt: string, context: GameContext): Promise<string> {
    let attempts = 0;
    let lastError: any;
    
    while (attempts < this.maxRetries) {
      try {
        // Acquire rate limit permission
        await globalRateLimiter.acquire('openai-chat', 'high');
        
        // Call OpenAI API with timeout
        return await this.callOpenAIWithTimeout(prompt, context);
      } catch (error: any) {
        attempts++;
        lastError = error;
        
        const errorType = this.classifyError(error);
        console.error(`OpenAI API error (attempt ${attempts}/${this.maxRetries}):`, {
          type: errorType,
          message: error.message,
          status: error.status
        });
        
        // If we've reached max retries, handle fallback
        if (attempts >= this.maxRetries) {
          return this.handlePersistentFailure(error, context);
        }
        
        // Check if error is retryable
        if (!this.isRetryableError(error)) {
          return this.handleNonRetryableError(error, context);
        }
        
        // Calculate exponential backoff delay
        const delay = this.calculateRetryDelay(attempts, errorType);
        console.log(`Retrying in ${delay}ms...`);
        
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // Fallback response if all retries failed
    return this.handlePersistentFailure(lastError, context);
  }

  /**
   * Call OpenAI API with timeout handling
   */
  private async callOpenAIWithTimeout(prompt: string, context: GameContext): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Request timeout'));
      }, this.requestTimeout);

      try {
        const result = await this.callOpenAI(prompt, context);
        clearTimeout(timeoutId);
        resolve(result);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Call OpenAI API with properly formatted prompt
   */
  private async callOpenAI(prompt: string, context: GameContext): Promise<string> {
    const { story, conversationHistory, characterState, gameState } = context;
    
    // Format the system prompt based on story context
    const systemPrompt = this.createSystemPrompt(story.genre, story.characterContext, story.gameRules);
    
    // Format conversation history
    const formattedHistory = this.formatConversationHistory(conversationHistory);
    
    // Format game state for context
    const gameStateContext = this.formatGameState(characterState, gameState);
    
    // Start timing for performance tracking
    const startTime = Date.now();
    
    // Call OpenAI API
    const response = await this.client.chat.completions.create({
      model: this.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'system', content: gameStateContext },
        ...formattedHistory,
        { role: 'user', content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
      top_p: 1,
      frequency_penalty: 0.2,
      presence_penalty: 0.6
    });
    
    // Calculate processing time
    const processingTime = Date.now() - startTime;
    console.log(`LLM response generated in ${processingTime}ms`);
    
    // Extract and return the response content
    const responseContent = response.choices[0]?.message?.content?.trim();
    
    if (!responseContent) {
      throw new Error('Empty response from OpenAI API');
    }
    
    return responseContent;
  }

  /**
   * Create system prompt based on story genre and context
   */
  private createSystemPrompt(genre: string, characterContext: string, gameRules: string[]): string {
    // Base prompt for RPG game master
    let prompt = `You are an immersive AI game master for a ${genre} role-playing game. 
Your responses should be engaging, descriptive, and maintain the atmosphere of the ${genre} genre.

Character and World Context:
${characterContext}

Game Rules:
${gameRules.join('\n')}

Guidelines:
1. Stay in character as the game master/narrator at all times
2. Provide vivid descriptions that engage the player's imagination
3. Respond to player actions with logical consequences
4. Maintain narrative consistency with previous exchanges
5. Offer meaningful choices to the player when appropriate
6. Keep responses concise (2-4 paragraphs maximum)
7. Use appropriate language and tone for the ${genre} genre
8. Never break the fourth wall or acknowledge that you are an AI
9. If the player attempts actions that contradict the game rules, gently guide them back to allowed actions
10. Adapt to the player's play style and preferences

Your goal is to create an immersive and engaging RPG experience through text.`;

    return prompt;
  }

  /**
   * Format conversation history for OpenAI API
   */
  private formatConversationHistory(history: string[]): { role: 'user' | 'assistant', content: string }[] {
    const formattedHistory: { role: 'user' | 'assistant', content: string }[] = [];
    
    // Process each message in history
    for (const message of history) {
      if (message.startsWith('Player: ')) {
        formattedHistory.push({
          role: 'user',
          content: message.substring('Player: '.length)
        });
      } else if (message.startsWith('AI: ')) {
        formattedHistory.push({
          role: 'assistant',
          content: message.substring('AI: '.length)
        });
      }
    }
    
    // Limit history to last 10 messages to avoid token limits
    return formattedHistory.slice(-10);
  }

  /**
   * Format game state for context
   */
  private formatGameState(characterState: Record<string, any>, gameState: Record<string, any>): string {
    let stateContext = 'Current Game State:\n';
    
    if (Object.keys(characterState).length > 0) {
      stateContext += '\nCharacter State:\n';
      for (const [key, value] of Object.entries(characterState)) {
        stateContext += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    if (Object.keys(gameState).length > 0) {
      stateContext += '\nWorld State:\n';
      for (const [key, value] of Object.entries(gameState)) {
        stateContext += `- ${key}: ${JSON.stringify(value)}\n`;
      }
    }
    
    return stateContext;
  }

  /**
   * Format error for consistent error handling
   */
  private formatError(error: any): Error {
    const errorResponse: ErrorResponse = {
      type: 'LLM_ERROR',
      message: error.message || 'Unknown error occurred while generating AI response',
      details: error.response?.data || error,
      timestamp: new Date()
    };
    
    return new Error(JSON.stringify(errorResponse));
  }

  /**
   * Set OpenAI model to use
   */
  setModel(model: string): void {
    this.model = model;
  }

  /**
   * Configure retry settings
   */
  configureRetries(maxRetries: number, baseRetryDelay: number, maxRetryDelay?: number, backoffMultiplier?: number): void {
    this.maxRetries = maxRetries;
    this.baseRetryDelay = baseRetryDelay;
    if (maxRetryDelay) this.maxRetryDelay = maxRetryDelay;
    if (backoffMultiplier) this.backoffMultiplier = backoffMultiplier;
  }

  /**
   * Classify error type for appropriate handling
   */
  private classifyError(error: any): 'rate_limit' | 'timeout' | 'auth' | 'server' | 'network' | 'unknown' {
    if (error.message === 'Request timeout') {
      return 'timeout';
    }
    
    if (error.status) {
      switch (error.status) {
        case 429:
          return 'rate_limit';
        case 401:
        case 403:
          return 'auth';
        case 500:
        case 502:
        case 503:
        case 504:
          return 'server';
        default:
          return 'unknown';
      }
    }
    
    if (error.code === 'ECONNRESET' || error.code === 'ENOTFOUND' || error.code === 'ETIMEDOUT') {
      return 'network';
    }
    
    return 'unknown';
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: any): boolean {
    const errorType = this.classifyError(error);
    
    // Non-retryable errors
    if (errorType === 'auth') {
      return false;
    }
    
    // Client errors (4xx) except rate limiting are generally not retryable
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      return false;
    }
    
    return true;
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(attempt: number, errorType: string): number {
    let baseDelay = this.baseRetryDelay;
    
    // Longer delays for rate limiting
    if (errorType === 'rate_limit') {
      baseDelay = Math.max(baseDelay, 5000); // Minimum 5 seconds for rate limits
    }
    
    // Exponential backoff
    const delay = baseDelay * Math.pow(this.backoffMultiplier, attempt - 1);
    
    // Add jitter to prevent thundering herd
    const jitter = Math.random() * 0.1 * delay;
    
    return Math.min(delay + jitter, this.maxRetryDelay);
  }

  /**
   * Handle non-retryable errors
   */
  private async handleNonRetryableError(error: any, context: GameContext): Promise<string> {
    const errorType = this.classifyError(error);
    
    if (errorType === 'auth') {
      console.error('Authentication error with OpenAI API. Check API key.');
      return 'Извините, произошла ошибка авторизации. Пожалуйста, обратитесь к администратору.';
    }
    
    // For other non-retryable errors, return a contextual fallback
    return this.generateContextualFallback(context);
  }

  /**
   * Handle persistent failures after all retries
   */
  private async handlePersistentFailure(error: any, context: GameContext): Promise<string> {
    const errorType = this.classifyError(error);
    
    console.error('OpenAI API persistent failure:', {
      type: errorType,
      message: error.message,
      status: error.status
    });
    
    // Log for monitoring
    this.logFailure(error, context);
    
    // Return contextual fallback response
    return this.generateContextualFallback(context);
  }

  /**
   * Generate contextual fallback response
   */
  private generateContextualFallback(context: GameContext): string {
    const { story } = context;
    
    // Try to provide a genre-appropriate fallback
    const genreFallbacks: Record<string, string[]> = {
      fantasy: [
        'Магические силы временно ослабли. Попробуйте повторить ваше действие.',
        'Древние руны мерцают и гаснут. Магия нестабильна в данный момент.',
        'Волшебство требует времени для восстановления. Подождите немного.'
      ],
      'sci-fi': [
        'Системы корабля временно недоступны. Перезагрузка в процессе.',
        'Связь с центральным компьютером прервана. Попробуйте еще раз.',
        'Технические неполадки в системе ИИ. Восстановление соединения...'
      ],
      mystery: [
        'Туман сгущается, затрудняя видимость. Попробуйте еще раз.',
        'Улики временно скрыты во мраке. Подождите прояснения.',
        'Тайна углубляется. Нужно время, чтобы разгадать следующий шаг.'
      ],
      adventure: [
        'Путь временно заблокирован. Ищите альтернативный маршрут.',
        'Приключение приостановлено. Соберитесь с силами и попробуйте снова.',
        'Неожиданное препятствие на пути. Время для новой стратегии.'
      ],
      horror: [
        'Тьма поглощает ваши слова. Попробуйте прошептать еще раз.',
        'Зловещая тишина нарушает связь. Осмельтесь повторить.',
        'Силы зла временно блокируют путь. Наберитесь храбрости.'
      ]
    };
    
    const fallbacks = genreFallbacks[story.genre] || this.fallbackResponses;
    const randomIndex = Math.floor(Math.random() * fallbacks.length);
    
    return fallbacks[randomIndex];
  }

  /**
   * Log failure for monitoring and debugging
   */
  private logFailure(error: any, context: GameContext): void {
    const logData = {
      timestamp: new Date().toISOString(),
      service: 'OpenAI-LLM',
      error: {
        type: this.classifyError(error),
        message: error.message,
        status: error.status,
        code: error.code
      },
      context: {
        storyId: context.story.id,
        genre: context.story.genre,
        conversationLength: context.conversationHistory.length
      }
    };
    
    console.error('LLM Service Failure:', JSON.stringify(logData, null, 2));
  }

  /**
   * Set request timeout
   */
  setTimeout(timeout: number): void {
    this.requestTimeout = timeout;
  }

  /**
   * Add custom fallback responses
   */
  addFallbackResponses(responses: string[]): void {
    this.fallbackResponses.push(...responses);
  }

  /**
   * Get service health status
   */
  async getHealthStatus(): Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; details: any }> {
    try {
      // Try a simple API call to check health
      await globalRateLimiter.acquire('openai-chat', 'low');
      
      const testResponse = await this.client.chat.completions.create({
        model: this.model,
        messages: [{ role: 'user', content: 'test' }],
        max_tokens: 1
      });
      
      return {
        status: 'healthy',
        details: {
          model: this.model,
          rateLimiter: globalRateLimiter.getMetrics('openai-chat')
        }
      };
    } catch (error: any) {
      const errorType = this.classifyError(error);
      
      return {
        status: errorType === 'rate_limit' ? 'degraded' : 'unhealthy',
        details: {
          error: error.message,
          type: errorType,
          rateLimiter: globalRateLimiter.getMetrics('openai-chat')
        }
      };
    }
  }
}