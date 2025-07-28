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
    error?: boolean;
    ttsError?: boolean;
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
  isAvailable(): boolean;
}

export interface TTSOptions {
  voice: string;
  speed: number;
  pitch: number;
}

// Error handling
export interface ErrorResponse {
  type: 'ASR_ERROR' | 'LLM_ERROR' | 'TTS_ERROR' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT_ERROR' | 'AUTHENTICATION_ERROR' | 'SYSTEM_ERROR';
  message: string;
  details?: any;
  timestamp: Date;
}

export interface AppError {
  id: string;
  type: 'ASR_ERROR' | 'LLM_ERROR' | 'TTS_ERROR' | 'CONNECTION_ERROR' | 'VALIDATION_ERROR' | 'RATE_LIMIT_ERROR' | 'AUTHENTICATION_ERROR' | 'SYSTEM_ERROR';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  originalError?: Error;
  context: Record<string, any>;
  timestamp: Date;
  recoverable: boolean;
  retryable: boolean;
  userId?: string;
  sessionId?: string;
  requestId?: string;
}

export interface RecoveryStep {
  action: string;
  description: string;
  autoExecute: boolean;
  priority: number;
}

export interface RecoveryPlan {
  steps: RecoveryStep[];
  autoExecute: boolean;
  userAction?: string;
  estimatedTime?: number;
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

// Logging interfaces
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: LogLevel;
  service: string;
  component: string;
  message: string;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
  context: Record<string, any>;
  userId?: string;
  sessionId?: string;
  requestId?: string;
  duration?: number;
  memoryUsage?: NodeJS.MemoryUsage;
}

export interface LoggerConfig {
  level: LogLevel;
  service: string;
  logFile?: string;
  maxFileSize?: number;
  maxFiles?: number;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableStructured?: boolean;
}