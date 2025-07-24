import { config } from 'dotenv';

// Load environment variables
config();

interface EnvConfig {
  // Server Configuration
  NODE_ENV: string;
  PORT: number;
  HOST: string;
  FRONTEND_URL: string;

  // CORS Settings
  CORS_ORIGIN: string;
  CORS_CREDENTIALS: boolean;

  // OpenAI Configuration
  OPENAI_API_KEY?: string;
  OPENAI_MODEL: string;
  OPENAI_TTS_MODEL: string;
  OPENAI_TTS_VOICE: string;
  OPENAI_MAX_TOKENS: number;
  OPENAI_TEMPERATURE: number;

  // Anthropic Configuration
  ANTHROPIC_API_KEY?: string;
  ANTHROPIC_MODEL: string;

  // Audio Configuration
  MAX_AUDIO_FILE_SIZE: number;
  SUPPORTED_AUDIO_FORMATS: string[];
  AUDIO_TEMP_DIR: string;
  AUDIO_CLEANUP_INTERVAL: number;

  // Session Configuration
  SESSION_TIMEOUT: number;
  SESSION_CLEANUP_INTERVAL: number;
  MAX_CONVERSATION_HISTORY: number;
  MAX_CONCURRENT_SESSIONS: number;

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: number;
  RATE_LIMIT_MAX_REQUESTS: number;
  RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: boolean;

  // Logging
  LOG_LEVEL: string;
  LOG_FILE: string;
  LOG_MAX_SIZE: number;
  LOG_MAX_FILES: number;

  // Security
  JWT_SECRET?: string;
  BCRYPT_ROUNDS: number;

  // Performance
  CACHE_TTL: number;
  REQUEST_TIMEOUT: number;
  KEEP_ALIVE_TIMEOUT: number;

  // Development
  ENABLE_DEBUG_LOGS: boolean;
  ENABLE_PERFORMANCE_MONITORING: boolean;
  MOCK_OPENAI_API: boolean;
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

function parseArray(value: string | undefined, defaultValue: string[] = []): string[] {
  if (!value) return defaultValue;
  return value.split(',').map(item => item.trim());
}

function validateRequiredEnvVar(name: string, value: string | undefined): string {
  if (!value || value.trim() === '') {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value.trim();
}

function validateOptionalEnvVar(name: string, value: string | undefined): string | undefined {
  if (!value || value.trim() === '' || value === 'your_' + name.toLowerCase() + '_here') {
    console.warn(`Optional environment variable ${name} is not set`);
    return undefined;
  }
  return value.trim();
}

export function validateEnvironment(): EnvConfig {
  try {
    const config: EnvConfig = {
      // Server Configuration
      NODE_ENV: process.env.NODE_ENV || 'development',
      PORT: parseNumber(process.env.PORT, 3001),
      HOST: process.env.HOST || 'localhost',
      FRONTEND_URL: validateRequiredEnvVar('FRONTEND_URL', process.env.FRONTEND_URL),

      // CORS Settings
      CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',
      CORS_CREDENTIALS: parseBoolean(process.env.CORS_CREDENTIALS, true),

      // OpenAI Configuration
      OPENAI_API_KEY: validateOptionalEnvVar('OPENAI_API_KEY', process.env.OPENAI_API_KEY),
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-4',
      OPENAI_TTS_MODEL: process.env.OPENAI_TTS_MODEL || 'tts-1',
      OPENAI_TTS_VOICE: process.env.OPENAI_TTS_VOICE || 'alloy',
      OPENAI_MAX_TOKENS: parseNumber(process.env.OPENAI_MAX_TOKENS, 2000),
      OPENAI_TEMPERATURE: parseFloat(process.env.OPENAI_TEMPERATURE, 0.7),

      // Anthropic Configuration
      ANTHROPIC_API_KEY: validateOptionalEnvVar('ANTHROPIC_API_KEY', process.env.ANTHROPIC_API_KEY),
      ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL || 'claude-3-sonnet-20240229',

      // Audio Configuration
      MAX_AUDIO_FILE_SIZE: parseNumber(process.env.MAX_AUDIO_FILE_SIZE, 25000000),
      SUPPORTED_AUDIO_FORMATS: parseArray(process.env.SUPPORTED_AUDIO_FORMATS, ['mp3', 'wav', 'ogg', 'webm', 'm4a']),
      AUDIO_TEMP_DIR: process.env.AUDIO_TEMP_DIR || 'temp/audio',
      AUDIO_CLEANUP_INTERVAL: parseNumber(process.env.AUDIO_CLEANUP_INTERVAL, 3600000),

      // Session Configuration
      SESSION_TIMEOUT: parseNumber(process.env.SESSION_TIMEOUT, 3600000),
      SESSION_CLEANUP_INTERVAL: parseNumber(process.env.SESSION_CLEANUP_INTERVAL, 1800000),
      MAX_CONVERSATION_HISTORY: parseNumber(process.env.MAX_CONVERSATION_HISTORY, 50),
      MAX_CONCURRENT_SESSIONS: parseNumber(process.env.MAX_CONCURRENT_SESSIONS, 100),

      // Rate Limiting
      RATE_LIMIT_WINDOW_MS: parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),
      RATE_LIMIT_MAX_REQUESTS: parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100),
      RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS: parseBoolean(process.env.RATE_LIMIT_SKIP_SUCCESSFUL_REQUESTS, false),

      // Logging
      LOG_LEVEL: process.env.LOG_LEVEL || 'info',
      LOG_FILE: process.env.LOG_FILE || 'combined.log',
      LOG_MAX_SIZE: parseNumber(process.env.LOG_MAX_SIZE, 10485760),
      LOG_MAX_FILES: parseNumber(process.env.LOG_MAX_FILES, 5),

      // Security
      JWT_SECRET: validateOptionalEnvVar('JWT_SECRET', process.env.JWT_SECRET),
      BCRYPT_ROUNDS: parseNumber(process.env.BCRYPT_ROUNDS, 12),

      // Performance
      CACHE_TTL: parseNumber(process.env.CACHE_TTL, 300000),
      REQUEST_TIMEOUT: parseNumber(process.env.REQUEST_TIMEOUT, 30000),
      KEEP_ALIVE_TIMEOUT: parseNumber(process.env.KEEP_ALIVE_TIMEOUT, 5000),

      // Development
      ENABLE_DEBUG_LOGS: parseBoolean(process.env.ENABLE_DEBUG_LOGS, false),
      ENABLE_PERFORMANCE_MONITORING: parseBoolean(process.env.ENABLE_PERFORMANCE_MONITORING, false),
      MOCK_OPENAI_API: parseBoolean(process.env.MOCK_OPENAI_API, false),
    };

    // Validate critical configurations
    if (!config.OPENAI_API_KEY && !config.ANTHROPIC_API_KEY && !config.MOCK_OPENAI_API) {
      console.warn('Warning: No AI API keys configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY, or enable MOCK_OPENAI_API for testing.');
    }

    if (config.NODE_ENV === 'production') {
      if (!config.JWT_SECRET) {
        throw new Error('JWT_SECRET is required in production environment');
      }
      if (config.ENABLE_DEBUG_LOGS) {
        console.warn('Warning: Debug logs are enabled in production');
      }
    }

    console.log(`Environment validated successfully for ${config.NODE_ENV} mode`);
    return config;

  } catch (error) {
    console.error('Environment validation failed:', error);
    throw error;
  }
}

export const env = validateEnvironment();