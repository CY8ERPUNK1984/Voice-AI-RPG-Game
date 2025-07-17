// Core data models for Voice AI RPG Game

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

// Component Props Interfaces
export interface AppState {
  currentStory: Story | null;
  gameSession: GameSession | null;
  isConnected: boolean;
}

export interface StorySelectorProps {
  stories: Story[];
  onStorySelect: (story: Story) => void;
}

export interface ChatInterfaceProps {
  messages: Message[];
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export interface VoiceInputProps {
  onVoiceInput: (text: string) => void;
  isRecording: boolean;
  onRecordingStateChange: (recording: boolean) => void;
}

export interface AudioPlayerProps {
  audioUrl: string;
  autoPlay: boolean;
  onPlaybackComplete: () => void;
}

export interface SettingsPanelProps {
  settings: AudioSettings;
  onSettingsChange: (settings: AudioSettings) => void;
}

// Error handling
export interface ErrorState {
  asrError: string | null;
  llmError: string | null;
  ttsError: string | null;
  connectionError: string | null;
}

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
  'voice-input': (audioBlob: Blob) => void;
  'game-response': (response: GameResponse) => void;
  'error': (error: ErrorResponse) => void;
}

export interface GameResponse {
  message: Message;
  audioUrl?: string;
}

// ASR Service Interface
export interface ASRService {
  transcribeAudio(audioBlob: Blob): Promise<string>;
  isAvailable(): boolean;
  startRecording(): Promise<void>;
  stopRecording(): Promise<string>;
  onResult?: (result: string) => void;
  onError?: (error: Error) => void;
}