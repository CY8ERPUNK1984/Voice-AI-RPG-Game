// Backend entry point
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameController } from './controllers/gameController';
import { monitoringController } from './controllers/monitoringController';
import { WhisperASR } from './services/WhisperASR';
import { createLogger, getLogger, LogLevel } from './services/Logger';
import { createPerformanceMonitor } from './services/PerformanceMonitor';
import { createHealthCheckService } from './services/HealthCheckService';
import { validateEnvironment } from './utils/envValidation';

// Initialize environment validation
const env = validateEnvironment();

// Initialize structured logger
const logger = createLogger({
  level: env.LOG_LEVEL as LogLevel,
  service: 'voice-ai-rpg-backend',
  logFile: env.LOG_FILE,
  maxFileSize: env.LOG_MAX_SIZE,
  maxFiles: env.LOG_MAX_FILES,
  enableConsole: true,
  enableFile: true,
  enableStructured: true
});

logger.info('Starting Voice AI RPG Backend', {
  nodeVersion: process.version,
  environment: process.env.NODE_ENV || 'development',
  logLevel: env.LOG_LEVEL,
  logFile: env.LOG_FILE
}, 'startup');

// Initialize monitoring services
const performanceMonitor = createPerformanceMonitor();
const healthCheckService = createHealthCheckService({
  interval: 30000, // 30 seconds
  timeout: 5000,   // 5 seconds
  retries: 3,
  enabled: true
});

logger.info('Monitoring services initialized', {}, 'startup');

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

// Request logging middleware
app.use((req, res, next) => {
  const startTime = Date.now();
  const requestId = require('uuid').v4();
  
  // Set request ID for logging context
  logger.setRequestId(requestId);
  
  // Add request ID to response headers for debugging
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  logger.info(`${req.method} ${req.url}`, {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
    requestId
  }, 'http');
  
  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    logger.logRequest(req.method, req.url, res.statusCode, duration, {
      requestId,
      responseSize: res.get('Content-Length') || 0
    });
    
    // Clear request context
    logger.clearRequestId();
    
    return originalEnd(chunk, encoding);
  };
  
  next();
});

// Middleware
app.use(cors());
app.use(express.json());

// Configure multer for audio file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB limit for Whisper API
  },
  fileFilter: (_req, file, cb) => {
    // Accept audio files
    if (file.mimetype.startsWith('audio/')) {
      cb(null, true);
    } else {
      cb(new Error('Only audio files are allowed'));
    }
  }
});

// Initialize Whisper ASR service
const whisperASR = new WhisperASR();

// Initialize game controller with Socket.IO server
const gameController = new GameController(io);

// Monitoring and health check endpoints
app.get('/api/health', monitoringController.getHealth.bind(monitoringController));
app.get('/api/health/ready', monitoringController.getReadiness.bind(monitoringController));
app.get('/api/health/live', monitoringController.getLiveness.bind(monitoringController));
app.get('/api/health/:serviceName', monitoringController.getServiceHealth.bind(monitoringController));
app.post('/api/health/:serviceName/check', monitoringController.runHealthCheck.bind(monitoringController));

// Metrics endpoints
app.get('/api/monitoring/metrics', monitoringController.getMetrics.bind(monitoringController));
app.get('/api/monitoring/metrics/:serviceName', monitoringController.getServiceMetrics.bind(monitoringController));
app.get('/api/monitoring/dashboard', monitoringController.getDashboardData.bind(monitoringController));

// Alert endpoints
app.get('/api/monitoring/alerts', monitoringController.getAlerts.bind(monitoringController));
app.get('/api/monitoring/alerts/rules', monitoringController.getAlertRules.bind(monitoringController));
app.post('/api/monitoring/alerts/rules', monitoringController.addAlertRule.bind(monitoringController));
app.delete('/api/monitoring/alerts/rules/:ruleId', monitoringController.removeAlertRule.bind(monitoringController));

// Logs endpoint for debugging (development only)
app.get('/api/logs', async (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    logger.warn('Logs endpoint accessed in production', {}, 'security');
    return res.status(403).json({ error: 'Logs endpoint not available in production' });
  }
  
  try {
    const query = req.query.q as string || '';
    const level = req.query.level as LogLevel;
    const limit = parseInt(req.query.limit as string) || 100;
    
    logger.debug('Logs search requested', { query, level, limit }, 'logs');
    
    const logs = await logger.searchLogs(query, level, limit);
    return res.json({
      logs,
      total: logs.length,
      query,
      level,
      limit
    });
  } catch (error) {
    logger.error('Error searching logs', error as Error, {}, 'logs');
    return res.status(500).json({ error: 'Failed to search logs' });
  }
});

