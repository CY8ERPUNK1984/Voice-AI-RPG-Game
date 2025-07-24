interface EnvConfig {
  // API Configuration
  API_BASE_URL: string;
  SOCKET_URL: string;
  API_TIMEOUT: number;

  // Feature Flags
  ENABLE_VOICE_INPUT: boolean;
  ENABLE_TTS: boolean;
  ENABLE_ASR_FALLBACK: boolean;
  ENABLE_DEBUG_MODE: boolean;
  ENABLE_PERFORMANCE_MONITORING: boolean;

  // Audio Settings
  DEFAULT_TTS_VOLUME: number;
  DEFAULT_ASR_SENSITIVITY: number;
  DEFAULT_VOICE_SPEED: number;
  MAX_RECORDING_DURATION: number;
  AUDIO_SAMPLE_RATE: number;

  // UI Configuration
  APP_TITLE: string;
  APP_VERSION: string;
  MAX_MESSAGE_LENGTH: number;
  TYPING_INDICATOR_DELAY: number;
  CONNECTION_RETRY_ATTEMPTS: number;
  CONNECTION_RETRY_DELAY: number;

  // Error Handling
  ENABLE_ERROR_REPORTING: boolean;
  ERROR_DISPLAY_DURATION: number;

  // Performance Settings
  ENABLE_LAZY_LOADING: boolean;
  CACHE_DURATION: number;

  // Development Settings
  SHOW_REDUX_DEVTOOLS: boolean;
  ENABLE_HOT_RELOAD: boolean;
  MOCK_API_RESPONSES: boolean;
}

function parseBoolean(value: string | undefined, defaultValue: boolean = false): boolean {
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
}

function parseNumber(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

function parseFloat(value: string | undefined, defaultValue: number): number {
  if (!value) return defaultValue;
  const parsed = Number.parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

function validateRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    console.error(`Required environment variable VITE_${name} is not set`);
    // In development, provide sensible defaults
    if (import.meta.env.DEV) {
      switch (name) {
        case 'API_BASE_URL':
          return 'http://localhost:3001';
        case 'SOCKET_URL':
          return 'http://localhost:3001';
        case 'APP_TITLE':
          return 'Voice AI RPG Game';
        case 'APP_VERSION':
          return '1.0.0';
        default:
          throw new Error(`Required environment variable VITE_${name} is not set and no default available`);
      }
    }
    throw new Error(`Required environment variable VITE_${name} is not set`);
  }
  return value.trim();
}

