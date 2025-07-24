// Core data models for Voice AI RPG Game

// Utility types for better type safety
export type NonEmptyString = string & { readonly __brand: unique symbol };
export type PositiveNumber = number & { readonly __brand: unique symbol };
export type Timestamp = Date & { readonly __brand: unique symbol };

// Result type for operations that can fail
export type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

// Optional with explicit undefined handling
export type Optional<T> = T | undefined;
export type Nullable<T> = T | null;

// Story interface with enhanced validation
export interface Story {
  readonly id: NonEmptyString;
  readonly title: NonEmptyString;
  readonly description: NonEmptyString;
  readonly genre: 'fantasy' | 'sci-fi' | 'mystery' | 'adventure' | 'horror';
  readonly initialPrompt: NonEmptyString;
  readonly characterContext: NonEmptyString;
  readonly gameRules: readonly NonEmptyString[];
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
}

// Message interface with enhanced metadata and validation
export interface MessageMetadata {
  readonly processingTime?: PositiveNumber;
  readonly confidence?: number; // 0-1 range
  readonly tokens?: PositiveNumber;
  readonly model?: NonEmptyString;
  readonly retryCount?: number;
  readonly errorRecovered?: boolean;
}

export interface Message {
  readonly id: NonEmptyString;
  readonly sessionId: NonEmptyString;
  readonly type: 'user' | 'ai';
  readonly content: NonEmptyString;
  readonly audioUrl?: NonEmptyString;
  readonly metadata: MessageMetadata;
  readonly timestamp: Timestamp;
  readonly status?: 'pending' | 'sent' | 'delivered' | 'failed';
}

// Game session with enhanced state management
export type SessionStatus = 'active' | 'paused' | 'completed' | 'error' | 'terminated';

export interface GameSession {
  readonly id: NonEmptyString;
  readonly storyId: NonEmptyString;
  readonly userId: NonEmptyString;
  readonly status: SessionStatus;
  readonly messages: readonly Message[];
  readonly context: GameContext;
  readonly settings: AudioSettings;
  readonly createdAt: Timestamp;
  readonly updatedAt: Timestamp;
  readonly lastActivity?: Timestamp;
  readonly errorCount?: number;
}

// Enhanced game context with type safety
export interface CharacterState {
  readonly [key: string]: string | number | boolean | null;
}

export interface GameState {
  readonly [key: string]: string | number | boolean | null | readonly (string | number | boolean)[];
}

export interface GameContext {
  readonly story: Story;
  readonly characterState: CharacterState;
  readonly gameState: GameState;
  readonly conversationHistory: readonly NonEmptyString[];
  readonly currentScene?: NonEmptyString;
  readonly availableActions?: readonly NonEmptyString[];
}

// Audio settings with validation constraints
export interface AudioSettings {
  readonly ttsEnabled: boolean;
  readonly ttsVolume: number; // 0-1 range
  readonly asrSensitivity: number; // 0-1 range
  readonly voiceSpeed: number; // 0.5-2.0 range
  readonly preferredVoice?: NonEmptyString;
  readonly noiseReduction?: boolean;
  readonly autoGainControl?: boolean;
}

// Validation helpers for audio settings
export const AudioSettingsConstraints = {
  ttsVolume: { min: 0, max: 1 },
  asrSensitivity: { min: 0, max: 1 },
  voiceSpeed: { min: 0.5, max: 2.0 }
} as const;

// Enhanced component props with strict typing
export interface AppState {
  readonly currentStory: Nullable<Story>;
  readonly gameSession: Nullable<GameSession>;
  readonly isConnected: boolean;
  readonly lastError?: AppError;
  readonly connectionQuality?: 'excellent' | 'good' | 'poor' | 'critical';
}

// Enhanced component props with better error handling
export interface StorySelectorProps {
  readonly stories: readonly Story[];
  readonly onStorySelect: (story: Story) => void;
  readonly isLoading?: boolean;
  readonly error?: AppError;
  readonly onRetry?: () => void;
}

export interface ChatInterfaceProps {
  readonly messages: readonly Message[];
  readonly onSendMessage: (message: NonEmptyString) => Promise<Result<void, AppError>>;
  readonly isLoading: boolean;
  readonly onVoiceInput?: (text: NonEmptyString) => void;
  readonly isRecording?: boolean;
  readonly onRecordingStateChange?: (recording: boolean) => void;
  readonly audioSettings?: AudioSettings;
  readonly error?: AppError;
  readonly onClearError?: () => void;
}