// Server metrics endpoint for monitoring
app.get('/api/metrics', (_req, res) => {
  try {
    const metrics = gameController.getServerMetrics();
    const activeSessions = gameController.getActiveSessions();
    const activeConnections = gameController.getActiveConnections();
    const loggerStats = logger.getStats();
    
    const metricsData = {
      server: metrics,
      sessions: {
        active: activeSessions.length,
        total: activeSessions.length
      },
      connections: {
        active: activeConnections.length,
        details: activeConnections.map(conn => ({
          socketId: conn.socketId,
          userId: conn.userId,
          sessionId: conn.sessionId,
          connectedAt: conn.connectedAt,
          lastActivity: conn.lastActivity,
          reconnectCount: conn.reconnectCount,
          isHealthy: conn.isHealthy
        }))
      },
      logging: {
        bufferSize: loggerStats.bufferSize,
        memoryUsage: loggerStats.memoryUsage
      },
      timestamp: new Date().toISOString()
    };
    
    logger.debug('Metrics requested', { 
      activeSessions: activeSessions.length,
      activeConnections: activeConnections.length 
    }, 'metrics');
    
    res.json(metricsData);
  } catch (error) {
    logger.error('Error fetching metrics', error as Error, {}, 'metrics');
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// API endpoint to get all stories
app.get('/api/stories', async (_req, res) => {
  try {
    logger.debug('Fetching all stories', {}, 'stories');
    const stories = await gameController.getStories();
    logger.info('Stories fetched successfully', { count: stories.length }, 'stories');
    res.json(stories);
  } catch (error) {
    logger.error('Error fetching stories', error as Error, {}, 'stories');
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// API endpoint to get a story by ID
app.get('/api/stories/:id', async (req, res) => {
  try {
    const storyId = req.params.id;
    logger.debug('Fetching story by ID', { storyId }, 'stories');
    
    const story = await gameController.getStoryById(storyId);
    if (!story) {
      logger.warn('Story not found', { storyId }, 'stories');
      return res.status(404).json({ error: 'Story not found' });
    }
    
    logger.info('Story fetched successfully', { storyId, title: story.title }, 'stories');
    return res.json(story);
  } catch (error) {
    logger.error('Error fetching story', error as Error, { storyId: req.params.id }, 'stories');
    return res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// API endpoint for audio transcription using Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    if (!req.file) {
      logger.warn('Transcription request without audio file', {}, 'transcription');
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!whisperASR.isAvailable()) {
      logger.error('Whisper ASR service not available', undefined, {}, 'transcription');
      return res.status(503).json({ error: 'Whisper ASR service is not available' });
    }

    logger.info('Starting audio transcription', {
      fileSize: req.file.size,
      mimeType: req.file.mimetype
    }, 'transcription');

    const transcription = await whisperASR.transcribeAudio(req.file.buffer);
    const processingTime = Date.now() - startTime;
    
    logger.info('Audio transcription completed', {
      transcriptionLength: transcription.length,
      processingTime,
      fileSize: req.file.size
    }, 'transcription');
    
    return res.json({ 
      transcription,
      confidence: 1.0, // Whisper doesn't provide confidence scores
      processingTime
    });
  } catch (error: any) {
    const processingTime = Date.now() - startTime;
    logger.error('Error transcribing audio', error, {
      processingTime,
      fileSize: req.file?.size
    }, 'transcription');
    
    // Try to parse error response if it's a formatted error
    let errorResponse;
    try {
      errorResponse = JSON.parse(error.message);
    } catch {
      errorResponse = {
        type: 'ASR_ERROR',
        message: error.message || 'Failed to transcribe audio',
        timestamp: new Date()
      };
    }
    
    return res.status(500).json({ error: errorResponse.message, details: errorResponse });
  }
});

// API endpoint to serve TTS audio files
app.get('/api/audio/:filename', (req, res) => {
  try {
    const filename = req.params.filename;
    
    logger.debug('Audio file requested', { filename }, 'audio');
    
    // Validate filename to prevent directory traversal
    if (!/^[a-f0-9-]+\.mp3$/i.test(filename)) {
      logger.warn('Invalid audio filename requested', { filename }, 'audio');
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const audioPath = gameController.getAudioFilePath(filename);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(audioPath)) {
      logger.warn('Audio file not found', { filename, audioPath }, 'audio');
      return res.status(404).json({ error: 'Audio file not found' });
    }

    logger.info('Serving audio file', { filename, audioPath }, 'audio');

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream the audio file
    const stream = fs.createReadStream(audioPath);
    stream.pipe(res);
    return;
  } catch (error) {
    logger.error('Error serving audio file', error as Error, { filename: req.params.filename }, 'audio');
    return res.status(500).json({ error: 'Failed to serve audio file' });
  }
});

// Setup periodic cleanup of old sessions (every hour)
setInterval(() => {
  try {
    const cleaned = gameController.cleanupOldSessions(24);
    if (cleaned > 0) {
      logger.info('Cleaned up old sessions', { cleanedCount: cleaned }, 'cleanup');
    }
    
    // Also cleanup old log files
    logger.cleanup().catch(error => {
      logger.warn('Failed to cleanup log files', { error }, 'cleanup');
    });
  } catch (error) {
    logger.error('Error during periodic cleanup', error as Error, {}, 'cleanup');
  }
}, 60 * 60 * 1000);

// Setup graceful shutdown
const gracefulShutdown = async () => {
  logger.info('Received shutdown signal, starting graceful shutdown...', {}, 'shutdown');
  
  try {
    // Shutdown WebSocket server first
    await gameController.shutdownServer();
    logger.info('WebSocket server shutdown completed', {}, 'shutdown');
    
    // Close HTTP server
    server.close(() => {
      logger.info('HTTP server closed', {}, 'shutdown');
      process.exit(0);
    });
    
    // Force exit after 10 seconds if graceful shutdown fails
    setTimeout(() => {
      logger.fatal('Forced shutdown after timeout', undefined, {}, 'shutdown');
      process.exit(1);
    }, 10000);
  } catch (error) {
    logger.fatal('Error during graceful shutdown', error as Error, {}, 'shutdown');
    process.exit(1);
  }
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

server.listen(PORT, () => {
  logger.info('Server started successfully', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    uptime: process.uptime()
  }, 'startup');
  
  logger.info('Game controller initialized with WebSocket server', {}, 'startup');
  logger.info('Graceful shutdown handlers registered', {}, 'startup');
});