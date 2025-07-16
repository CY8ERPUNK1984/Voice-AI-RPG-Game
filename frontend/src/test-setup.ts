// Simple test to verify TypeScript compilation and imports work
import { Story, Message, GameSession, AudioSettings } from './types';

// Test that interfaces are properly defined
const testStory: Story = {
  id: 'test-1',
  title: 'Test Story',
  description: 'A test story',
  genre: 'fantasy',
  initialPrompt: 'Welcome to the test',
  characterContext: 'You are a test character',
  gameRules: ['Rule 1', 'Rule 2'],
  createdAt: new Date(),
  updatedAt: new Date(),
};

const testMessage: Message = {
  id: 'msg-1',
  sessionId: 'session-1',
  type: 'user',
  content: 'Hello world',
  metadata: {},
  timestamp: new Date(),
};

const testSettings: AudioSettings = {
  ttsEnabled: true,
  ttsVolume: 0.8,
  asrSensitivity: 0.5,
  voiceSpeed: 1.0,
};

const testSession: GameSession = {
  id: 'session-1',
  storyId: 'test-1',
  userId: 'user-1',
  status: 'active',
  messages: [testMessage],
  context: {
    story: testStory,
    characterState: {},
    gameState: {},
    conversationHistory: [],
  },
  settings: testSettings,
  createdAt: new Date(),
  updatedAt: new Date(),
};

console.log('✅ Frontend TypeScript setup verified');
console.log('✅ All interfaces compile correctly');
console.log(`✅ Test story: ${testStory.title}`);
console.log(`✅ Test session: ${testSession.id}`);

export { testStory, testMessage, testSession, testSettings };