export interface VoiceInputProps {
  readonly onVoiceInput: (text: NonEmptyString) => void;
  readonly isRecording: boolean;
  readonly onRecordingStateChange: (recording: boolean) => void;
  readonly disabled?: boolean;
  readonly error?: AppError;
  readonly onError?: (error: AppError) => void;
}

export interface AudioPlayerProps {
  readonly audioUrl: NonEmptyString;
  readonly autoPlay: boolean;
  readonly onPlaybackComplete: () => void;
  readonly onError?: (error: AppError) => void;
  readonly volume?: number; // 0-1 range
}

export interface SettingsPanelProps {
  readonly settings: AudioSettings;
  readonly onSettingsChange: (settings: AudioSettings) => Promise<Result<void, AppError>>;
  readonly isLoading?: boolean;
  readonly error?: AppError;
}

// Enhanced error handling with strict typing
export type ErrorType = 
  | 'ASR_ERROR' 
  | 'LLM_ERROR' 
  | 'TTS_ERROR' 
  | 'CONNECTION_ERROR' 
  | 'VALIDATION_ERROR' 
  | 'RATE_LIMIT_ERROR' 
  | 'AUTHENTICATION_ERROR' 
  | 'SYSTEM_ERROR'
  | 'NETWORK_ERROR'
  | 'TIMEOUT_ERROR'
  | 'PERMISSION_ERROR';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface ErrorState {
  readonly asrError: Nullable<AppError>;
  readonly llmError: Nullable<AppError>;
  readonly ttsError: Nullable<AppError>;
  readonly connectionError: Nullable<AppError>;
  readonly lastUpdated?: Timestamp;
}

export interface ErrorContext {
  readonly [key: string]: string | number | boolean | null | undefined;
  readonly component?: NonEmptyString;
  readonly action?: NonEmptyString;
  readonly userAgent?: NonEmptyString;
  readonly url?: NonEmptyString;
}

export interface ErrorResponse {
  readonly type: ErrorType;
  readonly message: NonEmptyString;
  readonly details?: ErrorContext;
  readonly timestamp: Timestamp;
  readonly requestId?: NonEmptyString;
  readonly statusCode?: number;
}

export interface AppError {
  readonly id: NonEmptyString;
  readonly type: ErrorType;
  readonly severity: ErrorSeverity;
  readonly message: NonEmptyString;
  readonly originalError?: Error;
  readonly context: ErrorContext;
  readonly timestamp: Timestamp;
  readonly recoverable: boolean;
  readonly retryable: boolean;
  readonly userId?: NonEmptyString;
  readonly sessionId?: NonEmptyString;
  readonly requestId?: NonEmptyString;
  readonly stack?: NonEmptyString;
  readonly retryCount?: number;
  readonly maxRetries?: number;
}

// Enhanced recovery system with type safety
export type RecoveryAction = 
  | 'retry'
  | 'fallback'
  | 'reset'
  | 'reconnect'
  | 'refresh'
  | 'clear_cache'
  | 'user_action_required';

export interface RecoveryStep {
  readonly id: NonEmptyString;
  readonly action: RecoveryAction;
  readonly description: NonEmptyString;
  readonly autoExecute: boolean;
  readonly priority: PositiveNumber;
  readonly estimatedDuration?: PositiveNumber; // in milliseconds
  readonly dependencies?: readonly NonEmptyString[];
  readonly execute: () => Promise<Result<void, AppError>>;
}

export interface RecoveryPlan {
  readonly id: NonEmptyString;
  readonly steps: readonly RecoveryStep[];
  readonly autoExecute: boolean;
  readonly userAction?: NonEmptyString;
  readonly estimatedTime?: PositiveNumber; // in milliseconds
  readonly successRate?: number; // 0-1 range
  readonly createdAt: Timestamp;
}

// Enhanced toast notifications with better typing
export type ToastType = 'error' | 'warning' | 'info' | 'success';

export interface ToastAction {
  readonly id: NonEmptyString;
  readonly label: NonEmptyString;
  readonly action: () => Promise<Result<void, AppError>>;
  readonly primary?: boolean;
  readonly keepToastOpen?: boolean;
  readonly disabled?: boolean;
  readonly loading?: boolean;
}

export interface ToastNotification {
  readonly id: NonEmptyString;
  readonly type: ToastType;
  readonly title: NonEmptyString;
  readonly message: NonEmptyString;
  readonly timestamp: Timestamp;
  readonly duration?: PositiveNumber; // in milliseconds
  readonly actions?: readonly ToastAction[];
  readonly persistent?: boolean;
  readonly priority?: number; // higher number = higher priority
  readonly relatedError?: AppError;
}

