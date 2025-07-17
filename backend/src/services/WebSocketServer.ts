import { Server, Socket } from 'socket.io';
import { GameSessionManager } from './GameSessionManager';
import { StoryService } from './StoryService';
import { OpenAILLM } from './OpenAILLM';
import { Message, GameResponse, ErrorResponse, AudioSettings, LLMService, GameContext } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class WebSocketServer {
  private gameSessionManager: GameSessionManager;
  private storyService: StoryService;
  private llmService: LLMService;

  constructor(io: Server) {
    this.gameSessionManager = new GameSessionManager();
    this.storyService = new StoryService();
    this.llmService = new OpenAILLM();
    
    io.on('connection', (socket) => {
      console.log('Client connected:', socket.id);
      this.handleConnection(socket);
    });

    // Cleanup old sessions every hour
    setInterval(() => {
      const cleaned = this.gameSessionManager.cleanupOldSessions(24);
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} old sessions`);
      }
    }, 60 * 60 * 1000);
  }

  private handleConnection(socket: Socket): void {
    let currentUserId: string | null = null;
    let currentSessionId: string | null = null;

    // Join game session
    socket.on('join-game', async (data: { storyId: string; userId: string; settings?: AudioSettings }) => {
      try {
        const { storyId, userId, settings } = data;
        currentUserId = userId;

        // Get story
        const story = await this.storyService.getStoryById(storyId);
        if (!story) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Story not found');
          return;
        }

        // Default audio settings
        const audioSettings: AudioSettings = {
          ttsEnabled: true,
          ttsVolume: 0.8,
          asrSensitivity: 0.7,
          voiceSpeed: 1.0,
          ...settings
        };

        // Create new session
        const session = this.gameSessionManager.createSession(userId, story, audioSettings);
        currentSessionId = session.id;

        // Join socket room for this session
        socket.join(session.id);

        // Send initial game state
        socket.emit('session-created', {
          sessionId: session.id,
          story: session.context.story,
          settings: session.settings
        });

        // Send initial AI message
        if (session.messages.length > 0) {
          const initialMessage = session.messages[0];
          const response: GameResponse = {
            message: initialMessage
          };
          socket.emit('game-response', response);
        }

        console.log(`User ${userId} joined game session ${session.id} for story ${storyId}`);
      } catch (error) {
        console.error('Error joining game:', error);
        this.sendError(socket, 'VALIDATION_ERROR', 'Failed to join game');
      }
    });

    // Handle text message from user
    socket.on('send-message', async (messageContent: string) => {
      if (!currentSessionId || !currentUserId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      try {
        const session = this.gameSessionManager.getSession(currentSessionId);
        if (!session || session.status !== 'active') {
          this.sendError(socket, 'VALIDATION_ERROR', 'Session not active');
          return;
        }

        // Create user message
        const userMessage: Message = {
          id: uuidv4(),
          sessionId: currentSessionId,
          type: 'user',
          content: messageContent.trim(),
          metadata: {},
          timestamp: new Date()
        };

        // Add user message to session
        this.gameSessionManager.addMessage(currentSessionId, userMessage);

        // Echo user message back to client
        socket.emit('message-received', { message: userMessage });

        // Indicate that AI is generating a response
        socket.emit('ai-thinking', { status: 'generating' });

        try {
          // Start timing for performance tracking
          const startTime = Date.now();
          
          // Generate AI response using LLM service
          const aiResponse = await this.generateAIResponse(messageContent, currentSessionId);
          
          // Calculate processing time
          const processingTime = Date.now() - startTime;
          
          const aiMessage: Message = {
            id: uuidv4(),
            sessionId: currentSessionId,
            type: 'ai',
            content: aiResponse,
            metadata: {
              processingTime: processingTime
            },
            timestamp: new Date()
          };

          // Add AI message to session
          this.gameSessionManager.addMessage(currentSessionId, aiMessage);

          // Send AI response
          const gameResponse: GameResponse = {
            message: aiMessage
          };
          socket.emit('game-response', gameResponse);
        } catch (llmError: any) {
          console.error('LLM error:', llmError);
          
          // Create a fallback message for the user
          const fallbackMessage: Message = {
            id: uuidv4(),
            sessionId: currentSessionId,
            type: 'ai',
            content: 'Извините, у меня возникли проблемы с генерацией ответа. Пожалуйста, попробуйте еще раз или выберите другую историю.',
            metadata: {
              error: true
            },
            timestamp: new Date()
          };
          
          // Add fallback message to session
          this.gameSessionManager.addMessage(currentSessionId, fallbackMessage);
          
          // Send fallback response
          const fallbackResponse: GameResponse = {
            message: fallbackMessage
          };
          socket.emit('game-response', fallbackResponse);
          
          // Also send error event with details
          this.sendError(socket, 'LLM_ERROR', 'Ошибка генерации ответа ИИ', llmError.message);
        }
      } catch (error) {
        console.error('Error processing message:', error);
        this.sendError(socket, 'LLM_ERROR', 'Failed to process message');
      }
    });

    // Handle voice input (placeholder for future implementation)
    socket.on('voice-input', async (_audioData: Buffer) => {
      if (!currentSessionId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      try {
        // Placeholder for ASR processing
        socket.emit('voice-processing', { status: 'processing' });
        
        // For now, just acknowledge receipt
        socket.emit('voice-processed', { 
          status: 'completed',
          message: 'Voice input received but ASR not yet implemented'
        });
      } catch (error) {
        console.error('Error processing voice input:', error);
        this.sendError(socket, 'ASR_ERROR', 'Failed to process voice input');
      }
    });

    // Update session settings
    socket.on('update-settings', (settings: Partial<AudioSettings>) => {
      if (!currentSessionId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      const success = this.gameSessionManager.updateSessionSettings(currentSessionId, settings);
      if (success) {
        socket.emit('settings-updated', settings);
      } else {
        this.sendError(socket, 'VALIDATION_ERROR', 'Failed to update settings');
      }
    });

    // Pause session
    socket.on('pause-session', () => {
      if (!currentSessionId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      const success = this.gameSessionManager.pauseSession(currentSessionId);
      if (success) {
        socket.emit('session-paused');
      } else {
        this.sendError(socket, 'VALIDATION_ERROR', 'Failed to pause session');
      }
    });

    // Resume session
    socket.on('resume-session', () => {
      if (!currentSessionId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      const success = this.gameSessionManager.resumeSession(currentSessionId);
      if (success) {
        socket.emit('session-resumed');
      } else {
        this.sendError(socket, 'VALIDATION_ERROR', 'Failed to resume session');
      }
    });

    // Get session history
    socket.on('get-history', () => {
      if (!currentSessionId) {
        this.sendError(socket, 'VALIDATION_ERROR', 'No active session');
        return;
      }

      const session = this.gameSessionManager.getSession(currentSessionId);
      if (session) {
        socket.emit('session-history', {
          messages: session.messages,
          context: session.context
        });
      } else {
        this.sendError(socket, 'VALIDATION_ERROR', 'Session not found');
      }
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log('Client disconnected:', socket.id);
      if (currentSessionId) {
        // Pause session instead of ending it, so user can reconnect
        this.gameSessionManager.pauseSession(currentSessionId);
        console.log(`Session ${currentSessionId} paused due to disconnect`);
      }
    });
  }

  private async generateAIResponse(userMessage: string, sessionId?: string): Promise<string> {
    if (!sessionId) {
      throw new Error('Session ID is required to generate AI response');
    }

    // Get the current session
    const session = this.gameSessionManager.getSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Validate session is active
    if (session.status !== 'active') {
      throw new Error('Session is not active');
    }

    try {
      // Start timing for performance tracking
      const startTime = Date.now();

      // Ensure conversation history is up to date before generating response
      const updatedSession = this.gameSessionManager.getSession(sessionId);
      if (!updatedSession) {
        throw new Error('Session not found after update');
      }

      // Generate response using LLM service with full context
      const response = await this.llmService.generateResponse(userMessage, updatedSession.context);

      // Calculate processing time
      const processingTime = Date.now() - startTime;
      console.log(`LLM response generated in ${processingTime}ms for session ${sessionId}`);

      // Update game context based on AI response
      this.updateGameContextFromResponse(sessionId, userMessage, response);
      
      return response;
    } catch (error) {
      console.error('Error generating AI response:', error);
      
      // Enhanced error handling with specific error types
      if (error instanceof Error) {
        if (error.message.includes('API key')) {
          throw new Error('LLM service configuration error');
        } else if (error.message.includes('rate limit')) {
          throw new Error('LLM service rate limit exceeded');
        } else if (error.message.includes('timeout')) {
          throw new Error('LLM service timeout');
        }
      }
      
      throw error;
    }
  }

  /**
   * Update game context based on user message and AI response
   * This helps maintain game state consistency and provides better context for future LLM interactions
   */
  private updateGameContextFromResponse(sessionId: string, userMessage: string, aiResponse: string): void {
    const session = this.gameSessionManager.getSession(sessionId);
    if (!session) return;

    const contextUpdate: Partial<GameContext> = {};
    const characterStateUpdate: Record<string, any> = { ...session.context.characterState };
    const gameStateUpdate: Record<string, any> = { ...session.context.gameState };
    
    // Update character state based on common RPG actions
    const userMessageLower = userMessage.toLowerCase();
    const aiResponseLower = aiResponse.toLowerCase();
    
    // Inventory and item management
    if (userMessageLower.includes('inventory') || userMessageLower.includes('items') || userMessageLower.includes('bag')) {
      characterStateUpdate.lastInventoryCheck = new Date().toISOString();
      
      // Extract items mentioned in AI response
      const itemMatches = aiResponse.match(/(?:find|have|carry|possess|discover)\s+(?:a\s+|an\s+|the\s+)?([^,.!?]+)/gi);
      if (itemMatches) {
        characterStateUpdate.recentItemsFound = itemMatches.map(match => 
          match.replace(/^(?:find|have|carry|possess|discover)\s+(?:a\s+|an\s+|the\s+)?/i, '').trim()
        );
      }
    }
    
    // Health and status checks
    if (userMessageLower.includes('health') || userMessageLower.includes('hp') || userMessageLower.includes('status')) {
      characterStateUpdate.lastHealthCheck = new Date().toISOString();
      
      // Extract health information from AI response
      const healthMatch = aiResponse.match(/health\s+(?:is\s+)?(?:at\s+)?(\d+)(?:\/(\d+))?/i);
      if (healthMatch) {
        characterStateUpdate.currentHealth = parseInt(healthMatch[1]);
        if (healthMatch[2]) {
          characterStateUpdate.maxHealth = parseInt(healthMatch[2]);
        }
      }
    }

    // Combat and action tracking
    if (userMessageLower.includes('attack') || userMessageLower.includes('fight') || userMessageLower.includes('battle')) {
      characterStateUpdate.lastCombatAction = new Date().toISOString();
      characterStateUpdate.lastAction = 'combat';
    } else if (userMessageLower.includes('search') || userMessageLower.includes('look') || userMessageLower.includes('examine') || userMessageLower.includes('enter') || userMessageLower.includes('explore')) {
      characterStateUpdate.lastExplorationAction = new Date().toISOString();
      characterStateUpdate.lastAction = 'exploration';
    } else if (userMessageLower.includes('talk') || userMessageLower.includes('speak') || userMessageLower.includes('say')) {
      characterStateUpdate.lastSocialAction = new Date().toISOString();
      characterStateUpdate.lastAction = 'social';
    }

    // Location and movement tracking - prioritize more specific patterns first
    const locationPatterns = [
      /(?:you find yourself in|you are now in|you have entered)\s+(?:the\s+)?([^.!?]+)/i,
      /(?:enter|arrive at|reach|move to|go to|travel to)\s+(?:the\s+)?([^.!?]+)/i,
      /(?:location|place|area):\s*([^.!?]+)/i
    ];
    
    for (const pattern of locationPatterns) {
      const locationMatch = aiResponse.match(pattern);
      if (locationMatch) {
        let location = locationMatch[1].trim();
        // Clean up the location string by removing trailing punctuation and extra text
        location = location.replace(/[,.!?].*$/, '').trim();
        gameStateUpdate.currentLocation = location;
        gameStateUpdate.lastLocationUpdate = new Date().toISOString();
        break;
      }
    }

    // NPC and character tracking
    const npcMatch = aiResponse.match(/(?:meet|encounter|see|find)\s+(?:a\s+|an\s+|the\s+)?([^.!?]*(?:guard|merchant|wizard|knight|priest|villager|stranger|person))/i);
    if (npcMatch) {
      if (!gameStateUpdate.encounteredNPCs) {
        gameStateUpdate.encounteredNPCs = [];
      }
      const npcName = npcMatch[1].trim();
      if (!gameStateUpdate.encounteredNPCs.includes(npcName)) {
        gameStateUpdate.encounteredNPCs.push(npcName);
      }
      gameStateUpdate.lastNPCEncounter = new Date().toISOString();
    }

    // Quest and objective tracking
    if (aiResponseLower.includes('quest') || aiResponseLower.includes('mission') || aiResponseLower.includes('task')) {
      gameStateUpdate.lastQuestUpdate = new Date().toISOString();
      
      // Extract quest-related information
      const questMatch = aiResponse.match(/(?:quest|mission|task):\s*([^.!?]+)/i);
      if (questMatch) {
        if (!gameStateUpdate.activeQuests) {
          gameStateUpdate.activeQuests = [];
        }
        const questDescription = questMatch[1].trim();
        if (!gameStateUpdate.activeQuests.some((q: any) => q.description === questDescription)) {
          gameStateUpdate.activeQuests.push({
            description: questDescription,
            startedAt: new Date().toISOString()
          });
        }
      }
    }

    // Mood and atmosphere tracking for better context
    if (aiResponseLower.includes('dark') || aiResponseLower.includes('ominous') || aiResponseLower.includes('dangerous')) {
      gameStateUpdate.currentMood = 'tense';
    } else if (aiResponseLower.includes('peaceful') || aiResponseLower.includes('calm') || aiResponseLower.includes('serene')) {
      gameStateUpdate.currentMood = 'peaceful';
    } else if (aiResponseLower.includes('exciting') || aiResponseLower.includes('thrilling') || aiResponseLower.includes('adventure')) {
      gameStateUpdate.currentMood = 'adventurous';
    }

    // Update context if changes were made
    let hasUpdates = false;
    
    if (JSON.stringify(characterStateUpdate) !== JSON.stringify(session.context.characterState)) {
      contextUpdate.characterState = characterStateUpdate;
      hasUpdates = true;
    }
    
    if (JSON.stringify(gameStateUpdate) !== JSON.stringify(session.context.gameState)) {
      contextUpdate.gameState = gameStateUpdate;
      hasUpdates = true;
    }

    if (hasUpdates) {
      this.gameSessionManager.updateSessionContext(sessionId, contextUpdate);
      console.log(`Updated game context for session ${sessionId}:`, {
        characterStateChanges: Object.keys(contextUpdate.characterState || {}),
        gameStateChanges: Object.keys(contextUpdate.gameState || {})
      });
    }
  }

  private sendError(socket: Socket, type: ErrorResponse['type'], message: string, details?: any): void {
    const error: ErrorResponse = {
      type,
      message,
      details,
      timestamp: new Date()
    };
    socket.emit('error', error);
  }
}