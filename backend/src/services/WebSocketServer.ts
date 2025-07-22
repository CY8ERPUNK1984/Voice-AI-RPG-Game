import { Server, Socket } from 'socket.io';
import { GameSessionManager } from './GameSessionManager';
import { StoryService } from './StoryService';
import { OpenAILLM } from './OpenAILLM';
import { Message, GameResponse, ErrorResponse, AudioSettings, LLMService, GameContext } from '../types';
import { v4 as uuidv4 } from 'uuid';

export interface ConnectionInfo {
  socketId: string;
  userId?: string;
  sessionId?: string;
  connectedAt: Date;
  lastActivity: Date;
  reconnectCount: number;
  isHealthy: boolean;
  lastPing?: Date;
  lastPong?: Date;
  connectionQuality: 'excellent' | 'good' | 'poor' | 'critical';
  errorCount: number;
  lastError?: Date;
  timeoutCount: number;
}

export interface ServerMetrics {
  totalConnections: number;
  activeConnections: number;
  totalReconnections: number;
  averageSessionDuration: number;
  errorCount: number;
  lastError?: Date;
  timeoutCount: number;
  connectionDrops: number;
  averageLatency: number;
  uptime: number;
  startTime: Date;
}

export class WebSocketServer {
  private gameSessionManager: GameSessionManager;
  private storyService: StoryService;
  private llmService: LLMService;
  private io: Server;
  private connections: Map<string, ConnectionInfo> = new Map();
  private metrics: ServerMetrics;
  private isShuttingDown: boolean = false;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private connectionTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private sessionPersistence: Map<string, { sessionId: string; userId: string; lastSeen: Date }> = new Map();

  constructor(io: Server) {
    this.io = io;
    this.gameSessionManager = new GameSessionManager();
    this.storyService = new StoryService();
    this.llmService = new OpenAILLM();
    
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      totalReconnections: 0,
      averageSessionDuration: 0,
      errorCount: 0,
      timeoutCount: 0,
      connectionDrops: 0,
      averageLatency: 0,
      uptime: 0,
      startTime: new Date()
    };