// Enhanced WebSocket events with type safety
export interface SocketEventData {
  readonly 'join-game': {
    readonly storyId: NonEmptyString;
    readonly userId: NonEmptyString;
    readonly settings?: AudioSettings;
  };
  readonly 'send-message': {
    readonly message: NonEmptyString;
    readonly sessionId: NonEmptyString;
    readonly metadata?: MessageMetadata;
  };
  readonly 'voice-input': {
    readonly audioBlob: Blob;
    readonly sessionId: NonEmptyString;
    readonly settings?: AudioSettings;
  };
  readonly 'game-response': GameResponse;
  readonly 'error': ErrorResponse;
  readonly 'session-created': {
    readonly sessionId: NonEmptyString;
    readonly storyId: NonEmptyString;
    readonly context: GameContext;
  };
  readonly 'session-updated': {
    readonly sessionId: NonEmptyString;
    readonly updates: Partial<GameSession>;
  };
}

export type SocketEventName = keyof SocketEventData;

export interface SocketEvents {
  readonly [K in SocketEventName]: (data: SocketEventData[K]) => void;
}

export interface GameResponse {
  readonly message: Message;
  readonly audioUrl?: NonEmptyString;
  readonly sessionId: NonEmptyString;
  readonly context?: Partial<GameContext>;
}

// Enhanced service interfaces with better error handling
export interface TranscriptionResult {
  readonly text: NonEmptyString;
  readonly confidence: number; // 0-1 range
  readonly alternatives?: readonly NonEmptyString[];
  readonly processingTime: PositiveNumber;
  readonly method: 'webspeech' | 'whisper' | 'hybrid';
}

export interface ASRService {
  readonly transcribeAudio: (audioBlob: Blob) => Promise<Result<TranscriptionResult, AppError>>;
  readonly isAvailable: () => boolean;
  readonly startRecording: () => Promise<Result<void, AppError>>;
  readonly stopRecording: () => Promise<Result<TranscriptionResult, AppError>>;
  readonly onResult?: (result: TranscriptionResult) => void;
  readonly onError?: (error: AppError) => void;
  readonly getCapabilities: () => ASRCapabilities;
}

export interface ASRCapabilities {
  readonly supportsContinuous: boolean;
  readonly supportsInterim: boolean;
  readonly supportedLanguages: readonly string[];
  readonly maxAudioDuration?: PositiveNumber; // in milliseconds
  readonly supportedFormats: readonly string[];
}

export interface TTSOptions {
  readonly voice?: NonEmptyString;
  readonly speed?: number; // 0.5-2.0 range
  readonly pitch?: number; // 0-2 range
  readonly volume?: number; // 0-1 range
  readonly language?: NonEmptyString;
}

export interface SynthesisResult {
  readonly audioUrl: NonEmptyString;
  readonly duration: PositiveNumber; // in milliseconds
  readonly format: NonEmptyString;
  readonly size: PositiveNumber; // in bytes
}

export interface TTSService {
  readonly synthesizeSpeech: (text: NonEmptyString, options?: TTSOptions) => Promise<Result<SynthesisResult, AppError>>;
  readonly isAvailable: () => boolean;
  readonly getAvailableVoices: () => Promise<Result<readonly SpeechSynthesisVoice[], AppError>>;
  readonly stop: () => void;
  readonly getCapabilities: () => TTSCapabilities;
}

export interface TTSCapabilities {
  readonly supportsSSML: boolean;
  readonly supportedVoices: readonly string[];
  readonly supportedLanguages: readonly string[];
  readonly maxTextLength?: PositiveNumber;
  readonly supportedFormats: readonly string[];
}

// Service health monitoring
export interface ServiceHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy' | 'unknown';
  readonly lastCheck: Timestamp;
  readonly responseTime?: PositiveNumber; // in milliseconds
  readonly errorRate?: number; // 0-1 range
  readonly availability?: number; // 0-1 range
  readonly details?: ErrorContext;
}

// Generic service interface
export interface Service {
  readonly name: NonEmptyString;
  readonly version: NonEmptyString;
  readonly isAvailable: () => boolean;
  readonly getHealth: () => Promise<ServiceHealth>;
  readonly initialize: () => Promise<Result<void, AppError>>;
  readonly cleanup: () => Promise<Result<void, AppError>>;
}
//
 Type guards for runtime type checking
export function isNonEmptyString(value: unknown): value is NonEmptyString {
  return typeof value === 'string' && value.length > 0;
}

