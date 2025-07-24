import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GameSessionManager } from '../GameSessionManager';
import { Story, AudioSettings, Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('GameSessionManager', () => {
  let sessionManager: GameSessionManager;
  let mockStory: Story;
  let mockSettings: AudioSettings;
  let testPersistencePath: string;

  beforeEach(() => {
    // Use a test-specific persistence path
    testPersistencePath = path.join(process.cwd(), 'temp', 'test-sessions.json');
    sessionManager = new GameSessionManager(undefined, testPersistencePath);
    
    mockStory = {
      id: 'story-1',
      title: 'Test Adventure',
      description: 'A test story',
      genre: 'fantasy',
      initialPrompt: 'Welcome to the adventure!',
      characterContext: 'You are a brave adventurer',
      gameRules: ['Be creative', 'Have fun'],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    mockSettings = {
      ttsEnabled: true,
      ttsVolume: 0.8,
      asrSensitivity: 0.7,
      voiceSpeed: 1.0
    };
  });

  afterEach(async () => {
    // Cleanup test files
    try {
      await fs.unlink(testPersistencePath);
    } catch (error) {
      // File might not exist, ignore
    }
    
    // Shutdown session manager to clean up intervals
    await sessionManager.shutdown();
  });

  describe('createSession', () => {
    it('should create a new session with correct properties', () => {
      const userId = 'user-1';
      const session = sessionManager.createSession(userId, mockStory, mockSettings);

      expect(session.id).toBeDefined();
      expect(session.storyId).toBe(mockStory.id);
      expect(session.userId).toBe(userId);
      expect(session.status).toBe('active');
      expect(session.messages).toHaveLength(1); // Initial AI message
      expect(session.messages[0].type).toBe('ai');
      expect(session.messages[0].content).toBe(mockStory.initialPrompt);
      expect(session.context.story).toEqual(mockStory);
      expect(session.settings).toEqual(mockSettings);
    });

    it('should end existing session when creating new one for same user', () => {
      const userId = 'user-1';
      
      // Create first session
      const session1 = sessionManager.createSession(userId, mockStory, mockSettings);
      expect(sessionManager.getSession(session1.id)).toBeDefined();
      
      // Create second session for same user
      const session2 = sessionManager.createSession(userId, mockStory, mockSettings);
      
      // First session should be ended
      expect(sessionManager.getSession(session1.id)).toBeUndefined();
      expect(sessionManager.getSession(session2.id)).toBeDefined();
    });
  });

  describe('getSession', () => {
    it('should return session by ID', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      const retrieved = sessionManager.getSession(session.id);
      
      expect(retrieved).toEqual(session);
    });

    it('should return undefined for non-existent session', () => {
      const retrieved = sessionManager.getSession('non-existent');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('getUserSession', () => {
    it('should return active session for user', () => {
      const userId = 'user-1';
      const session = sessionManager.createSession(userId, mockStory, mockSettings);
      const retrieved = sessionManager.getUserSession(userId);
      
      expect(retrieved).toEqual(session);
    });

    it('should return undefined for user with no session', () => {
      const retrieved = sessionManager.getUserSession('no-session-user');
      expect(retrieved).toBeUndefined();
    });
  });

  describe('addMessage', () => {
    it('should add message to session', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      const message: Message = {
        id: uuidv4(),
        sessionId: session.id,
        type: 'user',
        content: 'Hello!',
        metadata: {},
        timestamp: new Date()
      };

      const success = sessionManager.addMessage(session.id, message);
      expect(success).toBe(true);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.messages).toHaveLength(2); // Initial + new message
      expect(updatedSession?.messages[1]).toEqual(message);
      expect(updatedSession?.context.conversationHistory).toContain('Player: Hello!');
    });

    it('should return false for non-existent session', () => {
      const message: Message = {
        id: uuidv4(),
        sessionId: 'non-existent',
        type: 'user',
        content: 'Hello!',
        metadata: {},
        timestamp: new Date()
      };

      const success = sessionManager.addMessage('non-existent', message);
      expect(success).toBe(false);
    });

    it('should limit conversation history to 20 messages', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      
      // Add 25 messages
      for (let i = 0; i < 25; i++) {
        const message: Message = {
          id: uuidv4(),
          sessionId: session.id,
          type: 'user',
          content: `Message ${i}`,
          metadata: {},
          timestamp: new Date()
        };
        sessionManager.addMessage(session.id, message);
      }

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.context.conversationHistory).toHaveLength(20);
    });
  });

  describe('updateSessionSettings', () => {
    it('should update session settings', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      const newSettings = { ttsVolume: 0.5, voiceSpeed: 1.2 };

      const success = sessionManager.updateSessionSettings(session.id, newSettings);
      expect(success).toBe(true);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.settings.ttsVolume).toBe(0.5);
      expect(updatedSession?.settings.voiceSpeed).toBe(1.2);
      expect(updatedSession?.settings.ttsEnabled).toBe(true); // Should preserve other settings
    });
  });

  describe('session status management', () => {
    it('should pause session', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      
      const success = sessionManager.pauseSession(session.id);
      expect(success).toBe(true);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.status).toBe('paused');
    });

    it('should resume session', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      sessionManager.pauseSession(session.id);
      
      const success = sessionManager.resumeSession(session.id);
      expect(success).toBe(true);

      const updatedSession = sessionManager.getSession(session.id);
      expect(updatedSession?.status).toBe('active');
    });

    it('should end session', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      
      const success = sessionManager.endSession(session.id);
      expect(success).toBe(true);

      const retrievedSession = sessionManager.getSession(session.id);
      expect(retrievedSession).toBeUndefined();
    });
  });

  describe('getActiveSessions', () => {
    it('should return only active sessions', () => {
      const session1 = sessionManager.createSession('user-1', mockStory, mockSettings);
      const session2 = sessionManager.createSession('user-2', mockStory, mockSettings);
      
      sessionManager.pauseSession(session2.id);
      
      const activeSessions = sessionManager.getActiveSessions();
      expect(activeSessions).toHaveLength(1);
      expect(activeSessions[0].id).toBe(session1.id);
    });
  });

  describe('cleanupOldSessions', () => {
    it('should clean up old sessions', () => {
      const session = sessionManager.createSession('user-1', mockStory, mockSettings);
      
      // Manually set old timestamp
      const oldSession = sessionManager.getSession(session.id);
      if (oldSession) {
        oldSession.updatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25 hours ago
      }
      
      const cleanedCount = sessionManager.cleanupOldSessions(24);
      expect(cleanedCount).toBe(1);
      expect(sessionManager.getSession(session.id)).toBeUndefined();
    });
  });

  describe('enhanced session management', () => {
    describe('getSessionMetrics', () => {
      it('should return accurate session metrics', () => {
        // Create multiple sessions
        sessionManager.createSession('user-1', mockStory, mockSettings);
        sessionManager.createSession('user-2', mockStory, mockSettings);
        
        const metrics = sessionManager.getSessionMetrics();
        
        expect(metrics.activeSessions).toBe(2);
        expect(metrics.totalSessions).toBe(2);
        expect(metrics.memoryUsage).toBeGreaterThan(0);
        expect(metrics.messageCount).toBe(2); // Each session has 1 initial message
        expect(metrics.lastCleanup).toBeInstanceOf(Date);
      });
    });

    describe('getSessionsHealth', () => {
      it('should return health status for all sessions', () => {
        const session = sessionManager.createSession('user-1', mockStory, mockSettings);
        
        const health = sessionManager.getSessionsHealth();
        
        expect(health).toHaveLength(1);
        expect(health[0].sessionId).toBe(session.id);
        expect(health[0].memoryUsage).toBeGreaterThan(0);
        expect(health[0].messageCount).toBe(1);
        expect(health[0].isHealthy).toBe(true);
        expect(health[0].lastActivity).toBeInstanceOf(Date);
      });
    });

    describe('optimizeMemoryUsage', () => {
      it('should optimize memory usage by trimming data', () => {
        const session = sessionManager.createSession('user-1', mockStory, mockSettings);
        
        // Add many messages to trigger optimization
        for (let i = 0; i < 150; i++) {
          const message: Message = {
            id: uuidv4(),
            sessionId: session.id,
            type: 'user',
            content: `Message ${i}`,
            metadata: { 
              processingTime: 100,
              confidence: 0.9,
              tokens: 10,
              extraData: 'some extra data',
              moreData: 'more data'
            },
            timestamp: new Date()
          };
          sessionManager.addMessage(session.id, message);
        }
        
        // Add many conversation history entries
        const updatedSession = sessionManager.getSession(session.id);
        if (updatedSession) {
          for (let i = 0; i < 50; i++) {
            updatedSession.context.conversationHistory.push(`Extra history ${i}`);
          }
        }
        
        sessionManager.optimizeMemoryUsage();
        
        const optimizedSession = sessionManager.getSession(session.id);
        expect(optimizedSession?.messages.length).toBeLessThanOrEqual(100);
        expect(optimizedSession?.context.conversationHistory.length).toBeLessThanOrEqual(20);
        
        // Check that metadata was cleaned up (should have at most 3 essential keys)
        const lastMessage = optimizedSession?.messages[optimizedSession.messages.length - 1];
        if (lastMessage?.metadata) {
          const metadataKeys = Object.keys(lastMessage.metadata);
          expect(metadataKeys.length).toBeLessThanOrEqual(3);
          // Should only contain essential metadata
          const allowedKeys = ['processingTime', 'error', 'ttsError'];
          for (const key of metadataKeys) {
            expect(allowedKeys).toContain(key);
          }
        }
      });
    });

    describe('session persistence', () => {
      it('should persist and load sessions', async () => {
        // Create sessions
        const session1 = sessionManager.createSession('user-1', mockStory, mockSettings);
        const session2 = sessionManager.createSession('user-2', mockStory, mockSettings);
        
        // Add some messages
        const message: Message = {
          id: uuidv4(),
          sessionId: session1.id,
          type: 'user',
          content: 'Test message',
          metadata: {},
          timestamp: new Date()
        };
        sessionManager.addMessage(session1.id, message);
        
        // Persist sessions
        await sessionManager.persistSessions();
        
        // Create new session manager and load
        const newSessionManager = new GameSessionManager(undefined, testPersistencePath);
        await newSessionManager.loadPersistedSessions();
        
        // Verify sessions were loaded
        const loadedSession1 = newSessionManager.getSession(session1.id);
        const loadedSession2 = newSessionManager.getSession(session2.id);
        
        expect(loadedSession1).toBeDefined();
        expect(loadedSession2).toBeDefined();
        expect(loadedSession1?.messages).toHaveLength(2); // Initial + added message
        expect(loadedSession1?.userId).toBe('user-1');
        expect(loadedSession2?.userId).toBe('user-2');
        
        // Cleanup
        await newSessionManager.shutdown();
      });

      it('should handle missing persistence file gracefully', async () => {
        const nonExistentPath = path.join(process.cwd(), 'temp', 'non-existent.json');
        const newSessionManager = new GameSessionManager(undefined, nonExistentPath);
        
        // Should not throw error
        await expect(newSessionManager.loadPersistedSessions()).resolves.toBeUndefined();
        
        await newSessionManager.shutdown();
      });
    });

    describe('automatic cleanup', () => {
      it('should handle memory-heavy sessions', () => {
        const session = sessionManager.createSession('user-1', mockStory, mockSettings);
        
        // Create a large session by adding many messages
        for (let i = 0; i < 200; i++) {
          const message: Message = {
            id: uuidv4(),
            sessionId: session.id,
            type: 'user',
            content: `Very long message content that takes up memory: ${'x'.repeat(1000)}`,
            metadata: { largeData: 'x'.repeat(1000) },
            timestamp: new Date()
          };
          sessionManager.addMessage(session.id, message);
        }
        
        // Trigger memory cleanup (this is normally done automatically)
        const initialMessageCount = sessionManager.getSession(session.id)?.messages.length || 0;
        
        // The cleanup should have been triggered during message addition
        // Since we added 200 messages, it should be trimmed to 100
        expect(initialMessageCount).toBeLessThanOrEqual(100);
      });
    });

    describe('shutdown', () => {
      it('should shutdown gracefully', async () => {
        // Create a session
        sessionManager.createSession('user-1', mockStory, mockSettings);
        
        // Shutdown should persist sessions and clean up
        await expect(sessionManager.shutdown()).resolves.toBeUndefined();
        
        // Verify persistence file was created
        const fileExists = await fs.access(testPersistencePath).then(() => true).catch(() => false);
        expect(fileExists).toBe(true);
      });
    });
  });
});