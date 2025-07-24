import { GameSession, GameContext, Message, Story, AudioSettings, TTSService } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { OpenAITTS } from './OpenAITTS';
import * as fs from 'fs/promises';
import * as path from 'path';

interface SessionMetrics {
  activeSessions: number;
  totalSessions: number;
  averageSessionDuration: number;
  memoryUsage: number;
  messageCount: number;
  lastCleanup: Date;
}

interface SessionHealth {
  sessionId: string;
  memoryUsage: number;
  messageCount: number;
  lastActivity: Date;
  isHealthy: boolean;
}

interface SessionPersistenceData {
  sessions: Array<GameSession>;
  userSessions: Array<[string, string]>;
  metrics: SessionMetrics;
  timestamp: Date;
}

export class GameSessionManager {
  private sessions: Map<string, GameSession> = new Map();
  private userSessions: Map<string, string> = new Map(); // userId -> sessionId
  private ttsService: TTSService;
  private metrics: SessionMetrics;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private persistenceInterval: NodeJS.Timeout | null = null;
  private readonly persistencePath: string;
  private readonly maxSessionAge: number = 24 * 60 * 60 * 1000; // 24 hours
  private readonly maxMemoryPerSession: number = 50 * 1024 * 1024; // 50MB per session
  private readonly cleanupIntervalMs: number = 30 * 60 * 1000; // 30 minutes
  private readonly persistenceIntervalMs: number = 5 * 60 * 1000; // 5 minutes

