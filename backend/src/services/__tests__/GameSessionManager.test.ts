import { describe, it, expect, beforeEach } from 'vitest';
import { GameSessionManager } from '../GameSessionManager';
import { Story, AudioSettings, Message } from '../../types';
import { v4 as uuidv4 } from 'uuid';

describe('GameSessionManager', () => {
  let sessionManager: GameSessionManager;
  let mockStory: Story;
  let mockSettings: AudioSettings;

  beforeEach(() => {
    sessionManager = new GameSessionManager();
    
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
});