    this.setupServerEventHandlers(io);
    this.startPeriodicTasks();
    this.setupGracefulShutdown();
  }

  private setupServerEventHandlers(io: Server): void {
    io.on('connection', (socket) => {
      this.handleNewConnection(socket);
    });

    // Enhanced error handling for the server engine
    if (io.engine) {
      io.engine.on('connection_error', (err) => {
        this.logError('Engine connection error', err, {
          errorType: 'ENGINE_CONNECTION_ERROR',
          timestamp: new Date().toISOString()
        });
        this.metrics.errorCount++;
        this.metrics.connectionDrops++;
      });

      io.engine.on('initial_headers', (headers, req) => {
        this.logInfo('Initial connection headers received', {
          userAgent: req?.headers?.['user-agent'] || 'unknown',
          origin: req?.headers?.origin || 'unknown',
          timestamp: new Date().toISOString()
        });
      });

      io.engine.on('headers', (headers, req) => {
        // Add custom headers for monitoring
        headers['X-Server-Time'] = new Date().toISOString();
        headers['X-Server-Version'] = process.env.APP_VERSION || '1.0.0';
      });
    }

    // Handle server-level errors
    io.on('error', (error) => {
      this.logError('Socket.IO server error', error, {
        errorType: 'SERVER_ERROR',
        timestamp: new Date().toISOString()
      });
      this.metrics.errorCount++;
    });
  }

  private handleNewConnection(socket: Socket): void {
    const connectionInfo: ConnectionInfo = {
      socketId: socket.id,
      connectedAt: new Date(),
      lastActivity: new Date(),
      reconnectCount: 0,
      isHealthy: true,
      connectionQuality: 'excellent',
      errorCount: 0,
      timeoutCount: 0
    };

    this.connections.set(socket.id, connectionInfo);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;

    // Set up connection timeout monitoring
    this.setupConnectionTimeout(socket.id);

    this.logInfo(`Client connected: ${socket.id}`, {
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      clientIP: socket.handshake?.address || 'unknown',
      userAgent: socket.handshake?.headers?.['user-agent'] || 'unknown'
    });

    this.handleConnection(socket);
  }

  private startPeriodicTasks(): void {
    // Heartbeat monitoring every 30 seconds
    this.heartbeatInterval = setInterval(() => {
      this.performHealthCheck();
    }, 30 * 1000);

    // Cleanup old sessions every hour
    this.cleanupInterval = setInterval(() => {
      const cleaned = this.gameSessionManager.cleanupOldSessions(24);
      if (cleaned > 0) {
        this.logInfo(`Cleaned up ${cleaned} old sessions`);
      }
      this.cleanupStaleConnections();
      this.cleanupSessionPersistence();
    }, 60 * 60 * 1000);

    // Update metrics every 5 minutes
    this.metricsInterval = setInterval(() => {
      this.updateMetrics();
    }, 5 * 60 * 1000);
  }

  private setupConnectionTimeout(socketId: string): void {
    // Set up connection timeout (5 minutes of inactivity)
    const timeout = setTimeout(() => {
      this.handleConnectionTimeout(socketId);
    }, 5 * 60 * 1000);

    this.connectionTimeouts.set(socketId, timeout);
  }

  private resetConnectionTimeout(socketId: string): void {
    const existingTimeout = this.connectionTimeouts.get(socketId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }
    this.setupConnectionTimeout(socketId);
  }

  private handleConnectionTimeout(socketId: string): void {
    const connectionInfo = this.connections.get(socketId);
    if (!connectionInfo) return;

    connectionInfo.timeoutCount++;
    connectionInfo.connectionQuality = 'critical';
    this.metrics.timeoutCount++;

    this.logWarn(`Connection timeout for ${socketId}`, {
      userId: connectionInfo.userId,
      sessionId: connectionInfo.sessionId,
      timeoutCount: connectionInfo.timeoutCount,
      lastActivity: connectionInfo.lastActivity
    });

    // Try to ping the connection one more time
    const socket = this.io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit('connection-timeout-warning', {
        message: 'Соединение нестабильно. Проверьте подключение к интернету.',
        timeoutCount: connectionInfo.timeoutCount,
        timestamp: new Date().toISOString()
      });

      // If too many timeouts, force disconnect
      if (connectionInfo.timeoutCount >= 3) {
        this.logError('Forcing disconnect due to repeated timeouts', new Error('Connection timeout'), {
          socketId,
          userId: connectionInfo.userId,
          timeoutCount: connectionInfo.timeoutCount
        });
        socket.disconnect(true);
      }
    }
  }

  private cleanupSessionPersistence(): void {
    const now = new Date();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    let cleanedCount = 0;

    for (const [key, persistence] of this.sessionPersistence.entries()) {
      if (now.getTime() - persistence.lastSeen.getTime() > maxAge) {
        this.sessionPersistence.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logInfo(`Cleaned up ${cleanedCount} old session persistence records`);
    }
  }

  private performHealthCheck(): void {
    if (this.isShuttingDown) return;

    const now = new Date();
    const staleThreshold = 5 * 60 * 1000; // 5 minutes
    const criticalThreshold = 10 * 60 * 1000; // 10 minutes
    let totalLatency = 0;
    let latencyCount = 0;

    for (const [socketId, connectionInfo] of this.connections.entries()) {
      const timeSinceActivity = now.getTime() - connectionInfo.lastActivity.getTime();
      
      // Update connection quality based on activity and ping times
      this.updateConnectionQuality(connectionInfo, timeSinceActivity);

      // Calculate latency if we have ping/pong data
      if (connectionInfo.lastPing && connectionInfo.lastPong) {
        const latency = connectionInfo.lastPong.getTime() - connectionInfo.lastPing.getTime();
        if (latency > 0 && latency < 10000) { // Reasonable latency range
          totalLatency += latency;
          latencyCount++;
        }
      }
      
      if (timeSinceActivity > staleThreshold) {
        connectionInfo.isHealthy = false;
        
        if (timeSinceActivity > criticalThreshold) {
          this.logError('Connection critically stale', new Error('Connection timeout'), {
            socketId,
            timeSinceActivity: Math.round(timeSinceActivity / 1000),
            userId: connectionInfo.userId,
            sessionId: connectionInfo.sessionId,
            connectionQuality: connectionInfo.connectionQuality
          });
        } else {
          this.logWarn(`Connection ${socketId} appears stale`, {
            timeSinceActivity: Math.round(timeSinceActivity / 1000),
            userId: connectionInfo.userId,
            sessionId: connectionInfo.sessionId,
            connectionQuality: connectionInfo.connectionQuality
          });
        }

        // Try to ping the connection
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          connectionInfo.lastPing = now;
          socket.emit('ping', { 
            timestamp: now.toISOString(),
            connectionQuality: connectionInfo.connectionQuality,
            timeSinceActivity: Math.round(timeSinceActivity / 1000)
          });
        }
      }
    }

    // Update average latency metric
    if (latencyCount > 0) {
      this.metrics.averageLatency = totalLatency / latencyCount;
    }
  }

  private updateConnectionQuality(connectionInfo: ConnectionInfo, timeSinceActivity: number): void {
    const now = new Date();
    let quality: ConnectionInfo['connectionQuality'] = 'excellent';

    // Base quality on activity time
    if (timeSinceActivity > 10 * 60 * 1000) { // 10 minutes
      quality = 'critical';
    } else if (timeSinceActivity > 5 * 60 * 1000) { // 5 minutes
      quality = 'poor';
    } else if (timeSinceActivity > 2 * 60 * 1000) { // 2 minutes
      quality = 'good';
    }

    // Factor in error count
    if (connectionInfo.errorCount > 5) {
      quality = 'critical';
    } else if (connectionInfo.errorCount > 2) {
      quality = quality === 'excellent' ? 'good' : quality;
    }

    // Factor in timeout count
    if (connectionInfo.timeoutCount > 2) {
      quality = 'critical';
    } else if (connectionInfo.timeoutCount > 0) {
      quality = quality === 'excellent' ? 'good' : quality;
    }

    // Factor in ping latency if available
    if (connectionInfo.lastPing && connectionInfo.lastPong) {
      const latency = connectionInfo.lastPong.getTime() - connectionInfo.lastPing.getTime();
      if (latency > 5000) { // 5 seconds
        quality = 'critical';
      } else if (latency > 2000) { // 2 seconds
        quality = quality === 'excellent' ? 'good' : quality;
      }
    }

    connectionInfo.connectionQuality = quality;
  }

  private cleanupStaleConnections(): void {
    const now = new Date();
    const staleThreshold = 10 * 60 * 1000; // 10 minutes
    let cleanedCount = 0;

    for (const [socketId, connectionInfo] of this.connections.entries()) {
      const timeSinceActivity = now.getTime() - connectionInfo.lastActivity.getTime();
      
      if (timeSinceActivity > staleThreshold && !connectionInfo.isHealthy) {
        // Pause session if exists
        if (connectionInfo.sessionId) {
          this.gameSessionManager.pauseSession(connectionInfo.sessionId);
          this.logInfo(`Paused session ${connectionInfo.sessionId} due to stale connection`);
        }

        this.connections.delete(socketId);
        this.metrics.activeConnections--;
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logInfo(`Cleaned up ${cleanedCount} stale connections`);
    }
  }

  private updateMetrics(): void {
    const connections = Array.from(this.connections.values());
    const now = new Date();
    
    if (connections.length > 0) {
      const totalDuration = connections.reduce((sum, conn) => {
        return sum + (now.getTime() - conn.connectedAt.getTime());
      }, 0);
      
      this.metrics.averageSessionDuration = totalDuration / connections.length;
    }

    // Update uptime
    this.metrics.uptime = now.getTime() - this.metrics.startTime.getTime();

    // Calculate connection quality distribution
    const qualityDistribution = connections.reduce((acc, conn) => {
      acc[conn.connectionQuality] = (acc[conn.connectionQuality] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    this.logInfo('Server metrics updated', {
      totalConnections: this.metrics.totalConnections,
      activeConnections: this.metrics.activeConnections,
      totalReconnections: this.metrics.totalReconnections,
      averageSessionDuration: Math.round(this.metrics.averageSessionDuration / 1000),
      errorCount: this.metrics.errorCount,
      timeoutCount: this.metrics.timeoutCount,
      connectionDrops: this.metrics.connectionDrops,
      averageLatency: Math.round(this.metrics.averageLatency),
      uptime: Math.round(this.metrics.uptime / 1000),
      connectionQuality: qualityDistribution,
      sessionPersistenceCount: this.sessionPersistence.size
    });
  }

  private setupGracefulShutdown(): void {
    const gracefulShutdown = async () => {
      this.logInfo('Initiating graceful shutdown...');
      this.isShuttingDown = true;

      try {
        // Clear all intervals first
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
        if (this.cleanupInterval) clearInterval(this.cleanupInterval);
        if (this.metricsInterval) clearInterval(this.metricsInterval);

        // Clear all connection timeouts
        for (const timeout of this.connectionTimeouts.values()) {
          clearTimeout(timeout);
        }
        this.connectionTimeouts.clear();

        // Get current state for logging
        const activeConnections = this.connections.size;
        const activeSessions = this.gameSessionManager.getActiveSessions();

        // Notify all connected clients with detailed shutdown info
        this.io.emit('server-shutdown', {
          message: 'Сервер перезагружается. Ваши сессии будут сохранены.',
          estimatedDowntime: 30, // seconds
          reconnectDelay: 5, // seconds
          timestamp: new Date().toISOString(),
          sessionWillBePersisted: true
        });

        // Give clients time to receive the message
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Pause and persist all active sessions
        let persistedSessions = 0;
        for (const session of activeSessions) {
          const success = this.gameSessionManager.pauseSession(session.id);
          if (success) {
            // Ensure session persistence
            const persistenceKey = `${session.userId}:${session.id}`;
            this.sessionPersistence.set(persistenceKey, {
              sessionId: session.id,
              userId: session.userId,
              lastSeen: new Date()
            });
            persistedSessions++;
          }
        }

        // Log shutdown statistics
        this.logInfo('Graceful shutdown statistics', {
          activeConnections,
          activeSessions: activeSessions.length,
          persistedSessions,
          totalConnections: this.metrics.totalConnections,
          totalReconnections: this.metrics.totalReconnections,
          errorCount: this.metrics.errorCount,
          uptime: Math.round((Date.now() - this.metrics.startTime.getTime()) / 1000)
        });

        // Close server gracefully
        await new Promise<void>((resolve) => {
          this.io.close(() => {
            this.logInfo('WebSocket server closed gracefully');
            resolve();
          });
        });

      } catch (error) {
        this.logError('Error during graceful shutdown', error as Error);
        // Force close if graceful shutdown fails
        this.io.close();
      }
    };

    // Handle different shutdown signals
    process.on('SIGTERM', () => {
      this.logInfo('Received SIGTERM signal');
      gracefulShutdown();
    });
    
    process.on('SIGINT', () => {
      this.logInfo('Received SIGINT signal');
      gracefulShutdown();
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      this.logError('Uncaught exception, initiating emergency shutdown', error);
      gracefulShutdown();
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      this.logError('Unhandled promise rejection, initiating emergency shutdown', new Error(String(reason)), {
        promise: promise.toString()
      });
      gracefulShutdown();
    });
  }

  private handleConnection(socket: Socket): void {
    let currentUserId: string | null = null;
    let currentSessionId: string | null = null;
    const connectionInfo = this.connections.get(socket.id);

    if (!connectionInfo) {
      this.logError('Connection info not found for socket', new Error(`Socket ${socket.id} not in connections map`));
      return;
    }

    // Enhanced error handling for this socket
    socket.on('error', (error) => {
      this.handleSocketError(socket, error);
    });

    socket.on('connect_error', (error) => {
      this.handleSocketError(socket, error, 'Connection error during handshake');
    });

    socket.on('disconnect', (reason, details) => {
      this.handleDisconnection(socket, reason, currentSessionId, currentUserId, details);
    });

    // Enhanced ping/pong for connection health monitoring
    socket.on('pong', (data) => {
      const now = new Date();
      connectionInfo.lastActivity = now;
      connectionInfo.lastPong = now;
      connectionInfo.isHealthy = true;
      
      // Reset connection timeout
      this.resetConnectionTimeout(socket.id);
      
      // Calculate and log latency if ping timestamp is provided
      if (data && data.timestamp) {
        const pingTime = new Date(data.timestamp);
        const latency = now.getTime() - pingTime.getTime();
        if (latency > 0 && latency < 10000) { // Reasonable latency
          this.logInfo(`Pong received from ${socket.id}`, {
            latency,
            userId: connectionInfo.userId,
            connectionQuality: connectionInfo.connectionQuality
          });
        }
      }
    });

    socket.on('ping', (data) => {
      const now = new Date();
      connectionInfo.lastActivity = now;
      connectionInfo.lastPing = now;
      
      // Reset connection timeout
      this.resetConnectionTimeout(socket.id);
      
      socket.emit('pong', { 
        timestamp: now.toISOString(),
        serverTime: now.toISOString(),
        connectionQuality: connectionInfo.connectionQuality,
        ...(data || {})
      });
    });

    // Handle reconnection attempts
    socket.on('reconnect-session', async (data: { userId: string; sessionId?: string }) => {
      try {
        await this.handleReconnection(socket, data.userId, data.sessionId);
      } catch (error) {
        this.handleSocketError(socket, error as Error);
      }
    });

    // Join game session
    socket.on('join-game', async (data: { storyId: string; userId: string; settings?: AudioSettings }) => {
      try {
        this.updateConnectionActivity(socket.id);
        const { storyId, userId, settings } = data;
        currentUserId = userId;
        connectionInfo.userId = userId;

        this.logInfo(`User ${userId} attempting to join game`, { storyId, socketId: socket.id });

        // Get story
        const story = await this.storyService.getStoryById(storyId);
        if (!story) {
          this.sendError(socket, 'VALIDATION_ERROR', 'История не найдена');
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
        connectionInfo.sessionId = session.id;

        // Store session persistence
        const persistenceKey = `${userId}:${session.id}`;
        this.sessionPersistence.set(persistenceKey, {
          sessionId: session.id,
          userId,
          lastSeen: new Date()
        });

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

        this.logInfo(`User ${userId} joined game session ${session.id}`, { 
          storyId, 
          socketId: socket.id,
          sessionId: session.id
        });
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error joining game');
        this.sendError(socket, 'VALIDATION_ERROR', 'Не удалось присоединиться к игре');
      }
    });

    // Handle text message from user
    socket.on('send-message', async (messageContent: string) => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId || !currentUserId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        if (!messageContent || typeof messageContent !== 'string' || messageContent.trim().length === 0) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Сообщение не может быть пустым');
          return;
        }

        const session = this.gameSessionManager.getSession(currentSessionId);
        if (!session || session.status !== 'active') {
          this.sendError(socket, 'VALIDATION_ERROR', 'Сессия неактивна');
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
          
          // Add AI message with TTS synthesis
          const aiMessage = await this.gameSessionManager.addAIMessageWithTTS(
            currentSessionId, 
            aiResponse, 
            { processingTime }
          );

          if (!aiMessage) {
            throw new Error('Failed to create AI message');
          }

          // Send AI response
          const gameResponse: GameResponse = {
            message: aiMessage,
            audioUrl: aiMessage.audioUrl
          };
          socket.emit('game-response', gameResponse);

          this.logInfo(`AI response generated for session ${currentSessionId}`, {
            processingTime,
            userId: currentUserId,
            messageLength: aiResponse.length
          });
        } catch (llmError: any) {
          this.handleSocketError(socket, llmError, 'LLM error during message processing');
          
          // Create a fallback message with TTS
          const fallbackMessage = await this.gameSessionManager.addAIMessageWithTTS(
            currentSessionId,
            'Извините, у меня возникли проблемы с генерацией ответа. Пожалуйста, попробуйте еще раз или выберите другую историю.',
            { error: true }
          );
          
          if (fallbackMessage) {
            // Send fallback response
            const fallbackResponse: GameResponse = {
              message: fallbackMessage,
              audioUrl: fallbackMessage.audioUrl
            };
            socket.emit('game-response', fallbackResponse);
          }
          
          // Also send error event with details
          this.sendError(socket, 'LLM_ERROR', 'Ошибка генерации ответа ИИ', llmError.message);
        }
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error processing message');
        this.sendError(socket, 'LLM_ERROR', 'Не удалось обработать сообщение');
      }
    });

    // Handle voice input (placeholder for future implementation)
    socket.on('voice-input', async (_audioData: Buffer) => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        // Placeholder for ASR processing
        socket.emit('voice-processing', { status: 'processing' });
        
        // For now, just acknowledge receipt
        socket.emit('voice-processed', { 
          status: 'completed',
          message: 'Голосовой ввод получен, но ASR еще не реализован'
        });

        this.logInfo(`Voice input received for session ${currentSessionId}`, {
          userId: currentUserId,
          socketId: socket.id
        });
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error processing voice input');
        this.sendError(socket, 'ASR_ERROR', 'Не удалось обработать голосовой ввод');
      }
    });

    // Update session settings
    socket.on('update-settings', (settings: Partial<AudioSettings>) => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        if (!settings || typeof settings !== 'object') {
          this.sendError(socket, 'VALIDATION_ERROR', 'Неверные настройки');
          return;
        }

        const success = this.gameSessionManager.updateSessionSettings(currentSessionId, settings);
        if (success) {
          socket.emit('settings-updated', settings);
          this.logInfo(`Settings updated for session ${currentSessionId}`, {
            userId: currentUserId,
            settings
          });
        } else {
          this.sendError(socket, 'VALIDATION_ERROR', 'Не удалось обновить настройки');
        }
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error updating settings');
        this.sendError(socket, 'VALIDATION_ERROR', 'Ошибка при обновлении настроек');
      }
    });

    // Pause session
    socket.on('pause-session', () => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        const success = this.gameSessionManager.pauseSession(currentSessionId);
        if (success) {
          socket.emit('session-paused');
          this.logInfo(`Session paused: ${currentSessionId}`, {
            userId: currentUserId,
            socketId: socket.id
          });
        } else {
          this.sendError(socket, 'VALIDATION_ERROR', 'Не удалось приостановить сессию');
        }
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error pausing session');
        this.sendError(socket, 'VALIDATION_ERROR', 'Ошибка при приостановке сессии');
      }
    });

    // Resume session
    socket.on('resume-session', () => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        const success = this.gameSessionManager.resumeSession(currentSessionId);
        if (success) {
          socket.emit('session-resumed');
          this.logInfo(`Session resumed: ${currentSessionId}`, {
            userId: currentUserId,
            socketId: socket.id
          });
        } else {
          this.sendError(socket, 'VALIDATION_ERROR', 'Не удалось возобновить сессию');
        }
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error resuming session');
        this.sendError(socket, 'VALIDATION_ERROR', 'Ошибка при возобновлении сессии');
      }
    });

    // Get session history
    socket.on('get-history', () => {
      try {
        this.updateConnectionActivity(socket.id);

        if (!currentSessionId) {
          this.sendError(socket, 'VALIDATION_ERROR', 'Нет активной сессии');
          return;
        }

        const session = this.gameSessionManager.getSession(currentSessionId);
        if (session) {
          socket.emit('session-history', {
            messages: session.messages,
            context: session.context
          });
          this.logInfo(`Session history sent for ${currentSessionId}`, {
            userId: currentUserId,
            messageCount: session.messages.length
          });
        } else {
          this.sendError(socket, 'VALIDATION_ERROR', 'Сессия не найдена');
        }
      } catch (error) {
        this.handleSocketError(socket, error as Error, 'Error getting session history');
        this.sendError(socket, 'VALIDATION_ERROR', 'Ошибка при получении истории сессии');
      }
    });

    // Handle disconnect - removed since it's already handled above in error setup
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

  private async handleReconnection(socket: Socket, userId: string, sessionId?: string): Promise<void> {
    const connectionInfo = this.connections.get(socket.id);
    if (!connectionInfo) return;

    connectionInfo.userId = userId;
    connectionInfo.reconnectCount++;
    this.metrics.totalReconnections++;

    this.logInfo(`User ${userId} attempting to reconnect`, {
      socketId: socket.id,
      sessionId,
      reconnectCount: connectionInfo.reconnectCount
    });

    // Check session persistence first
    const persistenceKey = `${userId}:${sessionId || 'latest'}`;
    const persistedSession = this.sessionPersistence.get(persistenceKey);

    // Try to find existing session
    let session = sessionId ? this.gameSessionManager.getSession(sessionId) : null;
    
    // If no specific session provided, try to find user's session
    if (!session) {
      session = this.gameSessionManager.getUserSession(userId);
    }

    // If still no session but we have persistence data, try to restore
    if (!session && persistedSession) {
      session = this.gameSessionManager.getSession(persistedSession.sessionId);
      if (session) {
        this.logInfo(`Session restored from persistence for user ${userId}`, {
          sessionId: session.id,
          lastSeen: persistedSession.lastSeen
        });
      }
    }

    if (session && (session.status === 'paused' || session.status === 'active')) {
      // Resume the session
      this.gameSessionManager.resumeSession(session.id);
      connectionInfo.sessionId = session.id;

      // Update session persistence
      this.sessionPersistence.set(persistenceKey, {
        sessionId: session.id,
        userId,
        lastSeen: new Date()
      });

      // Join socket room for this session
      socket.join(session.id);

      // Send comprehensive session restoration data
      socket.emit('session-restored', {
        sessionId: session.id,
        story: session.context.story,
        settings: session.settings,
        messages: session.messages.slice(-10), // Send last 10 messages
        context: {
          characterState: session.context.characterState,
          gameState: session.context.gameState
        },
        reconnected: true,
        reconnectCount: connectionInfo.reconnectCount,
        lastActivity: session.updatedAt,
        connectionQuality: connectionInfo.connectionQuality
      });

      // Send connection status update
      socket.emit('connection-status', {
        status: 'restored',
        quality: connectionInfo.connectionQuality,
        reconnectCount: connectionInfo.reconnectCount,
        sessionRestored: true,
        timestamp: new Date().toISOString()
      });

      this.logInfo(`Session ${session.id} restored for user ${userId}`, {
        socketId: socket.id,
        messageCount: session.messages.length,
        reconnectCount: connectionInfo.reconnectCount,
        connectionQuality: connectionInfo.connectionQuality
      });
    } else {
      // No valid session found - clean up persistence
      if (persistedSession) {
        this.sessionPersistence.delete(persistenceKey);
      }

      socket.emit('session-not-found', {
        message: 'Предыдущая сессия не найдена. Пожалуйста, начните новую игру.',
        userId,
        reconnectCount: connectionInfo.reconnectCount,
        suggestedAction: 'start-new-game'
      });

      this.logWarn(`No valid session found for user ${userId}`, {
        socketId: socket.id,
        requestedSessionId: sessionId,
        hadPersistence: !!persistedSession,
        reconnectCount: connectionInfo.reconnectCount
      });
    }
  }

  private handleDisconnection(socket: Socket, reason: string, sessionId: string | null, userId: string | null, details?: any): void {
    const connectionInfo = this.connections.get(socket.id);
    const connectionDuration = connectionInfo ? Date.now() - connectionInfo.connectedAt.getTime() : 0;
    
    // Classify disconnect reason
    const disconnectType = this.classifyDisconnectReason(reason);
    
    this.logInfo(`Client disconnected: ${socket.id}`, {
      reason,
      disconnectType,
      userId,
      sessionId,
      connectionDuration: Math.round(connectionDuration / 1000),
      errorCount: connectionInfo?.errorCount || 0,
      reconnectCount: connectionInfo?.reconnectCount || 0,
      connectionQuality: connectionInfo?.connectionQuality || 'unknown',
      details
    });

    // Update metrics based on disconnect type
    if (disconnectType === 'unexpected') {
      this.metrics.connectionDrops++;
    }

    if (sessionId && userId) {
      // Pause session instead of ending it, so user can reconnect
      const success = this.gameSessionManager.pauseSession(sessionId);
      if (success) {
        // Store session persistence data for potential reconnection
        const persistenceKey = `${userId}:${sessionId}`;
        this.sessionPersistence.set(persistenceKey, {
          sessionId,
          userId,
          lastSeen: new Date()
        });

        this.logInfo(`Session ${sessionId} paused and persisted due to disconnect`, { 
          userId, 
          reason, 
          disconnectType,
          connectionDuration: Math.round(connectionDuration / 1000)
        });
      }
    }

    // Clean up connection-specific resources
    const timeout = this.connectionTimeouts.get(socket.id);
    if (timeout) {
      clearTimeout(timeout);
      this.connectionTimeouts.delete(socket.id);
    }

    // Clean up connection info
    this.connections.delete(socket.id);
    this.metrics.activeConnections--;
  }

  private classifyDisconnectReason(reason: string): 'expected' | 'unexpected' | 'error' {
    const lowerReason = reason.toLowerCase();
    
    if (lowerReason.includes('client namespace disconnect') || 
        lowerReason.includes('server namespace disconnect') ||
        lowerReason.includes('transport close')) {
      return 'expected';
    } else if (lowerReason.includes('ping timeout') || 
               lowerReason.includes('transport error') ||
               lowerReason.includes('connection error')) {
      return 'error';
    }
    
    return 'unexpected';
  }



  private updateConnectionActivity(socketId: string): void {
    const connectionInfo = this.connections.get(socketId);
    if (connectionInfo) {
      connectionInfo.lastActivity = new Date();
      connectionInfo.isHealthy = true;
      // Reset connection timeout on activity
      this.resetConnectionTimeout(socketId);
    }
  }

  private handleSocketError(socket: Socket, error: Error, context?: string): void {
    const connectionInfo = this.connections.get(socket.id);
    if (connectionInfo) {
      connectionInfo.errorCount++;
      connectionInfo.lastError = new Date();
      connectionInfo.connectionQuality = connectionInfo.errorCount > 3 ? 'critical' : 'poor';
    }

    this.metrics.errorCount++;

    // Classify error types for better handling
    const errorType = this.classifyError(error);
    
    this.logError(context || 'Socket error', error, {
      socketId: socket.id,
      userId: connectionInfo?.userId,
      sessionId: connectionInfo?.sessionId,
      errorType,
      errorCount: connectionInfo?.errorCount || 0,
      connectionQuality: connectionInfo?.connectionQuality || 'unknown'
    });

    // Handle specific error types
    switch (errorType) {
      case 'TIMEOUT':
        this.handleTimeoutError(socket, error);
        break;
      case 'CONNECTION_LOST':
        this.handleConnectionLostError(socket, error);
        break;
      case 'PARSE_ERROR':
        this.handleParseError(socket, error);
        break;
      case 'RATE_LIMIT':
        this.handleRateLimitError(socket, error);
        break;
      default:
        this.handleGenericError(socket, error);
    }
  }

  private classifyError(error: Error): string {
    const message = error.message.toLowerCase();
    
    if (message.includes('timeout') || message.includes('timed out')) {
      return 'TIMEOUT';
    } else if (message.includes('connection') && (message.includes('lost') || message.includes('closed') || message.includes('reset'))) {
      return 'CONNECTION_LOST';
    } else if (message.includes('parse') || message.includes('json') || message.includes('syntax')) {
      return 'PARSE_ERROR';
    } else if (message.includes('rate limit') || message.includes('too many requests')) {
      return 'RATE_LIMIT';
    } else if (message.includes('auth') || message.includes('unauthorized')) {
      return 'AUTH_ERROR';
    }
    
    return 'GENERIC_ERROR';
  }

  private handleTimeoutError(socket: Socket, error: Error): void {
    const connectionInfo = this.connections.get(socket.id);
    if (connectionInfo) {
      connectionInfo.timeoutCount++;
    }
    
    socket.emit('error-recovery', {
      type: 'TIMEOUT',
      message: 'Превышено время ожидания. Проверьте подключение к интернету.',
      recoveryAction: 'reconnect',
      timestamp: new Date().toISOString()
    });
  }

  private handleConnectionLostError(socket: Socket, error: Error): void {
    socket.emit('error-recovery', {
      type: 'CONNECTION_LOST',
      message: 'Соединение потеряно. Попытка переподключения...',
      recoveryAction: 'auto-reconnect',
      timestamp: new Date().toISOString()
    });
    
    // Trigger graceful disconnect to allow reconnection
    setTimeout(() => {
      if (socket.connected) {
        socket.disconnect(true);
      }
    }, 1000);
  }

  private handleParseError(socket: Socket, error: Error): void {
    socket.emit('error-recovery', {
      type: 'PARSE_ERROR',
      message: 'Ошибка обработки данных. Попробуйте еще раз.',
      recoveryAction: 'retry',
      timestamp: new Date().toISOString()
    });
  }

  private handleRateLimitError(socket: Socket, error: Error): void {
    socket.emit('error-recovery', {
      type: 'RATE_LIMIT',
      message: 'Слишком много запросов. Подождите немного.',
      recoveryAction: 'wait',
      retryAfter: 30000, // 30 seconds
      timestamp: new Date().toISOString()
    });
  }

  private handleGenericError(socket: Socket, error: Error): void {
    socket.emit('error-recovery', {
      type: 'GENERIC_ERROR',
      message: 'Произошла ошибка. Попробуйте обновить страницу.',
      recoveryAction: 'refresh',
      timestamp: new Date().toISOString()
    });
  }

  private logInfo(message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'WebSocketServer',
      message,
      context
    };
    console.log(JSON.stringify(logEntry));
  }

  private logWarn(message: string, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'warn',
      service: 'WebSocketServer',
      message,
      context
    };
    console.warn(JSON.stringify(logEntry));
  }

  private logError(message: string, error: Error, context?: any): void {
    const logEntry = {
      timestamp: new Date().toISOString(),
      level: 'error',
      service: 'WebSocketServer',
      message,
      error: error.message,
      stack: error.stack,
      context
    };
    console.error(JSON.stringify(logEntry));
  }

  public getServerMetrics(): ServerMetrics {
    return { ...this.metrics };
  }

  public getActiveConnections(): ConnectionInfo[] {
    return Array.from(this.connections.values());
  }

  public async shutdown(): Promise<void> {
    this.logInfo('WebSocket server shutdown requested');
    this.isShuttingDown = true;

    try {
      // Clear all intervals
      if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
      if (this.cleanupInterval) clearInterval(this.cleanupInterval);
      if (this.metricsInterval) clearInterval(this.metricsInterval);

      // Clear all connection timeouts
      for (const timeout of this.connectionTimeouts.values()) {
        clearTimeout(timeout);
      }
      this.connectionTimeouts.clear();

      // Get current state for logging
      const activeConnections = this.connections.size;
      const activeSessions = this.gameSessionManager.getActiveSessions();

      // Notify all connected clients
      this.io.emit('server-shutdown', {
        message: 'Сервер перезагружается. Ваши сессии будут сохранены.',
        estimatedDowntime: 30,
        reconnectDelay: 5,
        timestamp: new Date().toISOString(),
        sessionWillBePersisted: true
      });

      // Give clients time to receive the message
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Pause and persist all active sessions
      let persistedSessions = 0;
      for (const session of activeSessions) {
        const success = this.gameSessionManager.pauseSession(session.id);
        if (success) {
          const persistenceKey = `${session.userId}:${session.id}`;
          this.sessionPersistence.set(persistenceKey, {
            sessionId: session.id,
            userId: session.userId,
            lastSeen: new Date()
          });
          persistedSessions++;
        }
      }

      this.logInfo(`Shutdown completed - paused ${persistedSessions} sessions from ${activeConnections} connections`);

      // Close server
      return new Promise((resolve) => {
        this.io.close(() => {
          this.logInfo('WebSocket server closed gracefully');
          resolve();
        });
      });

    } catch (error) {
      this.logError('Error during shutdown', error as Error);
      // Force close if graceful shutdown fails
      this.io.close();
      throw error;
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
    
    // Log the error for monitoring
    this.logWarn(`Error sent to client ${socket.id}`, {
      errorType: type,
      message,
      details
    });
  }
}