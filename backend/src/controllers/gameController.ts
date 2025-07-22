import { Server } from 'socket.io';
import { WebSocketServer, ServerMetrics, ConnectionInfo } from '../services/WebSocketServer';
import { GameSessionManager } from '../services/GameSessionManager';
import { StoryService } from '../services/StoryService';

/**
 * Game controller that initializes and manages the WebSocket server
 * for real-time game interactions
 */
export class GameController {
  private webSocketServer: WebSocketServer;
  private gameSessionManager: GameSessionManager;
  private storyService: StoryService;
  
  /**
   * Initialize the game controller with Socket.IO server
   * @param io Socket.IO server instance
   */
  constructor(io: Server) {
    this.gameSessionManager = new GameSessionManager();
    this.storyService = new StoryService();
    this.webSocketServer = new WebSocketServer(io);
    
    console.log('Game controller initialized with WebSocket server');
  }
  
  /**
   * Get the WebSocket server instance
   * @returns WebSocketServer instance
   */
  getWebSocketServer() {
    return this.webSocketServer;
  }
  
  /**
   * Get all available stories
   * @returns Array of stories
   */
  async getStories() {
    return this.storyService.getAllStories();
  }
  
  /**
   * Get a story by ID
   * @param id Story ID
   * @returns Story or undefined if not found
   */
  async getStoryById(id: string) {
    return this.storyService.getStoryById(id);
  }
  
  /**
   * Get all active game sessions (for monitoring/debugging)
   * @returns Array of active game sessions
   */
  getActiveSessions() {
    return this.gameSessionManager.getActiveSessions();
  }
  
  /**
   * Clean up old sessions
   * @param maxAgeHours Maximum age of sessions in hours
   * @returns Number of cleaned sessions
   */
  cleanupOldSessions(maxAgeHours: number = 24) {
    return this.gameSessionManager.cleanupOldSessions(maxAgeHours);
  }

  /**
   * Get audio file path for serving
   * @param filename Audio filename
   * @returns Full path to audio file
   */
  getAudioFilePath(filename: string): string {
    // This method should delegate to the TTS service
    // For now, we'll construct the path directly
    const path = require('path');
    return path.join(process.cwd(), 'temp', 'audio', filename);
  }

  /**
   * Get WebSocket server metrics for monitoring
   * @returns Server metrics
   */
  getServerMetrics(): ServerMetrics {
    return this.webSocketServer.getServerMetrics();
  }

  /**
   * Get active WebSocket connections
   * @returns Array of active connections
   */
  getActiveConnections(): ConnectionInfo[] {
    return this.webSocketServer.getActiveConnections();
  }

  /**
   * Shutdown the WebSocket server gracefully
   * @returns Promise that resolves when shutdown is complete
   */
  async shutdownServer(): Promise<void> {
    return this.webSocketServer.shutdown();
  }
}