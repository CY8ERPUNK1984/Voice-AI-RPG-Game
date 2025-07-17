import { OpenAI } from 'openai';
import { LLMService, GameContext, ErrorResponse } from '../types';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * OpenAI LLM service implementation
 * Handles communication with OpenAI API for generating game responses
 */
export class OpenAILLM implements LLMService {
  private client: OpenAI;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // ms
  private model: string = 'gpt-4o';

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
    
    while (attempts < this.maxRetries) {
      try {
        return await this.callOpenAI(prompt, context);
      } catch (error: any) {
        attempts++;
        console.error(`OpenAI API error (attempt ${attempts}/${this.maxRetries}):`, error.message);
        
        // If we've reached max retries, throw the error
        if (attempts >= this.maxRetries) {
          throw this.formatError(error);
        }
        
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempts));
      }
    }
    
    // This should never be reached due to the throw in the loop
    throw new Error('Failed to generate response after multiple attempts');
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
  configureRetries(maxRetries: number, retryDelay: number): void {
    this.maxRetries = maxRetries;
    this.retryDelay = retryDelay;
  }
}