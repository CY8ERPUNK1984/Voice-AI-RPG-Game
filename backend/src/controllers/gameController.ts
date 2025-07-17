import { Server } from 'socket.io';
import { WebSocketServer } from '../services/WebSocketServer';
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
}