// Backend types for Voice AI RPG Game

export interface Story {
  id: string;
  title: string;
  description: string;
  genre: 'fantasy' | 'sci-fi' | 'mystery' | 'adventure' | 'horror';
  initialPrompt: string;
  characterContext: string;
  gameRules: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface Message {
  id: string;
  sessionId: string;
  type: 'user' | 'ai';
  content: string;
  audioUrl?: string;
  metadata: {
    processingTime?: number;
    confidence?: number;
    tokens?: number;
  };
  timestamp: Date;
}

export interface GameSession {
  id: string;
  storyId: string;
  userId: string;
  status: 'active' | 'paused' | 'completed';
  messages: Message[];
  context: GameContext;
  settings: AudioSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface GameContext {
  story: Story;
  characterState: Record<string, any>;
  gameState: Record<string, any>;
  conversationHistory: string[];
}

export interface AudioSettings {
  ttsEnabled: boolean;
  ttsVolume: number;
  asrSensitivity: number;
  voiceSpeed: number;
}

// Service Interfaces
export interface ASRService {
  transcribeAudio(audioBlob: Buffer): Promise<string>;
  isAvailable(): boolean;
}

export interface LLMService {
  generateResponse(prompt: string, context: GameContext): Promise<string>;
}

export interface TTSService {
  synthesizeSpeech(text: string, options: TTSOptions): Promise<string>;
}

export interface TTSOptions {
  voice: string;
  speed: number;
  pitch: number;
}

// Error handling
export interface ErrorResponse {
  type: 'ASR_ERROR' | 'LLM_ERROR' | 'TTS_ERROR' | 'VALIDATION_ERROR';
  message: string;
  details?: any;
  timestamp: Date;
}

// WebSocket Events
export interface SocketEvents {
  'join-game': (storyId: string) => void;
  'send-message': (message: string) => void;
  'voice-input': (audioBlob: Buffer) => void;
  'game-response': (response: GameResponse) => void;
  'error': (error: ErrorResponse) => void;
}

export interface GameResponse {
  message: Message;
  audioUrl?: string;
}