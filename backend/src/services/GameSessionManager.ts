import { GameSession, GameContext, Message, Story, AudioSettings, TTSService } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { OpenAITTS } from './OpenAITTS';

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId
  private ttsService: TTSService;

  constructor(ttsService?: TTSService) {
    this.ttsService = ttsService || new OpenAITTS();
  }

  /**
   * Create a new game session for a user with a specific story
   */
  createSession(userId: string, story: Story, settings: AudioSettings): GameSession {
    // End any existing session for this user
    this.endUserSession(userId);

    const sessionId = uuidv4();
    const session: GameSession = {
      id: sessionId,
      storyId: story.id,
      userId,
      status: 'active',
      messages: [],
      context: {
        story,
        characterState: {},
        gameState: {},
        conversationHistory: []
      },
      settings,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    this.sessions.set(sessionId, session);
    this.userSessions.set(userId, sessionId);

    // Add initial AI message with story introduction
    this.addMessage(sessionId, {
      id: uuidv4(),
      sessionId,
      type: 'ai',
      content: story.initialPrompt,
      metadata: {},
      timestamp: new Date()
    });

    return session;
  }

  /**
   * Get session by ID
   */
  getSession(sessionId: string): GameSession | undefined {
    return this.sessions.get(sessionId);
  }

  /**
   * Get active session for a user
   */
  getUserSession(userId: string): GameSession | undefined {
    const sessionId = this.userSessions.get(userId);
    if (!sessionId) return undefined;
    return this.sessions.get(sessionId);
  }

  /**
   * Add a message to a session
   */
  addMessage(sessionId: string, message: Message): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.messages.push(message);
    session.updatedAt = new Date();

    // Update conversation history for LLM context
    session.context.conversationHistory.push(
      `${message.type === 'user' ? 'Player' : 'AI'}: ${message.content}`
    );

    // Keep only last 20 messages in history to manage context size
    if (session.context.conversationHistory.length > 20) {
      session.context.conversationHistory = session.context.conversationHistory.slice(-20);
    }

    return true;
  }

  /**
   * Add AI message with TTS synthesis
   */
  async addAIMessageWithTTS(sessionId: string, content: string, metadata: any = {}): Promise<Message | null> {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    const message: Message = {
      id: uuidv4(),
      sessionId,
      type: 'ai',
      content,
      metadata,
      timestamp: new Date()
    };

    // Generate TTS audio if enabled
    if (session.settings.ttsEnabled && this.ttsService.isAvailable()) {
      try {
        const audioUrl = await this.ttsService.synthesizeSpeech(content, {
          voice: 'alloy', // Default voice, could be configurable
          speed: session.settings.voiceSpeed,
          pitch: 1.0
        });
        message.audioUrl = audioUrl;
      } catch (error) {
        console.error('TTS synthesis failed:', error);
        // Continue without audio - fallback to text-only
        message.metadata.ttsError = true;
      }
    }

    // Add message to session
    this.addMessage(sessionId, message);
    
    return message;
  }

  /**
   * Update session settings
   */
  updateSessionSettings(sessionId: string, settings: Partial<AudioSettings>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.settings = { ...session.settings, ...settings };
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Get TTS service availability
   */
  isTTSAvailable(): boolean {
    return this.ttsService.isAvailable();
  }

  /**
   * Test TTS synthesis
   */
  async testTTS(text: string = 'Hello, this is a test.'): Promise<string | null> {
    if (!this.ttsService.isAvailable()) {
      return null;
    }

    try {
      return await this.ttsService.synthesizeSpeech(text, {
        voice: 'alloy',
        speed: 1.0,
        pitch: 1.0
      });
    } catch (error) {
      console.error('TTS test failed:', error);
      return null;
    }
  }

  /**
   * Update session context (character state, game state)
   */
  updateSessionContext(sessionId: string, contextUpdate: Partial<GameContext>): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.context = { ...session.context, ...contextUpdate };
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Pause a session
   */
  pauseSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'paused';
    session.updatedAt = new Date();
    return true;
  }

  /**
   * Resume a session
   */
  resumeSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'active';
    session.updatedAt = new Date();
    return true;
  }

  /**
   * End a session
   */
  endSession(sessionId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session) return false;

    session.status = 'completed';
    session.updatedAt = new Date();

    // Remove from active sessions
    this.userSessions.delete(session.userId);
    this.sessions.delete(sessionId);
    return true;
  }

  /**
   * End any existing session for a user
   */
  private endUserSession(userId: string): void {
    const existingSessionId = this.userSessions.get(userId);
    if (existingSessionId) {
      this.endSession(existingSessionId);
    }
  }

  /**
   * Get all active sessions (for monitoring/debugging)
   */
  getActiveSessions(): GameSession[] {
    return Array.from(this.sessions.values()).filter(session => session.status === 'active');
  }

  /**
   * Clean up old sessions (should be called periodically)
   */
  cleanupOldSessions(maxAgeHours: number = 24): number {
    const cutoffTime = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.updatedAt < cutoffTime) {
        this.endSession(sessionId);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }
}