export function validateEnvironment(): EnvConfig {
  try {
    const config: EnvConfig = {
      // API Configuration
      API_BASE_URL: validateRequiredEnvVar('API_BASE_URL', import.meta.env.VITE_API_BASE_URL),
      SOCKET_URL: validateRequiredEnvVar('SOCKET_URL', import.meta.env.VITE_SOCKET_URL),
      API_TIMEOUT: parseNumber(import.meta.env.VITE_API_TIMEOUT, 30000),

      // Feature Flags
      ENABLE_VOICE_INPUT: parseBoolean(import.meta.env.VITE_ENABLE_VOICE_INPUT, true),
      ENABLE_TTS: parseBoolean(import.meta.env.VITE_ENABLE_TTS, true),
      ENABLE_ASR_FALLBACK: parseBoolean(import.meta.env.VITE_ENABLE_ASR_FALLBACK, true),
      ENABLE_DEBUG_MODE: parseBoolean(import.meta.env.VITE_ENABLE_DEBUG_MODE, false),
      ENABLE_PERFORMANCE_MONITORING: parseBoolean(import.meta.env.VITE_ENABLE_PERFORMANCE_MONITORING, false),

      // Audio Settings
      DEFAULT_TTS_VOLUME: parseFloat(import.meta.env.VITE_DEFAULT_TTS_VOLUME, 0.8),
      DEFAULT_ASR_SENSITIVITY: parseFloat(import.meta.env.VITE_DEFAULT_ASR_SENSITIVITY, 0.5),
      DEFAULT_VOICE_SPEED: parseFloat(import.meta.env.VITE_DEFAULT_VOICE_SPEED, 1.0),
      MAX_RECORDING_DURATION: parseNumber(import.meta.env.VITE_MAX_RECORDING_DURATION, 60000),
      AUDIO_SAMPLE_RATE: parseNumber(import.meta.env.VITE_AUDIO_SAMPLE_RATE, 16000),

      // UI Configuration
      APP_TITLE: validateRequiredEnvVar('APP_TITLE', import.meta.env.VITE_APP_TITLE),
      APP_VERSION: validateRequiredEnvVar('APP_VERSION', import.meta.env.VITE_APP_VERSION),
      MAX_MESSAGE_LENGTH: parseNumber(import.meta.env.VITE_MAX_MESSAGE_LENGTH, 1000),
      TYPING_INDICATOR_DELAY: parseNumber(import.meta.env.VITE_TYPING_INDICATOR_DELAY, 500),
      CONNECTION_RETRY_ATTEMPTS: parseNumber(import.meta.env.VITE_CONNECTION_RETRY_ATTEMPTS, 5),
      CONNECTION_RETRY_DELAY: parseNumber(import.meta.env.VITE_CONNECTION_RETRY_DELAY, 1000),

      // Error Handling
      ENABLE_ERROR_REPORTING: parseBoolean(import.meta.env.VITE_ENABLE_ERROR_REPORTING, true),
      ERROR_DISPLAY_DURATION: parseNumber(import.meta.env.VITE_ERROR_DISPLAY_DURATION, 5000),

      // Performance Settings
      ENABLE_LAZY_LOADING: parseBoolean(import.meta.env.VITE_ENABLE_LAZY_LOADING, true),
      CACHE_DURATION: parseNumber(import.meta.env.VITE_CACHE_DURATION, 300000),

      // Development Settings
      SHOW_REDUX_DEVTOOLS: parseBoolean(import.meta.env.VITE_SHOW_REDUX_DEVTOOLS, import.meta.env.DEV),
      ENABLE_HOT_RELOAD: parseBoolean(import.meta.env.VITE_ENABLE_HOT_RELOAD, import.meta.env.DEV),
      MOCK_API_RESPONSES: parseBoolean(import.meta.env.VITE_MOCK_API_RESPONSES, false),
    };

    // Validate configuration
    if (config.DEFAULT_TTS_VOLUME < 0 || config.DEFAULT_TTS_VOLUME > 1) {
      console.warn('TTS volume should be between 0 and 1, using default 0.8');
      config.DEFAULT_TTS_VOLUME = 0.8;
    }

    if (config.DEFAULT_ASR_SENSITIVITY < 0 || config.DEFAULT_ASR_SENSITIVITY > 1) {
      console.warn('ASR sensitivity should be between 0 and 1, using default 0.5');
      config.DEFAULT_ASR_SENSITIVITY = 0.5;
    }

    if (config.DEFAULT_VOICE_SPEED < 0.1 || config.DEFAULT_VOICE_SPEED > 3) {
      console.warn('Voice speed should be between 0.1 and 3, using default 1.0');
      config.DEFAULT_VOICE_SPEED = 1.0;
    }

    if (import.meta.env.PROD && config.ENABLE_DEBUG_MODE) {
      console.warn('Warning: Debug mode is enabled in production');
    }

    if (import.meta.env.DEV) {
      console.log('Environment validated successfully for development mode');
      console.log('Configuration:', {
        API_BASE_URL: config.API_BASE_URL,
        SOCKET_URL: config.SOCKET_URL,
        ENABLE_VOICE_INPUT: config.ENABLE_VOICE_INPUT,
        ENABLE_TTS: config.ENABLE_TTS,
        ENABLE_DEBUG_MODE: config.ENABLE_DEBUG_MODE,
      });
    }

    return config;

  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
}

export const env = validateEnvironment();