  constructor(ttsService?: TTSService, persistencePath?: string) {
    this.ttsService = ttsService || new OpenAITTS();
    this.persistencePath = persistencePath || path.join(process.cwd(), 'temp', 'sessions.json');
    
    this.metrics = {
      activeSessions: 0,
      totalSessions: 0,
      averageSessionDuration: 0,
      memoryUsage: 0,
      messageCount: 0,
      lastCleanup: new Date()
    };

    // Initialize automatic cleanup and persistence
    this.startAutomaticCleanup();
    this.startAutomaticPersistence();
    
    // Load persisted sessions on startup
    this.loadPersistedSessions().catch(error => {
      console.warn('Failed to load persisted sessions:', error);
    });
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
    
    // Update metrics
    this.metrics.totalSessions++;
    this.updateMetrics();

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
    const session = this.sessions.get(sessionId);
    // Only return if session is active or paused (can be resumed)
    if (session && (session.status === 'active' || session.status === 'paused')) {
      return session;
    }
    return undefined;
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

    // Automatic memory management - trim messages if too many
    if (session.messages.length > 100) {
      session.messages = session.messages.slice(-100);
    }

    // Check if session is using too much memory and optimize
    const sessionMemory = this.estimateSessionMemoryUsage(session);
    if (sessionMemory > this.maxMemoryPerSession) {
      this.optimizeSessionMemory(session);
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

    this.metrics.lastCleanup = new Date();
    this.updateMetrics();
    return cleanedCount;
  }

  /**
   * Start automatic cleanup process
   */
  private startAutomaticCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.cleanupOldSessions();
      if (cleaned > 0) {
        console.log(`Cleaned up ${cleaned} old sessions`);
      }
      
      // Also cleanup memory-heavy sessions
      this.cleanupMemoryHeavySessions();
    }, this.cleanupIntervalMs);
  }

  /**
   * Stop automatic cleanup process
   */
  private stopAutomaticCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Clean up sessions that use too much memory
   */
  private cleanupMemoryHeavySessions(): void {
    for (const [sessionId, session] of this.sessions.entries()) {
      const sessionMemory = this.estimateSessionMemoryUsage(session);
      if (sessionMemory > this.maxMemoryPerSession) {
        console.warn(`Session ${sessionId} using ${sessionMemory} bytes, cleaning up`);
        
        // Trim conversation history to reduce memory
        if (session.context.conversationHistory.length > 10) {
          session.context.conversationHistory = session.context.conversationHistory.slice(-10);
        }
        
        // Remove old messages if still too large
        if (session.messages.length > 50) {
          session.messages = session.messages.slice(-50);
        }
        
        session.updatedAt = new Date();
      }
    }
  }

  /**
   * Estimate memory usage of a session
   */
  private estimateSessionMemoryUsage(session: GameSession): number {
    const sessionStr = JSON.stringify(session);
    return Buffer.byteLength(sessionStr, 'utf8');
  }

  /**
   * Get session metrics
   */
  getSessionMetrics(): SessionMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Update internal metrics
   */
  private updateMetrics(): void {
    const activeSessions = this.getActiveSessions();
    this.metrics.activeSessions = activeSessions.length;
    
    let totalMemory = 0;
    let totalMessages = 0;
    let totalDuration = 0;
    
    for (const session of activeSessions) {
      totalMemory += this.estimateSessionMemoryUsage(session);
      totalMessages += session.messages.length;
      totalDuration += Date.now() - session.createdAt.getTime();
    }
    
    this.metrics.memoryUsage = totalMemory;
    this.metrics.messageCount = totalMessages;
    this.metrics.averageSessionDuration = activeSessions.length > 0 ? 
      totalDuration / activeSessions.length : 0;
  }

  /**
   * Get health status of all sessions
   */
  getSessionsHealth(): SessionHealth[] {
    const health: SessionHealth[] = [];
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const memoryUsage = this.estimateSessionMemoryUsage(session);
      const messageCount = session.messages.length;
      const lastActivity = session.updatedAt;
      
      const isHealthy = memoryUsage < this.maxMemoryPerSession && 
                       messageCount < 100 && 
                       (Date.now() - lastActivity.getTime()) < this.maxSessionAge;
      
      health.push({
        sessionId,
        memoryUsage,
        messageCount,
        lastActivity,
        isHealthy
      });
    }
    
    return health;
  }

  /**
   * Start automatic session persistence
   */
  private startAutomaticPersistence(): void {
    this.persistenceInterval = setInterval(() => {
      this.persistSessions().catch(error => {
        console.error('Failed to persist sessions:', error);
      });
    }, this.persistenceIntervalMs);
  }

  /**
   * Stop automatic session persistence
   */
  private stopAutomaticPersistence(): void {
    if (this.persistenceInterval) {
      clearInterval(this.persistenceInterval);
      this.persistenceInterval = null;
    }
  }

  /**
   * Persist sessions to disk
   */
  async persistSessions(): Promise<void> {
    try {
      const persistenceData: SessionPersistenceData = {
        sessions: Array.from(this.sessions.values()),
        userSessions: Array.from(this.userSessions.entries()),
        metrics: this.metrics,
        timestamp: new Date()
      };

      // Ensure directory exists
      const dir = path.dirname(this.persistencePath);
      await fs.mkdir(dir, { recursive: true });

      // Write to temporary file first, then rename for atomic operation
      const tempPath = `${this.persistencePath}.tmp`;
      await fs.writeFile(tempPath, JSON.stringify(persistenceData, null, 2));
      await fs.rename(tempPath, this.persistencePath);
      
      console.log(`Persisted ${this.sessions.size} sessions to ${this.persistencePath}`);
    } catch (error) {
      console.error('Failed to persist sessions:', error);
      throw error;
    }
  }

  /**
   * Load persisted sessions from disk
   */
  async loadPersistedSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.persistencePath, 'utf8');
      const persistenceData: SessionPersistenceData = JSON.parse(data);
      
      // Restore sessions
      this.sessions.clear();
      this.userSessions.clear();
      
      for (const session of persistenceData.sessions) {
        // Convert date strings back to Date objects
        session.createdAt = new Date(session.createdAt);
        session.updatedAt = new Date(session.updatedAt);
        
        for (const message of session.messages) {
          message.timestamp = new Date(message.timestamp);
        }
        
        this.sessions.set(session.id, session);
      }
      
      for (const [userId, sessionId] of persistenceData.userSessions) {
        this.userSessions.set(userId, sessionId);
      }
      
      // Restore metrics
      if (persistenceData.metrics) {
        this.metrics = {
          ...persistenceData.metrics,
          lastCleanup: new Date(persistenceData.metrics.lastCleanup)
        };
      }
      
      console.log(`Loaded ${this.sessions.size} sessions from ${this.persistencePath}`);
      
      // Clean up any stale sessions after loading
      this.cleanupOldSessions();
      
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        console.log('No persisted sessions file found, starting fresh');
      } else {
        console.error('Failed to load persisted sessions:', error);
        throw error;
      }
    }
  }

  /**
   * Optimize memory usage for a single session
   */
  private optimizeSessionMemory(session: GameSession): void {
    // Trim conversation history
    if (session.context.conversationHistory.length > 20) {
      session.context.conversationHistory = session.context.conversationHistory.slice(-20);
    }
    
    // Remove old messages beyond limit
    if (session.messages.length > 100) {
      session.messages = session.messages.slice(-100);
    }
    
    // Clean up metadata in messages
    for (const message of session.messages) {
      if (message.metadata && Object.keys(message.metadata).length > 3) {
        // Keep only essential metadata
        const essentialMetadata: any = {};
        if (message.metadata.processingTime !== undefined) {
          essentialMetadata.processingTime = message.metadata.processingTime;
        }
        if (message.metadata.error !== undefined) {
          essentialMetadata.error = message.metadata.error;
        }
        if (message.metadata.ttsError !== undefined) {
          essentialMetadata.ttsError = message.metadata.ttsError;
        }
        message.metadata = essentialMetadata;
      }
    }
    
    session.updatedAt = new Date();
  }

  /**
   * Force memory optimization for all sessions
   */
  optimizeMemoryUsage(): void {
    let optimizedCount = 0;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const initialMemory = this.estimateSessionMemoryUsage(session);
      this.optimizeSessionMemory(session);
      const finalMemory = this.estimateSessionMemoryUsage(session);
      
      if (finalMemory < initialMemory) {
        optimizedCount++;
      }
    }
    
    console.log(`Optimized memory usage for ${optimizedCount} sessions`);
    this.updateMetrics();
  }

  /**
   * Graceful shutdown - cleanup and persist
   */
  async shutdown(): Promise<void> {
    console.log('GameSessionManager shutting down...');
    
    // Stop automatic processes
    this.stopAutomaticCleanup();
    this.stopAutomaticPersistence();
    
    // Final persistence
    try {
      await this.persistSessions();
      console.log('Sessions persisted successfully during shutdown');
    } catch (error) {
      console.error('Failed to persist sessions during shutdown:', error);
    }
    
    // Clear in-memory data
    this.sessions.clear();
    this.userSessions.clear();
    
    console.log('GameSessionManager shutdown complete');
  }
}