export function isPositiveNumber(value: unknown): value is PositiveNumber {
  return typeof value === 'number' && value > 0 && !isNaN(value) && isFinite(value);
}

export function isValidTimestamp(value: unknown): value is Timestamp {
  return value instanceof Date && !isNaN(value.getTime());
}

export function isValidErrorType(value: unknown): value is ErrorType {
  const validTypes: ErrorType[] = [
    'ASR_ERROR', 'LLM_ERROR', 'TTS_ERROR', 'CONNECTION_ERROR',
    'VALIDATION_ERROR', 'RATE_LIMIT_ERROR', 'AUTHENTICATION_ERROR',
    'SYSTEM_ERROR', 'NETWORK_ERROR', 'TIMEOUT_ERROR', 'PERMISSION_ERROR'
  ];
  return typeof value === 'string' && validTypes.includes(value as ErrorType);
}

export function isValidErrorSeverity(value: unknown): value is ErrorSeverity {
  const validSeverities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical'];
  return typeof value === 'string' && validSeverities.includes(value as ErrorSeverity);
}

export function isValidSessionStatus(value: unknown): value is SessionStatus {
  const validStatuses: SessionStatus[] = ['active', 'paused', 'completed', 'error', 'terminated'];
  return typeof value === 'string' && validStatuses.includes(value as SessionStatus);
}

export function isValidToastType(value: unknown): value is ToastType {
  const validTypes: ToastType[] = ['error', 'warning', 'info', 'success'];
  return typeof value === 'string' && validTypes.includes(value as ToastType);
}

// Validation utilities
export const ValidationUtils = {
  audioSettings: {
    isValidVolume: (value: number): boolean => value >= 0 && value <= 1,
    isValidSensitivity: (value: number): boolean => value >= 0 && value <= 1,
    isValidSpeed: (value: number): boolean => value >= 0.5 && value <= 2.0,
  },
  
  message: {
    isValidContent: (content: string): boolean => content.trim().length > 0,
    isValidMetadata: (metadata: unknown): metadata is MessageMetadata => {
      if (typeof metadata !== 'object' || metadata === null) return false;
      const meta = metadata as Record<string, unknown>;
      
      if (meta.processingTime !== undefined && !isPositiveNumber(meta.processingTime)) return false;
      if (meta.confidence !== undefined && (typeof meta.confidence !== 'number' || meta.confidence < 0 || meta.confidence > 1)) return false;
      if (meta.tokens !== undefined && !isPositiveNumber(meta.tokens)) return false;
      if (meta.model !== undefined && !isNonEmptyString(meta.model)) return false;
      
      return true;
    },
  },
  
  error: {
    isRecoverable: (error: AppError): boolean => error.recoverable && error.severity !== 'critical',
    isRetryable: (error: AppError): boolean => error.retryable && (error.retryCount ?? 0) < (error.maxRetries ?? 3),
    shouldAutoRecover: (error: AppError): boolean => error.recoverable && error.severity === 'low',
  },
} as const;

// Factory functions for creating type-safe objects
export const TypeFactory = {
  createNonEmptyString: (value: string): NonEmptyString => {
    if (!isNonEmptyString(value)) {
      throw new Error(`Invalid non-empty string: "${value}"`);
    }
    return value;
  },
  
  createPositiveNumber: (value: number): PositiveNumber => {
    if (!isPositiveNumber(value)) {
      throw new Error(`Invalid positive number: ${value}`);
    }
    return value;
  },
  
  createTimestamp: (value?: Date): Timestamp => {
    const date = value ?? new Date();
    if (!isValidTimestamp(date)) {
      throw new Error(`Invalid timestamp: ${date}`);
    }
    return date;
  },
  
  createAppError: (params: {
    type: ErrorType;
    severity: ErrorSeverity;
    message: string;
    context?: ErrorContext;
    recoverable?: boolean;
    retryable?: boolean;
    originalError?: Error;
  }): AppError => {
    return {
      id: TypeFactory.createNonEmptyString(crypto.randomUUID()),
      type: params.type,
      severity: params.severity,
      message: TypeFactory.createNonEmptyString(params.message),
      context: params.context ?? {},
      timestamp: TypeFactory.createTimestamp(),
      recoverable: params.recoverable ?? false,
      retryable: params.retryable ?? false,
      originalError: params.originalError,
      stack: params.originalError?.stack ? TypeFactory.createNonEmptyString(params.originalError.stack) : undefined,
      retryCount: 0,
      maxRetries: 3,
    };
  },
} as const;