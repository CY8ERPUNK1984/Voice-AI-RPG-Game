// Backend entry point
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { GameController } from './controllers/gameController';
import { WhisperASR } from './services/WhisperASR';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3001;

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

// Basic health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Voice AI RPG Backend is running' });
});

// API endpoint to get all stories
app.get('/api/stories', async (_req, res) => {
  try {
    const stories = await gameController.getStories();
    res.json(stories);
  } catch (error) {
    console.error('Error fetching stories:', error);
    res.status(500).json({ error: 'Failed to fetch stories' });
  }
});

// API endpoint to get a story by ID
app.get('/api/stories/:id', async (req, res) => {
  try {
    const story = await gameController.getStoryById(req.params.id);
    if (!story) {
      return res.status(404).json({ error: 'Story not found' });
    }
    return res.json(story);
  } catch (error) {
    console.error('Error fetching story:', error);
    return res.status(500).json({ error: 'Failed to fetch story' });
  }
});

// API endpoint for audio transcription using Whisper
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }

    if (!whisperASR.isAvailable()) {
      return res.status(503).json({ error: 'Whisper ASR service is not available' });
    }

    const transcription = await whisperASR.transcribeAudio(req.file.buffer);
    
    return res.json({ 
      transcription,
      confidence: 1.0, // Whisper doesn't provide confidence scores
      processingTime: Date.now() - req.body.startTime || 0
    });
  } catch (error: any) {
    console.error('Error transcribing audio:', error);
    
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
    
    // Validate filename to prevent directory traversal
    if (!/^[a-f0-9-]+\.mp3$/i.test(filename)) {
      return res.status(400).json({ error: 'Invalid filename' });
    }

    const audioPath = gameController.getAudioFilePath(filename);
    
    // Check if file exists
    const fs = require('fs');
    if (!fs.existsSync(audioPath)) {
      return res.status(404).json({ error: 'Audio file not found' });
    }

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    
    // Stream the audio file
    const stream = fs.createReadStream(audioPath);
    stream.pipe(res);
    return;
  } catch (error) {
    console.error('Error serving audio file:', error);
    return res.status(500).json({ error: 'Failed to serve audio file' });
  }
});

// Setup periodic cleanup of old sessions (every hour)
setInterval(() => {
  const cleaned = gameController.cleanupOldSessions(24);
  if (cleaned > 0) {
    console.log(`Cleaned up ${cleaned} old sessions`);
  }
}, 60 * 60 * 1000);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('Game controller initialized with WebSocket server');
});